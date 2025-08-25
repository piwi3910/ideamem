import { NextResponse } from 'next/server';
import { ingest, retrieve, deleteSource } from '@/lib/memory';

// GET - Fetch all global rules
export async function GET() {
  try {
    const result = await retrieve({
      query: 'global rules coding standards',
      filters: { type: 'rule', scope: 'global', project_id: 'global' },
      scope: 'global',
    });

    return NextResponse.json({
      success: true,
      rules: result || [],
    });
  } catch (error) {
    console.error('Error fetching global rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch global rules' },
      { status: 500 }
    );
  }
}

// POST - Add new global rule
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, content, type = 'rule', language = 'markdown' } = body;

    if (!source || !content) {
      return NextResponse.json(
        { success: false, error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Ingest the rule into global scope
    const result = await ingest({
      content,
      source,
      type: 'rule',
      language,
      project_id: 'global',
      scope: 'global',
    });

    return NextResponse.json({
      success: true,
      message: 'Rule added successfully',
      vectors_added: result.vectors_added,
    });
  } catch (error) {
    console.error('Error adding global rule:', error);
    return NextResponse.json({ success: false, error: 'Failed to add rule' }, { status: 500 });
  }
}

// PUT - Update existing global rule
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, source, content } = body;

    if (!id || !source || !content) {
      return NextResponse.json(
        { success: false, error: 'ID, source, and content are required' },
        { status: 400 }
      );
    }

    // Delete the old rule by source
    await deleteSource({
      source,
      project_id: 'global',
      scope: 'global',
    });

    // Add the updated rule
    const result = await ingest({
      content,
      source,
      type: 'rule',
      language: 'markdown',
      project_id: 'global',
      scope: 'global',
    });

    return NextResponse.json({
      success: true,
      message: 'Rule updated successfully',
      vectors_added: result.vectors_added,
    });
  } catch (error) {
    console.error('Error updating global rule:', error);
    return NextResponse.json({ success: false, error: 'Failed to update rule' }, { status: 500 });
  }
}

// DELETE - Remove global rule
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { source } = body;

    if (!source) {
      return NextResponse.json({ success: false, error: 'Source is required' }, { status: 400 });
    }

    await deleteSource({
      source,
      project_id: 'global',
      scope: 'global',
    });

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting global rule:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete rule' }, { status: 500 });
  }
}
