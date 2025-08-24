import { NextResponse } from 'next/server';
import { getProjectsNeedingScheduledIndexing, updateScheduledIndexingRun } from '@/lib/projects';
import { scheduledIncrementalIndexing } from '@/lib/indexing';

export async function POST(request: Request) {
  try {
    console.log('Scheduler run started at:', new Date().toISOString());
    
    // Get projects that need scheduled indexing
    const projects = await getProjectsNeedingScheduledIndexing();
    
    if (projects.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No projects need scheduled indexing',
        projectsProcessed: 0
      });
    }

    const results = [];
    
    // Process each project
    for (const project of projects) {
      try {
        console.log(`Running scheduled indexing for project ${project.name} (${project.id})`);
        
        // Run the scheduled incremental indexing
        const result = await scheduledIncrementalIndexing(
          project.id,
          project.gitRepo,
          project.scheduledIndexingBranch || 'main'
        );
        
        // Update the project's next run time
        await updateScheduledIndexingRun(project.id, result.success);
        
        results.push({
          projectId: project.id,
          projectName: project.name,
          success: result.success,
          action: result.action,
          message: result.message
        });
        
        console.log(`Scheduled indexing result for ${project.name}:`, result);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Scheduled indexing failed for project ${project.name}:`, error);
        
        // Still update the next run time even on error
        await updateScheduledIndexingRun(project.id, false);
        
        results.push({
          projectId: project.id,
          projectName: project.name,
          success: false,
          action: 'error',
          message: `Error: ${errorMessage}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${projects.length} projects`,
      projectsProcessed: projects.length,
      results
    });
    
  } catch (error) {
    console.error('Scheduler run failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectsProcessed: 0
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get projects that need scheduled indexing (for monitoring)
    const projects = await getProjectsNeedingScheduledIndexing();
    
    return NextResponse.json({
      needsIndexing: projects.length,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        nextRun: p.scheduledIndexingNextRun,
        interval: p.scheduledIndexingInterval,
        branch: p.scheduledIndexingBranch
      }))
    });
    
  } catch (error) {
    console.error('Error checking scheduled indexing status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}