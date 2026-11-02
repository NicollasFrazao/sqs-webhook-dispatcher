---
type: doc
name: tooling
description: Every npm script, hook and CI job, and what each one catches
category: tooling
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Tooling

## npm scripts

| Script | What it runs | Catches |
| --- | --- | --- |
| `lint` | `eslint . --max-warnings 0` | type-aware errors, sonarjs bugs and smells, unused code, complexity, missing TSDoc, layout |
| `typecheck` | `tsc --noEmit` | type errors, strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `check:architecture` | `depcruise src infra test` | layer violations, cycles, orphans, unresolvable imports, devDependencies in `src/` |
| `check:unused` | `knip` | unused files, exports, types and dependencies |
| `test` / `test:coverage` | Vitest, all projects (with the 80% gate) | behaviour |
| `test:unit`, `test:tooling`, `test:watch` | one Vitest project / watch mode | — |
| `synth` | `cdk synth --quiet` | bundling errors, invalid stack |
| `deploy` | `cdk deploy` | — |
| `check:context` / `export:context` | `scripts/check-context-surfaces.mjs` | agent surfaces drifting from `.context/docs/README.md` |

## ESLint (`eslint.config.js`)

- `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked`.
- `eslint-plugin-sonarjs` `recommended` at error, plus rules it leaves off:
  `cognitive-complexity` (15), `no-unused-function-argument`, `no-duplicate-string` (threshold 3),
  `no-collapsible-if`, `prefer-immediate-return`, `no-commented-code`, `no-inconsistent-returns`,
  `no-variable-usage-before-declaration`. From `recommended`: `no-unused-vars`, `unused-import`,
  `no-dead-store`, `no-identical-functions`, `no-redundant-jump`, `todo-tag`, `fixme-tag` and the
  AWS CDK security rules (`aws-sqs-unencrypted-queue` and friends).
- `eslint-plugin-jsdoc` (`recommended-typescript-error`, `require-jsdoc` on exports,
  `require-throws`, tag order, one blank line after the summary).
- `@stylistic`: indentation, quotes, semicolons, trailing commas, line length 120, one statement
  per line, blank lines around multi-line blocks.
- Local rules in `eslint-rules/`, each with RuleTester tests: `one-per-line`,
  `multiline-if-condition`, `block-multiline`, `jsdoc-tag-spacing`.
- Core: `max-depth` 3, `@typescript-eslint/max-params` 4, `id-length` 2, `curly`, `eqeqeq`,
  `@typescript-eslint/no-magic-numbers` (off in tests).

## knip (`knip.jsonc`)

Entries: `src/handler.ts`, `infra/app.ts`, `scripts/*.mjs`. `tsx` and `esbuild` are ignored as
dependencies with the reason in the file: the CDK CLI runs them, nothing imports them.

## Git hooks (husky)

- `pre-commit`: `lint-staged` — `eslint --max-warnings 0` on staged `.ts`, `.js`, `.mjs`, `.cjs`,
  and `npm run check:context` when a context file or surface is staged.
- `commit-msg`: `commitlint` with `@commitlint/config-conventional`.

## CI (`.github/workflows/ci.yml`)

One job per check: `lint`, `typecheck`, `architecture`, `unused`, `test` (coverage, report uploaded
as an artifact), `synth`, `audit` (`npm audit --omit=dev --audit-level=high`), `context`, and
`commitlint` (pull requests only, every commit of the PR). CodeQL runs in `codeql.yml` (job
`CodeQL`); Dependabot opens weekly updates for npm (grouped: AWS SDK, CDK, lint, test) and GitHub
Actions.
