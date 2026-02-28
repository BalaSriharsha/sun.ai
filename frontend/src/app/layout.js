import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata = {
  title: 'Zeus.ai',
  description: 'A comprehensive AI agent platform with providers, tools, MCP servers, workflows, and observability',
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        </head>
        <body>
          <ClientLayout>
            {children}
          </ClientLayout>
        </body>
      </html>
    </ClerkProvider>
  );
}

