import { prisma } from '@/lib/database';
import { ToolContext } from './tool';

/**
 * Extract bearer token from request headers
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Authenticate a project using bearer token
 */
export async function authenticateProject(token: string): Promise<string | null> {
  if (!token) return null;
  
  try {
    const project = await prisma.project.findUnique({
      where: { token },
      select: { id: true },
    });
    
    return project?.id || null;
  } catch (error) {
    console.error('Error authenticating project:', error);
    return null;
  }
}

/**
 * Create a tool context from a request
 */
export async function createToolContext(request: Request): Promise<ToolContext> {
  const token = extractBearerToken(request);
  const projectId = token ? await authenticateProject(token) : undefined;
  
  return {
    projectId,
    token: token || undefined,
    request,
  };
}