import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProject, updateProject, startIndexingJob } from '@/lib/projects';
import { headers } from 'next/headers';
import { QueueManager, JOB_PRIORITIES } from '@/lib/queue';
import { MiddlewareStacks } from '@/lib/middleware/compose';

const paramsSchema = z.object({
  projectId: z.string(),
});

// GitHub webhook payload schema (simplified)
const githubPushSchema = z.object({
  deleted: z.boolean().optional(),
  commits: z.array(z.object({
    id: z.string(),
    author: z.object({
      name: z.string(),
    }).optional(),
  })).optional(),
  head_commit: z.object({
    id: z.string(),
    author: z.object({
      name: z.string(),
    }).optional(),
  }).optional(),
  ref: z.string().optional(),
  repository: z.object({
    name: z.string(),
    url: z.string().optional(),
  }).optional(),
});

// GitLab webhook payload schema (simplified)
const gitlabPushSchema = z.object({
  commits: z.array(z.object({
    id: z.string(),
    author: z.object({
      name: z.string(),
    }).optional(),
  })).optional(),
  checkout_sha: z.string().optional(),
  ref: z.string().optional(),
  repository: z.object({
    name: z.string(),
    url: z.string().optional(),
  }).optional(),
});

// Bitbucket webhook payload schema (simplified)
const bitbucketPushSchema = z.object({
  push: z.object({
    changes: z.array(z.object({
      new: z.object({
        type: z.string().optional(),
        target: z.object({
          hash: z.string().optional(),
          author: z.object({
            raw: z.string().optional(),
          }).optional(),
        }).optional(),
        name: z.string().optional(),
      }).optional(),
    })).optional(),
  }).optional(),
  repo: z.object({
    name: z.string(),
    url: z.string().optional(),
  }).optional(),
});

// Union of all webhook payload types
const webhookPayloadSchema = z.union([
  githubPushSchema,
  gitlabPushSchema,
  bitbucketPushSchema,
  z.record(z.string(), z.unknown()), // Fallback for other webhook formats
]);

