---
type: doc
name: development-conventions
description: Normative conventions — quality gate, layer rules, delivery guarantees, documentation and readability, commits, branches, PRs, language
category: workflow
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Development conventions

What is mandatory when changing this repository. Setup and step-by-step recipes are in
[development-workflow.md](development-workflow.md); this file holds only what must hold without
anything prompting it, written as commands.

## Quality gate

**Before every commit, run the gate, one command at a time:**

```bash
npm run lint                # ESLint, --max-warnings 0
npm run typecheck           # tsc --noEmit, strict
npm run check:architecture  # dependency-cruiser layer rules
npm run check:unused        # knip: unused files, exports, types, dependencies
npm run test:coverage       # unit + tooling, 80% on all four metrics
npm run synth               # esbuild bundle + CloudFormation template
npm run check:context       # agent surfaces are copies of .context/docs/README.md
```

These are exactly the CI jobs (`lint`, `typecheck`, `architecture`, `unused`, `test`, `synth`,
`context`, plus `audit` and `commitlint`), one job per command, every one meant to be a required
check on `master`. A green local gate means a green CI.

- Run them **one at a time**. `lint`, `typecheck` and `synth` each take a few hundred MB; running
  them in parallel on a small machine is how it runs out of memory.
- The `pre-commit` hook runs ESLint on the staged files only, and `commit-msg` runs commitlint. They
  are a fast first filter, not the gate.
- A rule is fixed in the code, never silenced. A targeted `eslint-disable-next-line <rule>` is
  allowed only with a comment on the same line saying why the rule does not apply there. No
  file-level or blanket disables. The same holds for knip and dependency-cruiser exceptions: each
  one carries its reason next to it (see `knip.jsonc` and `.dependency-cruiser.cjs`).
- Coverage stays at or above 80% on statements, branches, functions and lines. A drop is fixed with
  tests, never by lowering `COVERAGE_THRESHOLD` in `vitest.config.ts` or widening `exclude`.

## Layer rules

Enforced by `npm run check:architecture`. See [architecture.md](architecture.md) for the reasoning.

- `src/domain/` imports nothing outside `src/domain/` except Node built-ins.
- `src/dispatcher.ts` imports only `src/domain/` and type-only `aws-lambda`. It reaches SQS through
  `QueuePort` and the secret through a function; it never imports the AWS SDK.
- `src/adapters/` wraps the AWS SDK and the environment. `src/handler.ts` is the only module that
  reads `process.env` and constructs clients; nothing imports it.
- `src/` and `infra/` never import each other. No cycles. No orphan module.

## Guarantees you must not break

The list is in [architecture.md](architecture.md), "Guarantees". In short: a record leaves the
queue only when delivered or parked; a failed park keeps it; a failed delay still retries; records
are independent; a failed secret read is not cached. A change that touches `createDispatcher`
states in the PR what happens to a record at each failure point.

- Classify a new HTTP status in `deliver`, nowhere else, and add its row to the README's outcome
  table.
- The request a receiver gets (headers, body shape, signature format) is a public contract. Changing
  it is a `!` commit and needs a new `v` scheme in the signature header, not a change to `v1`.
- Retry delays are whole seconds within `SQS_MAX_VISIBILITY_SECONDS`.

## Documentation in code (TSDoc)

Enforced by `eslint-plugin-jsdoc` and the local `jsdoc-tag-spacing` rule.

- **Every exported symbol has a doc comment**: classes, functions, interfaces, type aliases and
  exported constants. One summary sentence saying what it does for the caller; `@remarks` for the why.
- `@param` and `@returns` only when they add something the type does not say. When a function
  documents one parameter it documents all of them (`jsdoc/check-param-names`).
- `@throws {@link ErrorClass} when ...` for every error a caller must handle. A function with a
  `throw` statement and no `@throws` fails the lint.
- Tag order: `@remarks`, `@typeParam`, `@param`, `@returns`, `@throws`, `@example`, `@see`. Exactly
  one blank line between kinds, one after the summary.
- Comments explain **why**, not what. No commented-out code, no `TODO` / `FIXME`: deferred work is
  an issue, listed in [tech-debt.md](tech-debt.md).

## Readability rules

Enforced by ESLint, at error level:

- Cognitive complexity at most **15** per function (`sonarjs/cognitive-complexity`); nesting at most
  **3** (`max-depth`); at most **4** parameters (`@typescript-eslint/max-params`) — beyond that, take
  an object with a named interface, as `createDispatcher(deps)` does.
- One statement per line. With more than one item, every parameter, argument, property and array
  element goes on its own line (`local/one-per-line`). A condition with `&&` / `||` puts each clause
  on its own line, operator leading (`local/multiline-if-condition`). Control-block bodies are never
  inline (`curly: all`).
- Blank lines around multi-line blocks and statements, and before `return`, `throw` and control
  statements.
- No magic numbers in `src/` and `infra/`: name them (`HTTP_TOO_MANY_REQUESTS`,
  `VISIBILITY_TIMEOUT_FACTOR`). Tests are exempt.
- No unused code: variables, imports, arguments, private members, dead stores (`sonarjs`,
  `@typescript-eslint/no-unused-vars`) and no unused file, export or dependency (`knip`).
- No string literal duplicated three times or more in `src/` (`sonarjs/no-duplicate-string`).

## Naming

- Domain vocabulary from [glossary.md](glossary.md): `job`, `delivery`, `attempt`, `outcome`,
  `retry`, `give up`, `dead-letter`, `receiver`.
- No abbreviations except those in the glossary. `id-length` rejects one-letter names.
- Booleans read as predicates (`hasJobFields`); units are in the name (`delaySeconds`, `timeoutMs`).

## Language

Everything is in English: identifiers, comments, log messages, error messages, documentation,
commit messages, PR and issue text.

## Branches, commits and pull requests

- `master` is the default branch and is never pushed to directly. Branch prefixes: `feat/`, `fix/`,
  `docs/`, `refactor/`, `chore/`, `test/`, `ci/`.
- Commits follow **Conventional Commits** (`type(scope): description`), checked by commitlint in the
  `commit-msg` hook and, for every commit of a pull request, in CI.
- **The commit type is the version.** `feat` → minor; `fix`, `perf`, `refactor` → patch; a `!` after
  the type or a `BREAKING CHANGE:` footer → major; `docs`, `test`, `build`, `ci`, `chore`, `style` →
  no release.
- Small pull requests, one concern each. The PR template asks for the what and why, the issue, the
  verification **as results** ("95/95 tests"), and the risks.
- Link the issue with an English closing keyword (`Closes #12`); anything else does not link.

## Context base

`.context/docs/` is the source. `AGENTS.md`, `.claude/CLAUDE.md` and
`.github/copilot-instructions.md` are copies of `.context/docs/README.md` written by
`npm run export:context`; edit the source and re-export. Never generate the surfaces with the
dotcontext `exportDocs`, `exportContext` or `reverseSync` tools: they write targets this repository
does not control and re-import generated files as sources.
