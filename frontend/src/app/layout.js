import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata = {
  title: 'sun.ai',
  description: 'A comprehensive AI agent platform with providers, tools, MCP servers, workflows, and observability',
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: 'var(--text-primary)',
          colorText: 'var(--text-primary)',
          colorTextSecondary: 'var(--text-secondary)',
          colorBackground: 'var(--bg-card)',
          colorInputBackground: 'var(--bg-input)',
          colorInputText: 'var(--text-primary)',
          colorDanger: 'var(--text-primary)',
          colorSuccess: 'var(--text-primary)',
          colorWarning: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          borderRadius: 'var(--radius-md)',
        },
        elements: {
          cardBox: {
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
          },
          card: {
            boxShadow: 'none',
            border: 'none',
            background: 'transparent',
          },
          headerTitle: {
            display: 'none', // Hide the "ZeusAI" default text
          },
          headerSubtitle: {
            color: 'var(--text-secondary)',
            fontSize: '14px',
          },
          logoBox: {
            display: 'block', // Ensure the logo shows instead of the title if configured
          },
          formButtonPrimary: {
            backgroundColor: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            border: '1px solid var(--text-primary)',
            boxShadow: '2px 2px 0px var(--border-color)',
            '&:hover': {
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            },
          },
          socialButtonsBlockButton: {
            border: '1px solid var(--border-color)',
            boxShadow: '2px 2px 0px var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            '&:hover': {
              backgroundColor: 'var(--bg-secondary)',
            },
          },
          dividerLine: {
            background: 'var(--border-color)',
          },
          dividerText: {
            color: 'var(--text-secondary)',
          },
          footerActionLink: {
            color: 'var(--text-primary)',
            fontWeight: 600,
            '&:hover': {
              color: 'var(--text-secondary)',
            },
          },
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
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

