import { NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// GET - Fetch all global rules
export async function GET() {
  try {
    const globalRules = await prisma.globalRule.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    // Transform to match the expected frontend format
    const rules = globalRules.map(rule => ({
      id: rule.id,
      payload: {
        source: rule.source,
        content: rule.content,
        type: 'rule' as const,
        language: 'markdown' as const,
        scope: 'global' as const,
        project_id: 'global'
      }
    }));

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: any) {
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
    const { source, content } = body;

    if (!source || !content) {
      return NextResponse.json(
        { success: false, error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Create the rule in the database
    const rule = await prisma.globalRule.create({
      data: {
        source,
        content,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Rule added successfully',
      rule: {
        id: rule.id,
        payload: {
          source: rule.source,
          content: rule.content,
          type: 'rule' as const,
          language: 'markdown' as const,
          scope: 'global' as const,
          project_id: 'global'
        }
      }
    });
  } catch (error: any) {
    console.error('Error adding global rule:', error);
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        success: false, 
        error: 'A rule with this source already exists' 
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to add rule' }, { status: 500 });
  }
}

// PUT - Update existing global rule
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { source, content } = body;

    if (!source || !content) {
      return NextResponse.json(
        { success: false, error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Update the rule by source
    const rule = await prisma.globalRule.update({
      where: { source },
      data: { content },
    });

    return NextResponse.json({
      success: true,
      message: 'Rule updated successfully',
      rule: {
        id: rule.id,
        payload: {
          source: rule.source,
          content: rule.content,
          type: 'rule' as const,
          language: 'markdown' as const,
          scope: 'global' as const,
          project_id: 'global'
        }
      }
    });
  } catch (error: any) {
    console.error('Error updating global rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        success: false, 
        error: 'Rule not found' 
      }, { status: 404 });
    }
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

    // Delete the rule by source
    await prisma.globalRule.delete({
      where: { source }
    });

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting global rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        success: false, 
        error: 'Rule not found' 
      }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to delete rule' }, { status: 500 });
  }
}
