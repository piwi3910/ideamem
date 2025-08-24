import { QdrantClient } from '@qdrant/js-client-rest';
import { getConfig } from './config';
import { v4 as uuidv4 } from 'uuid';
import { parserFactory, ParseResult, SemanticChunk } from './parsing';

const COLLECTION_NAME = 'ideamem_memory';

// Helper function to get a configured Qdrant client
async function getQdrantClient(): Promise<QdrantClient> {
  const config = await getConfig();
  return new QdrantClient({ url: config.qdrantUrl });
}

// Helper function to ensure the Qdrant collection exists
async function ensureCollectionExists() {
  const qdrant = await getQdrantClient();
  const result = await qdrant.getCollections();
  const collectionExists = result.collections.some(
    (collection) => collection.name === COLLECTION_NAME
  );

  if (!collectionExists) {
    console.log(`Collection '${COLLECTION_NAME}' not found. Creating it now...`);
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 768, // Dimensionality for nomic-embed-text
        distance: 'Cosine',
      },
    });
    console.log(`Collection '${COLLECTION_NAME}' created successfully.`);
  }
}

// Helper function to get an embedding from Ollama
async function getEmbedding(text: string): Promise<number[]> {
  const config = await getConfig();
  const response = await fetch(`${config.ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });
  if (!response.ok) {
    throw new Error(`Failed to get embedding from Ollama: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding;
}

// The `ingest` function
interface IngestParams {
  content: string;
  source: string;
  type: 'code' | 'documentation' | 'conversation' | 'user_preference' | 'rule';
  language: string;
  project_id?: string; // Optional project identifier, defaults to 'global'
  scope?: 'global' | 'project'; // Optional scope specification
}

export async function ingest(params: IngestParams): Promise<{ success: boolean; vectors_added: number; project_id: string }> {
  await ensureCollectionExists(); // Ensure collection exists before proceeding
  const { content, source, type, language, project_id, scope } = params;
  
  // Determine the effective project_id
  let effectiveProjectId: string;
  if (scope === 'global' || (!project_id && !scope)) {
    effectiveProjectId = 'global';
  } else if (project_id) {
    effectiveProjectId = project_id;
  } else {
    effectiveProjectId = 'global';
  }
  
  const qdrant = await getQdrantClient();

  // Use the new multi-language parser system
  const parseResult = parserFactory.parse(content, source, language);
  
  let chunks: Array<{ content: string; metadata?: any }> = [];
  
  if (parseResult.success && parseResult.chunks.length > 0) {
    // Use semantic chunks from the parser
    chunks = parseResult.chunks.map(chunk => ({
      content: chunk.content,
      metadata: {
        type: chunk.type,
        name: chunk.name,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.metadata.language,
        dependencies: chunk.metadata.dependencies || [],
        exports: chunk.metadata.exports || [],
        parent: chunk.metadata.parent,
        visibility: chunk.metadata.visibility,
        async: chunk.metadata.async,
        static: chunk.metadata.static,
        parameters: chunk.metadata.parameters || [],
        decorators: chunk.metadata.decorators || []
      }
    }));
  } else {
    // Fallback to simple chunking if parsing fails
    console.warn(`Parsing failed for ${source}, using fallback chunking:`, parseResult.error);
    const simpleChunks = content.split('\n\n').filter(chunk => chunk.trim().length > 0);
    if (simpleChunks.length === 0) {
      simpleChunks.push(content);
    }
    chunks = simpleChunks.map(chunk => ({ content: chunk }));
  }

  const points = [];
  for (const chunk of chunks) {
    if (chunk.content.trim().length === 0) continue;
    const embedding = await getEmbedding(chunk.content);
    points.push({
      id: uuidv4(),
      vector: embedding,
      payload: { 
        ...params, 
        content: chunk.content, 
        project_id: effectiveProjectId,
        scope: effectiveProjectId === 'global' ? 'global' : 'project',
        // Add semantic metadata if available
        ...(chunk.metadata && {
          chunk_type: chunk.metadata.type,
          chunk_name: chunk.metadata.name,
          start_line: chunk.metadata.startLine,
          end_line: chunk.metadata.endLine,
          dependencies: chunk.metadata.dependencies,
          exports: chunk.metadata.exports,
          parent: chunk.metadata.parent,
          visibility: chunk.metadata.visibility,
          is_async: chunk.metadata.async,
          is_static: chunk.metadata.static,
          parameters: chunk.metadata.parameters,
          decorators: chunk.metadata.decorators
        })
      },
    });
  }

  if (points.length > 0) {
    await qdrant.upsert(COLLECTION_NAME, { wait: true, points });
  }

  return { success: true, vectors_added: points.length, project_id: effectiveProjectId };
}

// The `retrieve` function
interface RetrieveParams {
  query: string;
  filters?: Record<string, any>;
  project_id?: string;
  scope?: 'global' | 'project' | 'all';
}

export async function retrieve(params: RetrieveParams): Promise<any[]> {
  await ensureCollectionExists(); // Ensure collection exists before proceeding
  const { query, filters, project_id, scope } = params;
  const qdrant = await getQdrantClient();

  const query_vector = await getEmbedding(query);

  // Build filter conditions
  const filterConditions: any[] = [];
  
  // Add custom filters
  if (filters) {
    filterConditions.push(...Object.entries(filters).map(([key, value]) => ({ key, match: { value } })));
  }
  
  // Add project and scope filtering
  if (scope === 'global') {
    filterConditions.push({ key: 'project_id', match: { value: 'global' } });
  } else if (scope === 'project' && project_id) {
    filterConditions.push({ key: 'project_id', match: { value: project_id } });
  } else if (scope === 'all') {
    // Search both global and project-specific content - use 'should' at top level
    if (project_id) {
      // For 'all' scope with project_id, create an OR condition at the top level
      const searchResult = await qdrant.search(COLLECTION_NAME, {
        vector: query_vector,
        limit: 5,
        filter: {
          must: filters ? Object.entries(filters).map(([key, value]) => ({ key, match: { value } })) : [],
          should: [
            { key: 'project_id', match: { value: 'global' } },
            { key: 'project_id', match: { value: project_id } }
          ]
        },
      });
      return searchResult;
    } else {
      filterConditions.push({ key: 'project_id', match: { value: 'global' } });
    }
  }
  
  const searchResult = await qdrant.search(COLLECTION_NAME, {
    vector: query_vector,
    limit: 5,
    filter: filterConditions.length > 0 ? { must: filterConditions } : undefined,
  });

  return searchResult;
}

// The `deleteSource` function
interface DeleteSourceParams {
  source: string;
  project_id?: string; // Optional project identifier
  scope?: 'global' | 'project'; // Optional scope specification
}

export async function deleteSource(params: DeleteSourceParams): Promise<{ success: boolean; project_id: string }> {
  await ensureCollectionExists();
  const { source, project_id, scope } = params;
  const qdrant = await getQdrantClient();

  // Determine the effective project_id
  let effectiveProjectId: string;
  if (scope === 'global' || (!project_id && !scope)) {
    effectiveProjectId = 'global';
  } else if (project_id) {
    effectiveProjectId = project_id;
  } else {
    effectiveProjectId = 'global';
  }

  console.log(`Deleting all vectors from source: ${source} in project: ${effectiveProjectId}`);

  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: 'source',
          match: { value: source },
        },
        {
          key: 'project_id',
          match: { value: effectiveProjectId },
        },
      ],
    },
  });

  return { success: true, project_id: effectiveProjectId };
}

