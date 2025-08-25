import 'next-auth';

declare module 'next-auth' {
  interface User {
    projectId: string;
    projectName: string;
    gitRepo: string;
    token: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      projectId: string;
      projectName: string;
      gitRepo: string;
      mcpToken: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    projectId: string;
    projectName: string;
    gitRepo: string;
    mcpToken: string;
  }
}