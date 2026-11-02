---
type: doc
name: development-workflow
description: Setup, day-to-day commands and step-by-step recipes
category: workflow
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Development workflow

## Setup

```bash
nvm use 22    # or any Node.js >= 22
npm ci        # dependencies + husky hooks (prepare)
```

No AWS credentials are needed for anything but `npm run deploy`.

## Day to day

| Task | Command |
| --- | --- |
| Run all tests | `npm test` (`npm run test:watch` while editing) |
| Only the unit or tooling project | `npm run test:unit`, `npm run test:tooling` |
| Coverage with the 80% gate | `npm run test:coverage` (report in `coverage/`) |
| Lint, fixing what is mechanical | `npx eslint . --fix`, then `npm run lint` |
| Build the bundle and template | `npm run synth` (output in `cdk.out/`) |
| Deploy to the current AWS account | `npm run deploy` |
| Regenerate the agent surfaces | `npm run export:context` |

The full gate, in order, is in [development-conventions.md](development-conventions.md).

## Recipes

### Classify a new receiver answer

1. Change `deliver` in `src/domain/delivery.ts` (and the named status constants beside it).
2. Add a case in `test/delivery.test.ts`; if it changes what happens to the message, also in
   `test/dispatcher.test.ts`.
3. Update the outcome table in the README.

### Add a setting

1. Add the field to `DispatcherConfig` (or `Settings`) and read it in `loadSettings`
   (`src/adapters/config.ts`) with a named default.
2. Test the default and the override in `test/config.test.ts`.
3. If the stack should set it, add it to `environment` in `infra/stack.ts` and assert it in
   `test/stack.test.ts`. Document it in the README's configuration table.

### Change the infrastructure

1. Edit `infra/stack.ts`; name every number.
2. Assert the resulting CloudFormation in `test/stack.test.ts` (`Template.hasResourceProperties`).
3. `npm run synth`, and check `cdk diff` against a deployed stack before `npm run deploy`. Watch for
   replacements of the queues or the secret: the secret is retained, the queues are not.

### Deploy

```bash
npm run synth
npx cdk diff
npm run deploy
```

The outputs are the queue URL (for senders), the dead-letter queue URL and the secret ARN (share the
secret value with receivers out of band).
