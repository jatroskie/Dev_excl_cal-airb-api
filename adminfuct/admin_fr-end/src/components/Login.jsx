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
        <div className="login-page-wrapper">
            <div className="glass-modal-content login-box">
                <div className="login-header">
                    <h2>Host Admin Portal</h2>
                    <p>Please sign in to manage your properties</p>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="google-login-btn"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                    />
                    <span>Sign in with Google</span>
                </button>

                {error && (
                    <div className="error-text">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Login;
