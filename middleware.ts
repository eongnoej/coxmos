import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')

  if (isApiAuth) return NextResponse.next()
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
