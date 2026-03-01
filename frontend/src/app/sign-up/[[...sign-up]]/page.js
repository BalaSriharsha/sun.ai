'use client';

import { useSignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const signUpWithOAuth = (strategy) => {
        if (!isLoaded) return;
        try {
            signUp.authenticateWithRedirect({
                strategy,
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/',
            });
        } catch (err) {
            setError(err.errors?.[0]?.message || 'An error occurred during sign up.');
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!isLoaded) return;
        setError('');

        try {
            await signUp.create({
                emailAddress,
                password,
            });

            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            setPendingVerification(true);
        } catch (err) {
            setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'An error occurred.');
        }
    };

    const verifyCode = async (e) => {
        e.preventDefault();
        if (!isLoaded) return;
        setError('');

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            });

            if (completeSignUp.status === 'complete') {
                await setActive({ session: completeSignUp.createdSessionId });
                router.push('/');
            } else {
                setError('Verification incomplete.');
            }
        } catch (err) {
            setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Invalid code.');
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '40px' }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Create an account</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Sign up to get started with sun.ai</p>
                </div>

                {error && (
                    <div style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', padding: '12px', borderRadius: '4px', fontSize: '13px', border: '1px solid var(--border-color)', fontWeight: 500 }}>
                        {error}
                    </div>
                )}

                {!pendingVerification ? (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={() => signUpWithOAuth('oauth_google')}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    boxShadow: '2px 2px 0px var(--border-color)',
                                    transition: 'all 0.2s',
                                    fontSize: '14px'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                                Continue with Google
                            </button>

                            <button
                                onClick={() => signUpWithOAuth('oauth_microsoft')}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    boxShadow: '2px 2px 0px var(--border-color)',
                                    transition: 'all 0.2s',
                                    fontSize: '14px'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 21 21"><path d="M10 0H0v10h10V0z" fill="#f25022" /><path d="M21 0H11v10h10V0z" fill="#7fba00" /><path d="M10 11H0v10h10V11z" fill="#00a4ef" /><path d="M21 11H11v10h10V11z" fill="#ffb900" /></svg>
                                Continue with Microsoft
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        </div>

                        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Email address</label>
                                <input
                                    type="email"
                                    value={emailAddress}
                                    onChange={(e) => setEmailAddress(e.target.value)}
                                    style={{
                                        padding: '10px 12px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        background: 'transparent',
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                        fontSize: '14px'
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{
                                        padding: '10px 12px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        background: 'transparent',
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                        fontSize: '14px'
                                    }}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    background: 'var(--text-primary)',
                                    color: 'var(--bg-primary)',
                                    border: '1px solid var(--text-primary)',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginTop: '4px',
                                    boxShadow: '2px 2px 0px var(--border-color)',
                                    fontSize: '14px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                Continue
                            </button>
                        </form>
                    </>
                ) : (
                    <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Verification Code</label>
                            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Enter the verification code sent to {emailAddress}
                            </p>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                style={{
                                    padding: '10px 12px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    fontSize: '14px'
                                }}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            style={{
                                background: 'var(--text-primary)',
                                color: 'var(--bg-primary)',
                                border: '1px solid var(--text-primary)',
                                padding: '12px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginTop: '4px',
                                boxShadow: '2px 2px 0px var(--border-color)',
                                fontSize: '14px',
                                transition: 'all 0.2s',
                            }}
                        >
                            Verify Email
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Already have an account?{' '}
                    <Link href="/sign-in" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}>
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
