import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

const DEFAULT_MAX_ATTEMPTS = 8;
const FUNCTION_TIMEOUT_SECONDS = 30;
/** AWS recommends a visibility timeout of at least six times the function timeout for SQS event sources. */
const VISIBILITY_TIMEOUT_FACTOR = 6;
/** The dead-letter safety net fires this many receives after the function's own retry budget. */
const REDRIVE_MARGIN = 2;
const DEAD_LETTER_RETENTION_DAYS = 14;
const DELIVERY_RETENTION_DAYS = 4;
const ALARM_PERIOD_MINUTES = 5;

/** Options of {@link WebhookDispatcherStack}. */
export interface WebhookDispatcherStackProps extends StackProps {
  /** Attempts before a delivery goes to the dead-letter queue. */
  readonly maxAttempts?: number;
}

/**
 * The whole dispatcher: delivery queue, dead-letter queue, function, signing secret and alarm.
 *
 * @remarks
 * Both queues use SQS-managed server-side encryption (SSE-SQS), stated explicitly so the template
 * says what the account default would otherwise decide.
 */
export class WebhookDispatcherStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: WebhookDispatcherStackProps = {},
  ) {
    super(
      scope,
      id,
      props,
    );

    const maxAttempts = props.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const functionTimeout = Duration.seconds(FUNCTION_TIMEOUT_SECONDS);

    const deadLetterQueue = new Queue(
      this,
      'DeadLetterQueue',
      {
        encryption: QueueEncryption.SQS_MANAGED,
        retentionPeriod: Duration.days(DEAD_LETTER_RETENTION_DAYS),
      },
    );

    const queue = new Queue(
      this,
      'DeliveryQueue',
      {
        encryption: QueueEncryption.SQS_MANAGED,
        visibilityTimeout: Duration.seconds(functionTimeout.toSeconds() * VISIBILITY_TIMEOUT_FACTOR),
        retentionPeriod: Duration.days(DELIVERY_RETENTION_DAYS),
        // Safety net only: the function dead-letters on its own, with a reason. This catches
        // messages that keep crashing the function before it can decide.
        deadLetterQueue: {
          queue: deadLetterQueue,
          maxReceiveCount: maxAttempts + REDRIVE_MARGIN,
        },
      },
    );

    const signingSecret = new Secret(
      this,
      'SigningSecret',
      {
        description: 'HMAC key used to sign outgoing webhooks',
        generateSecretString: {
          passwordLength: 48,
          excludePunctuation: true,
        },
        removalPolicy: RemovalPolicy.RETAIN,
      },
    );

    const logGroup = new LogGroup(
      this,
      'DispatcherLogs',
      {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    );

    const dispatcher = new NodejsFunction(
      this,
      'Dispatcher',
      {
        entry: fileURLToPath(new URL(
          '../src/handler.ts',
          import.meta.url,
        )),
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
        bundling: {
          format: OutputFormat.ESM,
          minify: true,
          sourceMap: true,
        },
      },
    );

    dispatcher.addEventSource(
      new SqsEventSource(
        queue,
        {
          batchSize: 10,
          maxBatchingWindow: Duration.seconds(1),
          reportBatchItemFailures: true,
          // Caps how hard a backlog can hit receivers after an outage.
          maxConcurrency: 10,
        },
      ),
    );

    queue.grantConsumeMessages(dispatcher);
    deadLetterQueue.grantSendMessages(dispatcher);
    signingSecret.grantRead(dispatcher);

    new Alarm(
      this,
      'DeadLettersAlarm',
      {
        alarmDescription: 'Webhooks were given up and are waiting in the dead-letter queue',
        metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({
          period: Duration.minutes(ALARM_PERIOD_MINUTES),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      },
    );

    new CfnOutput(
      this,
      'QueueUrl',
      { value: queue.queueUrl },
    );

    new CfnOutput(
      this,
      'DeadLetterQueueUrl',
      { value: deadLetterQueue.queueUrl },
    );

    new CfnOutput(
      this,
      'SigningSecretArn',
      { value: signingSecret.secretArn },
    );
  }
}
