#!/usr/bin/env npx tsx
/**
 * Migration script to convert existing projects to the new RBAC system
 * Each project will get a dedicated user and role with access to that project only
 * Run with: npx tsx scripts/migrate-projects-to-rbac.ts
 */

import { prisma } from '@/lib/database';
import { hashPassword, generateSecureToken } from '@/lib/auth/password';
import { RolePermissions } from '@/lib/auth/types';

async function main() {
  console.log('🔄 Migrating existing projects to RBAC system...\n');

  // Get all existing projects
  const projects = await prisma.project.findMany();
  
  if (projects.length === 0) {
    console.log('No projects found to migrate.');
    return;
  }

  console.log(`Found ${projects.length} projects to migrate.\n`);

  for (const project of projects) {
    console.log(`\nMigrating project: ${project.name}`);
    
    // Create a user for this project
    const userEmail = `${project.name.toLowerCase().replace(/\s+/g, '-')}@project.local`;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (existingUser) {
      console.log(`  ⚠️  User for project "${project.name}" already exists`);
      continue;
    }

    // Create role with permissions for this specific project
    const rolePermissions: RolePermissions = {
      projects: {
        specific: {
          [project.id]: {
            read: true,
            write: true,
            delete: false
          }
        }
      },
      global: {
        preferences: {
          read: true,
          write: false
        },
        docs: {
          read: true,
          write: false,
          index: false
        }
      }
    };

    const role = await prisma.role.create({
      data: {
        name: `Project: ${project.name}`,
        description: `Access to project ${project.name} (migrated from legacy token)`,
        permissions: JSON.stringify(rolePermissions),
        isSystem: false
      }
    });
    console.log(`  ✓ Created role for project`);

    // Create user for the project
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        name: `${project.name} User`,
        passwordHash: await hashPassword(generateSecureToken(16)), // Random password
        isActive: true,
        roles: {
          create: {
            roleId: role.id
          }
        }
      }
    });
    console.log(`  ✓ Created user: ${userEmail}`);

    // Create a token that matches the legacy project token
    // This allows existing integrations to continue working
    await prisma.token.create({
      data: {
        token: project.token, // Use the existing project token
        name: `Legacy token for ${project.name}`,
        userId: user.id,
        roleId: role.id
      }
    });
    console.log(`  ✓ Migrated legacy token`);

    console.log(`  ✅ Project "${project.name}" successfully migrated`);
  }

  console.log('\n✅ All projects migrated successfully!');
  console.log('\nNote: Legacy project tokens will continue to work.');
  console.log('Users can now also authenticate with their email and password');
  console.log('to get new tokens with different roles.');
}

main()
  .catch((error) => {
    console.error('Error migrating projects:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });