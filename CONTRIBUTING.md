# Contributing

Thanks for taking the time. This project is small on purpose; the bar is that no message is ever
lost, that a retry only happens when it can succeed, and code a reviewer can read in one sitting.

The full rules are in [`.context/docs/development-conventions.md`](.context/docs/development-conventions.md).
This page is the short version.

## Setup

```bash
npm ci    # installs dependencies and the git hooks
```

No AWS account is needed to develop: the tests fake the queue, the receiver and the secret, and
`npm run synth` builds the template offline. Deploying needs credentials (see the README).

## Branches

Branch from `master`, named by the kind of change:

| Prefix | For |
| --- | --- |
| `feat/` | a new capability |
| `fix/` | a defect |
| `docs/` | documentation only |
| `refactor/` | a structural change with no behaviour change |
| `chore/` | maintenance, dependencies |
| `test/` | tests only |
| `ci/` | workflows |

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), checked by commitlint in the
`commit-msg` hook and, in CI, on every commit of a pull request:

```
fix(dispatcher): keep the message when the dead-letter send fails

The message was acknowledged before the send to the dead-letter queue
resolved, so a throttled send lost it. It is now reported as a batch
item failure and comes back on the main queue.

Closes #12
```

**The commit type is the version**: `feat` → minor; `fix`, `perf`, `refactor` → patch; `!` after the
type or a `BREAKING CHANGE:` footer → major; `docs`, `test`, `build`, `ci`, `chore`, `style` → no
release. Use `!` only when a sender or a receiver integration breaks (the job format, the headers,
the signature).

## Before pushing: the local gate

Run these one at a time:

```bash
npm run lint                # ESLint, any warning fails
npm run typecheck
npm run check:architecture  # layer rules
npm run check:unused        # unused files, exports, dependencies
npm run test:coverage       # all tests, 80% coverage on all four metrics
npm run synth               # bundles the function and synthesizes the template
npm run check:context       # agent surfaces in sync with .context/docs/README.md
```

They are the CI jobs. If they pass locally, CI passes.

## Pull requests

- Small, one concern each. A refactor and a behaviour change are two pull requests.
- Fill in the template. Verification states **results** ("95/95 tests, coverage 99/91/96/99"),
  not "tested".
- Link the issue with an English closing keyword: `Closes #12`. Other words do not link.
- A change to the retry, dead-letter or signing path needs a test that fails without the change.

## Language

Code, comments, docs, commits, issues and pull requests are in English.

## Repository settings (maintainers)

On GitHub:

- **Branch ruleset on `master`**: require a pull request; require the status checks `lint`,
  `typecheck`, `architecture`, `unused`, `test`, `synth`, `audit`, `context`, `commitlint` and
  `CodeQL`; block force pushes; require linear history.
- **Code security**: enable secret scanning, push protection, Dependabot alerts and private
  vulnerability reporting (used by [SECURITY.md](SECURITY.md)).
