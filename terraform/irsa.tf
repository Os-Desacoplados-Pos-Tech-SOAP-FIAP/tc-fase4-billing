# Role IRSA do pod: só a ServiceAccount billing/billing assume.
locals {
  oidc_issuer = replace(local.infra.oidc_provider_arn, "/^.*oidc-provider\\//", "")
}

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.infra.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer}:sub"
      values   = [local.service_account]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = local.nome
  assume_role_policy = data.aws_iam_policy_document.trust.json
}

# Menor privilégio: consome a própria fila, lê a profundidade da própria DLQ e publica no
# próprio tópico. Nada mais.
data "aws_iam_policy_document" "app" {
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.inbox.arn]
  }

  # Só leitura da profundidade da DLQ, para a métrica dlq_mensagens.
  statement {
    actions   = ["sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.dlq.arn]
  }

  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.events.arn]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "mensageria"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}
