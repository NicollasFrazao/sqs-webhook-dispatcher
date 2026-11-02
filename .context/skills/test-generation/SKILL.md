---
type: skill
name: Test Generation
description: Add tests for a new outcome, setting, stack change or bug fix in this repository. Use when writing or extending tests
skillSlug: test-generation
phases: [E, V]
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Test generation

1. Find the layer: HTTP classification → `test/delivery.test.ts`; what happens to the message →
   `test/dispatcher.test.ts`; settings → `test/config.test.ts`; AWS commands → `test/aws.test.ts`;
   CloudFormation → `test/stack.test.ts`.
2. Reuse the helpers in the file (`respond`, `deps`, `setup`, `record`, `fakeClient`); do not mock
   the AWS SDK modules.
3. Write the test first for a bug and watch it fail.
4. Cover the failure path, not only the happy one: a rejected `delay` or `deadLetter`, a missing
   variable, a malformed header.
5. Run `npm run test:coverage` and keep all four metrics at or above 80%.

The details and conventions are in [agents/test-writer.md](../../agents/test-writer.md) and
[testing-strategy.md](../../docs/testing-strategy.md).
