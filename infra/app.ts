import { App, type Environment } from 'aws-cdk-lib';

import { WebhookDispatcherStack } from './stack.js';

const app = new App();

// Deploys to the account and region of the current AWS credentials.
const env: Environment = {
  ...(process.env.CDK_DEFAULT_ACCOUNT && { account: process.env.CDK_DEFAULT_ACCOUNT }),
  ...(process.env.CDK_DEFAULT_REGION && { region: process.env.CDK_DEFAULT_REGION }),
};

new WebhookDispatcherStack(app, 'WebhookDispatcher', { env });
