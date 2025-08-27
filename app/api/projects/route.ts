import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProjects, createProject } from '@/lib/projects';
import { composeMiddleware } from '@/lib/middleware/compose';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().trim().optional(),
  gitRepo: z.string().min(1, 'Git repository is required').trim(),
});

export const GET = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 60, window: '1 m' },
    security: { contentSecurityPolicy: false },
    compression: { threshold: 1024 },
    errorHandling: { context: { resource: 'projects' } },
  },
  async (request: NextRequest) => {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  }
);

export const POST = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 10, window: '1 m' },
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { body: createProjectSchema },
    errorHandling: { context: { resource: 'projects' } },
  },
  async (request: NextRequest, { body }: { body: z.infer<typeof createProjectSchema> }) => {
    const project = await createProject({
      name: body.name,
      description: body.description || undefined,
      gitRepo: body.gitRepo,
    });

    return NextResponse.json({ project }, { status: 201 });
  }
);
