import type { ActionHandler } from './types.js';

export class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  register(handler: ActionHandler): void {
    if (this.handlers.has(handler.actionId)) {
      throw new Error(`Action handler already registered: ${handler.actionId}`);
    }
    this.handlers.set(handler.actionId, handler);
  }

  get(actionId: string): ActionHandler | undefined {
    return this.handlers.get(actionId);
  }

  getRegisteredIds(): string[] {
    return [...this.handlers.keys()];
  }
}
