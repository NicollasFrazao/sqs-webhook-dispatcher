import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';

import { WebhookDispatcherStack } from '../infra/stack.js';

// Skips esbuild bundling: these tests are about the infrastructure, not the bundle.
const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });

const template = Template.fromStack(new WebhookDispatcherStack(
  app,
  'Test',
  { maxAttempts: 5 },
));

describe('WebhookDispatcherStack', () => {
  it('reports partial batch failures from the SQS event source', () => {
    template.hasResourceProperties(
      'AWS::Lambda::EventSourceMapping',
      {
        FunctionResponseTypes: ['ReportBatchItemFailures'],
        ScalingConfig: { MaximumConcurrency: 10 },
      },
    );
  });

  it('redrives to the dead-letter queue as a safety net after the retry budget', () => {
    template.hasResourceProperties(
      'AWS::SQS::Queue',
      {
        RedrivePolicy: Match.objectLike({ maxReceiveCount: 7 }),
        VisibilityTimeout: 180,
      },
    );
  });

  it('runs the dispatcher on Node.js 22 / arm64 with the queue URLs and secret', () => {
    template.hasResourceProperties(
      'AWS::Lambda::Function',
      {
        Runtime: 'nodejs22.x',
        Architectures: ['arm64'],
        Environment: {
          Variables: Match.objectLike({
            QUEUE_URL: Match.anyValue(),
            DEAD_LETTER_QUEUE_URL: Match.anyValue(),
            SIGNING_SECRET_ARN: Match.anyValue(),
            MAX_ATTEMPTS: '5',
          }),
        },
      },
    );
  });

  it('alarms as soon as anything lands in the dead-letter queue', () => {
    template.hasResourceProperties(
      'AWS::CloudWatch::Alarm',
      {
        MetricName: 'ApproximateNumberOfMessagesVisible',
        Threshold: 1,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      },
    );
  });

  it('lets the function change visibility and send to the dead-letter queue', () => {
    const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('sqs:ChangeMessageVisibility');
    expect(policies).toContain('sqs:SendMessage');
    expect(policies).toContain('secretsmanager:GetSecretValue');
  });

});
