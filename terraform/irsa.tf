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

# Menor privilégio: consome a própria fila, lê a profundidade da própria DLQ, publica no
# próprio tópico e envia e-mail pelo SES. Nada mais.
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

  # E-mail ao cliente com NOTIFICADOR=ses. As identidades (remetente e, no sandbox, os
  # destinatários) são verificadas uma vez fora do Terraform: o destroy de cada ensaio as
  # apagaria e exigiria reverificar. O SendEmail da API v2 só exige ses:SendEmail.
  statement {
    actions   = ["ses:SendEmail"]
    resources = ["arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/*"]
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "app" {
  name   = "mensageria"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}
