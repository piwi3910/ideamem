import { NextResponse } from 'next/server';
import { 
  getAllDocumentationRepositories,
  createDocumentationRepository,
  updateDocumentationRepository,
  deleteDocumentationRepository,
  getDocumentationRepository,
  checkIfRepositoryNeedsReindexing,
} from '@/lib/documentation-repositories';
import { QueueManager } from '@/lib/queue';
import { getDocumentationSchedulerStatus } from '@/lib/documentation-scheduler';

// GET - List all documentation repositories
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get('id');
    
    if (repositoryId) {
      // Get specific repository
      const repository = await getDocumentationRepository(repositoryId);
      if (!repository) {
        return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
      }
      
      // Check if repository needs reindexing
      const needsReindexing = await checkIfRepositoryNeedsReindexing(repository);
      
      return NextResponse.json({
        repository,
        needsReindexing,
      });
    } else {
      // Get all repositories with scheduler status
      const repositories = await getAllDocumentationRepositories();
      const schedulerStatus = await getDocumentationSchedulerStatus();
      
      return NextResponse.json({
        repositories,
        schedulerStatus,
      });
    }
  } catch (error) {
    console.error('Failed to get documentation repositories:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve documentation repositories' },
      { status: 500 }
    );
  }
}

// POST - Create new documentation repository
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }
    
    // Validate source type
    if (data.sourceType && !['git', 'llmstxt', 'website'].includes(data.sourceType)) {
      return NextResponse.json(
        { error: 'Invalid source type. Must be git, llmstxt, or website' },
        { status: 400 }
      );
    }
    
    // Validate reindex interval
    if (data.reindexInterval && (typeof data.reindexInterval !== 'number' || data.reindexInterval < 1)) {
      return NextResponse.json(
        { error: 'Reindex interval must be a positive number (days)' },
        { status: 400 }
      );
    }
    
    const repository = await createDocumentationRepository(data);
    
    // If auto-reindexing is enabled, trigger initial indexing
    if (repository.autoReindexEnabled) {
      await QueueManager.addDocumentationIndexingJob({
        repositoryId: repository.id,
        repositoryUrl: repository.url,
        branch: repository.branch,
        sourceType: repository.sourceType,
        forceReindex: true, // Initial indexing should always run
      });
    }
    
    return NextResponse.json({ repository }, { status: 201 });
  } catch (error) {
    console.error('Failed to create documentation repository:', error);
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'Repository with this name or URL already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create documentation repository' },
      { status: 500 }
    );
  }
}

// PUT - Update documentation repository
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get('id');
    
    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }
    
    const data = await request.json();
    
    // Validate reindex interval if provided
    if (data.reindexInterval && (typeof data.reindexInterval !== 'number' || data.reindexInterval < 1)) {
      return NextResponse.json(
        { error: 'Reindex interval must be a positive number (days)' },
        { status: 400 }
      );
    }
    
    const repository = await updateDocumentationRepository(repositoryId, data);
    
    return NextResponse.json({ repository });
  } catch (error) {
    console.error('Failed to update documentation repository:', error);
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'Repository with this name or URL already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update documentation repository' },
      { status: 500 }
    );
  }
}

// DELETE - Delete documentation repository
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get('id');
    
    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }
    
    await deleteDocumentationRepository(repositoryId);
    
    // TODO: Also clean up any associated vectors/documents
    // This could be handled by a cleanup job
    await QueueManager.addCleanupJob({
      type: 'documentation_repository',
      targetId: repositoryId,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete documentation repository:', error);
    return NextResponse.json(
      { error: 'Failed to delete documentation repository' },
      { status: 500 }
    );
  }
}