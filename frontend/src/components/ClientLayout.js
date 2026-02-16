'use client';
import { WorkspaceProvider } from '@/lib/WorkspaceContext';
import Sidebar from '@/components/Sidebar';

export default function ClientLayout({ children }) {
    return (
        <WorkspaceProvider>
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </WorkspaceProvider>
    );
}
