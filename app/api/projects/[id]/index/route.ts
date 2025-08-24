import { NextResponse } from 'next/server';
import { getProject, startIndexingJob, cancelIndexingJob } from '@/lib/projects';
import { startCodebaseIndexing, cancelIndexing } from '@/lib/indexing';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.indexStatus === 'indexing') {
      return NextResponse.json(
        { error: 'Indexing already in progress' },
        { status: 409 }
      );
    }

    // Start the indexing job tracking
    await startIndexingJob(id);

    // Start the actual indexing process in the background
    // Don't await this so the request returns immediately
    startCodebaseIndexing(id, project.gitRepo).catch(error => {
      console.error('Background indexing failed:', error);
    });

    return NextResponse.json({ 
      message: 'Indexing started',
      projectId: id 
    });
  } catch (error) {
    console.error('Error starting indexing:', error);
    return NextResponse.json(
      { error: 'Failed to start indexing' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = cancelIndexing(id);
    
    if (success) {
      await cancelIndexingJob(id);
      return NextResponse.json({ message: 'Indexing cancelled' });
    } else {
      return NextResponse.json(
        { error: 'No active indexing job found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error cancelling indexing:', error);
    return NextResponse.json(
      { error: 'Failed to cancel indexing' },
      { status: 500 }
    );
  }
}