import { DAGResolver } from "./dag/dag-resolver.js";
import { VorqError } from "./errors/vorq-error.js";
import { WorkflowBuilder } from "./workflow/workflow-builder.js";

class DagRequiresStorageError extends VorqError {
  readonly code = "DAG_REQUIRES_STORAGE";

  constructor() {
    super("DAG dependencies require InMemoryTransport or a StorageAdapter");
  }
}
import { EventBus } from "./events/event-bus.js";
import type { VorqEventMap } from "./events/types.js";
import { ConsoleLogger } from "./logging/console-logger.js";
import type { VorqLogger } from "./logging/types.js";
import type { StorageAdapter } from "./persistence/types.js";
import { QueueManager } from "./queue/queue-manager.js";
import type { QueueHandle } from "./queue/types.js";
import { RetryPolicy, type RetryPolicyConfig } from "./retry/retry-policy.js";
import { CronScheduler } from "./scheduler/cron-scheduler.js";
import type { ScheduleOptions } from "./scheduler/types.js";
import { type DeadLetterRecord, Priority, type TaskDefinition } from "./task/types.js";
import { InMemoryTransport } from "./transport/in-memory-transport.js";
import type { QueueOptions, TaskMessage, TransportAdapter } from "./transport/types.js";
import type { TaskHandler, WorkerHandle, WorkerOptions } from "./worker/types.js";
import { WorkerPool } from "./worker/worker-pool.js";

export interface VorqConfig {
  transport: TransportAdapter;
  storage?: StorageAdapter;
  logger?: VorqLogger;
  defaults?: {
    retryPolicy?: RetryPolicyConfig;
    priority?: Priority;
    timeout?: number;
  };
}

export class Vorq {
  private readonly transport: TransportAdapter;
  private readonly storage?: StorageAdapter;
  private readonly eventBus: EventBus;
  private readonly logger: VorqLogger;
  private readonly queueManager: QueueManager;
  private readonly dagResolver: DAGResolver;
  private readonly scheduler: CronScheduler;
  private readonly workers: Map<string, WorkerPool[]>;
  private readonly waitingTasks: Map<
    string,
    { queue: string; task: TaskDefinition; message: TaskMessage }
  >;
  private readonly defaultRetryPolicy: RetryPolicy;
  private started: boolean;

  constructor(config: VorqConfig) {
    this.transport = config.transport;
    this.storage = config.storage;
    this.logger = config.logger ?? new ConsoleLogger();
    this.eventBus = new EventBus(this.logger);
    this.dagResolver = new DAGResolver();
    this.workers = new Map();
    this.waitingTasks = new Map();
    this.started = false;

    this.defaultRetryPolicy = new RetryPolicy(config.defaults?.retryPolicy ?? { maxRetries: 3 });

    this.queueManager = new QueueManager(this.transport, (queue, task) =>
      this.enqueue(queue, task),
    );

    this.scheduler = new CronScheduler((queue, task) => this.enqueue(queue, task), this.logger);

    this.eventBus.on("task.completed", async (data) => {
      const readyTaskIds = this.dagResolver.resolve(data.taskId);
      for (const taskId of readyTaskIds) {
        const waiting = this.waitingTasks.get(taskId);
        if (!waiting) continue;
        this.waitingTasks.delete(taskId);
        await this.transport.publish(waiting.queue, waiting.message, {
          priority: waiting.message.priority,
          delay: waiting.message.delay,
        });
      }
    });

    this.eventBus.on("task.deadLettered", async (data) => {
      const abandonedIds = this.dagResolver.abandon(data.taskId);
      for (const taskId of abandonedIds) {
        this.waitingTasks.delete(taskId);
        await this.eventBus.emit("task.abandoned", {
          taskId,
          queue: data.queue,
          reason: `Dependency ${data.taskId} failed`,
        });
      }
    });
  }

  async start(): Promise<void> {
    await this.transport.connect();
    this.scheduler.start();
    for (const pools of this.workers.values()) {
      for (const pool of pools) {
        await pool.start();
      }
    }
    this.started = true;
  }

  async shutdown(_timeout = 30000): Promise<void> {
    this.scheduler.stop();
    const stopPromises: Promise<void>[] = [];
    for (const pools of this.workers.values()) {
      for (const pool of pools) {
        stopPromises.push(pool.stop());
      }
    }
    await Promise.all(stopPromises);
    await this.transport.disconnect();
    this.started = false;
  }

  async createQueue(name: string, options?: QueueOptions): Promise<QueueHandle> {
    return this.queueManager.createQueue(name, options);
  }

  async enqueue<T>(queue: string, task: TaskDefinition<T>): Promise<string> {
    const taskId = crypto.randomUUID();
    const message: TaskMessage = {
      taskId,
      taskName: task.name,
      queue,
      payload: task.payload,
      attempt: 1,
      priority: task.options?.priority ?? Priority.MEDIUM,
      delay: task.options?.delay ?? 0,
      maxRetries: task.options?.maxRetries ?? this.defaultRetryPolicy.maxRetries,
      createdAt: Date.now(),
    };

    const dependsOn = task.options?.dependsOn;
    if (dependsOn && dependsOn.length > 0) {
      if (!(this.transport instanceof InMemoryTransport) && !this.storage) {
        throw new DagRequiresStorageError();
      }
      this.dagResolver.addTask(taskId, dependsOn);
      this.waitingTasks.set(taskId, { queue, task, message });
      await this.eventBus.emit("task.enqueued", { taskId, queue });
      return taskId;
    }

    await this.eventBus.emit("task.enqueued", { taskId, queue });
    await this.transport.publish(queue, message, {
      priority: message.priority,
      delay: message.delay,
    });
    return taskId;
  }

  async enqueueBatch(queue: string, tasks: TaskDefinition[]): Promise<string[]> {
    return Promise.all(tasks.map((t) => this.enqueue(queue, t)));
  }

  registerWorker<T>(
    queue: string,
    handler: TaskHandler<T>,
    options?: Partial<WorkerOptions>,
  ): WorkerHandle {
    const pool = new WorkerPool(
      queue,
      handler as TaskHandler,
      this.transport,
      this.eventBus,
      this.logger,
      this.defaultRetryPolicy,
      options,
    );

    const pools = this.workers.get(queue) ?? [];
    pools.push(pool);
    this.workers.set(queue, pools);

    if (this.started) {
      pool.start();
    }

    return pool;
  }

  schedule(queue: string, cron: string, task: TaskDefinition, options?: ScheduleOptions): string {
    return this.scheduler.register(queue, cron, task, options);
  }

  async getDLQ(queue: string): Promise<DeadLetterRecord[]> {
    if (this.transport instanceof InMemoryTransport) {
      const envelopes = this.transport.getPublished(`dlq:${queue}`);
      return envelopes.map((env) => ({
        taskId: env.task.taskId,
        queue,
        payload: env.task.payload,
        error: "Unknown",
        attempts: env.task.attempt,
        failedAt: new Date(env.receivedAt),
        history: [],
      }));
    }
    return [];
  }

  async retryFromDLQ(_taskId: string): Promise<void> {}

  async retryAllFromDLQ(_queue: string): Promise<void> {}

  async purgeDLQ(_queue: string): Promise<void> {}

  on<E extends keyof VorqEventMap>(event: E, listener: (data: VorqEventMap[E]) => void): void {
    this.eventBus.on(event, listener);
  }

  workflow<TInput>(name: string): WorkflowBuilder<TInput, Record<string, never>> {
    return new WorkflowBuilder<TInput, Record<string, never>>(name, this.logger, this.eventBus);
  }
}
