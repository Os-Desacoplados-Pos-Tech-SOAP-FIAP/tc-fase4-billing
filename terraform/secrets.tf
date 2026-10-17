# Credenciais do Mercado Pago: o Terraform cria só o "contêiner" do segredo, SEM
# aws_secretsmanager_secret_version. O valor é gravado à mão pelo usuário com
# `aws secretsmanager put-secret-value` (README, seção "Deploy no EKS") e nunca passa
# pelo state nem pelo Git. O CD só lê estes segredos com PAYMENT_PROVIDER=mercadopago.
#
# recovery_window_in_days = 0: o destroy apaga na hora e o próximo apply recria o nome
# (vazio de novo; o valor precisa ser gravado outra vez a cada ensaio).
resource "aws_secretsmanager_secret" "mp_access_token" {
  name                    = "oficina-fase4/${local.servico}/MP_ACCESS_TOKEN"
  description             = "Access token do Mercado Pago (gravado manualmente, fora do Terraform)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret" "mp_webhook_secret" {
  name                    = "oficina-fase4/${local.servico}/MP_WEBHOOK_SECRET"
  description             = "Assinatura secreta do webhook do Mercado Pago (gravada manualmente, fora do Terraform)"
  recovery_window_in_days = 0
}
