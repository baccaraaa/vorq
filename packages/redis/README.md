# @vorq/redis

Redis transport adapter for [Vorq](https://github.com/baccaraaa/vorq) distributed task queue.

[![npm version](https://img.shields.io/npm/v/@vorq/redis.svg)](https://www.npmjs.com/package/@vorq/redis)

## Install

```bash
npm install @vorq/core @vorq/redis
```

## Usage

```ts
import { Vorq } from "@vorq/core";
import { RedisTransport } from "@vorq/redis";

const vorq = new Vorq({
  transport: new RedisTransport({
    host: "localhost",
    port: 6379,
  }),
});
```

## Features

- Priority queues via Redis sorted sets
- Delayed tasks with polling-based scheduling
- Consumer groups for horizontal scaling
- Automatic reconnection

## Configuration

```ts
interface RedisTransportOptions {
  host?: string;       // default: "localhost"
  port?: number;       // default: 6379
  url?: string;        // connection URL (alternative to host/port)
  password?: string;
  db?: number;
  keyPrefix?: string;  // namespace for Redis keys
}
```

## License

MIT
