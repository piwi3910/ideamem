import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { getQdrantClient } from '@/lib/memory';

export async function GET() {
  try {
    // Get database metrics
    const [
      projectsCount,
      totalIndexingJobs,
      totalDocumentationIndexingJobs,
      globalPreferencesCount,
      recentProjectJobs,
      recentDocumentationJobs,
      totalQueries,
      activeProjects,
      documentationRepositoriesCount,
      activeDocumentationRepositories,
      totalDocuments,
    ] = await Promise.all([
      // Count total projects
      prisma.project.count(),
      
      // Count total indexing jobs
      prisma.indexingJob.count(),
      
      // Count total documentation indexing jobs
      prisma.documentationIndexingJob.count(),
      
      // Count global preferences (unified constraints)
      prisma.globalPreference.count(),
      
      // Get recent project indexing activity
      prisma.indexingJob.findMany({
        take: 15,
        orderBy: { startedAt: 'desc' },
        include: {
          project: {
            select: { name: true }
          }
        }
      }),
      
      // Get recent documentation indexing activity
      prisma.documentationIndexingJob.findMany({
        take: 15,
        orderBy: { startedAt: 'desc' },
        include: {
          repository: {
            select: { name: true }
          }
        }
      }),
      
      // Sum of all project queries
      prisma.project.aggregate({
        _sum: {
          totalQueries: true
        }
      }),
      
      // Count projects with recent activity (queries in last 7 days)
      prisma.project.count({
        where: {
          lastQueryAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Count total documentation repositories
      prisma.documentationRepository.count(),
      
      // Count active documentation repositories (indexed in last 30 days)
      prisma.documentationRepository.count({
        where: {
          lastIndexedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          },
          isActive: true
        }
      }),
      
      // Sum total documents across all documentation repositories
      prisma.documentationRepository.aggregate({
        _sum: {
          totalDocuments: true
        }
      })
    ]);

    // Get vector database metrics
    let vectorMetrics = {
      collectionExists: false,
      totalVectors: 0,
      collectionSize: 0,
      status: 'unknown',
      segments: 0,
      indexedVectors: 0,
      optimizerStatus: 'unknown',
      indexingProgress: 0,
      vectorsPerSegment: 0
    };

    try {
      const qdrant = await getQdrantClient();
      
      // Check if collection exists and get info
      const collectionInfo = await qdrant.getCollection('ideamem_memory');
      
      vectorMetrics = {
        collectionExists: true,
        totalVectors: collectionInfo.points_count || 0,
        collectionSize: collectionInfo.vectors_count || 0,
        status: collectionInfo.status || 'unknown',
        segments: collectionInfo.segments_count || 0,
        indexedVectors: collectionInfo.indexed_vectors_count || 0,
        optimizerStatus: typeof collectionInfo.optimizer_status === 'string' 
          ? collectionInfo.optimizer_status 
          : (collectionInfo.optimizer_status && typeof collectionInfo.optimizer_status === 'object' && 'status' in collectionInfo.optimizer_status)
            ? String(collectionInfo.optimizer_status.status || 'unknown')
            : 'unknown',
        // Performance indicators
        indexingProgress: (collectionInfo.points_count || 0) > 0 
          ? ((collectionInfo.indexed_vectors_count || 0) / (collectionInfo.points_count || 1)) * 100
          : 100,
        vectorsPerSegment: (collectionInfo.segments_count || 0) > 0 
          ? Math.round((collectionInfo.points_count || 0) / (collectionInfo.segments_count || 1))
          : 0
      };
    } catch (error) {
      console.warn('Could not fetch vector database metrics:', error);
      // Vector metrics will remain with default values
    }

    // Calculate project statistics
    const projectStats = await prisma.project.groupBy({
      by: ['indexStatus'],
      _count: {
        indexStatus: true
      }
    });

    const indexingStats = await prisma.indexingJob.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    const docIndexingStats = await prisma.documentationIndexingJob.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Get database size estimation (SQLite specific)
    let dbSize = 0;
    try {
      const result = await prisma.$queryRaw`
        SELECT page_count * page_size as size 
        FROM pragma_page_count(), pragma_page_size()
      ` as Array<{ size: bigint }>;
      
      if (result && result.length > 0) {
        dbSize = Number(result[0].size);
      }
    } catch (error) {
      console.warn('Could not get database size:', error);
    }

    // Format and combine recent activity from both project and documentation indexing
    const formattedProjectJobs = recentProjectJobs.map(job => ({
      id: job.id,
      type: 'project' as const,
      projectName: job.project.name,
      repositoryName: null,
      status: job.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      progress: job.progress,
      vectorsAdded: job.vectorsAdded,
      documentsAdded: 0
    }));

    const formattedDocumentationJobs = recentDocumentationJobs.map(job => ({
      id: job.id,
      type: 'documentation' as const,
      projectName: null,
      repositoryName: job.repository.name,
      status: job.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      progress: job.progress,
      vectorsAdded: 0,
      documentsAdded: job.documentsAdded
    }));

    // Combine and sort by most recent
    const allRecentActivity = [...formattedProjectJobs, ...formattedDocumentationJobs]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10); // Take top 10 most recent

    return NextResponse.json({
      overview: {
        projectsCount,
        totalQueries: totalQueries._sum.totalQueries || 0,
        activeProjects,
        documentationRepositoriesCount,
        activeDocumentationRepositories,
        totalDocuments: totalDocuments._sum.totalDocuments || 0,
        dbSize,
        vectorMetrics
      },
      projects: {
        total: projectsCount,
        statusBreakdown: projectStats.reduce((acc, stat) => {
          acc[stat.indexStatus] = stat._count.indexStatus;
          return acc;
        }, {} as Record<string, number>)
      },
      indexing: {
        totalJobs: totalIndexingJobs,
        totalDocumentationJobs: totalDocumentationIndexingJobs,
        statusBreakdown: indexingStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as Record<string, number>),
        documentationStatusBreakdown: docIndexingStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as Record<string, number>)
      },
      content: {
        globalPreferences: globalPreferencesCount,
        totalVectors: vectorMetrics.totalVectors,
        documentationRepositories: documentationRepositoriesCount,
        totalDocuments: totalDocuments._sum.totalDocuments || 0
      },
      recentActivity: allRecentActivity,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}