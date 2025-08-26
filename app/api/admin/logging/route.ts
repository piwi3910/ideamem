import { setLogLevel, getAvailableLogLevels, LOG_LEVELS } from '@/lib/logger';
import { getLogLevel as getPersistedLogLevel, saveLogLevel } from '@/lib/config';
import { createSuccessResponse, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { level } = body;

    if (!level) {
      return createErrorResponse('Log level is required', HTTP_STATUS.BAD_REQUEST);
    }

    // Validate the log level
    if (!(level in LOG_LEVELS)) {
      const availableLevels = Object.keys(LOG_LEVELS);
      return createErrorResponse(
        `Invalid log level. Available levels: ${availableLevels.join(', ')}`,
        HTTP_STATUS.BAD_REQUEST,
        { availableLevels }
      );
    }

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