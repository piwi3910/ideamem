# User-Based Authentication and RBAC Migration Guide

## Overview

IdeaMem has been successfully migrated from a project-based token system to a comprehensive user-based authentication system with Role-Based Access Control (RBAC). This guide documents the changes and provides instructions for using the new system.

## Key Changes

### 1. Database Schema

New models have been added to support user authentication:

- **User**: Stores user credentials and information
- **Role**: Defines permissions and access levels
- **UserRole**: Many-to-many relationship between users and roles
- **Token**: Authentication tokens associated with users and specific roles

### 2. Authentication Flow

The system now supports two authentication methods:

1. **Legacy Project Tokens** (backward compatible)
   - Existing project tokens continue to work
   - Automatically mapped to project-specific permissions

2. **User-Based Tokens** (new)
   - Users authenticate with email/password
   - Tokens are generated with specific role permissions
   - Support for multiple roles per user

## Default Admin Account

After running the seed script, a default admin account is created:

```
Email: admin@ideamem.local
Password: changeme123!
```

**Important**: Change this password immediately after first login!

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with email/password

### User Management (Admin only)

- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/users/[id]` - Get user details
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user

### Role Management (Admin only)

- `GET /api/roles` - List all roles
- `POST /api/roles` - Create new role
- `GET /api/roles/[id]` - Get role details
- `PUT /api/roles/[id]` - Update role
- `DELETE /api/roles/[id]` - Delete role

### Token Management

- `GET /api/tokens` - List user's tokens
- `POST /api/tokens` - Generate new token
- `DELETE /api/tokens/[id]` - Revoke token

## System Roles

Three default system roles are created:

1. **Admin**
   - Full system access
   - Can manage users, roles, and all projects

2. **Developer**
   - Read/write access to assigned projects
   - Read-only access to global preferences and documentation

3. **Read-Only**
   - Read-only access to assigned projects
   - Read-only access to global resources

## Role Permissions Structure

Roles use a flexible JSON permission structure:

```json
{
  "projects": {
    "all": {
      "read": true,
      "write": true,
      "delete": false
    },
    "specific": {
      "project-id-1": {
        "read": true,
        "write": true
      }
    }
  },
  "global": {
    "preferences": {
      "read": true,
      "write": false
    },
    "docs": {
      "read": true,
      "write": false,
      "index": false
    },
    "users": {
      "read": false,
      "write": false,
      "delete": false
    },
    "roles": {
      "read": false,
      "write": false,
      "delete": false
    }
  },
  "system": {
    "admin": false
  }
}
```

## MCP Connection with User Tokens

The MCP connection string has been updated to support both authentication methods:

### With User Token (New)

```bash
claude mcp add --transport http ideamem-project \
  http://localhost:3000/api/mcp \
  --header "Authorization: Bearer YOUR_USER_TOKEN" \
  --header "X-Project-ID: PROJECT_ID"
```

### With Legacy Project Token (Backward Compatible)

```bash
claude mcp add --transport http ideamem-project \
  http://localhost:3000/api/mcp \
  --header "Authorization: Bearer PROJECT_TOKEN"
```

## Migration Scripts

### 1. Seed Default Admin and Roles

```bash
npx tsx scripts/seed-rbac.ts
```

Creates:
- System roles (Admin, Developer, Read-Only)
- Default admin user

### 2. Migrate Existing Projects

```bash
npx tsx scripts/migrate-projects-to-rbac.ts
```

For each existing project:
- Creates a dedicated user
- Creates a project-specific role
- Maintains the original project token for backward compatibility

## Security Best Practices

1. **Change Default Password**: Immediately change the admin password after first login
2. **Token Management**: Regularly rotate tokens and revoke unused ones
3. **Principle of Least Privilege**: Assign users only the roles they need
4. **Audit Trail**: All tokens track last usage for security monitoring

## Backward Compatibility

The system maintains full backward compatibility:

- Existing project tokens continue to work
- Legacy tokens automatically map to project-specific permissions
- No changes required for existing integrations

## Troubleshooting

### Login Issues

If login fails, verify:
1. User exists and is active
2. Password is correct
3. User has at least one role assigned

### Permission Denied

Check:
1. Token is valid and not expired
2. User's role has required permissions
3. For project operations, X-Project-ID header is provided

### Token Issues

- Tokens show masked values in listings for security
- Full token value is only shown once during creation
- Expired tokens are automatically rejected

## Future Enhancements

Potential improvements for the RBAC system:

1. **Two-Factor Authentication (2FA)**: Add TOTP/SMS authentication
2. **OAuth Integration**: Support for Google, GitHub, etc.
3. **Fine-Grained Permissions**: More detailed permission controls
4. **Audit Logging**: Comprehensive activity tracking
5. **Session Management**: Web-based session handling
6. **Password Recovery**: Email-based password reset

## Support

For issues or questions about the RBAC system, please:
1. Check this documentation
2. Review the migration scripts in `/scripts`
3. Contact the development team

---

*Last Updated: August 29, 2025*