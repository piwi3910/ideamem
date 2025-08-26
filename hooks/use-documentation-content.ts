import { useQuery } from '@tanstack/react-query';
import type { DocumentationContent } from '@/components/DocumentationReader';

// Query keys
export const documentationContentKeys = {
  all: ['documentation-content'] as const,
  byId: (id: string) => [...documentationContentKeys.all, 'by-id', id] as const,
};

// API function
async function fetchDocumentationContent(documentId: string): Promise<DocumentationContent> {
  // TODO: Replace with actual API call
  // This is currently a placeholder - in a real implementation, this would
  // make an API call to fetch the document content by ID
  
  // For now, return a mock document
  const mockDocument: DocumentationContent = {
    id: documentId,
    title: `Document ${documentId}`,
    content: `# Document ${documentId}\n\nThis is placeholder content for document ${documentId}.\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n\`\`\`javascript\nconst example = () => {\n  console.log('Hello, world!');\n};\n\`\`\`\n\n## More Information\n\nThis document contains sample content to demonstrate the documentation reader.`,
    type: 'markdown',
    source: 'API',
    lastUpdated: new Date().toISOString(),
    tags: ['sample', 'documentation', 'placeholder'],
    headings: [
      {
        id: `document-${documentId}`,
        text: `Document ${documentId}`,
        level: 1,
        position: 0,
      },
      {
        id: 'features',
        text: 'Features',
        level: 2,
        position: 1,
      },
      {
        id: 'more-information',
        text: 'More Information',
        level: 2,
        position: 2,
      },
    ],
  };

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return mockDocument;
}

// Hook
export function useDocumentationContent(documentId: string) {
  return useQuery({
    queryKey: documentationContentKeys.byId(documentId),
    queryFn: () => fetchDocumentationContent(documentId),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}