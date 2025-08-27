import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProjects, createProject } from '@/lib/projects';
import { withValidation } from '@/lib/middleware/validation';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().trim().optional(),
  gitRepo: z.string().min(1, 'Git repository is required').trim(),
});

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export const POST = withValidation(
  { body: createProjectSchema },
  async (_request: NextRequest, { body }) => {
    try {
      const project = await createProject({
        name: body.name,
        description: body.description || undefined,
        gitRepo: body.gitRepo,
      });

      return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
      console.error('Error creating project:', error);
      const message = error instanceof Error ? error.message : 'Failed to create project';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
