import { NextResponse } from 'next/server';
import { getIndexingStatus } from '@/lib/indexing';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Load current jobs from file
    const jobsFile = path.join(process.cwd(), 'data', 'indexing-jobs.json');
    let allJobs = {};
    
    try {
      const data = await fs.readFile(jobsFile, 'utf-8');
      allJobs = JSON.parse(data);
    } catch {
      // File doesn't exist or is invalid, return empty jobs
    }

    // Filter to only return running jobs
    const runningJobs = {};
    for (const [projectId, job] of Object.entries(allJobs)) {
      if (job && typeof job === 'object' && 'status' in job) {
        if (job.status === 'running') {
          runningJobs[projectId] = job;
        }
      }
    }

    return NextResponse.json({ jobs: runningJobs });
  } catch (error) {
    console.error('Error getting indexing status:', error);
    return NextResponse.json(
      { error: 'Failed to get indexing status' },
      { status: 500 }
    );
  }
}