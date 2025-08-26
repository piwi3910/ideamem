import { getProjectByToken } from '@/lib/projects';
import { loggers } from '@/lib/logger';

// Custom function to validate Bearer tokens for API routes
export async function validateBearerToken(authHeader: string | null): Promise<{
  projectId: string;
  projectName: string;
  gitRepo: string;
  token: string;
} | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring('Bearer '.length);
  
  try {
    const project = await getProjectByToken(token);
    if (project) {
      return {
        projectId: project.id,
        projectName: project.name,
        gitRepo: project.gitRepo,
        token: token,
      };
    }
  } catch (error) {
    loggers.auth.error('Token validation failed', error, {
      tokenPrefix: token.substring(0, 8) + '...',
    });
  }

  return null;
}