import React, { useState } from 'react';
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from '../firebase';

function Login() {
    const [error, setError] = useState('');

    const handleGoogleLogin = async () => {
        setError('');
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            setError('Failed to sign in with Google. ' + err.message);
            console.error(err);
        }
    };

    return (
        <div className="login-container" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f5f5f5'
        }}>
            <div className="login-box" style={{
                padding: '2.5rem',
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <h2 style={{ marginBottom: '0.5rem', color: '#333' }}>Host Admin Portal</h2>
                <p style={{ marginBottom: '2rem', color: '#666' }}>Please sign in to manage your properties</p>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="google-btn"
                    style={{
                        padding: '0.85rem 1.5rem',
                        backgroundColor: '#fff',
                        color: '#3c4043',
                        border: '1px solid #dadce0',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        width: '100%',
                        fontSize: '16px',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        style={{ width: '20px', height: '20px' }}
                    />
                    Sign in with Google
                </button>

                {error && (
                    <p className="error" style={{
                        color: '#d93025',
                        fontSize: '14px',
                        marginTop: '1.5rem',
                        backgroundColor: '#fce8e6',
                        padding: '0.75rem',
                        borderRadius: '4px'
                    }}>
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}

export default Login;
