# @vorq/core changelog

## 0.2.0

### Added

- `MetricsCollector` and `TaskRegistry` for in-memory queue metrics and recent-task tracking.
- `Vorq.listQueues`, `getQueueMetrics`, `listTasks`, `getTask`, `listSchedules`, `listWorkers`, `pauseQueue`, `resumeQueue`, `pauseWorker`, `resumeWorker`, `off` — public introspection and control surface for tooling and dashboards.
- `EventBus.subscribeAll` for fan-out subscribers (dashboards, tracing exporters).
- `InMemoryTransport.removeFromQueue` and `clearQueue` helpers used by DLQ operations.
- `QueueManager.listQueues` to enumerate created queues.

### Changed

- `Vorq.retryFromDLQ`, `retryAllFromDLQ`, and `purgeDLQ` are now fully implemented (previously no-op stubs). They support `InMemoryTransport` directly and any transport with a configured `StorageAdapter`.
- `Vorq.retryAllFromDLQ` and `purgeDLQ` now return `Promise<number>` (count of affected entries) instead of `Promise<void>`.
- `queue.pause()` and `queue.resume()` now actually pause/resume all `WorkerPool` instances attached to the queue (previously no-ops).
- `QueueManager` constructor now takes a `QueueManagerCallbacks` object instead of a single `enqueue` callback. **This is a breaking change** for any code that instantiated `QueueManager` directly; the standard public API surface (`new Vorq(...)`) is unchanged.

## 0.1.1

- Initial publishable release.
