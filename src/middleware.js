import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request) {
  
  const path = request.nextUrl.pathname;
  
  
  const isPublicPath = path === '/login' || 
                       path === '/register' || 
                       path === '/' ||
                       path === '/api/auth/register' ||
                       path.startsWith('/api/auth');
  
                       
  const isApiPath = path.startsWith('/api') && !path.startsWith('/api/auth');
  
  
  const isProtectedPage = path.startsWith('/my-rides') || 
                          path.startsWith('/profile');
  
                          
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  
  if ((isProtectedPage || isApiPath) && !token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', encodeURI(request.url));
    return NextResponse.redirect(url);
  }
  
  if ((path === '/login' || path === '/register') && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/my-rides/:path*',
    '/profile/:path*',
    '/api/rides/:path*',
    '/login',
    '/register'
  ],
};
