// packages/board/src/server/data/standalone.ts
import type { DeadLetterRecord, ListFilter, Page, RegistryRecord, ScheduleEntry } from "@vorq/core";
import type { BoardDataSource, QueueDetail, QueueInfo, WorkerInfo } from "./types.js";

export interface StandaloneOptions {
  transportUrl: string;
  storageUrl: string | undefined;
  knownQueues?: string[];
}

/**
 * Minimal v0.1 standalone data source — primarily useful for read-only
 * dashboards behind storage. Pause/retry/purge operations throw because
 * the standalone process does not own the in-process EventBus, transport
 * subscriptions, or worker pools. v0.2 will fully implement this.
 */
export class StandaloneDataSource implements BoardDataSource {
  constructor(private readonly opts: StandaloneOptions) {}

  async connect(): Promise<void> {
    // v0.1: no-op. v0.2 will connect to transport + optional storage.
  }

  async disconnect(): Promise<void> {
    // v0.1: no-op.
  }

  async listQueues(): Promise<QueueInfo[]> {
    return (this.opts.knownQueues ?? []).map((name) => ({
      name,
      paused: false,
      metrics: {
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        avgDuration: 0,
        throughput: 0,
      },
    }));
  }

  async getQueueDetail(name: string): Promise<QueueDetail | null> {
    const list = await this.listQueues();
    const q = list.find((x) => x.name === name);
    return q ? { ...q, workers: [] } : null;
  }

  async pauseQueue(): Promise<void> {
    throw new Error("Pause not supported in standalone v0.1");
  }

  async resumeQueue(): Promise<void> {
    throw new Error("Resume not supported in standalone v0.1");
  }

  async listTasks(_filter: ListFilter): Promise<Page<RegistryRecord>> {
    return { items: [] };
  }

  async getTask(_taskId: string): Promise<RegistryRecord | null> {
    return null;
  }

  async listDlq(_queue: string): Promise<DeadLetterRecord[]> {
    return [];
  }

  async retryFromDlq(): Promise<void> {
    throw new Error("Retry not supported in standalone v0.1");
  }

  async retryAllFromDlq(): Promise<number> {
    return 0;
  }

  async purgeDlq(): Promise<number> {
    return 0;
  }

  async listWorkers(_queue: string): Promise<WorkerInfo[]> {
    return [];
  }

  async pauseWorker(): Promise<void> {
    // No-op in standalone v0.1
  }

  async resumeWorker(): Promise<void> {
    // No-op in standalone v0.1
  }

  async listSchedules(): Promise<ScheduleEntry[]> {
    return [];
  }
}
