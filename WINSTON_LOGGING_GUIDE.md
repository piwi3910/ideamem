# Winston Logging Implementation Guide

## Overview

IdeaMem now uses **Winston** for comprehensive structured logging with proper service identification, log levels, timestamps, and production-ready file rotation.

## 🔧 Configuration

### Environment Variables

```bash
# Logging Configuration
LOG_LEVEL=debug          # debug, info, http, warn, error
LOG_DIR=./logs          # Log files directory (production only)
SERVICE_NAME=ideamem-api # Service identifier
SERVICE_VERSION=1.0.0   # Service version
HOSTNAME=localhost      # Host identifier
```

### Log Levels (Winston Standard)

```typescript
{
  error: 0,    // Error conditions
  warn: 1,     // Warning conditions  
  info: 2,     // Informational messages
  http: 3,     // HTTP request/response logs
  verbose: 4,  // Verbose informational
  debug: 5,    // Debug-level messages
  silly: 6,    // Silly debug messages
}
```

## 🏗️ Architecture

### Service-Specific Loggers

```typescript
import { loggers } from '@/lib/logger';

// Pre-configured service loggers
loggers.api        // ideamem-api
loggers.database   // ideamem-database  
loggers.auth       // ideamem-auth
loggers.mcp        // ideamem-mcp
loggers.indexing   // ideamem-indexing
loggers.memory     // ideamem-memory
loggers.queue      // ideamem-queue
loggers.startup    // ideamem-startup
```

### Log Output Formats

**Development Console:**
```
14:25:30 info [ideamem-api][req_1703123456_abc123]: API Request Completed {
  "method": "GET",
  "url": "/api/projects",
  "statusCode": 200,
  "duration": 45
}
```

**Production JSON:**
```json
{
  "timestamp": "2024-01-15 14:25:30.123",
  "level": "INFO",
  "service": "ideamem-api",
  "requestId": "req_1703123456_abc123",
  "message": "API Request Completed",
  "method": "GET",
  "url": "/api/projects", 
  "statusCode": 200,
  "duration": 45,
  "environment": "production",
  "hostname": "server-01",
  "version": "1.0.0"
}
```

## 📂 File Structure (Production)

```
logs/
├── error.log      # Error level only
├── combined.log   # All log levels
└── access.log     # HTTP requests (level: http)
```

- **File Rotation**: 10MB max, 5 files retained
- **Console**: Always enabled with appropriate formatting

## 🚀 Usage Examples

### Basic Service Logging

```typescript
import { loggers } from '@/lib/logger';

// Database operations
loggers.database.info('User created', { userId: '123', email: 'user@example.com' });
loggers.database.error('Connection failed', error, { retryAttempt: 3 });

// API operations  
loggers.api.http('Request received', { method: 'POST', url: '/api/users' });
loggers.api.warn('Rate limit approaching', { userId: '123', requestCount: 95 });

// Authentication
loggers.auth.info('User authenticated', { userId: '123', method: 'oauth' });
loggers.auth.security('Failed login attempt', { ip: '192.168.1.100', attempts: 3 });
```

### Request-Correlated Logging

```typescript
import { createRequestLogger } from '@/lib/logger';

export function withLogging(handler) {
  return async (request, context) => {
    const requestId = generateRequestId();
    const requestLogger = createRequestLogger(requestId, 'ideamem-api');
    
    requestLogger.http('Request started', {
      method: request.method,
      url: request.url,
    });
    
    try {
      const result = await handler(request, context);
      requestLogger.http('Request completed', { statusCode: 200 });
      return result;
    } catch (error) {
      requestLogger.error('Request failed', error);
      throw error;
    }
  };
}
```

### Performance Logging

```typescript
import { PerformanceLogger } from '@/lib/middleware/logging';

const perf = new PerformanceLogger('database-query', {
  service: 'ideamem-database',
  requestId: 'req_123'
});

perf.mark('query-start');
const result = await prisma.user.findMany();
perf.mark('query-complete');

perf.mark('transform-start'); 
const transformed = transformResults(result);
perf.mark('transform-complete');

perf.finish(); // Logs all performance metrics
```

### Structured Error Logging

