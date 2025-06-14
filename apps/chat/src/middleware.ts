import { convexAuthNextjsMiddleware } from '@convex-dev/auth/nextjs/server';

export default convexAuthNextjsMiddleware();

export const config = {
  // The default matcher excludes files in the _next directory and static files.
  // Modify the matcher to include/exclude specific routes as needed for your application.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
