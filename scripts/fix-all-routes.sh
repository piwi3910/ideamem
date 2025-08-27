#!/bin/bash

echo "Fixing all API routes - removing try-catch blocks and fixing types..."

# Fix projects/[id]/token/route.ts
cat > /tmp/fix_token.patch << 'EOF'
--- a/app/api/projects/[id]/token/route.ts
+++ b/app/api/projects/[id]/token/route.ts
@@ -21,18 +21,11 @@
     validation: { params: paramsSchema },
     errorHandling: { context: { resource: 'project-token' } },
   },
-  async (request: NextRequest, { params }: any) => {
-    try {
-      const { id } = params;
-      const newToken = await regenerateToken(id);
+  async (request: NextRequest, { params }: { params: z.infer<typeof paramsSchema> }) => {
+    const { id } = params;
+    const newToken = await regenerateToken(id);
 
-      if (!newToken) {
-        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
-      }
-
-      return NextResponse.json({ token: newToken });
-    } catch (error) {
-      console.error('Error regenerating token:', error);
-      return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
+    if (!newToken) {
+      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
     }
+
+    return NextResponse.json({ token: newToken });
   }
EOF

# Fix projects/[id]/schedule/route.ts
cat > /tmp/fix_schedule.patch << 'EOF'
--- a/app/api/projects/[id]/schedule/route.ts
+++ b/app/api/projects/[id]/schedule/route.ts
@@ -23,24 +23,16 @@
     validation: { params: paramsSchema },
     errorHandling: { context: { resource: 'project-schedule' } },
   },
-  async (request: NextRequest, { params: { id } }: any) => {
-    try {
-      const project = await getProject(id);
-
-      if (!project) {
-        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
-      }
+  async (request: NextRequest, { params: { id } }: { params: z.infer<typeof paramsSchema> }) => {
+    const project = await getProject(id);
 
-      return NextResponse.json({
-        projectId: project.id,
-        scheduledIndexingEnabled: project.scheduledIndexingEnabled || false,
-        intervalMinutes: project.scheduledIndexingInterval || 60,
-        branch: project.scheduledIndexingBranch || 'main',
-      });
-    } catch (error) {
-      console.error('Error fetching scheduled indexing info:', error);
-      return NextResponse.json({ error: 'Failed to fetch scheduled indexing info' }, { status: 500 });
+    if (!project) {
+      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
     }
+
+    return NextResponse.json({
+      projectId: project.id,
+      scheduledIndexingEnabled: project.scheduledIndexingEnabled || false,
+      intervalMinutes: project.scheduledIndexingInterval || 60,
+      branch: project.scheduledIndexingBranch || 'main',
+    });
   }
@@ -56,20 +48,15 @@
     validation: { params: paramsSchema, body: scheduleToggleSchema },
     errorHandling: { context: { resource: 'project-schedule' } },
   },
-  async (request: NextRequest, { params: { id }, body: { enabled, intervalMinutes, branch } }: any) => {
-    try {
-      const project = await toggleScheduledIndexing(id, enabled, intervalMinutes, branch);
+  async (request: NextRequest, { params: { id }, body: { enabled, intervalMinutes, branch } }: { 
+    params: z.infer<typeof paramsSchema>,
+    body: z.infer<typeof scheduleToggleSchema>
+  }) => {
+    const project = await toggleScheduledIndexing(id, enabled, intervalMinutes, branch);
 
-      if (!project) {
-        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
-      }
-
-      return NextResponse.json({
-        projectId: project.id,
-        scheduledIndexingEnabled: project.scheduledIndexingEnabled || false,
-      });
-    } catch (error) {
-      console.error('Error toggling scheduled indexing:', error);
-      return NextResponse.json({ error: 'Failed to toggle scheduled indexing' }, { status: 500 });
+    if (!project) {
+      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
     }
+
+    return NextResponse.json({
+      projectId: project.id,
+      scheduledIndexingEnabled: project.scheduledIndexingEnabled || false,
+    });
   }
EOF

echo "Patches created. Manual application needed for complex cases."
echo "Run type check to verify: pnpm tsc --noEmit --skipLibCheck"