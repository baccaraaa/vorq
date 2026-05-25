import type { VorqLogger } from "../logging/types.js";
import type { VorqEvent, VorqEventListener, VorqEventMap } from "./types.js";

export type VorqEventAllListener = (event: VorqEvent, data: unknown) => void | Promise<void>;

export class EventBus {
  private readonly listeners = new Map<string, Set<VorqEventListener<VorqEvent>>>();
  private readonly allListeners = new Set<VorqEventAllListener>();

  constructor(private readonly logger: VorqLogger) {}

  on<E extends VorqEvent>(event: E, listener: VorqEventListener<E>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener as VorqEventListener<VorqEvent>);
  }

  off<E extends VorqEvent>(event: E, listener: VorqEventListener<E>): void {
    this.listeners.get(event)?.delete(listener as VorqEventListener<VorqEvent>);
  }

  /**
   * Subscribe to every emitted event. The listener receives both the event
   * name and its payload (typed as `unknown` — narrow via the name). Returns
   * an unsubscribe function. Useful for fan-out subscribers like dashboards
   * and trace exporters that want a single hook into the entire stream.
   */
  subscribeAll(listener: VorqEventAllListener): () => void {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }

  async emit<E extends VorqEvent>(event: E, data: VorqEventMap[E]): Promise<void> {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          await listener(data);
        } catch (error) {
          this.logger.error(`EventBus listener error on ${event}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    for (const listener of this.allListeners) {
      try {
        await listener(event, data);
      } catch (error) {
        this.logger.error(`EventBus subscribeAll listener error on ${event}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
