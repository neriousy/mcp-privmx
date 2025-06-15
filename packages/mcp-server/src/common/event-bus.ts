import { EventEmitter } from 'events';

/**
 * Global event bus allowing loosely-coupled services to subscribe to MCP lifecycle events.
 *
 * Example usage:
 *   eventBus.on('vector.index.complete', (payload) => { ... })
 */
// Narrow known event names – extend as needed
export interface McpEvents {
  'vector.initialized': void;
  'vector.index.start': void;
  'vector.index.complete': void;
  'search.started': void;
  'search.completed': void;
  [key: string]: unknown;
}

const eventBus = new EventEmitter();

export default eventBus as EventEmitter;
