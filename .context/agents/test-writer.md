---
type: agent
name: Test Writer
description: Unit tests with fakes for the domain, dispatcher and adapters, and CDK template assertions
agentType: test-writer
phases: [E, V]
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Test writer

Read [testing-strategy.md](../docs/testing-strategy.md) first.

## Domain (`test/backoff.test.ts`, `test/signature.test.ts`, `test/delivery.test.ts`)

- Inject `random` and `nowSeconds`; never rely on the clock.
- For `deliver`, use `respond(status, headers)` (a `vi.fn<typeof fetch>()` resolving to a
  `Response`) and assert both the outcome and the request; check the signature with `verify`.

## Dispatcher (`test/dispatcher.test.ts`)

- `setup(status | Error, overrides)` returns `queue` (the `delay` and `deadLetter` mocks), `fetch`
  and `run(...records)`. Build records with `record(body, attempt, id)`.
- For each guarantee, cover the failure path with an override: `delay` or `deadLetter` rejecting.
- Assert on the `batchItemFailures` returned, not only on the calls: that list is what keeps or
  deletes the message.

## Adapters (`test/aws.test.ts`, `test/config.test.ts`)

- `fakeClient(output)` gives a `send` mock; assert the command class and its `input`.
- `loadSettings` takes a plain object, so no `process.env` mutation.

## Stack (`test/stack.test.ts`)

- One module-level `Template` built with bundling disabled; `hasResourceProperties` with `Match`
  for what matters, `findResources` when counting.

## Done means

The test fails when the behaviour it covers is removed (try it), the gate is green, and coverage
stays at or above 80% on all four metrics.
