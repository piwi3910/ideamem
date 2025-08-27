import { PreConfiguredRoutes } from '@/lib/handlers/crud-factory';

// Use pre-configured CRUD routes for project constraints
// These automatically include all middleware (CORS, rate limiting, security headers, compression, validation, error handling)
export const { GET, POST, PUT, DELETE } = PreConfiguredRoutes.projectConstraints;