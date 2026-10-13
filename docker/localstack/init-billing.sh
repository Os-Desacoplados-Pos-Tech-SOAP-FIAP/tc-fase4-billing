#!/bin/bash
# Cria a topologia FIFO do Billing no LocalStack (mesmos nomes da AWS).
set -euo pipefail
R=us-east-1

DLQ_URL=$(awslocal sqs create-queue --region $R --queue-name oficina-billing-inbox-dlq.fifo \
  --attributes FifoQueue=true --query QueueUrl --output text)
DLQ_ARN=$(awslocal sqs get-queue-attributes --region $R --queue-url "$DLQ_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text)

awslocal sqs create-queue --region $R --queue-name oficina-billing-inbox.fifo \
  --attributes "{\"FifoQueue\":\"true\",\"VisibilityTimeout\":\"30\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}"

awslocal sns create-topic --region $R --name oficina-billing-events.fifo \
  --attributes FifoTopic=true,ContentBasedDeduplication=false

# Fila de inspeção: assina o tópico do Billing para vermos os eventos publicados em dev.
SPY_URL=$(awslocal sqs create-queue --region $R --queue-name oficina-billing-events-spy.fifo \
  --attributes FifoQueue=true --query QueueUrl --output text)
SPY_ARN=$(awslocal sqs get-queue-attributes --region $R --queue-url "$SPY_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text)
awslocal sns subscribe --region $R \
  --topic-arn arn:aws:sns:$R:000000000000:oficina-billing-events.fifo \
  --protocol sqs --notification-endpoint "$SPY_ARN" --attributes RawMessageDelivery=true

echo "billing: topologia SNS/SQS criada"
