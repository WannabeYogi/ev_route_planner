import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// This function can be marked `async` if using `await` inside
export async function middleware(request) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;
  
  // Define public paths that don't require authentication
  const isPublicPath = path === '/login' || 
                       path === '/register' || 
                       path === '/' ||
                       path === '/api/auth/register' ||
                       path.startsWith('/api/auth');
  
  // Check if the path is for API that requires authentication
  const isApiPath = path.startsWith('/api') && !path.startsWith('/api/auth');
  
  // Check if the path is for protected pages
  const isProtectedPage = path.startsWith('/my-rides') || 
                          path.startsWith('/profile');
  
  // Get the token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  // Redirect unauthenticated users from protected routes to login
  if ((isProtectedPage || isApiPath) && !token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', encodeURI(request.url));
    return NextResponse.redirect(url);
  }
  
  // Redirect authenticated users from login/register to home
  if ((path === '/login' || path === '/register') && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/my-rides/:path*',
    '/profile/:path*',
    '/api/rides/:path*',
    '/login',
    '/register'
  ],
};
