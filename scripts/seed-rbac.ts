#!/usr/bin/env npx tsx
/**
 * Seed script to create default roles and admin user
 * Run with: npx tsx scripts/seed-rbac.ts
 */

import { prisma } from '@/lib/database';
import { hashPassword, generateSecureToken } from '@/lib/auth/password';
import { SYSTEM_ROLES } from '@/lib/auth/types';

async function main() {
  console.log('🌱 Seeding RBAC data...\n');

  // Create system roles
  console.log('Creating system roles...');
  
  for (const [key, roleData] of Object.entries(SYSTEM_ROLES)) {
    const existingRole = await prisma.role.findUnique({
      where: { name: roleData.name }
    });

    if (existingRole) {
      console.log(`  ✓ Role "${roleData.name}" already exists`);
    } else {
      const role = await prisma.role.create({
        data: {
          name: roleData.name,
          description: roleData.description,
          permissions: JSON.stringify(roleData.permissions),
          isSystem: true
        }
      });
      console.log(`  ✓ Created role "${role.name}"`);
    }
  }

  // Check if admin user already exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ideamem.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123!';
  
  console.log('\nCreating admin user...');
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log(`  ✓ Admin user "${adminEmail}" already exists`);
  } else {
    // Get admin role
    const adminRole = await prisma.role.findUnique({
      where: { name: 'Admin' }
    });

    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Administrator',
        passwordHash: await hashPassword(adminPassword),
        isActive: true,
        roles: {
          create: {
            roleId: adminRole.id
          }
        }
      }
    });

    console.log(`  ✓ Created admin user "${adminUser.email}"`);
    
    // Create an initial token for the admin
    const token = await prisma.token.create({
      data: {
        token: generateSecureToken(32),
        name: 'Initial admin token',
        userId: adminUser.id,
        roleId: adminRole.id
      }
    });

    console.log(`\n  📝 Admin credentials:`);
    console.log(`     Email: ${adminEmail}`);
    console.log(`     Password: ${adminPassword}`);
    console.log(`\n  🔑 Initial admin token:`);
    console.log(`     ${token.token}`);
    console.log(`\n  ⚠️  Please change the admin password after first login!`);
  }

  console.log('\n✅ RBAC seeding completed!');
}

main()
  .catch((error) => {
    console.error('Error seeding RBAC:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });