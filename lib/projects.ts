import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

export interface Project {
  id: string;
  name: string;
  description?: string;
  gitRepo: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  indexedAt?: string;
  indexStatus: 'pending' | 'indexing' | 'completed' | 'failed' | 'cancelled';
  indexProgress?: number; // 0-100
  fileCount?: number;
  vectorCount?: number;
  lastError?: string;
  // Query metrics
  totalQueries?: number;
  lastQueryAt?: string;
  queriesThisWeek?: number;
  queriesThisMonth?: number;
  // Webhook information
  webhookEnabled?: boolean;
  lastWebhookAt?: string;
  lastWebhookCommit?: string;
  lastWebhookBranch?: string;
  lastWebhookAuthor?: string;
  // Git tracking
  lastIndexedCommit?: string;
  lastIndexedBranch?: string;
  // Scheduled indexing
  scheduledIndexingEnabled?: boolean;
  scheduledIndexingInterval?: number; // minutes
  scheduledIndexingBranch?: string;
  lastScheduledIndexingAt?: string;
  scheduledIndexingNextRun?: string;
}

export interface IndexingJob {
  projectId: string;
  status: 'running' | 'cancelled' | 'completed' | 'failed';
  progress: number;
  currentFile?: string;
  totalFiles: number;
  processedFiles: number;
  vectorCount?: number;
  startTime: string;
  endTime?: string;
  error?: string;
}

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');
const JOBS_FILE = path.join(process.cwd(), 'data', 'indexing-jobs.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(PROJECTS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Generate a secure random token
function generateToken(): string {
  return 'idm_' + uuidv4().replace(/-/g, '');
}

// Load projects from file
async function loadProjects(): Promise<Project[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save projects to file
async function saveProjects(projects: Project[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// Load indexing jobs from file
async function loadJobs(): Promise<Record<string, IndexingJob>> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(JOBS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save indexing jobs to file
async function saveJobs(jobs: Record<string, IndexingJob>): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

// Create a new project
export async function createProject(data: {
  name: string;
  description?: string;
  gitRepo: string;
}): Promise<Project> {
  const projects = await loadProjects();
  
  // Check if project with same name or repo already exists
  const existing = projects.find(p => p.name === data.name || p.gitRepo === data.gitRepo);
  if (existing) {
    throw new Error('Project with this name or repository already exists');
  }
  
  const project: Project = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    gitRepo: data.gitRepo,
    token: generateToken(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    indexStatus: 'pending'
  };
  
  projects.push(project);
  await saveProjects(projects);
  
  return project;
}

// Get all projects
export async function getProjects(): Promise<Project[]> {
  return await loadProjects();
}

// Get a project by ID
export async function getProject(id: string): Promise<Project | null> {
  const projects = await loadProjects();
  return projects.find(p => p.id === id) || null;
}

// Get a project by token
export async function getProjectByToken(token: string): Promise<Project | null> {
  const projects = await loadProjects();
  return projects.find(p => p.token === token) || null;
}

// Update a project
export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const projects = await loadProjects();
  const index = projects.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await saveProjects(projects);
  return projects[index];
}

// Delete a project
export async function deleteProject(id: string): Promise<boolean> {
  const projects = await loadProjects();
  const filtered = projects.filter(p => p.id !== id);
  
  if (filtered.length === projects.length) return false;
  
  await saveProjects(filtered);
  return true;
}

// Regenerate project token
export async function regenerateToken(id: string): Promise<string | null> {
  const newToken = generateToken();
  const updated = await updateProject(id, { token: newToken });
  return updated?.token || null;
}

// Start indexing job
export async function startIndexingJob(projectId: string): Promise<void> {
  const jobs = await loadJobs();
  
  // Cancel existing job if running
  if (jobs[projectId]?.status === 'running') {
    jobs[projectId].status = 'cancelled';
  }
  
  const job: IndexingJob = {
    projectId,
    status: 'running',
    progress: 0,
    totalFiles: 0,
    processedFiles: 0,
    startTime: new Date().toISOString()
  };
  
  jobs[projectId] = job;
  await saveJobs(jobs);
  
  // Update project status
  await updateProject(projectId, { 
    indexStatus: 'indexing',
    indexProgress: 0
  });
}

// Update indexing job progress
export async function updateIndexingProgress(
  projectId: string,
  progress: {
    progress?: number;
    currentFile?: string;
    totalFiles?: number;
    processedFiles?: number;
    vectorCount?: number;
    status?: IndexingJob['status'];
    error?: string;
  }
): Promise<void> {
  const jobs = await loadJobs();
  const job = jobs[projectId];
  
  if (!job) return;
  
  Object.assign(job, progress);
  
  if (progress.status && ['completed', 'failed', 'cancelled'].includes(progress.status)) {
    job.endTime = new Date().toISOString();
  }
  
  await saveJobs(jobs);
  
  // Update project status
  const projectUpdates: Partial<Project> = {
    indexProgress: progress.progress
  };
  
  if (progress.status === 'completed') {
    projectUpdates.indexStatus = 'completed';
    projectUpdates.indexedAt = new Date().toISOString();
    projectUpdates.fileCount = job.totalFiles;
    projectUpdates.vectorCount = job.vectorCount;
  } else if (progress.status === 'failed') {
    projectUpdates.indexStatus = 'failed';
    projectUpdates.lastError = progress.error;
  } else if (progress.status === 'cancelled') {
    projectUpdates.indexStatus = 'pending';
  }
  
  await updateProject(projectId, projectUpdates);
}

// Get indexing job status
export async function getIndexingJob(projectId: string): Promise<IndexingJob | null> {
  const jobs = await loadJobs();
  return jobs[projectId] || null;
}

// Cancel indexing job
export async function cancelIndexingJob(projectId: string): Promise<boolean> {
  const jobs = await loadJobs();
  const job = jobs[projectId];
  
  if (!job || job.status !== 'running') return false;
  
  job.status = 'cancelled';
  job.endTime = new Date().toISOString();
  
  await saveJobs(jobs);
  
  // Update project status
  await updateProject(projectId, { 
    indexStatus: 'pending',
    indexProgress: undefined
  });
  
  return true;
}

// Enable/disable webhook for a project
export async function toggleWebhook(projectId: string, enabled: boolean): Promise<Project | null> {
  return await updateProject(projectId, { webhookEnabled: enabled });
}

// Get webhook URL for a project
export function getWebhookUrl(projectId: string, baseUrl?: string): string {
  const base = baseUrl || 'http://localhost:3000';
  return `${base}/api/webhooks/${projectId}`;
}

// Track a query for metrics
export async function trackQuery(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Calculate time-based metrics
  // For now, we'll increment based on the current totals and rough estimation
  // In a production system, you'd want to store individual query timestamps
  const totalQueries = (project.totalQueries || 0) + 1;
  const lastQueryAt = now.toISOString();
  
  // Simple heuristic for recent queries based on last query time
  let queriesThisWeek = project.queriesThisWeek || 0;
  let queriesThisMonth = project.queriesThisMonth || 0;
  
  if (!project.lastQueryAt || new Date(project.lastQueryAt) > oneWeekAgo) {
    queriesThisWeek = queriesThisWeek + 1;
  } else {
    // Reset weekly count if it's been more than a week
    queriesThisWeek = 1;
  }
  
  if (!project.lastQueryAt || new Date(project.lastQueryAt) > oneMonthAgo) {
    queriesThisMonth = queriesThisMonth + 1;
  } else {
    // Reset monthly count if it's been more than a month
    queriesThisMonth = 1;
  }

  await updateProject(projectId, {
    totalQueries,
    lastQueryAt,
    queriesThisWeek,
    queriesThisMonth
  });
}

// Scheduled indexing management functions

// Configure scheduled indexing for a project
export async function configureScheduledIndexing(
  projectId: string, 
  enabled: boolean, 
  intervalMinutes?: number,
  branch?: string
): Promise<Project | null> {
  const updates: Partial<Project> = {
    scheduledIndexingEnabled: enabled,
    scheduledIndexingBranch: branch || 'main'
  };

  if (enabled && intervalMinutes) {
    updates.scheduledIndexingInterval = intervalMinutes;
    // Calculate next run time
    const nextRun = new Date();
    nextRun.setMinutes(nextRun.getMinutes() + intervalMinutes);
    updates.scheduledIndexingNextRun = nextRun.toISOString();
  } else {
    updates.scheduledIndexingInterval = undefined;
    updates.scheduledIndexingNextRun = undefined;
  }

  return await updateProject(projectId, updates);
}

// Update last scheduled indexing run time and calculate next run
export async function updateScheduledIndexingRun(
  projectId: string,
  success: boolean = true
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project || !project.scheduledIndexingEnabled || !project.scheduledIndexingInterval) {
    return project;
  }

  const now = new Date();
  const nextRun = new Date(now.getTime() + project.scheduledIndexingInterval * 60 * 1000);

  return await updateProject(projectId, {
    lastScheduledIndexingAt: now.toISOString(),
    scheduledIndexingNextRun: nextRun.toISOString()
  });
}

// Get projects that need scheduled indexing
export async function getProjectsNeedingScheduledIndexing(): Promise<Project[]> {
  const projects = await loadProjects();
  const now = new Date();

  return projects.filter(project => 
    project.scheduledIndexingEnabled &&
    project.scheduledIndexingNextRun &&
    new Date(project.scheduledIndexingNextRun) <= now &&
    project.indexStatus !== 'indexing' // Don't start if already indexing
  );
}