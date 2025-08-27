import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProject, toggleWebhook, getWebhookUrl } from '@/lib/projects';
import { withValidation } from '@/lib/middleware/validation';

const paramsSchema = z.object({
  id: z.string(),
});

const webhookToggleSchema = z.object({
  enabled: z.boolean(),
});

export const GET = withValidation(
  { params: paramsSchema },
  async (request: NextRequest, { params: { id } }) => {
    try {
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
    } catch (error) {
      console.error('Error fetching webhook info:', error);
      return NextResponse.json({ error: 'Failed to fetch webhook info' }, { status: 500 });
    }
  }
);

export const POST = withValidation(
  { params: paramsSchema, body: webhookToggleSchema },
  async (request: NextRequest, { params: { id }, body: { enabled } }) => {
    try {
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
    } catch (error) {
      console.error('Error toggling webhook:', error);
      return NextResponse.json({ error: 'Failed to toggle webhook' }, { status: 500 });
    }
  }
);
