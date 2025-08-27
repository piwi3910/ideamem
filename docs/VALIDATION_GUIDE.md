# API Validation Guide

## Overview

This guide documents the Zod validation implementation across all API routes in the IdeaMem application.

## Architecture

### Core Components

1. **Validation Middleware** (`lib/middleware/validation.ts`)
   - `withValidation()` - Main middleware wrapper
   - Handles body, query, params, and headers validation
   - Automatic error responses with detailed validation messages

2. **Centralized Schemas** (`lib/schemas/index.ts`)
   - All reusable Zod schemas in one place
   - Organized by domain (projects, constraints, search, etc.)
   - Export as `Schemas` namespace for easy importing

3. **CRUD Factory** (`lib/handlers/crud-factory.ts`)
   - Pre-configured validation for CRUD operations
   - Automatic validation for preferences and rules endpoints

## Usage Patterns

### Basic Route Validation

```typescript
import { withValidation } from '@/lib/middleware/validation';
import { Schemas } from '@/lib/schemas';

export const POST = withValidation(
  { 
    body: Schemas.project.create,
    params: Schemas.params.id 
  },
  async (request, { body, params }) => {
    // body and params are fully typed and validated
    return NextResponse.json({ success: true });
  }
);
```

### Custom Schema Definition

```typescript
import { z } from 'zod';
import { withValidation } from '@/lib/middleware/validation';

const customSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0).max(150),
});

export const POST = withValidation(
  { body: customSchema },
  async (request, { body }) => {
    // Handle validated data
  }
);
```

### Query Parameter Validation

```typescript
export const GET = withValidation(
  { query: Schemas.pagination },
  async (request, { query }) => {
    const { page, limit } = query;
    // page and limit are validated numbers
  }
);
```

### Discriminated Union Validation

```typescript
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), data: z.string() }),
  z.object({ action: z.literal('stop') }),
]);

export const POST = withValidation(
  { body: actionSchema },
  async (request, { body }) => {
    switch (body.action) {
      case 'start':
        // body.data is available here
        break;
      case 'stop':
        // No data field here
        break;
    }
  }
);
```

## Validated Routes

### Admin Routes
- ✅ `/api/admin/config` - Configuration management
- ✅ `/api/admin/documentation` - Documentation repository CRUD
- ✅ `/api/admin/health` - Service health checks
- ✅ `/api/admin/logging` - Log level configuration
- ✅ `/api/admin/queues` - Queue management operations
- ✅ `/api/admin/workers` - Worker control

### Project Routes
- ✅ `/api/projects` - Project CRUD
- ✅ `/api/projects/[id]` - Individual project operations
- ✅ `/api/projects/[id]/constraints` - Project constraints
- ✅ `/api/projects/[id]/schedule` - Scheduled indexing config
- ✅ `/api/projects/[id]/webhook` - Webhook configuration
- ✅ `/api/projects/[id]/index` - Manual indexing control
- ✅ `/api/projects/[id]/preferences` - Via CRUD factory

### Global Routes
- ✅ `/api/global/constraints` - Global constraints management
- ✅ `/api/global/preferences` - Via CRUD factory
- ✅ `/api/global/rules` - Via CRUD factory

### Search Routes
- ✅ `/api/search/facets` - Faceted search
- ✅ `/api/search/visualization` - Search result visualization

### Webhook Routes
- ✅ `/api/webhooks/[projectId]` - GitHub/GitLab/Bitbucket webhooks

## Common Validation Schemas

### Base Types
- `uuidSchema` - UUID validation
- `urlSchema` - URL format validation
- `emailSchema` - Email validation
- `sourceSchema` - Non-empty string
- `contentSchema` - Non-empty content

### Enums
- `constraintCategoryEnum` - rule, tooling, workflow, formatting
- `contentTypeEnum` - code, documentation, conversation, etc.
- `searchTypeEnum` - hybrid, semantic, keyword
- `logLevelEnum` - error, warn, info, verbose, debug, silly
- `indexStatusEnum` - IDLE, INDEXING, COMPLETED, ERROR

### Common Patterns
- `paginationSchema` - page, limit, offset
- `searchQuerySchema` - q, type, language, source
- `idParamSchema` - { id: string }
- `projectIdParamSchema` - { projectId: string }

## Error Response Format

When validation fails, the middleware automatically returns:

```json
{
  "error": "Validation failed",
  "details": {
    "issues": [
      {
        "path": ["field"],
        "message": "Field is required",
        "code": "invalid_type"
      }
    ]
  }
}
```

## Best Practices

1. **Use Centralized Schemas**: Import from `lib/schemas` instead of defining inline
2. **Type Safety**: Let TypeScript infer types from schemas
3. **Clear Messages**: Provide custom error messages in schemas
4. **Coercion**: Use `.coerce` for number/boolean conversions from strings
5. **Defaults**: Provide sensible defaults with `.default()`
6. **Optional Fields**: Use `.optional()` for nullable fields
7. **Trim Strings**: Use `.trim()` for user input strings

## Migration Guide

To migrate an existing route to use Zod validation:

1. Import validation middleware and schemas:
```typescript
import { withValidation } from '@/lib/middleware/validation';
import { Schemas } from '@/lib/schemas';
```

2. Replace function declaration with validated export:
```typescript
// Before
export async function POST(request: Request) {
  const body = await request.json();
  // Manual validation...
}

// After
export const POST = withValidation(
  { body: Schemas.project.create },
  async (request, { body }) => {
    // body is validated
  }
);
```

3. Remove manual validation code
4. Update error handling to use validated data

## Testing Validation

Example test request:

```bash
# Valid request
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "gitRepo": "https://github.com/test/repo"}'

# Invalid request (missing required field)
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
# Returns: {"error": "Validation failed", "details": {...}}
```

## Extending Validation

To add new schemas:

1. Add to `lib/schemas/index.ts`
2. Export in appropriate category
3. Add to `Schemas` namespace
4. Document in this guide

## Performance Considerations

- Validation is synchronous and fast
- Schemas are parsed once at startup
- No runtime overhead beyond validation
- Safe parsing prevents throwing errors

## Security Benefits

- Prevents injection attacks
- Ensures type safety
- Validates data boundaries
- Sanitizes user input
- Prevents prototype pollution