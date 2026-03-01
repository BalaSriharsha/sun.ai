'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const { isLoaded, user } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();

    if (!isLoaded) return <div style={{ padding: '40px', color: 'var(--text-primary)' }}>Loading...</div>;

    if (!user) {
        router.push('/sign-in');
        return null;
    }

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
            }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Profile</h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img
                        src={user.imageUrl}
                        alt="Profile"
                        style={{ width: '64px', height: '64px', borderRadius: '50%', border: '1px solid var(--border-color)' }}
                    />
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {user.fullName || 'User'}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                            {user.primaryEmailAddress?.emailAddress}
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '8px 0' }}></div>

                <button
                    onClick={() => signOut(() => router.push('/'))}
                    style={{
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '10px 16px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        width: 'fit-content',
                        boxShadow: '2px 2px 0px var(--border-color)',
                        transition: 'all 0.2s',
                        fontSize: '14px'
                    }}
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
}
