# Vorq

Distributed task queue for TypeScript with **type-safe workflows**, pluggable transports (Redis, RabbitMQ), and optional persistence.

[![npm version](https://img.shields.io/npm/v/@vorq/core.svg)](https://www.npmjs.com/package/@vorq/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/baccaraaa/vorq/ci.yml?branch=main)](https://github.com/baccaraaa/vorq/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg)](https://www.typescriptlang.org/)

## Features

- **Priority queues** -- critical, high, medium, and low priority levels
- **Delayed tasks** -- schedule tasks to execute after a specified delay
- **Retry with exponential backoff** -- configurable retry policies with fixed, exponential, and jitter strategies
- **Dead letter queue** -- automatic routing of permanently failed tasks
- **Task dependencies (DAG)** -- define execution order with directed acyclic graphs
- **Type-safe workflows** -- multi-step pipelines with compile-time validation between steps
- **Cron scheduler** -- recurring tasks with cron expressions
- **Pluggable transports** -- Redis and RabbitMQ adapters, in-memory for testing
- **Optional PostgreSQL persistence** -- task history and metrics via Prisma
- **NestJS integration** -- first-class module with `@Worker`, `@Task`, and `@Scheduled` decorators
- **Framework-agnostic core** -- use with any Node.js application

## Quick Start

Install the core package and a transport adapter:

```bash
npm install @vorq/core @vorq/redis
```

Create a queue, register a worker, and enqueue a task:

```typescript
import { Vorq, Priority } from "@vorq/core";
import { RedisTransport } from "@vorq/redis";

const vorq = new Vorq({
  transport: new RedisTransport({ host: "localhost", port: 6379 }),
});

await vorq.createQueue("emails");

vorq.registerWorker("emails", async (ctx) => {
  console.log(`Sending email to ${ctx.payload.to}`);
  // send the email...
});

await vorq.start();

await vorq.enqueue("emails", {
  name: "welcome-email",
  payload: { to: "user@example.com", subject: "Welcome" },
});
```

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@vorq/core`](packages/core) | Queue engine, workers, retry/DLQ, DAG, scheduler, persistence | [![npm](https://img.shields.io/npm/v/@vorq/core.svg)](https://www.npmjs.com/package/@vorq/core) |
| [`@vorq/redis`](packages/redis) | Redis transport adapter | [![npm](https://img.shields.io/npm/v/@vorq/redis.svg)](https://www.npmjs.com/package/@vorq/redis) |
| [`@vorq/rabbitmq`](packages/rabbitmq) | RabbitMQ transport adapter | [![npm](https://img.shields.io/npm/v/@vorq/rabbitmq.svg)](https://www.npmjs.com/package/@vorq/rabbitmq) |
| [`@vorq/nestjs`](packages/nestjs) | NestJS module with decorators | [![npm](https://img.shields.io/npm/v/@vorq/nestjs.svg)](https://www.npmjs.com/package/@vorq/nestjs) |

## API Overview

### Creating Queues

```typescript
const queue = await vorq.createQueue("notifications", {
  maxPriority: 10,
  deadLetterQueue: "dlq:notifications",
  messageTtl: 60000,
  maxLength: 10000,
  rateLimiter: { maxPerInterval: 100, interval: 1000 },
});

// Enqueue directly through the queue handle
await queue.enqueue({ name: "push", payload: { userId: "abc" } });

// Pause and resume processing
await queue.pause();
await queue.resume();
```

### Enqueueing Tasks

```typescript
// Basic task
await vorq.enqueue("emails", {
  name: "send-receipt",
  payload: { orderId: "12345" },
});

// With priority and delay
await vorq.enqueue("emails", {
  name: "send-receipt",
  payload: { orderId: "12345" },
  options: {
    priority: Priority.HIGH,
    delay: 5000, // 5 second delay
    maxRetries: 5,
    timeout: 30000,
  },
});

// Batch enqueue
await vorq.enqueueBatch("emails", [
  { name: "send-receipt", payload: { orderId: "001" } },
  { name: "send-receipt", payload: { orderId: "002" } },
  { name: "send-receipt", payload: { orderId: "003" } },
]);
```

### Workers

Workers process tasks from a queue. The handler receives a `TaskContext` with the task payload, metadata, and utilities:

```typescript
vorq.registerWorker<{ url: string }>(
  "image-processing",
  async (ctx) => {
    ctx.log(`Processing image: ${ctx.payload.url}`);

    // Report progress
    await ctx.progress(25);
    const thumbnail = await generateThumbnail(ctx.payload.url);

    await ctx.progress(75);
    await uploadThumbnail(thumbnail);

    await ctx.progress(100);
    return { thumbnailUrl: thumbnail.url };
  },
  {
    concurrency: 4,
    pollInterval: 500,
    lockDuration: 60000,
    batchSize: 1,
  },
);

// Pause and resume a worker
const worker = vorq.registerWorker("emails", handler);
worker.pause();
worker.resume();
console.log(worker.isRunning());
```

### Task Dependencies (DAG)

Define execution order so that a task only runs after its dependencies complete:

```typescript
const taskA = await vorq.enqueue("pipeline", {
  name: "extract",
  payload: { source: "s3://bucket/data.csv" },
});

const taskB = await vorq.enqueue("pipeline", {
  name: "transform",
  payload: { format: "parquet" },
  options: { dependsOn: [taskA] },
});

await vorq.enqueue("pipeline", {
  name: "load",
  payload: { destination: "warehouse" },
  options: { dependsOn: [taskB] },
});
```

If a dependency fails and is sent to the dead letter queue, all downstream tasks are automatically abandoned.

### Type-safe Workflows

Define multi-step pipelines where TypeScript validates at compile time that each step's output matches downstream expectations:

```ts
const etl = vorq
  .workflow<{ url: string }>("etl-pipeline")
  .step("fetch", { timeout: 30_000, maxRetries: 3 }, async (ctx) => {
    const res = await fetch(ctx.input.url);
    return { data: await res.json() };
  })
  .step("transform", async (ctx) => {
    // ctx.results.fetch is fully typed -- { data: unknown }
    const rows = normalize(ctx.results.fetch.data);
    return { rows, count: rows.length };
  })
  .step("load", { maxRetries: 2 }, async (ctx) => {
    // ctx.results.transform is fully typed -- { rows: ..., count: number }
    await db.insertMany(ctx.results.transform.rows);
    return { inserted: ctx.results.transform.count };
  })
  .build();

const result = await etl.run({ url: "https://api.example.com/data" });

if (result.status === "completed") {
  console.log(`Inserted ${result.results.load.inserted} rows`);
  //                      ^^^ No optional chaining -- TS knows it's complete
}
```

**Compile-time guarantees:**
- Accessing a non-existent step result -> TypeScript error
- Duplicate step names -> TypeScript error
- Discriminated union on result: `completed` gives full types, `failed` gives partial

### Scheduling (Cron)

Schedule recurring tasks with cron expressions:

```typescript
vorq.schedule("reports", "0 9 * * MON", {
  name: "weekly-report",
  payload: { type: "sales" },
});

// Prevent overlapping runs
vorq.schedule(
  "cleanup",
  "*/5 * * * *",
  { name: "temp-cleanup", payload: {} },
  { overlap: false },
);
```

### Dead Letter Queue

Tasks that exhaust their retries are moved to the dead letter queue:

```typescript
// Retrieve dead-lettered tasks
const deadLetters = await vorq.getDLQ("emails");

for (const record of deadLetters) {
  console.log(record.taskId, record.error, record.attempts);
}

// Retry individual tasks or the entire DLQ
await vorq.retryFromDLQ(deadLetters[0].taskId);
await vorq.retryAllFromDLQ("emails");

// Purge the DLQ
await vorq.purgeDLQ("emails");
```

### Events

Listen to lifecycle events for monitoring, logging, or custom integrations:

```typescript
vorq.on("task.enqueued", (data) => {
  console.log(`Task ${data.taskId} enqueued to ${data.queue}`);
});

vorq.on("task.completed", (data) => {
  console.log(`Task ${data.taskId} completed in ${data.duration}ms`);
});

vorq.on("task.failed", (data) => {
  console.error(`Task ${data.taskId} failed on attempt ${data.attempt}:`, data.error);
});

vorq.on("task.retrying", (data) => {
  console.log(`Retrying ${data.taskId}, attempt ${data.attempt}, next delay ${data.nextDelay}ms`);
});

vorq.on("task.deadLettered", (data) => {
  alertOps(`Task ${data.taskId} dead-lettered after ${data.attempts} attempts`);
});

vorq.on("task.progress", (data) => {
  console.log(`Task ${data.taskId}: ${data.percent}%`);
});
```

### Retry and Backoff

Configure retry behavior globally or per task:

```typescript
import {
  Vorq,
  ExponentialBackoff,
  ExponentialJitterBackoff,
  FixedBackoff,
} from "@vorq/core";

// Global defaults
const vorq = new Vorq({
  transport,
  defaults: {
    retryPolicy: {
      maxRetries: 5,
      backoff: new ExponentialBackoff(1000, 60000), // 1s base, 60s max
      retryableErrors: ["TimeoutError", "NetworkError"],
    },
  },
});

// Available backoff strategies:
new FixedBackoff(2000);                        // constant 2s delay
new ExponentialBackoff(1000, 30000);            // 1s, 2s, 4s, ... up to 30s
new ExponentialJitterBackoff(1000, 30000);      // exponential with random jitter

// Per-task override
await vorq.enqueue("emails", {
  name: "send-notification",
  payload: { userId: "abc" },
  options: {
    maxRetries: 10,
    backoff: new FixedBackoff(5000),
  },
});
```

## Transport Adapters

Vorq ships with two production-ready transports. Pick the one that fits your infrastructure:

| Capability | Redis (`@vorq/redis`) | RabbitMQ (`@vorq/rabbitmq`) |
|---|---|---|
| Priority mechanism | Sorted sets per priority level | Native priority queues (`x-max-priority`) |
| Delayed tasks | Sorted set with score = timestamp | Dead-letter exchange + per-message TTL |
| Scaling | Add replicas; partition by key prefix | Add consumers; built-in competing-consumer pattern |
| Persistence | AOF / RDB snapshots | Durable queues + persistent delivery mode |
| Best for | Low-latency, simple deployments | High-throughput, complex routing topologies |

### Redis

```typescript
import { RedisTransport } from "@vorq/redis";

const transport = new RedisTransport({
  host: "localhost",
  port: 6379,
  password: "secret",
  db: 0,
  keyPrefix: "myapp",
});

// Or use a connection URL
const transport2 = new RedisTransport({
  url: "redis://:secret@localhost:6379/0",
});
```

### RabbitMQ

```typescript
import { RabbitMQTransport } from "@vorq/rabbitmq";

const transport = new RabbitMQTransport({
  host: "localhost",
  port: 5672,
  username: "guest",
  password: "guest",
  vhost: "/",
  prefetch: 10,
});

// Or use a connection URL
const transport2 = new RabbitMQTransport({
  url: "amqp://guest:guest@localhost:5672",
});
```

### Building Your Own Transport

Implement the `TransportAdapter` interface and validate with the built-in test suite:

```ts
import type { TransportAdapter } from "@vorq/core";
import { transportContractTests } from "@vorq/core";

class KafkaTransport implements TransportAdapter {
  // 10 methods to implement
}

// Validate your adapter against the contract:
transportContractTests(
  "KafkaTransport",
  async () => { /* create and connect */ },
  async (t) => { /* cleanup */ },
);
```

The contract test suite covers all queue operations (enqueue, dequeue, ack, nack), priority ordering, delayed delivery, and dead-letter routing -- so a passing run means your adapter is fully compatible.

## Persistence

Store task history and query metrics with PostgreSQL via Prisma:

```typescript
import { PrismaClient } from "@prisma/client";
import { Vorq, PrismaStorage, PersistenceListener, EventBus } from "@vorq/core";

const prisma = new PrismaClient();
const storage = new PrismaStorage(prisma);

const vorq = new Vorq({
  transport,
  storage,
});

// Query tasks
const tasks = await storage.queryTasks({
  queue: "emails",
  status: "COMPLETED",
  limit: 50,
  orderBy: "completedAt",
  order: "desc",
});

// Get queue metrics
const metrics = await storage.getMetrics("emails");
console.log(metrics.pending, metrics.active, metrics.completed, metrics.avgDuration);
```

## NestJS Integration

```bash
npm install @vorq/nestjs @vorq/core @vorq/redis
```

Register the module:

```typescript
import { Module } from "@nestjs/common";
import { VorqModule } from "@vorq/nestjs";
import { RedisTransport } from "@vorq/redis";

@Module({
  imports: [
    VorqModule.forRoot({
      transport: new RedisTransport({ host: "localhost" }),
    }),
  ],
})
export class AppModule {}
```

Or with async configuration:

```typescript
VorqModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    transport: new RedisTransport({ url: config.get("REDIS_URL") }),
  }),
});
```

Define workers with decorators:

```typescript
import { Injectable } from "@nestjs/common";
import { Worker, Task, Scheduled } from "@vorq/nestjs";
import type { TaskContext } from "@vorq/core";

