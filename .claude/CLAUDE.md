# sqs-webhook-dispatcher: context index

The knowledge base of this repository, for people and for coding agents. Start with the project
overview, then open the guide the task needs.

## Mandatory for anyone editing this repository

**Before editing any file, read [`development-conventions.md`](/.context/docs/development-conventions.md).**
It is the normative file: the quality gate to run before every commit, the layer rules, the
delivery guarantees you must not break, the documentation and readability rules the lint enforces,
commits and branches, and the language everything is written in. Its rules are commands, not
background reading.

Two more readings, each with the moment it applies:

- **before changing how a record is retried, dead-lettered or acknowledged** —
  [`architecture.md`](/.context/docs/architecture.md), sections "Guarantees" and "Why retries use the
  visibility timeout";
- **before changing the request a receiver gets (headers, body, signature)** —
  [`security.md`](/.context/docs/security.md), section "Signature scheme", because receivers already
  verify it.

> **This file is the source of the agent surfaces.** `AGENTS.md`, `.claude/CLAUDE.md` and
> `.github/copilot-instructions.md` are byte-for-byte copies of `.context/docs/README.md`, written by
> `npm run export:context` and verified by `npm run check:context` (a CI job). Edit this file, never
> a copy. The rules themselves are not copied into the surfaces: they live in
> `development-conventions.md`, one hop away, so there is a single place to change them.

## Guides

| Guide | What it answers |
| --- | --- |
| [Project overview](/.context/docs/project-overview.md) | What the dispatcher does, for whom, and what it deliberately does not do |
| [Architecture](/.context/docs/architecture.md) | Modules and their import rules, guarantees, retries, the CDK stack |
| [Development conventions](/.context/docs/development-conventions.md) | **Normative.** Quality gate, code rules, commits, branches, PRs, language |
| [Development workflow](/.context/docs/development-workflow.md) | Setup, day-to-day commands, recipes (new outcome, new setting, deploy) |
| [Testing strategy](/.context/docs/testing-strategy.md) | Test files, fakes instead of AWS mocks, CDK template assertions, coverage |
| [Data flow](/.context/docs/data-flow.md) | A job from `SendMessage` to the receiver, the retry loop and the dead-letter queue |
| [Glossary](/.context/docs/glossary.md) | Domain vocabulary and the only abbreviations allowed in names |
| [Security](/.context/docs/security.md) | Signature scheme, IAM, secrets, known gaps, how to report a vulnerability |
| [Tooling](/.context/docs/tooling.md) | Every npm script, hook and CI job, and what each one catches |
| [Technical debt](/.context/docs/tech-debt.md) | Known gaps, with the reason they are still open |
| [Decision records](/.context/docs/adr/README.md) | Why the visibility timeout, why dead-letter from code, why full jitter |

## Agents and skills

Playbooks tailored to this repository, for agents that support them:

- [`agents/code-reviewer.md`](/.context/agents/code-reviewer.md), [`agents/devops-specialist.md`](/.context/agents/devops-specialist.md), [`agents/test-writer.md`](/.context/agents/test-writer.md)
- [`skills/code-review`](/.context/skills/code-review/SKILL.md), [`skills/commit-message`](/.context/skills/commit-message/SKILL.md), [`skills/test-generation`](/.context/skills/test-generation/SKILL.md)

## Repository map

- `src/domain/` — backoff, signature, job parsing and one delivery attempt; no AWS, Node built-ins only
- `src/dispatcher.ts` — one SQS batch: retry with backoff, dead-letter, partial batch failures
- `src/adapters/` — the SQS queue port, the cached signing secret, settings from the environment
- `src/handler.ts` — Lambda entry point and composition root
- `infra/` — CDK app and stack: queues, function, secret, log group, alarm
- `test/` — Vitest unit tests and CDK template assertions
- `eslint-rules/` — local readability rules, with RuleTester tests
- `scripts/` — `check-context-surfaces.mjs` (export and check of the agent surfaces)
- `.github/` — CI, CodeQL, Dependabot, PR and issue templates, CODEOWNERS
