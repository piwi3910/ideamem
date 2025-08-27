import { NextRequest } from 'next/server';
import { z } from 'zod';
import { setLogLevel, getAvailableLogLevels, LOG_LEVELS } from '@/lib/logger';
import { getLogLevel as getPersistedLogLevel, saveLogLevel } from '@/lib/config';
import { createSuccessResponse, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { withValidation } from '@/lib/middleware/validation';

const logLevelSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'verbose', 'debug', 'silly']),
});

export async function GET() {
  try {
    const currentLevel = await getPersistedLogLevel();
    const availableLevels = getAvailableLogLevels();
    
    return createSuccessResponse({
      currentLevel,
      availableLevels,
      logLevels: LOG_LEVELS,
    });
  } catch (error) {
    console.error('Error getting logging configuration:', error);
    return createErrorResponse('Failed to get logging configuration', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export const POST = withValidation(
  { body: logLevelSchema },
  async (_request: NextRequest, { body: { level } }) => {
    try {
      // Set the new log level in Winston
      setLogLevel(level as keyof typeof LOG_LEVELS);
      
      // Save the log level to database for persistence
      await saveLogLevel(level);
      
      return createSuccessResponse({
        message: `Log level changed to ${level.toUpperCase()}`,
        newLevel: level,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error setting log level:', error);
      return createErrorResponse('Failed to set log level', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
);