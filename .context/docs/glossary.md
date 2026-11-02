---
type: doc
name: glossary
description: Domain vocabulary and the only abbreviations allowed in names
category: glossary
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Glossary

| Term | Meaning |
| --- | --- |
| **Job** | One webhook to deliver: the JSON body of a message on the delivery queue (`WebhookJob`). |
| **Delivery** | The job's journey from enqueue to delivered or given up; identified by `deliveryId`, stable across retries. |
| **Attempt** | One POST to the receiver. Number 1 is the first; it equals the message's `ApproximateReceiveCount`. |
| **Outcome** | What one attempt produced: `delivered`, `retry` or `rejected` (`DeliveryOutcome`). |
| **Receiver** | The customer's endpoint that gets the POST. |
| **Sender** | The application that enqueues jobs. |
| **Retry** | Holding a message back for a delay (visibility timeout) and reporting it as a batch item failure, so SQS hands it back. |
| **Backoff policy** | `baseSeconds` (ceiling of the first delay) and `maxSeconds` (largest ceiling). |
| **Full jitter** | The delay is uniformly random between 0 and the ceiling. |
| **Give up** | Send the message to the dead-letter queue with a reason and remove it from the delivery queue. |
| **Dead-letter queue (DLQ)** | The queue that holds given-up messages for inspection; it has an alarm. |
| **Partial batch failure** | Lambda's `batchItemFailures` response: only the listed records stay on the queue. |
| **Visibility timeout** | How long SQS hides a received message; changed per message to space retries. |
| **Redrive policy** | The queue's own move to the DLQ after `maxReceiveCount` receives; a safety net here. |
| **Signing secret** | The HMAC key in Secrets Manager shared with receivers. |
| **Tolerance** | How old a signature `verify` still accepts (300 s by default). |

## Abbreviations allowed in names

`id`, `url`, `http`, `sqs`, `dlq` (prose only), `arn`, `hmac`, `ms` (milliseconds, as a suffix),
`env` (only in `CDK` code where AWS uses it). Everything else is spelled out.
