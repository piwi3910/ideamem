#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const API_DIR = join(__dirname, '../app/api');

// Find all route.ts files recursively
function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  const items = readdirSync(dir);
  
  for (const item of items) {
    const path = join(dir, item);
    const stat = statSync(path);
    
    if (stat.isDirectory()) {
      files.push(...findRouteFiles(path));
    } else if (item === 'route.ts') {
      files.push(path);
    }
  }
  
  return files;
}

// Remove try-catch blocks from route handlers
function removeTryCatch(content: string): string {
  // Pattern to match route handlers with try-catch
  const pattern = /async \(request: NextRequest(?:, \{ [^}]+ \}[^)]*)?:\s*any\)\s*=>\s*\{\s*try\s*\{([\s\S]*?)\}\s*catch[^}]*\{[^}]*\}\s*\}/g;
  
  return content.replace(pattern, (match, tryBody) => {
    // Extract the body without try-catch
    const cleanBody = tryBody.trim();
    
    // Determine the parameter type
    const paramMatch = match.match(/async \(request: NextRequest(?:, (\{ [^}]+ \})[^)]*)?:\s*any\)/);
    if (paramMatch && paramMatch[1]) {
      // Has additional parameters
      const params = paramMatch[1];
      
      // Try to infer the type
      let typeHint = '';
      if (params.includes('body')) {
        typeHint = '{ body: any }'; // Will be fixed in type safety pass
      } else if (params.includes('params')) {
        typeHint = '{ params: any }'; // Will be fixed in type safety pass  
      } else {
        typeHint = params + ': any';
      }
      
      return `async (request: NextRequest, ${typeHint}) => {\n    ${cleanBody}\n  }`;
    } else {
      return `async (request: NextRequest) => {\n    ${cleanBody}\n  }`;
    }
  });
}

// Fix type safety issues
function fixTypeSafety(content: string): string {
  // Replace : any with proper types for common patterns
  
  // Fix params type
  content = content.replace(
    /\{ params: \{ id \} \}: any/g,
    '{ params: { id } }: { params: { id: string } }'
  );
  
  content = content.replace(
    /\{ params \}: any/g,
    '{ params }: { params: { id: string } }'
  );
  
  // Fix body type when schema is available
  const schemaMatch = content.match(/const (\w+Schema) = z\.object/);
  if (schemaMatch) {
    const schemaName = schemaMatch[1];
    content = content.replace(
      /\{ body \}: any/g,
      `{ body }: { body: z.infer<typeof ${schemaName}> }`
    );
  }
  
  // Fix combined params and body
  content = content.replace(
    /\{ params: \{ id \}, body \}: any/g,
    '{ params: { id }, body }: { params: { id: string }, body: any }'
  );
  
  return content;
}

// Process each route file
const routeFiles = findRouteFiles(API_DIR);
console.log(`Found ${routeFiles.length} route files`);

let fixedCount = 0;
for (const file of routeFiles) {
  const content = readFileSync(file, 'utf-8');
  let modified = content;
  
  // Skip if no try-catch found
  if (!content.includes('try {')) {
    continue;
  }
  
  // Apply fixes
  modified = removeTryCatch(modified);
  modified = fixTypeSafety(modified);
  
  // Only write if changed
  if (modified !== content) {
    writeFileSync(file, modified);
    console.log(`Fixed: ${file.replace(API_DIR, 'app/api')}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);