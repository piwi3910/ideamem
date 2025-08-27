import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
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
import { MiddlewareStacks } from '@/lib/middleware/compose';
import { withValidation } from '@/lib/middleware/validation';

// Define schemas for validation
const createRepositorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Invalid URL format'),
  sourceType: z.enum(['git', 'llmstxt', 'website']).optional(),
  branch: z.string().optional(),
  description: z.string().optional(),
  reindexInterval: z.number().min(1, 'Reindex interval must be at least 1 day').optional(),
  autoReindexEnabled: z.boolean().optional(),
});

const updateRepositorySchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  sourceType: z.enum(['git', 'llmstxt', 'website']).optional(),
  branch: z.string().optional(),
  description: z.string().optional(),
  reindexInterval: z.number().min(1).optional(),
  autoReindexEnabled: z.boolean().optional(),
});

const querySchema = z.object({
  id: z.string().optional(),
});

// GET - List all documentation repositories
export const GET = MiddlewareStacks.admin(
  async (request: NextRequest) => {
    const url = new URL(request.url);
    const includeJobs = url.searchParams.get('includeJobs') === 'true';
    const includeStats = url.searchParams.get('includeStats') === 'true';
    const repositoryId = url.searchParams.get('id');
    
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
  }
);

// POST - Create new documentation repository
export const POST = withValidation(
  { body: createRepositorySchema },
  async (_request: NextRequest, { body: data }: { body: z.infer<typeof createRepositorySchema> }) => {
      const repository = await createDocumentationRepository(data).catch((error) => {
        console.error('Failed to create documentation repository:', error);
        
        if (error instanceof Error && error.message.includes('unique constraint')) {
          throw new Error('Repository with this name or URL already exists');
        }
        throw error;
      });
      
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
  }
);

// PUT - Update documentation repository
export const PUT = withValidation(
  { 
    query: z.object({ id: z.string().min(1, 'Repository ID is required') }),
    body: updateRepositorySchema 
  },
  async (_request: NextRequest, { query, body: data }: { 
    query: z.infer<z.ZodObject<{ id: z.ZodString }>>,
    body: z.infer<typeof updateRepositorySchema>
  }) => {
      const repository = await updateDocumentationRepository(query.id, data).catch((error) => {
        console.error('Failed to update documentation repository:', error);
        
        if (error instanceof Error && error.message.includes('unique constraint')) {
          throw new Error('Repository with this name or URL already exists');
        }
        throw error;
      });
      
      return NextResponse.json({ repository });
  }
);

// DELETE - Delete documentation repository
export const DELETE = withValidation(
  { query: z.object({ id: z.string().min(1, 'Repository ID is required') }) },
  async (_request: NextRequest, { query }: { query: z.infer<z.ZodObject<{ id: z.ZodString }>> }) => {
      await deleteDocumentationRepository(query.id);
      
      // TODO: Also clean up any associated vectors/documents
      // This could be handled by a cleanup job
      await QueueManager.addCleanupJob({
        type: 'documentation_repository',
        targetId: query.id,
      });
      
      return NextResponse.json({ success: true });
  }
);