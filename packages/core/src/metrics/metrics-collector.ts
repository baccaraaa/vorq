import type { EventBus } from "../events/event-bus.js";
import type { QueueMetrics } from "../persistence/types.js";

interface PerQueueCounters {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  totalDuration: number;
  completedSamples: number;
  completionsLastHour: { t: number }[];
}

export interface MetricsCollectorOptions {
  now?: () => number;
  windowMs?: number;
}

/**
 * Subscribes to {@link EventBus} task lifecycle events and maintains per-queue counters.
 *
 * Event-counter contract:
 * - `task.enqueued`        → pending++
 * - `task.active`          → pending--, active++
 * - `task.completed`       → active--, completed++, throughput sample
 * - `task.failed`          → failed++ (intentionally does NOT touch `active`; see below)
 * - `task.retrying`        → active--, pending++  (fires after task.failed when retry remains)
 * - `task.deadLettered`    → active--             (fires after task.failed when no retry)
 *
 * `task.failed` is emitted on every failed attempt, but it is ALWAYS followed by exactly
 * one of `task.retrying` or `task.deadLettered` (see worker-pool.ts:processMessage).
 * Decrementing `active` on all three would double-count. The decrement therefore lives on
 * the terminating event only.
 *
 * `completionsLastHour` is trimmed lazily inside {@link snapshot}. For workloads that
 * complete tasks but never read metrics, the array can grow unboundedly between reads.
 * This is acceptable for the dashboard use case (each queue is read at least every second).
 */
export class MetricsCollector {
  private readonly counters = new Map<string, PerQueueCounters>();
  private readonly now: () => number;
  private readonly windowMs: number;

  constructor(bus: EventBus, opts: MetricsCollectorOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.windowMs = opts.windowMs ?? 60 * 60 * 1000;

    bus.on("task.enqueued", (d) => {
      this.get(d.queue).pending++;
    });
    bus.on("task.active", (d) => {
      const c = this.get(d.queue);
      c.pending = Math.max(0, c.pending - 1);
      c.active++;
    });
    bus.on("task.completed", (d) => {
      const c = this.get(d.queue);
      c.active = Math.max(0, c.active - 1);
      c.completed++;
      c.totalDuration += d.duration;
      c.completedSamples++;
      c.completionsLastHour.push({ t: this.now() });
    });
    bus.on("task.failed", (d) => {
      this.get(d.queue).failed++;
    });
    bus.on("task.retrying", (d) => {
      const c = this.get(d.queue);
      c.active = Math.max(0, c.active - 1);
      c.pending++;
    });
    bus.on("task.deadLettered", (d) => {
      const c = this.get(d.queue);
      c.active = Math.max(0, c.active - 1);
    });
  }

  snapshot(queue: string): QueueMetrics {
    const c = this.counters.get(queue);
    if (!c)
      return {
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        avgDuration: 0,
        throughput: 0,
      };
    const cutoff = this.now() - this.windowMs;
    c.completionsLastHour = c.completionsLastHour.filter((e) => e.t >= cutoff);
    return {
      pending: c.pending,
      active: c.active,
      completed: c.completed,
      failed: c.failed,
      delayed: c.delayed,
      avgDuration: c.completedSamples > 0 ? c.totalDuration / c.completedSamples : 0,
      throughput: c.completionsLastHour.length,
    };
  }

  private get(queue: string): PerQueueCounters {
    let c = this.counters.get(queue);
    if (!c) {
      c = {
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        totalDuration: 0,
        completedSamples: 0,
        completionsLastHour: [],
      };
      this.counters.set(queue, c);
    }
    return c;
  }
}
