import { NextResponse } from 'next/server';
import { getConfig, saveConfig, AppConfig } from '@/lib/config';
import { updateDocumentationScheduling } from '@/lib/documentation-scheduler';

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (_error) {
    return NextResponse.json({ message: 'Failed to read configuration.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newConfig: AppConfig = await request.json();

    // Basic validation
    if (!newConfig.qdrantUrl || !newConfig.ollamaUrl) {
      return NextResponse.json({ message: 'Invalid configuration provided.' }, { status: 400 });
    }

    // Validate documentation reindexing settings
    if (typeof newConfig.docReindexEnabled !== 'boolean') {
      return NextResponse.json({ message: 'docReindexEnabled must be a boolean.' }, { status: 400 });
    }

    if (typeof newConfig.docReindexInterval !== 'number' || newConfig.docReindexInterval < 1) {
      return NextResponse.json({ message: 'docReindexInterval must be a positive number (days).' }, { status: 400 });
    }

    // Get current config to check for changes
    const currentConfig = await getConfig();
    
    await saveConfig(newConfig);
    
    // Update documentation scheduling if settings changed
    if (currentConfig.docReindexEnabled !== newConfig.docReindexEnabled || 
        currentConfig.docReindexInterval !== newConfig.docReindexInterval) {
      try {
        await updateDocumentationScheduling(newConfig.docReindexEnabled, newConfig.docReindexInterval);
        console.log('Documentation scheduling updated based on new config');
      } catch (schedulerError) {
        console.error('Failed to update documentation scheduler:', schedulerError);
        // Don't fail the config save if scheduler update fails
      }
    }
    
    return NextResponse.json({ message: 'Configuration saved successfully.' });
  } catch (_error) {
    return NextResponse.json({ message: 'Failed to save configuration.' }, { status: 500 });
  }
}
