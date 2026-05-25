import type {
  DeadLetterRecord,
  ListFilter,
  Page,
  RegistryRecord,
  ScheduleEntry,
  Vorq,
  VorqEvent,
  VorqEventMap,
} from "@vorq/core";
import type { AnyEvent, BoardDataSource, QueueDetail, QueueInfo, WorkerInfo } from "./types.js";

const ALL_EVENTS: VorqEvent[] = [
  "task.enqueued",
  "task.active",
  "task.completed",
  "task.failed",
  "task.retrying",
  "task.deadLettered",
  "task.abandoned",
  "task.progress",
  "workflow.started",
  "workflow.stepCompleted",
  "workflow.stepRetrying",
  "workflow.stepFailed",
  "workflow.completed",
  "workflow.failed",
];

export class EmbeddedDataSource implements BoardDataSource {
  private readonly pausedQueues = new Set<string>();

  constructor(private readonly vorq: Vorq) {}

  async listQueues(): Promise<QueueInfo[]> {
    return this.vorq.listQueues().map((q) => ({
      name: q.name,
      metrics: this.vorq.getQueueMetrics(q.name),
      paused: this.pausedQueues.has(q.name),
    }));
  }

  async getQueueDetail(name: string): Promise<QueueDetail | null> {
    const list = await this.listQueues();
    const info = list.find((q) => q.name === name);
    if (!info) return null;
    return { ...info, workers: this.vorq.listWorkers(name) };
  }

  async pauseQueue(name: string): Promise<void> {
    await this.vorq.pauseQueue(name);
    this.pausedQueues.add(name);
  }

  async resumeQueue(name: string): Promise<void> {
    await this.vorq.resumeQueue(name);
    this.pausedQueues.delete(name);
  }

  async listTasks(filter: ListFilter): Promise<Page<RegistryRecord>> {
    return this.vorq.listTasks(filter);
  }

  async getTask(taskId: string): Promise<RegistryRecord | null> {
    return this.vorq.getTask(taskId) ?? null;
  }

  async listDlq(queue: string): Promise<DeadLetterRecord[]> {
    return this.vorq.getDLQ(queue);
  }

  async retryFromDlq(taskId: string): Promise<void> {
    await this.vorq.retryFromDLQ(taskId);
  }

  async retryAllFromDlq(queue: string): Promise<number> {
    return (await this.vorq.retryAllFromDLQ(queue)) ?? 0;
  }

  async purgeDlq(queue: string): Promise<number> {
    return (await this.vorq.purgeDLQ(queue)) ?? 0;
  }

  async listWorkers(queue: string): Promise<WorkerInfo[]> {
    return this.vorq.listWorkers(queue).map((w) => ({ id: w.id, queue, running: w.running }));
  }

  async pauseWorker(queue: string, id: string): Promise<void> {
    await this.vorq.pauseWorker(queue, id);
  }

  async resumeWorker(queue: string, id: string): Promise<void> {
    await this.vorq.resumeWorker(queue, id);
  }

  async listSchedules(): Promise<ScheduleEntry[]> {
    return this.vorq.listSchedules();
  }

  subscribeEvents(cb: (evt: AnyEvent) => void): () => void {
    const handlers: { event: VorqEvent; handler: (data: unknown) => void }[] = [];
    for (const event of ALL_EVENTS) {
      const handler = (data: unknown) => {
        cb({ event, data } as AnyEvent);
      };
      this.vorq.on(event as never, handler as (data: VorqEventMap[VorqEvent]) => void);
      handlers.push({ event, handler });
    }
    return () => {
      for (const { event, handler } of handlers) {
        this.vorq.off(event as never, handler as (data: VorqEventMap[VorqEvent]) => void);
      }
    };
  }
}
