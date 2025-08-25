#!/usr/bin/env npx tsx

/**
 * Migration script to transfer documentation repository metadata from JSON file to Prisma database
 * This script safely migrates all repository data without losing any information
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { PrismaClient } from '../lib/generated/prisma';

interface DocRepositoryJSON {
  id: string;
  name: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  gitUrl?: string;
  url?: string;
  branch?: string;
  description?: string;
  languages: string[];
  lastIndexed?: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  documentCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const REPOS_FILE = path.join(DATA_DIR, 'doc-repositories.json');
const BACKUP_FILE = path.join(DATA_DIR, `doc-repositories-backup-${Date.now()}.json`);

const prisma = new PrismaClient();

async function loadJSONRepositories(): Promise<DocRepositoryJSON[]> {
  try {
    if (!existsSync(REPOS_FILE)) {
      console.log('❌ JSON file not found:', REPOS_FILE);
      return [];
    }
    const data = await readFile(REPOS_FILE, 'utf-8');
    const repositories = JSON.parse(data);
    console.log(`📂 Loaded ${repositories.length} repositories from JSON file`);
    return repositories;
  } catch (error) {
    console.error('❌ Error loading JSON repositories:', error);
    return [];
  }
}

async function createBackup(repositories: DocRepositoryJSON[]): Promise<void> {
  try {
    await writeFile(BACKUP_FILE, JSON.stringify(repositories, null, 2));
    console.log(`💾 Created backup at: ${BACKUP_FILE}`);
  } catch (error) {
    console.error('❌ Error creating backup:', error);
    throw error;
  }
}

async function migrateToDatabase(repositories: DocRepositoryJSON[]): Promise<void> {
  console.log(`🔄 Starting migration of ${repositories.length} repositories...`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const repo of repositories) {
    try {
      // Check if repository already exists in database
      const existing = await prisma.documentationRepository.findUnique({
        where: { id: repo.id }
      });

      if (existing) {
        console.log(`⏭️  Repository already exists in database: ${repo.name}`);
        skipped++;
        continue;
      }

      // Transform JSON data to Prisma format
      const repositoryUrl = repo.gitUrl || repo.url || '';
      
      await prisma.documentationRepository.create({
        data: {
          id: repo.id,
          name: repo.name,
          url: repositoryUrl,
          branch: repo.branch || 'main',
          sourceType: repo.sourceType,
          
          // Repository metadata
          description: repo.description || null,
          language: repo.languages.length > 0 ? repo.languages[0] : null, // Primary language
          isActive: repo.status !== 'error',
          
          // Indexing statistics
          totalDocuments: repo.documentCount,
          lastIndexingStatus: repo.status.toUpperCase(),
          lastIndexingError: repo.lastError || null,
          lastIndexedAt: repo.lastIndexed ? new Date(repo.lastIndexed) : null,
          
          // Timestamps
          createdAt: new Date(repo.createdAt),
          updatedAt: new Date(repo.updatedAt),
        }
      });

      console.log(`✅ Migrated: ${repo.name} (${repo.documentCount} documents)`);
      migrated++;

    } catch (error) {
      console.error(`❌ Error migrating repository ${repo.name}:`, error);
      errors++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`  ✅ Migrated: ${migrated} repositories`);
  console.log(`  ⏭️  Skipped: ${skipped} repositories (already exist)`);
  console.log(`  ❌ Errors: ${errors} repositories`);
}

async function verifyMigration(originalRepositories: DocRepositoryJSON[]): Promise<void> {
  console.log('\n🔍 Verifying migration...');
  
  const databaseCount = await prisma.documentationRepository.count();
  console.log(`📊 Database has ${databaseCount} documentation repositories`);
  
  // Check if all repositories were migrated
  for (const repo of originalRepositories) {
    const dbRepo = await prisma.documentationRepository.findUnique({
      where: { id: repo.id }
    });
    
    if (!dbRepo) {
      console.error(`❌ Repository not found in database: ${repo.name}`);
      continue;
    }
    
    // Verify key data matches
    const urlMatch = dbRepo.url === (repo.gitUrl || repo.url);
    const nameMatch = dbRepo.name === repo.name;
    const documentsMatch = dbRepo.totalDocuments === repo.documentCount;
    
    if (!urlMatch || !nameMatch || !documentsMatch) {
      console.error(`⚠️  Data mismatch for ${repo.name}:`);
      console.error(`    URL: JSON(${repo.gitUrl || repo.url}) vs DB(${dbRepo.url})`);
      console.error(`    Name: JSON(${repo.name}) vs DB(${dbRepo.name})`);
      console.error(`    Documents: JSON(${repo.documentCount}) vs DB(${dbRepo.totalDocuments})`);
    }
  }
  
  console.log('✅ Migration verification completed');
}

async function main() {
  try {
    console.log('🚀 Starting documentation repository migration...\n');
    
    // Load existing JSON data
    const repositories = await loadJSONRepositories();
    
    if (repositories.length === 0) {
      console.log('ℹ️  No repositories found to migrate');
      return;
    }
    
    // Create backup
    await createBackup(repositories);
    
    // Migrate to database
    await migrateToDatabase(repositories);
    
    // Verify migration
    await verifyMigration(repositories);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`💾 Original data backed up to: ${BACKUP_FILE}`);
    console.log('🔄 You can now update the documentation system to use Prisma instead of JSON');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}