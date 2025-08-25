import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Skip middleware for non-API routes and auth routes
  if (!request.nextUrl.pathname.startsWith('/api/') || 
      request.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Skip authentication for admin routes (localhost only)
  if (request.nextUrl.pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }

  // For now, just pass through - authentication will be handled in the route handlers
  // We can't use database operations in middleware due to edge runtime limitations
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/((?!auth|admin).*)', // Match all API routes except auth and admin
  ],
};