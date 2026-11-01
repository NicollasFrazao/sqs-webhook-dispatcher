import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export interface WebhookDispatcherStackProps extends StackProps {
  /** Attempts before a delivery goes to the dead-letter queue. */
  readonly maxAttempts?: number;
}

export class WebhookDispatcherStack extends Stack {
  constructor(scope: Construct, id: string, props: WebhookDispatcherStackProps = {}) {
    super(scope, id, props);

    const maxAttempts = props.maxAttempts ?? 8;
    const functionTimeout = Duration.seconds(30);

    const deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      retentionPeriod: Duration.days(14),
    });

    const queue = new Queue(this, 'DeliveryQueue', {
      // AWS recommends at least six times the function timeout for SQS event sources.
      visibilityTimeout: Duration.seconds(functionTimeout.toSeconds() * 6),
      retentionPeriod: Duration.days(4),
      // Safety net only: the function dead-letters on its own, with a reason. This catches
      // messages that keep crashing the function before it can decide.
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: maxAttempts + 2 },
    });

    const signingSecret = new Secret(this, 'SigningSecret', {
      description: 'HMAC key used to sign outgoing webhooks',
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const logGroup = new LogGroup(this, 'DispatcherLogs', {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const dispatcher = new NodejsFunction(this, 'Dispatcher', {
      entry: fileURLToPath(new URL('../src/handler.ts', import.meta.url)),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: functionTimeout,
      logGroup,
      environment: {
        QUEUE_URL: queue.queueUrl,
        DEAD_LETTER_QUEUE_URL: deadLetterQueue.queueUrl,
        SIGNING_SECRET_ARN: signingSecret.secretArn,
        MAX_ATTEMPTS: String(maxAttempts),
      },
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true },
    });

    dispatcher.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(1),
        reportBatchItemFailures: true,
        // Caps how hard a backlog can hit receivers after an outage.
        maxConcurrency: 10,
      }),
    );

    queue.grantConsumeMessages(dispatcher);
    deadLetterQueue.grantSendMessages(dispatcher);
    signingSecret.grantRead(dispatcher);

    new Alarm(this, 'DeadLettersAlarm', {
      alarmDescription: 'Webhooks were given up and are waiting in the dead-letter queue',
      metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    new CfnOutput(this, 'QueueUrl', { value: queue.queueUrl });
    new CfnOutput(this, 'DeadLetterQueueUrl', { value: deadLetterQueue.queueUrl });
    new CfnOutput(this, 'SigningSecretArn', { value: signingSecret.secretArn });
  }
}
