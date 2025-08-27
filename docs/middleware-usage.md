# Middleware Usage Guide

This guide shows how to use the centralized middleware system in the IdeaMem application.

## Available Middleware

1. **CORS** - Cross-Origin Resource Sharing configuration
2. **Rate Limiting** - Request rate limiting with Upstash Redis
3. **Security Headers** - Security headers using helmet patterns
4. **Compression** - Response compression (gzip, deflate, brotli)
5. **Validation** - Request validation using Zod schemas
6. **Error Handling** - Centralized error handling

## Using Pre-configured Middleware Stacks

The easiest way to apply middleware is using pre-configured stacks:

```typescript
import { MiddlewareStacks } from '@/lib/middleware/compose';

// Standard API endpoint with all middleware
export const GET = MiddlewareStacks.api(async (request) => {
  // Your handler code
  return NextResponse.json({ data: 'example' });
});

// Health check endpoint (no rate limiting, no compression)
export const GET = MiddlewareStacks.health(async (request) => {
  return NextResponse.json({ status: 'healthy' });
});

// Webhook endpoint
export const POST = MiddlewareStacks.webhook(async (request) => {
  // Handle webhook
  return NextResponse.json({ received: true });
});
```

## Custom Middleware Composition

For custom configurations, use `composeMiddleware`:

```typescript
import { composeMiddleware } from '@/lib/middleware/compose';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const POST = composeMiddleware(
  {
    cors: {
      origin: ['https://example.com'],
      credentials: true,
    },
    rateLimit: {
      requests: 10,
      window: '1 m',
    },
    security: {
      frameguard: { action: 'deny' },
    },
    compression: {
      threshold: 1024,
      level: 6,
    },
    validation: {
      body: schema,
    },
    errorHandling: {
      context: { resource: 'user' },
    },
  },
  async (request, { body }) => {
    // body is validated and typed
    console.log(body.name, body.email);
    return NextResponse.json({ success: true });
  }
);
```

## Individual Middleware Usage

You can also use middleware individually:

```typescript
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { withCors } from '@/lib/middleware/cors';
import { withCompression } from '@/lib/middleware/compression';

export const GET = withRateLimit(
  { requests: 30, window: '1 m' },
  withCors(
    withCompression(
      async (request) => {
        return NextResponse.json({ data: 'example' });
      },
      { threshold: 1024 }
    ),
    { origin: '*' }
  )
);
```

## Configuration Options

### CORS Configuration
```typescript
{
  origin: '*' | string | string[] | ((origin) => boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit'],
  credentials: true,
  maxAge: 86400,
}
```

### Rate Limiting Configuration
```typescript
{
  requests: 60,           // Number of requests
  window: '1 m',         // Time window (1 m, 5 m, 1 h, etc.)
  identifier: (req) => req.ip,  // Custom identifier
  skipIf: (req) => false,       // Skip condition
}
```

### Security Headers Configuration
```typescript
{
  contentSecurityPolicy: { /* CSP directives */ },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, preload: true },
  noSniff: true,
  xssFilter: true,
}
```

### Compression Configuration
```typescript
{
  threshold: 1024,    // Minimum size to compress (bytes)
  level: 6,          // Compression level (0-9)
  encodings: ['br', 'gzip', 'deflate'],
}
```

## Environment Variables

```env
# CORS
ALLOWED_ORIGINS=https://app.example.com,https://example.com
ADMIN_ORIGINS=http://localhost:3000

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

## Migration from Old Patterns

### Before (individual middleware):
```typescript
import { withErrorHandling } from '@/lib/middleware/error-handler';
import { withValidation } from '@/lib/middleware/validation';

export const POST = withValidation(
  { body: schema },
  withErrorHandling(
    async (request, { body }) => {
      // handler
    },
    { resource: 'user' }
  )
);
```

### After (composed middleware):
```typescript
import { composeMiddleware } from '@/lib/middleware/compose';

export const POST = composeMiddleware(
  {
    validation: { body: schema },
    errorHandling: { context: { resource: 'user' } },
    // Automatically includes CORS, rate limiting, security headers
  },
  async (request, { body }) => {
    // handler
  }
);
```

## Testing Middleware

```typescript
// Test rate limiting
for (let i = 0; i < 100; i++) {
  const res = await fetch('/api/endpoint');
  console.log(res.headers.get('X-RateLimit-Remaining'));
}

// Test CORS
const res = await fetch('/api/endpoint', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://example.com',
  },
});
console.log(res.headers.get('Access-Control-Allow-Origin'));

// Test compression
const res = await fetch('/api/endpoint', {
  headers: {
    'Accept-Encoding': 'gzip, deflate, br',
  },
});
console.log(res.headers.get('Content-Encoding'));
```