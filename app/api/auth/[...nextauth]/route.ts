import NextAuth, { NextAuthOptions } from 'next-auth';
import { getProjectByToken } from '@/lib/projects';

export const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-key',
};

// Custom function to validate Bearer tokens for API routes
export async function validateBearerToken(authHeader: string | null): Promise<{
  projectId: string;
  projectName: string;
  gitRepo: string;
  token: string;
} | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const project = await getProjectByToken(token);
    if (project) {
      return {
        projectId: project.id,
        projectName: project.name,
        gitRepo: project.gitRepo,
        token: project.token,
      };
    }
  } catch (error) {
    console.error('Token validation error:', error);
  }

  return null;
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };