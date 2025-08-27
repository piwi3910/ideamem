import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getConfig, saveConfig } from '@/lib/config';
import { updateDocumentationScheduling } from '@/lib/documentation-scheduler';
import { withValidation } from '@/lib/middleware/validation';

// Define the config schema
const configSchema = z.object({
  qdrantUrl: z.string().url('Invalid Qdrant URL'),
  ollamaUrl: z.string().url('Invalid Ollama URL'),
  logLevel: z.string().min(1, 'Log level is required'),
  docReindexEnabled: z.boolean(),
  docReindexInterval: z.number().min(1, 'Reindex interval must be at least 1 day'),
});

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (_error) {
    return NextResponse.json({ message: 'Failed to read configuration.' }, { status: 500 });
  }
}

export const POST = withValidation(
  { body: configSchema },
  async (_request: NextRequest, { body: newConfig }) => {
    try {
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
);
