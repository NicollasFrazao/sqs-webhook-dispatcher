import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SQSClient } from '@aws-sdk/client-sqs';

import { cachedSigningSecret, createSqsQueue } from './adapters/aws.js';
import { loadSettings } from './adapters/config.js';
import { createDispatcher } from './dispatcher.js';

// Composition root: the only module that reads `process.env` and creates AWS clients.
// Everything it wires is tested on its own; `npm run synth` bundles it.

const settings = loadSettings(process.env);

/** Lambda entry point for the SQS event source of the delivery queue. */
export const handler = createDispatcher({
  config: settings.dispatcher,
  fetch: globalThis.fetch,
  signingSecret: cachedSigningSecret(
    new SecretsManagerClient({}),
    settings.signingSecretArn,
  ),
  queue: createSqsQueue(
    new SQSClient({}),
    settings,
  ),
});
