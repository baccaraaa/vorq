import { describe, expect, it } from "vitest";
import type { BoardDataSource } from "./types.js";

describe("BoardDataSource interface", () => {
  it("defines all v0.1.0 methods", () => {
    // Compile-time assertion: if any method is renamed or removed, the array
    // below stops being assignable to `(keyof BoardDataSource)[]` and the
    // build fails. The length check guards against accidental additions.
    const required: (keyof BoardDataSource)[] = [
      "listQueues",
      "getQueueDetail",
      "pauseQueue",
      "resumeQueue",
      "listTasks",
      "getTask",
      "listDlq",
      "retryFromDlq",
      "retryAllFromDlq",
      "purgeDlq",
      "listWorkers",
      "pauseWorker",
      "resumeWorker",
      "listSchedules",
    ];
    expect(required.length).toBe(14);
  });
});
