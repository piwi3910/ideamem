import { NextResponse } from 'next/server';
import { getConfig, saveConfig, AppConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
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

    await saveConfig(newConfig);
    return NextResponse.json({ message: 'Configuration saved successfully.' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save configuration.' }, { status: 500 });
  }
}
