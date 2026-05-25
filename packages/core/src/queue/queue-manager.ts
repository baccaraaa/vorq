import { QueueAlreadyExistsError, QueueNotFoundError } from "../errors/index.js";
import type { TaskDefinition } from "../task/types.js";
import type { QueueOptions, TransportAdapter } from "../transport/types.js";
import type { QueueHandle } from "./types.js";

export interface QueueManagerCallbacks {
  enqueue: (queue: string, task: TaskDefinition) => Promise<string>;
  pauseWorkers: (queue: string) => Promise<void>;
  resumeWorkers: (queue: string) => Promise<void>;
}

export class QueueManager {
  private readonly registry = new Map<string, QueueHandle>();

  constructor(
    private readonly transport: TransportAdapter,
    private readonly callbacks: QueueManagerCallbacks,
  ) {}

  async createQueue(name: string, options?: QueueOptions): Promise<QueueHandle> {
    if (this.registry.has(name)) throw new QueueAlreadyExistsError(name);
    await this.transport.createQueue(name, options ?? {});
    await this.transport.createQueue(`dlq:${name}`, {});
    const handle: QueueHandle = {
      name,
      enqueue: <T>(task: TaskDefinition<T>) => this.callbacks.enqueue(name, task),
      pause: () => this.callbacks.pauseWorkers(name),
      resume: () => this.callbacks.resumeWorkers(name),
    };
    this.registry.set(name, handle);
    return handle;
  }

  getQueue(name: string): QueueHandle {
    const h = this.registry.get(name);
    if (!h) throw new QueueNotFoundError(name);
    return h;
  }

  hasQueue(name: string): boolean {
    return this.registry.has(name);
  }

  listQueues(): { name: string }[] {
    return Array.from(this.registry.keys()).map((name) => ({ name }));
  }
}
