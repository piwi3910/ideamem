import { NextResponse } from 'next/server';
import { getProject, toggleWebhook, getWebhookUrl } from '@/lib/projects';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
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
      lastWebhookAuthor: project.lastWebhookAuthor
    });
  } catch (error) {
    console.error('Error fetching webhook info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook info' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { enabled } = await request.json();
    
    const project = await toggleWebhook(id, enabled);
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    return NextResponse.json({
      projectId: project.id,
      webhookEnabled: project.webhookEnabled || false,
      webhookUrl: getWebhookUrl(project.id, baseUrl)
    });
  } catch (error) {
    console.error('Error toggling webhook:', error);
    return NextResponse.json(
      { error: 'Failed to toggle webhook' },
      { status: 500 }
    );
  }
}