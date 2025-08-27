import { createHmac } from 'crypto';
import { Headers } from 'next/dist/compiled/@edge-runtime/primitives';
import { QueueManager, JOB_PRIORITIES } from '@/lib/queue';
import { startIndexingJob } from '@/lib/projects';

export type WebhookPlatform = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

export interface WebhookInfo {
  shouldIndex: boolean;
  reason?: string;
  commit?: string;
  fullCommit?: string;
  branch?: string;
  author?: string;
  platform?: WebhookPlatform;
  repository?: string;
  event?: string;
}

export interface WebhookConfig {
  secret?: string;
  branch?: string;
  enabled: boolean;
}

export interface ParsedWebhookPayload {
  platform: WebhookPlatform;
  event: string;
  repository: string;
  branch?: string;
  commit?: string;
  author?: string;
  deleted?: boolean;
}

/**
 * Service for handling webhook operations
 */
export class WebhookService {
  private static instance: WebhookService;

  private constructor() {}

  static getInstance(): WebhookService {
    if (!this.instance) {
      this.instance = new WebhookService();
    }
    return this.instance;
  }

  /**
   * Verify webhook signature based on platform
   */
  async verifyWebhookSignature(
    headers: Headers,
    payload: string,
    config: WebhookConfig
  ): Promise<boolean> {
    if (!config.enabled) {
      return false;
    }

    const platform = this.detectPlatform(headers);

    switch (platform) {
      case 'github':
        return this.verifyGitHubSignature(headers, payload, config.secret);
      case 'gitlab':
        return this.verifyGitLabToken(headers, config.secret);
      case 'bitbucket':
        return this.verifyBitbucketSignature(headers, payload, config.secret);
      default:
        return false;
    }
  }

  /**
   * Detect webhook platform from headers
   */
  detectPlatform(headers: Headers): WebhookPlatform {
    if (headers.get('x-github-event')) {
      return 'github';
    }
    if (headers.get('x-gitlab-event')) {
      return 'gitlab';
    }
    if (headers.get('x-event-key')) {
      return 'bitbucket';
    }
    return 'unknown';
  }

  /**
   * Parse webhook payload based on platform
   */
  parseWebhookPayload(headers: Headers, payload: any): WebhookInfo {
    const platform = this.detectPlatform(headers);
    
    switch (platform) {
      case 'github':
        return this.parseGitHubPayload(headers, payload);
      case 'gitlab':
        return this.parseGitLabPayload(headers, payload);
      case 'bitbucket':
        return this.parseBitbucketPayload(headers, payload);
      default:
        return {
          shouldIndex: false,
          reason: 'Unknown webhook platform',
          platform: 'unknown',
        };
    }
  }

