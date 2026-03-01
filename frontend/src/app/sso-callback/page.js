import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '40px' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                Authenticating...
            </div>
            <AuthenticateWithRedirectCallback signUpForceRedirectUrl="/" signInForceRedirectUrl="/" />
        </div>
    );
}
