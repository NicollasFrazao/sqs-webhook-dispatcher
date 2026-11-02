# Agent playbooks

Playbooks tailored to this repository. The generic ones the scaffold offers were removed: a
playbook that says nothing specific to this code is noise an agent has to read past.

| Agent | Use it for |
| --- | --- |
| [Code reviewer](./code-reviewer.md) | Reviewing a diff against the delivery guarantees, the layer rules and the gate |
| [DevOps specialist](./devops-specialist.md) | The CDK stack, IAM, queues, alarms, CI and deployment |
| [Test writer](./test-writer.md) | Unit tests with fakes, failure paths, CDK template assertions |

Every playbook assumes the reader has read [`development-conventions.md`](../docs/development-conventions.md).