@Injectable()
@Worker("emails")
export class EmailWorker {
  @Task("send-welcome")
  async sendWelcome(ctx: TaskContext<{ to: string }>) {
    await this.mailer.send(ctx.payload.to, "Welcome!");
  }

  @Scheduled("0 8 * * *")
  @Task("daily-digest")
  async dailyDigest(ctx: TaskContext) {
    // Runs every day at 8:00 AM
  }
}
```

Enqueue tasks from any service:

```typescript
import { Injectable } from "@nestjs/common";
import { VorqService } from "@vorq/nestjs";

@Injectable()
export class UserService {
  constructor(private readonly vorq: VorqService) {}

  async onUserCreated(userId: string) {
    await this.vorq.enqueue("emails", {
      name: "send-welcome",
      payload: { to: userId },
    });
  }
}
```

## Testing

Use `InMemoryTransport` for fast, deterministic tests without external dependencies:

```typescript
import { Vorq, InMemoryTransport } from "@vorq/core";

describe("email tasks", () => {
  it("should process welcome emails", async () => {
    const transport = new InMemoryTransport();
    const vorq = new Vorq({ transport });
    const results: string[] = [];

    await vorq.createQueue("emails");

    vorq.registerWorker("emails", async (ctx) => {
      results.push(ctx.payload.to);
    });

    await vorq.start();

    await vorq.enqueue("emails", {
      name: "welcome",
      payload: { to: "user@test.com" },
    });

    // Drain processes all pending messages synchronously
    await transport.drain("emails");

    expect(results).toEqual(["user@test.com"]);
    await vorq.shutdown();
  });
});
```

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.

```bash
# Clone the repository
git clone https://github.com/vorq/vorq.git
cd vorq

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Lint
npm run lint
```

This project uses [Biome](https://biomejs.dev/) for linting and formatting, [Vitest](https://vitest.dev/) for testing, and [Turborepo](https://turbo.build/) for monorepo orchestration.

## License

[MIT](LICENSE)
