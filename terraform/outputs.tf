# --- Recursos do serviço (lidos pelo CD e, via remote state, pelo OS) ---

output "namespace" {
  description = "Namespace do serviço no EKS."
  value       = local.servico
}

output "inbox_queue_url" {
  description = "URL da fila de entrada (INBOX_QUEUE_URL; o OS envia comandos para ela)."
  value       = aws_sqs_queue.inbox.url
}

output "inbox_queue_arn" {
  description = "ARN da fila de entrada (permissão de SendMessage na role do OS)."
  value       = aws_sqs_queue.inbox.arn
}

output "dlq_url" {
  description = "URL da DLQ da fila de entrada (verificação do smoke)."
  value       = aws_sqs_queue.dlq.url
}

output "events_topic_arn" {
  description = "ARN do tópico de eventos (EVENTS_TOPIC_ARN; o OS assina este tópico)."
  value       = aws_sns_topic.events.arn
}

output "irsa_role_arn" {
  description = "Role IRSA do pod (anotação eks.amazonaws.com/role-arn da ServiceAccount)."
  value       = aws_iam_role.app.arn
}

output "database_url_secret_name" {
  description = "Nome do segredo DATABASE_URL no Secrets Manager."
  value       = aws_secretsmanager_secret.database_url.name
}

# --- Repassados da infra, para o CD ler tudo de um único state ---

output "ecr_repository_url" {
  description = "Repositório ECR do serviço."
  value       = local.infra.ecr_repository_urls[local.servico]
}

output "alb_security_group_id" {
  description = "SG do ALB interno (anotação alb.ingress.kubernetes.io/security-groups)."
  value       = local.infra.alb_security_group_id
}

output "jwt_secret_name" {
  description = "Nome do segredo JWT_SECRET compartilhado no Secrets Manager."
  value       = local.infra.jwt_secret_name
}

output "public_base_url" {
  description = "Base pública dos links enviados ao cliente (PUBLIC_BASE_URL)."
  value       = local.infra.public_base_url
}

output "mercadopago_webhook_url" {
  description = "URL de notificação do Mercado Pago (MP_NOTIFICATION_URL)."
  value       = local.infra.mercadopago_webhook_url
}

# --- Segredos do Mercado Pago (sem valor no Terraform; lidos pelo CD só no modo mercadopago) ---

output "mp_access_token_secret_name" {
  description = "Nome do segredo MP_ACCESS_TOKEN no Secrets Manager."
  value       = aws_secretsmanager_secret.mp_access_token.name
}

output "mp_webhook_secret_secret_name" {
  description = "Nome do segredo MP_WEBHOOK_SECRET no Secrets Manager."
  value       = aws_secretsmanager_secret.mp_webhook_secret.name
}
