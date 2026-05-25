const base = window.__VORQ_BOARD_BASE__?.replace(/\/$/, "") ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface QueueMetricsDto {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  avgDuration: number;
  throughput: number;
}

export interface QueueInfoDto {
  name: string;
  metrics: QueueMetricsDto;
  paused: boolean;
}

export interface QueueDetailDto extends QueueInfoDto {
  workers: { id: string; running: boolean }[];
}

export interface TaskRowDto {
  taskId: string;
  status: string;
  queue: string;
  attempt: number;
  enqueuedAt: number;
}

export interface TaskDetailDto extends TaskRowDto {
  payload: unknown;
  result?: unknown;
  error?: string;
}

export interface DlqEntryDto {
  taskId: string;
  error: string;
  attempts: number;
  failedAt: string;
}

export interface ScheduleDto {
  id: string;
  queue: string;
  cron: string;
  nextRun: string;
}

export const api = {
  listQueues: () => req<QueueInfoDto[]>("/api/queues"),
  getQueue: (name: string) => req<QueueDetailDto>(`/api/queues/${name}`),
  pauseQueue: (name: string) => req<void>(`/api/queues/${name}/pause`, { method: "POST" }),
  resumeQueue: (name: string) => req<void>(`/api/queues/${name}/resume`, { method: "POST" }),
  listTasks: (
    q: string,
    params: { status?: string; limit?: number; cursor?: string; search?: string },
  ) => {
    const u = new URLSearchParams();
    if (params.status) u.set("status", params.status);
    if (params.limit) u.set("limit", String(params.limit));
    if (params.cursor) u.set("cursor", params.cursor);
    if (params.search) u.set("search", params.search);
    return req<{ items: TaskRowDto[]; nextCursor?: string }>(`/api/queues/${q}/tasks?${u}`);
  },
  getTask: (q: string, id: string) => req<TaskDetailDto>(`/api/queues/${q}/tasks/${id}`),
  listDlq: (q: string) => req<DlqEntryDto[]>(`/api/queues/${q}/dlq`),
  retryDlq: (q: string, id: string) =>
    req<void>(`/api/queues/${q}/dlq/${id}/retry`, { method: "POST" }),
  retryAllDlq: (q: string) =>
    req<{ retried: number }>(`/api/queues/${q}/dlq/retry-all`, { method: "POST" }),
  purgeDlq: (q: string) => req<{ purged: number }>(`/api/queues/${q}/dlq`, { method: "DELETE" }),
  listSchedules: () => req<ScheduleDto[]>("/api/schedules"),
};
