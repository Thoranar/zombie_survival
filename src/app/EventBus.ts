/**
 * Responsibility: Synchronous event bus for per-frame domain events.
 * Publishes: arbitrary string-typed events
 * Subscribes: arbitrary string-typed events
 * Config: none
 * Notes: Kept minimal for MVP; handlers run synchronously.
 */
export type EventHandler<T = unknown> = (_payload: T) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  public on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as EventHandler);
  }

  public off<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  public emit<T = unknown>(event: string, payload: T): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) h(payload);
  }
}
