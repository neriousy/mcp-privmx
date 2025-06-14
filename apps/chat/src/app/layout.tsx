import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import ConvexClientProvider from '@/providers/ConvexProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PrivMX AI Assistant',
  description:
    'AI-powered chat interface for PrivMX development, code generation, and API discovery',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider verbose={true}>
      <html lang="en" className="dark">
        <body className={`${inter.variable} font-sans antialiased`}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
