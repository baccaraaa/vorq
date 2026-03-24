import { Inject, Injectable } from "@nestjs/common";
import type {
  QueueHandle,
  QueueOptions,
  ScheduleOptions,
  TaskDefinition,
  TaskHandler,
  Vorq,
  VorqEventMap,
  WorkerHandle,
  WorkerOptions,
} from "@vorq/core";

export const VORQ_INSTANCE = "VORQ_INSTANCE";

@Injectable()
export class VorqService {
  constructor(@Inject(VORQ_INSTANCE) private readonly vorq: Vorq) {}

  async createQueue(name: string, options?: QueueOptions): Promise<QueueHandle> {
    return this.vorq.createQueue(name, options);
  }

  async enqueue<T>(queue: string, task: TaskDefinition<T>): Promise<string> {
    return this.vorq.enqueue(queue, task);
  }

  registerWorker<T>(
    queue: string,
    handler: TaskHandler<T>,
    options?: Partial<WorkerOptions>,
  ): WorkerHandle {
    return this.vorq.registerWorker(queue, handler, options);
  }

  schedule(queue: string, cron: string, task: TaskDefinition, options?: ScheduleOptions): string {
    return this.vorq.schedule(queue, cron, task, options);
  }

  on<E extends keyof VorqEventMap>(event: E, listener: (data: VorqEventMap[E]) => void): void {
    this.vorq.on(event, listener);
  }

  workflow<TInput>(name: string) {
    return this.vorq.workflow<TInput>(name);
  }
}