```typescript
import { Logger } from '@/lib/logger';

try {
  await processPayment(amount, userId);
} catch (error) {
  Logger.error('Payment processing failed', error, {
    amount,
    userId,
    paymentMethod: 'stripe',
    correlationId: 'pay_123'
  }, 'ideamem-api');
}
```

## 🛡️ Security Features

### Automatic Header Filtering

```typescript
// Automatically excluded from logs
const excludedHeaders = [
  'authorization',
  'cookie', 
  'x-api-key'
];
```

### Token Masking

```typescript
loggers.auth.error('Token validation failed', error, {
  tokenPrefix: token.substring(0, 8) + '...',  // Only log prefix
});
```

### IP Address Logging

```typescript
// Automatically extracts real IP from headers
const ip = getClientIP(request); // Handles x-forwarded-for, x-real-ip
requestLogger.warn('Rate limit exceeded', { ip, userId });
```

## 🏷️ Middleware Integration

### Full Middleware Stack

```typescript
import { LoggingMiddleware } from '@/lib/middleware/logging';

// Service-specific middleware
export const GET = LoggingMiddleware.api(handler);
export const POST = LoggingMiddleware.crud(handler, 'user', 'create');
export const PUT = LoggingMiddleware.auth(handler);
export const DELETE = LoggingMiddleware.mcp(handler);
```

### Custom Service Logging

```typescript
import { withLogging } from '@/lib/middleware/logging';

const handler = withLogging(
  async (request, context) => {
    // Your handler logic
  },
  {
    service: 'ideamem-custom',
    operation: 'special-task',
    resource: 'user-data'
  }
);
```

## 📊 Database Query Logging

Prisma queries are automatically logged via event handlers:

```typescript
// Automatically logged by database singleton
loggers.database.debug('Database Query', {
  query: 'SELECT * FROM users WHERE id = $1',
  params: '[\"123\"]',
  duration: 45,
  target: 'postgresql://...'
});
```

## 🎯 Best Practices

### 1. Service Identification
Always specify service context:
```typescript
loggers.memory.info('Vector search completed', { query, results: results.length });
```

### 2. Correlation IDs
Include request/operation IDs:
```typescript
const requestLogger = createRequestLogger(requestId, 'ideamem-api');
```

### 3. Structured Data
Use structured metadata:
```typescript
loggers.api.info('User action', {
  action: 'create_project',
  userId: '123',
  projectId: '456',
  timestamp: new Date().toISOString()
});
```

### 4. Error Context
Include actionable error context:
```typescript
Logger.error('Database connection failed', error, {
  database: 'postgresql',
  host: 'localhost',
  retryAttempt: 3,
  maxRetries: 5
}, 'ideamem-database');
```

### 5. Performance Metrics
Log critical performance data:
```typescript
Logger.perf('API Response Time', duration, {
  endpoint: '/api/search',
  method: 'POST',
  statusCode: 200,
  cacheHit: false
});
```

## 🔍 Log Analysis

### Development
Logs display in colored, formatted console output with service identification and request correlation.

### Production
- **Error Analysis**: Check `error.log` for application errors
- **Performance**: Monitor `combined.log` for slow operations  
- **Access Patterns**: Analyze `access.log` for API usage
- **Service Health**: Filter by service name for component-specific issues

### Example Queries (for log aggregation tools)

```bash
# Find all errors for specific service
grep '"service":"ideamem-database"' combined.log | grep '"level":"ERROR"'

# Performance issues
grep '"duration":[0-9]{4,}' combined.log | grep '"type":"request_complete"'

# Security events  
grep '"metric":"security"' combined.log

# Request correlation
grep '"requestId":"req_1703123456_abc123"' combined.log
```

## ✅ Implementation Status

- ✅ Winston logger configuration with service identification
- ✅ Environment-based log levels and outputs
- ✅ File rotation in production
- ✅ Database query logging integration  
- ✅ Request correlation with unique IDs
- ✅ Service-specific logger instances
- ✅ Middleware integration for automatic request/response logging
- ✅ Performance monitoring with timing utilities
- ✅ Security-conscious header filtering and token masking
- ✅ Structured error logging with context
- ✅ Auto-startup logging integration

The Winston logging system is now fully operational with comprehensive service identification, proper log levels, timestamps, and production-ready file management.