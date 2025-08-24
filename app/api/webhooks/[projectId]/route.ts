import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/projects';
import { startIncrementalIndexing } from '@/lib/indexing';
import { headers } from 'next/headers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const headersList = await headers();
    
    // Get project
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify webhook source based on headers and payload
    const isValidWebhook = await verifyWebhook(headersList, body, project);
    if (!isValidWebhook) {
      return NextResponse.json(
        { error: 'Invalid webhook' },
        { status: 401 }
      );
    }

    // Extract webhook information
    const webhookInfo = parseWebhookPayload(body, headersList);
    if (!webhookInfo.shouldIndex) {
      return NextResponse.json({
        message: 'Webhook received but no indexing needed',
        reason: webhookInfo.reason
      });
    }

    // Check if already indexing
    if (project.indexStatus === 'INDEXING') {
      return NextResponse.json({
        message: 'Indexing already in progress',
        projectId: project.id
      });
    }

    // Update project with webhook information
    await updateProject(projectId, {
      lastWebhookAt: new Date(),
      lastWebhookCommit: webhookInfo.commit,
      lastWebhookBranch: webhookInfo.branch,
      lastWebhookAuthor: webhookInfo.author
    });

    // Start incremental indexing in background
    console.log(`Webhook triggered incremental re-indexing for project ${project.name} (${projectId})`);
    console.log(`Commit: ${webhookInfo.commit} by ${webhookInfo.author} on ${webhookInfo.branch}`);
    
    // Don't await - let it run in background
    startIncrementalIndexing(
      projectId, 
      project.gitRepo, 
      webhookInfo.fullCommit || webhookInfo.commit || 'HEAD',
      webhookInfo.branch || 'main'
    ).catch(error => {
      console.error(`Webhook incremental indexing failed for project ${projectId}:`, error);
    });

    return NextResponse.json({
      message: 'Webhook processed successfully, indexing started',
      projectId: project.id,
      commit: webhookInfo.commit,
      branch: webhookInfo.branch,
      author: webhookInfo.author
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function verifyWebhook(
  headersList: Headers,
  payload: any,
  project: any
): Promise<boolean> {
  // GitHub webhook verification
  const githubSignature = headersList.get('x-hub-signature-256');
  const githubEvent = headersList.get('x-github-event');
  
  // GitLab webhook verification
  const gitlabToken = headersList.get('x-gitlab-token');
  const gitlabEvent = headersList.get('x-gitlab-event');
  
  // Bitbucket webhook verification
  const bitbucketEvent = headersList.get('x-event-key');
  
  // For now, we'll do basic verification
  // In production, you'd want to verify HMAC signatures with webhook secrets
  
  // Check if it's a valid git hosting platform webhook
  const isGitHub = githubEvent === 'push' && githubSignature;
  const isGitLab = gitlabEvent === 'Push Hook' && gitlabToken;
  const isBitbucket = bitbucketEvent === 'repo:push';
  
  // Basic payload structure verification
  const hasValidPayload = payload && (
    payload.repository || // GitHub/GitLab
    payload.repo // Bitbucket
  );
  
  return (isGitHub || isGitLab || isBitbucket) && hasValidPayload;
}

interface WebhookInfo {
  shouldIndex: boolean;
  reason?: string;
  commit?: string;
  fullCommit?: string;
  branch?: string;
  author?: string;
  platform?: string;
}

function parseWebhookPayload(payload: any, headersList: Headers): WebhookInfo {
  const githubEvent = headersList.get('x-github-event');
  const gitlabEvent = headersList.get('x-gitlab-event');
  const bitbucketEvent = headersList.get('x-event-key');
  
  let platform = 'unknown';
  let shouldIndex = false;
  let reason = '';
  let commit = '';
  let fullCommit = '';
  let branch = '';
  let author = '';

  if (githubEvent === 'push') {
    platform = 'GitHub';
    
    // Don't index if it's a branch deletion
    if (payload.deleted) {
      return { 
        shouldIndex: false, 
        reason: 'Branch deleted',
        platform 
      };
    }
    
    // Don't index if no commits
    if (!payload.commits || payload.commits.length === 0) {
      return { 
        shouldIndex: false, 
        reason: 'No commits in push',
        platform 
      };
    }
    
    shouldIndex = true;
    fullCommit = payload.head_commit?.id || 'unknown';
    commit = fullCommit.substring(0, 7);
    branch = payload.ref?.replace('refs/heads/', '') || 'unknown';
    author = payload.head_commit?.author?.name || 'unknown';
    
  } else if (gitlabEvent === 'Push Hook') {
    platform = 'GitLab';
    
    // Don't index if no commits
    if (!payload.commits || payload.commits.length === 0) {
      return { 
        shouldIndex: false, 
        reason: 'No commits in push',
        platform 
      };
    }
    
    shouldIndex = true;
    fullCommit = payload.checkout_sha || 'unknown';
    commit = fullCommit.substring(0, 7);
    branch = payload.ref?.replace('refs/heads/', '') || 'unknown';
    author = payload.commits?.[0]?.author?.name || 'unknown';
    
  } else if (bitbucketEvent === 'repo:push') {
    platform = 'Bitbucket';
    
    // Don't index if no changes
    if (!payload.push?.changes || payload.push.changes.length === 0) {
      return { 
        shouldIndex: false, 
        reason: 'No changes in push',
        platform 
      };
    }
    
    const change = payload.push.changes[0];
    if (!change.new || change.new.type === 'tag') {
      return { 
        shouldIndex: false, 
        reason: 'Tag push or branch deletion',
        platform 
      };
    }
    
    shouldIndex = true;
    fullCommit = change.new?.target?.hash || 'unknown';
    commit = fullCommit.substring(0, 7);
    branch = change.new?.name || 'unknown';
    author = change.new?.target?.author?.raw || 'unknown';
  }

  return {
    shouldIndex,
    reason: shouldIndex ? 'Valid push event' : reason,
    commit,
    fullCommit,
    branch,
    author,
    platform
  };
}