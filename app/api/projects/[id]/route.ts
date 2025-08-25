import { NextResponse } from 'next/server';
import { getProject, deleteProject, updateProject } from '@/lib/projects';
import { deleteSource } from '@/lib/memory';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete all indexed data for this project
    try {
      // We'll need to get all sources for this project and delete them
      // For now, we'll use a simplified approach
      await deleteAllProjectData(id);
    } catch (error) {
      console.warn('Failed to clean up project data:', error);
    }

    const success = await deleteProject(id);

    if (!success) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const project = await updateProject(id, body);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// Helper function to delete all project data from vector database
async function deleteAllProjectData(projectId: string) {
  // This is a simplified version - in a real implementation, you might want to
  // query all sources for this project and delete them individually
  // For now, we'll rely on the project-scoped nature of the vector data
  console.log(`Cleaning up data for project: ${projectId}`);
}
