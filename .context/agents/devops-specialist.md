---
type: agent
name: DevOps Specialist
description: Change the CDK stack, IAM, queues, alarms, CI jobs and deployment safely
agentType: devops-specialist
phases: [E, C]
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# DevOps specialist

## The stack

`infra/stack.ts` (`WebhookDispatcherStack`) is the only infrastructure. Read
[architecture.md](../docs/architecture.md), "The stack", before changing it.

- Keep the invariants: delivery-queue visibility ≥ 6 × function timeout; `maxReceiveCount =
  maxAttempts + REDRIVE_MARGIN`; `reportBatchItemFailures: true`; `maxConcurrency` set.
- Name every number as a constant at the top of the file.
- Permissions only through grants (`grantConsumeMessages`, `grantSendMessages`, `grantRead`).
- Both queues keep `QueueEncryption.SQS_MANAGED` (`sonarjs/aws-sqs-unencrypted-queue` fails otherwise).
- The signing secret is `RemovalPolicy.RETAIN`. Changing its logical id replaces it, and every
  receiver's verification breaks.
- Assert each change in `test/stack.test.ts`, then `npm run synth` and `npx cdk diff`.

## CI

`.github/workflows/ci.yml` has one job per check: `lint`, `typecheck`, `architecture`, `unused`,
`test`, `synth`, `audit`, `context`, `commitlint`; `codeql.yml` has `CodeQL`. Renaming or adding a
job means updating the branch ruleset on `master` in the same change, or the PR stays blocked on a
check that never reports.

## Deploying

`npm run deploy` deploys to the account and region of the current credentials
(`CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`). Review `cdk diff` for replacements first.
