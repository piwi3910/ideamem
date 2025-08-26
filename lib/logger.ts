import winston from 'winston';
import path from 'path';

// Define log levels (Winston default levels)
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
} as const;

// Service identification
export const SERVICE_NAME = 'ideamem-api';
export const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';

// Log format configuration
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: service || SERVICE_NAME,
      message,
      ...(requestId ? { requestId } : {}),
      ...(meta && typeof meta === 'object' && meta !== null ? meta : {}),
    };
    
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
    const serviceInfo = `[${service || SERVICE_NAME}]`;
    const requestInfo = requestId ? `[${requestId}]` : '';
    const metaKeys = Object.keys(meta || {});
    const metaInfo = metaKeys.length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    
    return `${timestamp} ${level} ${serviceInfo}${requestInfo}: ${message}${metaInfo}`;
  })
);

// Initialize logger with default level, will be updated from database
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels: LOG_LEVELS,
  defaultMeta: {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: process.env.NODE_ENV || 'development',
    hostname: process.env.HOSTNAME || 'localhost',
  },
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    }),
  ],
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || './logs';
  
  // Error logs
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));
  
  // Combined logs
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));
  
  // HTTP access logs
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'access.log'),
    level: 'http',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));
}

// Service-specific logger factory
export function createServiceLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}

// Specialized loggers for different components
export const loggers = {
  api: createServiceLogger('ideamem-api'),
  database: createServiceLogger('ideamem-database'),
  auth: createServiceLogger('ideamem-auth'),
  mcp: createServiceLogger('ideamem-mcp'),
  indexing: createServiceLogger('ideamem-indexing'),
  memory: createServiceLogger('ideamem-memory'),
  queue: createServiceLogger('ideamem-queue'),
  startup: createServiceLogger('ideamem-startup'),
} as const;

// Request-specific logger with correlation ID
export function createRequestLogger(requestId: string, service: string = 'ideamem-api') {
  return logger.child({ 
    requestId,
    service,
  });
}

// Structured logging helpers
export const Logger = {
  /**
   * Log with specific service context
   */
  withService: (serviceName: string) => createServiceLogger(serviceName),
  
  /**
   * Log with request context
   */
  withRequest: (requestId: string, serviceName?: string) => createRequestLogger(requestId, serviceName),
  
  /**
   * Debug level logging
   */
  debug: (message: string, meta?: any, serviceName?: string) => {
    const serviceLogger = serviceName ? createServiceLogger(serviceName) : logger;
    serviceLogger.debug(message, meta);
  },
  
  /**
   * Info level logging
   */
  info: (message: string, meta?: any, serviceName?: string) => {
    const serviceLogger = serviceName ? createServiceLogger(serviceName) : logger;
    serviceLogger.info(message, meta);
  },
  
  /**
   * HTTP level logging (for requests)
   */
  http: (message: string, meta?: any, serviceName?: string) => {
    const serviceLogger = serviceName ? createServiceLogger(serviceName) : logger;
    serviceLogger.http(message, meta);
  },
  
  /**
   * Warning level logging
   */
  warn: (message: string, meta?: any, serviceName?: string) => {
    const serviceLogger = serviceName ? createServiceLogger(serviceName) : logger;
    serviceLogger.warn(message, meta);
  },
  
  /**
   * Error level logging
   */
  error: (message: string, error?: any, meta?: any, serviceName?: string) => {
    const serviceLogger = serviceName ? createServiceLogger(serviceName) : logger;
    const errorMeta = {
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
        }
      }),
      ...meta,
    };
    serviceLogger.error(message, errorMeta);
  },
  
  /**
   * Performance logging
   */
  perf: (operation: string, duration: number, meta?: any, serviceName?: string) => {
    const serviceLogger = serviceName ? createServiceLogger(serviceName) : logger;
    serviceLogger.info(`Performance: ${operation}`, {
      operation,
      duration,
      metric: 'performance',
      ...meta,
    });
  },
  
  /**
   * Security logging
   */
  security: (event: string, meta?: any, serviceName?: string) => {
    const serviceLogger = serviceName ? createServiceLogger(serviceName) : logger;
    serviceLogger.warn(`Security: ${event}`, {
      event,
      metric: 'security',
      ...meta,
    });
  },
};

/**
 * Dynamic logging level management
 */
export function setLogLevel(level: keyof typeof LOG_LEVELS) {
  logger.level = level;
  
  // Update all child loggers
  Object.values(loggers).forEach(childLogger => {
    childLogger.level = level;
  });
  
  // Database query logging is disabled for now
  
  logger.info('Log level changed', { 
    newLevel: level.toUpperCase(),
    service: 'ideamem-logger'
  });
}

export function getLogLevel(): string {
  return logger.level;
}

export function getAvailableLogLevels(): Array<{ value: string; label: string; description: string }> {
  return [
    { value: 'error', label: 'Error', description: 'Error conditions only' },
    { value: 'warn', label: 'Warning', description: 'Warning conditions and errors' },
    { value: 'info', label: 'Info', description: 'Informational messages, warnings, and errors' },
    { value: 'http', label: 'HTTP', description: 'HTTP requests, info, warnings, and errors' },
    { value: 'verbose', label: 'Verbose', description: 'Verbose informational messages' },
    { value: 'debug', label: 'Debug', description: 'Debug-level messages (most verbose)' },
    { value: 'silly', label: 'Silly', description: 'All messages including silly debug' },
  ];
}

// Initialize logger from database on startup
export async function initializeLoggerFromDatabase() {
  try {
    // Dynamically import to avoid circular dependency
    const { getLogLevel: getPersistedLogLevel } = await import('./config');
    const persistedLevel = await getPersistedLogLevel();
    setLogLevel(persistedLevel as keyof typeof LOG_LEVELS);
    logger.info('Logger initialized from database', { 
      level: persistedLevel.toUpperCase(),
      service: 'ideamem-logger' 
    });
  } catch (error) {
    logger.warn('Failed to initialize logger from database, using default', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      service: 'ideamem-logger' 
    });
  }
}

// Export the main logger instance
export default logger;

// Health check for logger
export function loggerHealthCheck(): boolean {
  try {
    logger.info('Logger health check', { healthCheck: true });
    return true;
  } catch (error) {
    console.error('Logger health check failed:', error);
    return false;
  }
}