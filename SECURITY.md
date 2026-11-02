# Security policy

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub's
[private vulnerability reporting](https://github.com/NicollasFrazao/sqs-webhook-dispatcher/security/advisories/new)
with:

- what an attacker can do (for example: forge a signature a receiver accepts, replay a webhook past
  the tolerance, make the dispatcher call a non-`https` URL, read the signing key);
- the job, the request or the test that reproduces it;
- the commit you tested.

You can expect an acknowledgement within a week. Fixes are released on `master` and credited in the
advisory unless you prefer otherwise.

## Supported versions

Only the latest commit on `master` is supported.

## Scope

In scope: the signature scheme and `verify`, the job validation, the IAM permissions and resources the
stack creates, and anything that makes a message disappear without being delivered or dead-lettered.

Known and out of scope: whoever can send to the delivery queue can make the dispatcher POST to any
`https` URL — the queue's IAM policy is the access control, and the README says so. Server-side
request forgery towards private addresses is listed in
[`.context/docs/security.md`](.context/docs/security.md) as a known gap.
