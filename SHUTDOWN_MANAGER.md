# Shutdown Manager

## Problem Solved

Fixed `MaxListenersExceededWarning` by consolidating all process signal handlers into a centralized shutdown manager.

**Previous Issue:**
```
(node:33756) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process]. MaxListeners is 10.
```

**Root Cause:**
Multiple modules (`lib/database.ts`, `lib/queue.ts`, `lib/workers.ts`) were each registering their own `SIGTERM`/`SIGINT` handlers, exceeding Node.js's default limit of 10 listeners per event.

## Solution

### Centralized Shutdown Manager (`lib/shutdown-manager.ts`)

- **Single Point of Control**: All signal handlers managed in one place
- **Priority-Based Execution**: Handlers execute in priority order (lower numbers first)
- **Graceful Error Handling**: Individual handler failures don't prevent shutdown
- **Logging Integration**: Full visibility into shutdown process
- **Memory Leak Prevention**: Uses `process.setMaxListeners(20)` appropriately

### Handler Registration

```typescript
import { registerShutdownHandler } from './shutdown-manager';

// Register with priority (lower = earlier execution)
registerShutdownHandler('database', async () => {
  await DatabaseClient.disconnect();
}, 1); // High priority - close database connections first

registerShutdownHandler('queues', closeQueues, 2);      // After database
registerShutdownHandler('workers', stopWorkers, 3);    // After queues
```

### Current Shutdown Order

1. **Priority 1: Database** - Close Prisma connections
2. **Priority 2: Queues** - Close BullMQ queues and connections  
3. **Priority 3: Workers** - Stop background workers

## Benefits

- ✅ **Eliminates Memory Leak Warnings**: Single set of signal handlers
- ✅ **Organized Shutdown**: Proper dependency order (database → queues → workers)  
- ✅ **Error Resilience**: Individual handler failures logged but don't block shutdown
- ✅ **Visibility**: Full logging of shutdown process with timing
- ✅ **Maintainable**: Easy to add new shutdown handlers

## Usage

### Register New Shutdown Handler

```typescript
import { registerShutdownHandler } from './shutdown-manager';

// Register during module initialization
registerShutdownHandler('my-service', async () => {
  await myService.close();
}, 5); // Priority 5 (lower priority)
```

### Debug Shutdown Handlers

```typescript
import { getShutdownHandlers } from './shutdown-manager';

console.log(getShutdownHandlers());
// [
//   { name: 'database', priority: 1 },
//   { name: 'queues', priority: 2 },
//   { name: 'workers', priority: 3 }
// ]
```

## Implementation

The shutdown manager:
1. **Prevents Duplicate Handlers**: Only initializes process signals once
2. **Manages Handler Registry**: Sorts by priority automatically
3. **Executes Gracefully**: Runs all handlers with proper error handling and logging
4. **Exits Cleanly**: Calls `process.exit(0)` after all handlers complete

This eliminates the Node.js EventEmitter memory leak warnings and ensures proper, ordered application shutdown.