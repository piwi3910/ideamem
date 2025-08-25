import { NextRequest, NextResponse } from 'next/server';
import { RelationshipAnalyzer } from '../../../../lib/relationship-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, limit = 10, minStrength = 0.3 } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    console.log('Finding related documents for:', documentId, {
      limit,
      minStrength,
    });

    const relatedDocuments = await RelationshipAnalyzer.getRelatedDocuments(
      documentId,
      limit,
      minStrength
    );

    console.log('Found related documents:', relatedDocuments.length);

    return NextResponse.json(relatedDocuments);
  } catch (error) {
    console.error('Error finding related documents:', error);
    return NextResponse.json(
      {
        error: 'Failed to find related documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to find related documents',
  });
}
