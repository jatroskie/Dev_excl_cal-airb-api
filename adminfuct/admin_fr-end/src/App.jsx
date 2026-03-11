import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { logActivity } from './utils/logger';
import Login from './components/Login';
import WelcomeModal from './components/WelcomeModal';
import Dashboard from './pages/Dashboard';
import HostOnboarding from './pages/HostOnboarding';
import './App.css';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showWelcome, setShowWelcome] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && !loading) {
                logActivity('USER_LOGIN', { email: user.email });

                // Show welcome modal only once per session
                const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
                if (!hasSeenWelcome) {
                    setShowWelcome(true);
                }
            }
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [loading]);

    const handleLogout = async () => {
        try {
            const email = user?.email;
            await signOut(auth);
            logActivity('USER_LOGOUT', { email: email });
            sessionStorage.removeItem('hasSeenWelcome'); // Clear for next login
        } catch (err) {
            console.error("Error signing out:", err);
        }
    };

    const closeWelcomeModal = () => {
        setShowWelcome(false);
        sessionStorage.setItem('hasSeenWelcome', 'true');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <Router basename="/host">
            {showWelcome && <WelcomeModal onClose={closeWelcomeModal} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
                <nav>
                    <Link to="/" style={{ marginRight: '15px', fontWeight: 'bold', textDecoration: 'none', color: '#007bff' }}>Image Admin</Link>
                    <Link to="/list-property" style={{ textDecoration: 'none', color: '#333' }}>List New Property</Link>
                </nav>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '14px', color: '#666' }}>{user.email}</span>
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        Logout
                    </button>
                </div>
            </div>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/list-property" element={<HostOnboarding />} />
            </Routes>
        </Router>
    );
}

export default App;