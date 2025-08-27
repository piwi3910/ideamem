export * from './health-service';

import { HealthCheckService } from './health-service';

// Export a singleton instance for convenience
export const healthService = HealthCheckService.getInstance();