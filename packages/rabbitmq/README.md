# @vorq/rabbitmq

RabbitMQ transport adapter for [Vorq](https://github.com/baccaraaa/vorq) distributed task queue.

[![npm version](https://img.shields.io/npm/v/@vorq/rabbitmq.svg)](https://www.npmjs.com/package/@vorq/rabbitmq)

## Install

```bash
npm install @vorq/core @vorq/rabbitmq
```

## Usage

```ts
import { Vorq } from "@vorq/core";
import { RabbitMQTransport } from "@vorq/rabbitmq";

const vorq = new Vorq({
  transport: new RabbitMQTransport({
    url: "amqp://localhost",
  }),
});
```

## Features

- Native priority queues via `x-max-priority`
- Delayed tasks via dead-letter exchange with TTL
- Configurable prefetch count
- Automatic reconnection

## Configuration

```ts
interface RabbitMQTransportOptions {
  url?: string;        // default: "amqp://localhost"
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  vhost?: string;
  prefetch?: number;   // default: 1
}
```

## License

MIT
