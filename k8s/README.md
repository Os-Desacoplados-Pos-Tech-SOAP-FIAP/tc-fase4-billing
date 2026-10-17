# Kubernetes (Kustomize)

Manifests do Billing no EKS. Aplicados pelo CD (`.github/workflows/cd.yml`), não à mão.

```
k8s/base/
├── kustomization.yaml   # namespace billing + imagem parametrizada (billing -> <ecr>:<sha>)
├── namespace.yaml       # namespace billing
├── serviceaccount.yaml  # SA billing com a role IRSA (${IRSA_ROLE_ARN})
├── deployment.yaml      # initContainer prisma-migrate + app na porta 3000
├── service.yaml         # ClusterIP 80 -> 3000
└── ingress.yaml         # ALB interno compartilhado, /api/billing (${ALB_SG_ID})
```

Fora do Git, criados pelo CD a cada deploy:

- **ConfigMap `billing-config`**: `NODE_ENV`, `PORT`, `AWS_REGION`, `MESSAGING_ENABLED`,
  `OTEL_SERVICE_NAME`, `PAYMENT_PROVIDER` (variável de repositório, padrão `fake`),
  `INBOX_QUEUE_URL`, `EVENTS_TOPIC_ARN`, `PUBLIC_BASE_URL`, `MP_NOTIFICATION_URL` (outputs
  do Terraform) e `OTEL_EXPORTER_OTLP_ENDPOINT` quando o Alloy está instalado.
- **Secret `billing-secret`**: `DATABASE_URL` e `JWT_SECRET`, lidos do Secrets Manager; com
  `PAYMENT_PROVIDER=mercadopago`, também `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`.

`AWS_ENDPOINT_URL` nunca é definida no EKS: o SDK usa o endpoint padrão e as
credenciais da role IRSA.

`replicas: 1` de propósito: no modo `fake` os pagamentos simulados vivem na memória do
processo e a simulação precisa cair na mesma réplica que gerou a cobrança.

## Validar (sem cluster)

```bash
kubectl kustomize k8s/base
```

`${IRSA_ROLE_ARN}` e `${ALB_SG_ID}` aparecem literais na saída; o CD os substitui com
`envsubst` antes do `kubectl apply`.