// Helper function to list all projects
export async function listProjects(): Promise<{ projects: string[] }> {
  await ensureCollectionExists();
  const qdrant = await getQdrantClient();
  
  // Get all unique project_ids from the collection
  // Note: This is a simplified approach. In production, you might want to maintain a separate projects collection
  const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
    limit: 1000,
    with_payload: ['project_id'],
    with_vector: false
  });
  
  const projectIds = new Set<string>();
  for (const point of scrollResult.points) {
    if (point.payload?.project_id) {
      projectIds.add(point.payload.project_id as string);
    }
  }
  
  return { projects: Array.from(projectIds).sort() };
}

// Helper function to delete all vectors for a specific project
export async function deleteAllProjectVectors(projectId: string): Promise<{ success: boolean; deleted_count: number }> {
  await ensureCollectionExists();
  const qdrant = await getQdrantClient();

  console.log(`Deleting all vectors for project: ${projectId}`);

  // Use Qdrant's delete operation with project filter
  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: 'project_id',
          match: { value: projectId },
        },
      ],
    },
  });

  // Get count of remaining vectors for verification (optional)
  const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
    limit: 1,
    filter: {
      must: [
        {
          key: 'project_id',
          match: { value: projectId },
        },
      ],
    },
    with_payload: false,
    with_vector: false
  });

  const remainingCount = scrollResult.points.length;
  const deletedCount = remainingCount === 0 ? 0 : -1; // -1 means we can't determine exact count

  console.log(`Bulk deletion completed for project ${projectId}`);
  return { success: true, deleted_count: deletedCount };
}
