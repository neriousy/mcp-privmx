import { EventEmitter } from 'events';

/**
 * Global event bus allowing loosely-coupled services to subscribe to MCP lifecycle events.
 *
 * Example usage:
 *   eventBus.on('vector.index.complete', (payload) => { ... })
 */
// Narrow known event names – extend as needed
export type McpEvent =
  | 'vector.initialized'
  | 'vector.index.start'
  | 'vector.index.complete'
  | 'search.started'
  | 'search.completed'
  | string; // allow custom extensions

const eventBus = new EventEmitter();

export default eventBus as EventEmitter;
