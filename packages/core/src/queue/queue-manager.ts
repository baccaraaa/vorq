import { QueueAlreadyExistsError, QueueNotFoundError } from "../errors/index.js";
import type { TaskDefinition } from "../task/types.js";
import type { QueueOptions, TransportAdapter } from "../transport/types.js";
import type { QueueHandle } from "./types.js";

export class QueueManager {
  private readonly registry = new Map<string, QueueHandle>();

  constructor(
    private readonly transport: TransportAdapter,
    private readonly enqueueCallback: (queue: string, task: TaskDefinition) => Promise<string>,
  ) {}

  async createQueue(name: string, options?: QueueOptions): Promise<QueueHandle> {
    if (this.registry.has(name)) {
      throw new QueueAlreadyExistsError(name);
    }

    await this.transport.createQueue(name, options ?? {});
    await this.transport.createQueue(`dlq:${name}`, {});

    const handle: QueueHandle = {
      name,
      enqueue: <T>(task: TaskDefinition<T>) => this.enqueueCallback(name, task),
      pause: async () => {},
      resume: async () => {},
    };

    this.registry.set(name, handle);
    return handle;
  }

  getQueue(name: string): QueueHandle {
    const handle = this.registry.get(name);
    if (!handle) {
      throw new QueueNotFoundError(name);
    }
    return handle;
  }

  hasQueue(name: string): boolean {
    return this.registry.has(name);
  }

  listQueues(): { name: string }[] {
    return Array.from(this.registry.keys()).map((name) => ({ name }));
  }
}
