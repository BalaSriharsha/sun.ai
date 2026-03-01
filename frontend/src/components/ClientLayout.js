'use client';
import { WorkspaceProvider } from '@/lib/WorkspaceContext';
import Sidebar from '@/components/Sidebar';
import { ThemeProvider } from 'next-themes';

export default function ClientLayout({ children }) {
    return (
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
            <WorkspaceProvider>
                <div className="app-layout">
                    <Sidebar />
                    <main className="main-content">
                        {children}
                    </main>
                </div>
            </WorkspaceProvider>
        </ThemeProvider>
    );
}
