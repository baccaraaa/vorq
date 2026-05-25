import type { EventBus } from "../events/event-bus.js";
import { TaskStatus } from "../task/types.js";

export interface RegistryRecord {
  taskId: string;
  queue: string;
  status: TaskStatus;
  attempt: number;
  result?: unknown;
  error?: string;
  progress: number;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  payload?: unknown;
}

export interface TaskRegistryOptions {
  capacity?: number;
}

export interface ListFilter {
  queue?: string;
  status?: TaskStatus | TaskStatus[];
  /** Substring match against `taskId`. */
  search?: string;
  /** Maximum items per page; clamped to [1, 500]. Default 50. */
  limit?: number;
  /** `taskId` of the last item returned by the previous page. */
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  /**
   * Set when more records exist past the current window. May yield an empty
   * page on the next call if all remaining records are filtered out — that's
   * the expected end-of-stream signal for filtered queries.
   */
  nextCursor?: string;
}

/**
 * Subscribes to {@link EventBus} task lifecycle events and keeps a bounded
 * ring buffer of recent task records, queryable by queue and status with
 * cursor-based pagination.
 *
 * Used by `@vorq/board` to render task tables when no `StorageAdapter` is
 * configured. Older records are evicted in FIFO order once `capacity` is
 * exceeded.
 */
export class TaskRegistry {
  private readonly capacity: number;
  private readonly records = new Map<string, RegistryRecord>();
  private readonly order: string[] = [];

  constructor(bus: EventBus, opts: TaskRegistryOptions = {}) {
    this.capacity = opts.capacity ?? 1000;

    bus.on("task.enqueued", (d) => this.upsert(d.taskId, { taskId: d.taskId, queue: d.queue, status: TaskStatus.QUEUED, attempt: 1, progress: 0, enqueuedAt: Date.now() }));
    bus.on("task.active", (d) => this.patch(d.taskId, { status: TaskStatus.ACTIVE, attempt: d.attempt, startedAt: Date.now() }));
    bus.on("task.completed", (d) => this.patch(d.taskId, { status: TaskStatus.COMPLETED, result: d.result, completedAt: Date.now(), progress: 100 }));
    bus.on("task.failed", (d) => this.patch(d.taskId, { status: TaskStatus.FAILED, error: d.error.message, attempt: d.attempt }));
    bus.on("task.retrying", (d) => this.patch(d.taskId, { status: TaskStatus.RETRYING, attempt: d.attempt }));
    bus.on("task.deadLettered", (d) => this.patch(d.taskId, { status: TaskStatus.ABANDONED, error: d.error.message, attempt: d.attempts }));
    bus.on("task.progress", (d) => this.patch(d.taskId, { progress: d.percent }));
  }

  get(taskId: string): RegistryRecord | undefined {
    return this.records.get(taskId);
  }

  list(filter: ListFilter = {}): Page<RegistryRecord> {
    const limit = Math.max(1, Math.min(filter.limit ?? 50, 500));
    const statuses = filter.status ? (Array.isArray(filter.status) ? filter.status : [filter.status]) : null;
    let startIdx = 0;
    if (filter.cursor) {
      const idx = this.order.indexOf(filter.cursor);
      if (idx >= 0) startIdx = idx + 1;
    }
    const items: RegistryRecord[] = [];
    let i = startIdx;
    for (; i < this.order.length && items.length < limit; i++) {
      const taskId = this.order[i];
      if (!taskId) continue;
      const rec = this.records.get(taskId);
      if (!rec) continue;
      if (filter.queue && rec.queue !== filter.queue) continue;
      if (statuses && !statuses.includes(rec.status)) continue;
      if (filter.search && !rec.taskId.includes(filter.search)) continue;
      items.push(rec);
    }
    const lastItem = items[items.length - 1];
    const nextCursor = i < this.order.length && lastItem ? lastItem.taskId : undefined;
    return { items, nextCursor };
  }

  private upsert(taskId: string, record: RegistryRecord) {
    if (this.records.has(taskId)) return;
    this.records.set(taskId, record);
    this.order.push(taskId);
    while (this.order.length > this.capacity) {
      const evict = this.order.shift();
      if (evict) this.records.delete(evict);
    }
  }

  private patch(taskId: string, patch: Partial<RegistryRecord>) {
    const cur = this.records.get(taskId);
    if (!cur) return;
    Object.assign(cur, patch);
  }
}
