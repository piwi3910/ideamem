import { NextResponse } from 'next/server';
import { getProjects, createProject } from '@/lib/projects';

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, gitRepo } = body;

    if (!name || !gitRepo) {
      return NextResponse.json({ error: 'Name and git repository are required' }, { status: 400 });
    }

    const project = await createProject({
      name: name.trim(),
      description: description?.trim() || undefined,
      gitRepo: gitRepo.trim(),
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    const message = error instanceof Error ? error.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
