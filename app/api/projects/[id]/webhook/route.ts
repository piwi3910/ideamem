import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProject, toggleWebhook, getWebhookUrl } from '@/lib/projects';
import { composeMiddleware } from '@/lib/middleware/compose';

const paramsSchema = z.object({
  id: z.string(),
});

const webhookToggleSchema = z.object({
  enabled: z.boolean(),
});

export const GET = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 60, window: '1 m' },
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { params: paramsSchema },
    errorHandling: { context: { resource: 'project-webhook' } },
  },
  async (request: NextRequest, { params: { id } }: { params: z.infer<typeof paramsSchema> }) => {
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    return NextResponse.json({
      projectId: project.id,
      webhookEnabled: project.webhookEnabled || false,
      webhookUrl: getWebhookUrl(project.id, baseUrl),
      lastWebhookAt: project.lastWebhookAt,
      lastWebhookCommit: project.lastWebhookCommit,
      lastWebhookBranch: project.lastWebhookBranch,
      lastWebhookAuthor: project.lastWebhookAuthor,
    });
  }
);

export const POST = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 10, window: '1 m' },
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { params: paramsSchema, body: webhookToggleSchema },
    errorHandling: { context: { resource: 'project-webhook' } },
  },
  async (request: NextRequest, { params: { id }, body: { enabled } }: { 
    params: z.infer<typeof paramsSchema>, 
    body: z.infer<typeof webhookToggleSchema> 
  }) => {
    const project = await toggleWebhook(id, enabled);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    return NextResponse.json({
      projectId: project.id,
      webhookEnabled: project.webhookEnabled || false,
      webhookUrl: getWebhookUrl(project.id, baseUrl),
    });
  }
);
