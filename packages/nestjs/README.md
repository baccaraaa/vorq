# @vorq/nestjs

NestJS integration for [Vorq](https://github.com/baccaraaa/vorq) distributed task queue.

[![npm version](https://img.shields.io/npm/v/@vorq/nestjs.svg)](https://www.npmjs.com/package/@vorq/nestjs)

## Install

```bash
npm install @vorq/core @vorq/nestjs
```

## Usage

### Module Setup

```ts
import { Module } from "@nestjs/common";
import { VorqModule } from "@vorq/nestjs";
import { InMemoryTransport } from "@vorq/core";

@Module({
  imports: [
    VorqModule.forRoot({
      transport: new InMemoryTransport(),
    }),
  ],
})
export class AppModule {}
```

### Decorators

```ts
import { Worker, Task, Scheduled } from "@vorq/nestjs";

@Worker("emails")
export class EmailWorker {
  @Task("send-welcome")
  async handleWelcome(ctx) {
    await sendEmail(ctx.payload.to, "Welcome!");
    return { sent: true };
  }

  @Scheduled("0 9 * * *")
  @Task("daily-digest")
  async handleDigest(ctx) {
    await sendDigest();
  }
}
```

### Enqueueing Tasks

```ts
import { Injectable } from "@nestjs/common";
import { VorqService } from "@vorq/nestjs";
import { Priority } from "@vorq/core";

@Injectable()
export class OrderService {
  constructor(private vorq: VorqService) {}

  async createOrder(dto: CreateOrderDto) {
    await this.vorq.enqueue("emails", {
      name: "send-welcome",
      payload: { to: dto.email },
      options: { priority: Priority.HIGH },
    });
  }
}
```

## License

MIT
