# @vorq/core

Distributed task queue for TypeScript with **type-safe workflows**, pluggable transports, and optional persistence.

[![npm version](https://img.shields.io/npm/v/@vorq/core.svg)](https://www.npmjs.com/package/@vorq/core)
[![license](https://img.shields.io/npm/l/@vorq/core.svg)](https://github.com/baccaraaa/vorq/blob/main/LICENSE)

## Install

```bash
npm install @vorq/core
```

## Quick Start

```ts
import { Vorq, InMemoryTransport, Priority } from "@vorq/core";

const vorq = new Vorq({ transport: new InMemoryTransport() });

await vorq.createQueue("tasks");

vorq.registerWorker("tasks", async (ctx) => {
  console.log(`Processing: ${ctx.name}`, ctx.payload);
  return { ok: true };
});

await vorq.start();

await vorq.enqueue("tasks", {
  name: "send-email",
  payload: { to: "user@example.com" },
  options: { priority: Priority.HIGH },
});
```

## Type-safe Workflows

```ts
const pipeline = vorq
  .workflow<{ url: string }>("etl")
  .step("fetch", async (ctx) => {
    const res = await fetch(ctx.input.url);
    return { data: await res.json() };
  })
  .step("transform", async (ctx) => {
    // ctx.results.fetch is fully typed
    return { rows: normalize(ctx.results.fetch.data) };
  })
  .build();

const result = await pipeline.run({ url: "https://api.example.com" });

if (result.status === "completed") {
  console.log(result.results.transform.rows);
}
```

## Features

- Priority queues, delayed tasks, retry with exponential backoff
- Dead letter queue, task dependencies (DAG), cron scheduler
- Type-safe workflows with compile-time validation
- Pluggable transports: Redis (`@vorq/redis`), RabbitMQ (`@vorq/rabbitmq`)
- Optional PostgreSQL persistence via Prisma
- NestJS integration (`@vorq/nestjs`)
- Framework-agnostic core
- InMemoryTransport for testing

## Packages

| Package | Description |
|---------|-------------|
| [`@vorq/core`](https://www.npmjs.com/package/@vorq/core) | Queue engine, workers, retry, DAG, scheduler, workflows |
| [`@vorq/redis`](https://www.npmjs.com/package/@vorq/redis) | Redis transport adapter |
| [`@vorq/rabbitmq`](https://www.npmjs.com/package/@vorq/rabbitmq) | RabbitMQ transport adapter |
| [`@vorq/nestjs`](https://www.npmjs.com/package/@vorq/nestjs) | NestJS module and decorators |

## Documentation

Full documentation and examples at [github.com/baccaraaa/vorq](https://github.com/baccaraaa/vorq).

## License

MIT
