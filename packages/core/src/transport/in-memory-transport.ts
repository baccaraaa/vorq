import { TransportError } from "../errors/index.js";
import type {
  MessageEnvelope,
  MessageHandler,
  PublishOptions,
  QueueOptions,
  TaskMessage,
  TransportAdapter,
} from "./types.js";

export class InMemoryTransport implements TransportAdapter {
  private connected = false;
  private queues = new Map<string, MessageEnvelope[]>();
  private handlers = new Map<string, MessageHandler>();
  private processing = new Set<string>();
  private messageQueues = new Map<string, string>();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async createQueue(name: string, _options: QueueOptions): Promise<void> {
    if (!this.queues.has(name)) {
      this.queues.set(name, []);
    }
  }

  async deleteQueue(name: string): Promise<void> {
    this.queues.delete(name);
  }

  async publish(queue: string, message: TaskMessage, options: PublishOptions): Promise<void> {
    if (!this.connected) {
      throw new TransportError("Cannot publish: transport is disconnected");
    }

    const envelope: MessageEnvelope = {
      messageId: options.messageId ?? crypto.randomUUID(),
      task: message,
      receivedAt: Date.now(),
    };

    const q = this.queues.get(queue) ?? [];
    q.push(envelope);
    this.queues.set(queue, q);
    this.messageQueues.set(envelope.messageId, queue);
  }

  async subscribe(queue: string, handler: MessageHandler): Promise<void> {
    this.handlers.set(queue, handler);
  }

  async acknowledge(envelope: MessageEnvelope): Promise<void> {
    this.processing.delete(envelope.messageId);
  }

  async reject(envelope: MessageEnvelope, requeue: boolean): Promise<void> {
    this.processing.delete(envelope.messageId);

    if (requeue) {
      const queueName = this.messageQueues.get(envelope.messageId) ?? envelope.task.queue;
      const q = this.queues.get(queueName) ?? [];
      q.unshift(envelope);
      this.queues.set(queueName, q);
    }
  }

  getPublished(queue: string): MessageEnvelope[] {
    return this.queues.get(queue) ?? [];
  }

  removeFromQueue(queue: string, predicate: (e: MessageEnvelope) => boolean): MessageEnvelope[] {
    const q = this.queues.get(queue) ?? [];
    const kept: MessageEnvelope[] = [];
    const removed: MessageEnvelope[] = [];
    for (const env of q) (predicate(env) ? removed : kept).push(env);
    this.queues.set(queue, kept);
    return removed;
  }

  clearQueue(queue: string): number {
    const q = this.queues.get(queue) ?? [];
    const n = q.length;
    this.queues.set(queue, []);
    return n;
  }

  async drain(queue: string): Promise<void> {
    const handler = this.handlers.get(queue);
    if (!handler) {
      return;
    }

    const q = this.queues.get(queue);
    if (!q || q.length === 0) {
      return;
    }

    q.sort((a, b) => a.task.priority - b.task.priority);

    const messages = [...q];
    q.length = 0;

    for (const envelope of messages) {
      this.processing.add(envelope.messageId);
      await handler(envelope);
      this.processing.delete(envelope.messageId);
    }
  }
}
