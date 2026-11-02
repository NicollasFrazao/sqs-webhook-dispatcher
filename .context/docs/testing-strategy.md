---
type: doc
name: testing-strategy
description: Test files, fakes instead of AWS mocks, CDK template assertions and the coverage gate
category: testing
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Testing strategy

Vitest, two projects (`vitest.config.ts`):

| Project | Files | What it covers |
| --- | --- | --- |
| `unit` | `test/**/*.test.ts` | domain, dispatcher, adapters, CDK stack |
| `tooling` | `eslint-rules/**/*.test.mjs`, `scripts/**/*.test.mjs` | local ESLint rules (RuleTester), the context surfaces script |

Everything runs offline in a few seconds: no AWS account, no LocalStack, no network.

## By layer

- **Domain** (`backoff`, `signature`, `delivery`): pure functions with injected randomness and
  clock. `deliver` gets a `vi.fn<typeof fetch>()` that resolves to a `Response`; assert on the
  outcome and on the request (headers, body, a signature `verify` accepts).
- **Dispatcher** (`test/dispatcher.test.ts`): `setup(status, overrides)` builds a dispatcher with a
  fake `QueuePort`, a fake `fetch`, `random: () => 0.5` and a silent log. Each guarantee in
  [architecture.md](architecture.md) has a test, including the failure paths (`delay` and
  `deadLetter` rejecting).
- **Adapters** (`test/aws.test.ts`, `test/config.test.ts`): a fake client whose `send` records the
  command; assert on the command class and its `input`. No `aws-sdk-client-mock`: the adapters only
  build commands.
- **Stack** (`test/stack.test.ts`): `Template.fromStack` with bundling disabled through the
  `aws:cdk:bundling-stacks` context, asserting on the CloudFormation that matters (event source
  mapping, redrive, environment, alarm, IAM, encryption).

## Coverage

`npm run test:coverage` enforces **80%** on statements, branches, functions and lines over `src/`
and `infra/`. Excluded, with the reason in `vitest.config.ts`: the two entry points
(`src/handler.ts`, `infra/app.ts`), which only wire tested parts; the `synth` job is their check.

Measured on 2026-11-01: statements 99.3%, branches 91.8%, functions 96.3%, lines 99.3%.

## Rules

- Arrange, act, assert, with a blank line between them. Names describe behaviour ("dead-letters
  after the last attempt"), not methods.
- No real timers or sleeps: inject `nowSeconds` and `random`.
- A test for a bug fails without the fix (try it before committing).
- Magic numbers and repeated strings are allowed in tests; they are the readable form of a case.
