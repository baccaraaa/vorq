import type {
  DeadLetterRecord,
  ListFilter,
  Page,
  QueueMetrics,
  RegistryRecord,
  ScheduleEntry,
  VorqEvent,
  VorqEventMap,
} from "@vorq/core";

export interface QueueInfo {
  name: string;
  metrics: QueueMetrics;
  paused: boolean;
}

export interface QueueDetail extends QueueInfo {
  workers: { id: string; running: boolean }[];
}

export interface WorkerInfo {
  id: string;
  queue: string;
  running: boolean;
}

export type AnyEvent = {
  [E in VorqEvent]: { event: E; data: VorqEventMap[E] };
}[VorqEvent];

export interface BoardDataSource {
  listQueues(): Promise<QueueInfo[]>;
  getQueueDetail(name: string): Promise<QueueDetail | null>;
  pauseQueue(name: string): Promise<void>;
  resumeQueue(name: string): Promise<void>;

  listTasks(filter: ListFilter): Promise<Page<RegistryRecord>>;
  getTask(taskId: string): Promise<RegistryRecord | null>;

  listDlq(queue: string): Promise<DeadLetterRecord[]>;
  retryFromDlq(taskId: string): Promise<void>;
  retryAllFromDlq(queue: string): Promise<number>;
  purgeDlq(queue: string): Promise<number>;

  listWorkers(queue: string): Promise<WorkerInfo[]>;
  pauseWorker(queue: string, workerId: string): Promise<void>;
  resumeWorker(queue: string, workerId: string): Promise<void>;

  listSchedules(): Promise<ScheduleEntry[]>;

  subscribeEvents?(cb: (evt: AnyEvent) => void): () => void;
}
