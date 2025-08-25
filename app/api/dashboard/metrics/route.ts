import { NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { getQdrantClient } from '@/lib/memory';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get database metrics
    const [
      projectsCount,
      totalIndexingJobs,
      globalRulesCount,
      globalPreferencesCount,
      recentActivity,
      totalQueries,
      activeProjects,
    ] = await Promise.all([
      // Count total projects
      prisma.project.count(),
      
      // Count total indexing jobs
      prisma.indexingJob.count(),
      
      // Count global rules
      prisma.globalRule.count(),
      
      // Count global preferences
      prisma.globalPreference.count(),
      
      // Get recent activity (last 10 indexing jobs)
      prisma.indexingJob.findMany({
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: {
          project: {
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

    // Format recent activity
    const formattedRecentActivity = recentActivity.map(job => ({
      id: job.id,
      projectName: job.project.name,
      status: job.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      progress: job.progress,
      vectorsAdded: job.vectorsAdded
    }));

    return NextResponse.json({
      overview: {
        projectsCount,
        totalQueries: totalQueries._sum.totalQueries || 0,
        activeProjects,
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
        statusBreakdown: indexingStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as Record<string, number>)
      },
      content: {
        globalRules: globalRulesCount,
        globalPreferences: globalPreferencesCount,
        totalVectors: vectorMetrics.totalVectors
      },
      recentActivity: formattedRecentActivity,
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