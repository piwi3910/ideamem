import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProject, deleteProject, updateProject } from '@/lib/projects';
import { deleteSource } from '@/lib/memory';
import { composeMiddleware } from '@/lib/middleware/compose';
import { withValidation } from '@/lib/middleware/validation';

const paramsSchema = z.object({
  id: z.string(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).trim().optional(),
  description: z.string().trim().optional(),
  gitRepo: z.string().trim().optional(),
});

export const GET = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 60, window: '1 m' },
    security: { contentSecurityPolicy: false },
    compression: { threshold: 1024 },
    validation: { params: paramsSchema },
    errorHandling: { context: { resource: 'project' } },
  },
  async (request: NextRequest, { params: { id } }: { params: z.infer<typeof paramsSchema> }) => {
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  }
);

export const DELETE = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 5, window: '5 m' },
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { params: paramsSchema },
    errorHandling: { context: { resource: 'project' } },
  },
  async (request: NextRequest, { params: { id } }: { params: z.infer<typeof paramsSchema> }) => {
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // deleteProject now handles all cleanup via ProjectService
    const success = await deleteProject(id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }
);

export const PATCH = withValidation(
  { params: paramsSchema, body: updateProjectSchema },
  async (_request: NextRequest, { params: { id }, body }: { 
    params: z.infer<typeof paramsSchema>, 
    body: z.infer<typeof updateProjectSchema> 
  }) => {
    const project = await updateProject(id, body);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  }
);

// Helper function to delete all project data from vector database
async function deleteAllProjectData(projectId: string) {
  // This is a simplified version - in a real implementation, you might want to
  // query all sources for this project and delete them individually
  // For now, we'll rely on the project-scoped nature of the vector data
  console.log(`Cleaning up data for project: ${projectId}`);
}
