import { NextResponse } from 'next/server';
import { ingest, retrieve, deleteSource } from '@/lib/memory';

// GET - Fetch all global preferences
export async function GET() {
  try {
    const result = await retrieve({
      query: 'global user preferences settings configuration',
      filters: { type: 'user_preference', scope: 'global', project_id: 'global' },
      scope: 'global',
    });

    return NextResponse.json({
      success: true,
      preferences: result || [],
    });
  } catch (error) {
    console.error('Error fetching global preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch global preferences' },
      { status: 500 }
    );
  }
}

// POST - Add new global preference
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, content, type = 'user_preference', language = 'markdown' } = body;

    if (!source || !content) {
      return NextResponse.json(
        { success: false, error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Ingest the preference into global scope
    const result = await ingest({
      content,
      source,
      type: 'user_preference',
      language,
      project_id: 'global',
      scope: 'global',
    });

    return NextResponse.json({
      success: true,
      message: 'Preference added successfully',
      vectors_added: result.vectors_added,
    });
  } catch (error) {
    console.error('Error adding global preference:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add preference' },
      { status: 500 }
    );
  }
}

// PUT - Update existing global preference
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

    // Delete the old preference by source
    await deleteSource({
      source,
      project_id: 'global',
      scope: 'global',
    });

    // Add the updated preference
    const result = await ingest({
      content,
      source,
      type: 'user_preference',
      language: 'markdown',
      project_id: 'global',
      scope: 'global',
    });

    return NextResponse.json({
      success: true,
      message: 'Preference updated successfully',
      vectors_added: result.vectors_added,
    });
  } catch (error) {
    console.error('Error updating global preference:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preference' },
      { status: 500 }
    );
  }
}

// DELETE - Remove global preference
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
      message: 'Preference deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting global preference:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete preference' },
      { status: 500 }
    );
  }
}
