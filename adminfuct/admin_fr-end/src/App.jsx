import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { logActivity } from './utils/logger';
import axios from 'axios';
import { API_BASE_URL } from './config';
import Login from './components/Login';
import WelcomeModal from './components/WelcomeModal';
import Dashboard from './pages/Dashboard';
import HostOnboarding from './pages/HostOnboarding';
import './App.css';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showWelcome, setShowWelcome] = useState(false);
    const [lowPhotoCount, setLowPhotoCount] = useState(0);

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

    useEffect(() => {
        if (user && !loading) {
            axios.get(`${API_BASE_URL}/admin/rooms`)
                .then(res => {
                    const count = res.data.filter(r => (r.imageUrls?.length || 0) <= 5).length;
                    setLowPhotoCount(count);
                })
                .catch(err => console.error("Error fetching room counts:", err));
        }
    }, [user, loading]);

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
            <div className="root-layout">
                {showWelcome && <WelcomeModal onClose={closeWelcomeModal} />}
                <div className="glass-nav">
                    <nav>
                        <Link to="/" className="nav-link active">Image Admin</Link>
                        <Link to="/list-property" className="nav-link">List New Property</Link>
                    </nav>

                    {lowPhotoCount > 0 && (
                        <div className="action-required-badge" title="Rooms with 5 or fewer photos">
                            <span className="dot"></span>
                            {lowPhotoCount} Action Required
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>{user.email}</span>
                        <button
                            onClick={handleLogout}
                            className="logout-button"
                        >
                            Logout
                        </button>
                    </div>
                </div>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/list-property" element={<HostOnboarding />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;