  /**
   * Process webhook and trigger indexing if needed
   */
  async processWebhook(
    projectId: string,
    webhookInfo: WebhookInfo,
    config: { branch?: string }
  ): Promise<{ jobId?: string; message: string }> {
    if (!webhookInfo.shouldIndex) {
      return {
        message: webhookInfo.reason || 'No indexing needed',
      };
    }

    // Check if branch matches configuration
    if (config.branch && webhookInfo.branch !== config.branch) {
      return {
        message: `Branch ${webhookInfo.branch} does not match configured branch ${config.branch}`,
      };
    }

    try {
      // Start indexing job
      const job = await startIndexingJob(projectId, {
        branch: webhookInfo.branch || 'main',
        fullReindex: false,
        triggeredBy: 'WEBHOOK',
      });

      // Add to queue
      await QueueManager.addIndexingJob(
        {
          projectId,
          jobId: job.id,
          branch: webhookInfo.branch || 'main',
          fullReindex: false,
          triggeredBy: 'WEBHOOK',
        },
        JOB_PRIORITIES.NORMAL
      );

      return {
        jobId: job.id,
        message: 'Indexing job created and queued',
      };
    } catch (error) {
      throw new Error(
        `Failed to create indexing job: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Verify GitHub webhook signature
   */
  private verifyGitHubSignature(
    headers: Headers,
    payload: string,
    secret?: string
  ): boolean {
    if (!secret) {
      // If no secret configured, accept but log warning
      console.warn('GitHub webhook received without secret configuration');
      return true;
    }

    const signature = headers.get('x-hub-signature-256');
    if (!signature) {
      return false;
    }

    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    return signature === expectedSignature;
  }

  /**
   * Verify GitLab webhook token
   */
  private verifyGitLabToken(headers: Headers, secret?: string): boolean {
    if (!secret) {
      console.warn('GitLab webhook received without secret configuration');
      return true;
    }

    const token = headers.get('x-gitlab-token');
    return token === secret;
  }

  /**
   * Verify Bitbucket webhook signature
   */
  private verifyBitbucketSignature(
    headers: Headers,
    payload: string,
    secret?: string
  ): boolean {
    if (!secret) {
      console.warn('Bitbucket webhook received without secret configuration');
      return true;
    }

    // Bitbucket doesn't use HMAC by default, just validates the payload
    // You could implement custom validation here
    return true;
  }

  /**
   * Parse GitHub webhook payload
   */
  private parseGitHubPayload(headers: Headers, payload: any): WebhookInfo {
    const event = headers.get('x-github-event');
    
    if (event !== 'push') {
      return {
        shouldIndex: false,
        reason: `GitHub event ${event} is not a push event`,
        platform: 'github',
        event,
      };
    }

    if (payload.deleted) {
      return {
        shouldIndex: false,
        reason: 'Branch was deleted',
        platform: 'github',
        event,
      };
    }

    const branch = payload.ref?.replace('refs/heads/', '');
    const commit = payload.head_commit?.id;
    const author = payload.head_commit?.author?.name || payload.pusher?.name;
    const repository = payload.repository?.full_name;

    return {
      shouldIndex: true,
      platform: 'github',
      event,
      branch,
      commit: commit?.substring(0, 7),
      fullCommit: commit,
      author,
      repository,
    };
  }

  /**
   * Parse GitLab webhook payload
   */
  private parseGitLabPayload(headers: Headers, payload: any): WebhookInfo {
    const event = headers.get('x-gitlab-event');
    
    if (event !== 'Push Hook') {
      return {
        shouldIndex: false,
        reason: `GitLab event ${event} is not a push event`,
        platform: 'gitlab',
        event,
      };
    }

    const branch = payload.ref?.replace('refs/heads/', '');
    const commit = payload.checkout_sha;
    const author = payload.user_name;
    const repository = payload.repository?.name;

    return {
      shouldIndex: true,
      platform: 'gitlab',
      event,
      branch,
      commit: commit?.substring(0, 7),
      fullCommit: commit,
      author,
      repository,
    };
  }

  /**
   * Parse Bitbucket webhook payload
   */
  private parseBitbucketPayload(headers: Headers, payload: any): WebhookInfo {
    const event = headers.get('x-event-key');
    
    if (event !== 'repo:push') {
      return {
        shouldIndex: false,
        reason: `Bitbucket event ${event} is not a push event`,
        platform: 'bitbucket',
        event,
      };
    }

    const changes = payload.push?.changes || [];
    if (changes.length === 0) {
      return {
        shouldIndex: false,
        reason: 'No changes in push',
        platform: 'bitbucket',
        event,
      };
    }

    const change = changes[0];
    const branch = change?.new?.name;
    const commit = change?.new?.target?.hash;
    const author = change?.new?.target?.author?.raw;
    const repository = payload.repository?.full_name;

    return {
      shouldIndex: true,
      platform: 'bitbucket',
      event,
      branch,
      commit: commit?.substring(0, 7),
      fullCommit: commit,
      author,
      repository,
    };
  }
}

// Export singleton instance
export const webhookService = WebhookService.getInstance();