export const POST = MiddlewareStacks.webhook(
  async (request: NextRequest) => {
    // Parse params and body manually since webhook payloads vary
    const url = new URL(request.url);
    const projectId = url.pathname.split('/').slice(-1)[0];
    const body = await request.json().catch(() => ({}));
    const headersList = await headers();

      // Get project
      const project = await getProject(projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Verify webhook source based on headers and payload
      const isValidWebhook = await verifyWebhook(headersList, body, project);
      if (!isValidWebhook) {
        return NextResponse.json({ error: 'Invalid webhook' }, { status: 401 });
      }

      // Extract webhook information
      const webhookInfo = parseWebhookPayload(body, headersList);
      if (!webhookInfo.shouldIndex) {
        return NextResponse.json({
          message: 'Webhook received but no indexing needed',
          reason: webhookInfo.reason,
        });
      }

      // Check if already indexing
      if (project.indexStatus === 'INDEXING') {
        return NextResponse.json({
          message: 'Indexing already in progress',
          projectId: project.id,
        });
      }

      // Update project with webhook information
      await updateProject(projectId, {
        lastWebhookAt: new Date(),
        lastWebhookCommit: webhookInfo.commit,
        lastWebhookBranch: webhookInfo.branch,
        lastWebhookAuthor: webhookInfo.author,
      });

      // Start incremental indexing in background
      console.log(
        `Webhook triggered incremental re-indexing for project ${project.name} (${projectId})`
      );
      console.log(`Commit: ${webhookInfo.commit} by ${webhookInfo.author} on ${webhookInfo.branch}`);

      // Create indexing job and add to queue
      const job = await startIndexingJob(projectId, {
        branch: webhookInfo.branch || 'main',
        fullReindex: false,
        triggeredBy: 'WEBHOOK',
      }).catch((error) => {
        console.error(`Failed to create indexing job for project ${projectId}:`, error);
        return null;
      });

      if (job) {
        await QueueManager.addIndexingJob({
          projectId,
          jobId: job.id,
          branch: webhookInfo.branch || 'main',
          fullReindex: false,
          triggeredBy: 'WEBHOOK',
        }, JOB_PRIORITIES.NORMAL).catch((error) => {
          console.error(`Failed to queue webhook indexing for project ${projectId}:`, error);
        });
        
        console.log(`Added webhook-triggered indexing job for project ${projectId} to queue`);
      }

      return NextResponse.json({
        message: 'Webhook processed successfully, indexing started',
        projectId: project.id,
        commit: webhookInfo.commit,
        branch: webhookInfo.branch,
        author: webhookInfo.author,
      });
  }
);

interface ProjectData {
  id: string;
  name: string;
  indexStatus?: string;
  webhookSecret?: string;
}

async function verifyWebhook(headersList: Headers, payload: unknown, project: ProjectData): Promise<boolean> {
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
  const isGitHub = !!(githubEvent === 'push' && githubSignature);
  const isGitLab = !!(gitlabEvent === 'Push Hook' && gitlabToken);
  const isBitbucket = bitbucketEvent === 'repo:push';

  // Basic payload structure verification
  const payloadObj = payload as Record<string, unknown>;
  const hasValidPayload = !!(
    payloadObj &&
    (payloadObj.repository || // GitHub/GitLab
      payloadObj.repo) // Bitbucket
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

function parseWebhookPayload(payload: unknown, headersList: Headers): WebhookInfo {
  const githubEvent = headersList.get('x-github-event');
  const gitlabEvent = headersList.get('x-gitlab-event');
  const bitbucketEvent = headersList.get('x-event-key');

  let platform = 'unknown';
  let shouldIndex = false;
  const reason = '';
  let commit = '';
  let fullCommit = '';
  let branch = '';
  let author = '';

  // We'll validate against specific schemas based on the event type

  if (githubEvent === 'push') {
    platform = 'GitHub';
    
    // Validate GitHub payload
    const result = githubPushSchema.safeParse(payload);
    if (!result.success) {
      return {
        shouldIndex: false,
        reason: 'Invalid GitHub payload',
        platform,
      };
    }
    
    const payloadData = result.data;

    // Don't index if it's a branch deletion
    if (payloadData.deleted) {
      return {
        shouldIndex: false,
        reason: 'Branch deleted',
        platform,
      };
    }

    // Don't index if no commits
    if (!payloadData.commits || payloadData.commits.length === 0) {
      return {
        shouldIndex: false,
        reason: 'No commits in push',
        platform,
      };
    }

    shouldIndex = true;
    fullCommit = payloadData.head_commit?.id || 'unknown';
    commit = fullCommit.substring(0, 7);
    branch = payloadData.ref?.replace('refs/heads/', '') || 'unknown';
    author = payloadData.head_commit?.author?.name || 'unknown';
  } else if (gitlabEvent === 'Push Hook') {
    platform = 'GitLab';
    
    // Validate GitLab payload
    const result = gitlabPushSchema.safeParse(payload);
    if (!result.success) {
      return {
        shouldIndex: false,
        reason: 'Invalid GitLab payload',
        platform,
      };
    }
    
    const payloadData = result.data;

    // Don't index if no commits
    if (!payloadData.commits || payloadData.commits.length === 0) {
      return {
        shouldIndex: false,
        reason: 'No commits in push',
        platform,
      };
    }

    shouldIndex = true;
    fullCommit = payloadData.checkout_sha || payloadData.commits?.[0]?.id || 'unknown';
    commit = fullCommit.substring(0, 7);
    branch = payloadData.ref?.replace('refs/heads/', '') || 'unknown';
    author = payloadData.commits?.[0]?.author?.name || 'unknown';
  } else if (bitbucketEvent === 'repo:push') {
    platform = 'Bitbucket';
    
    // Validate Bitbucket payload
    const result = bitbucketPushSchema.safeParse(payload);
    if (!result.success) {
      return {
        shouldIndex: false,
        reason: 'Invalid Bitbucket payload',
        platform,
      };
    }
    
    const payloadData = result.data;

    // Don't index if no changes
    if (!payloadData.push?.changes || payloadData.push.changes.length === 0) {
      return {
        shouldIndex: false,
        reason: 'No changes in push',
        platform,
      };
    }

    const change = payloadData.push.changes[0];
    if (!change?.new || change.new?.type === 'tag') {
      return {
        shouldIndex: false,
        reason: 'Tag push or branch deletion',
        platform,
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
    platform,
  };
}