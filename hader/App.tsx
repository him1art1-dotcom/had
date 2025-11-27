import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Kiosk from './pages/Kiosk';
import Watcher from './pages/Watcher';
import Supervision from './pages/Supervision';
import Parents from './pages/Parents';
import Support from './pages/Support';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';
import { auth } from './services/auth';
import { User, Notification } from './types';
import { db } from './services/db';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Sync Check for speed
    const sessionUser = auth.getSession();
    if (sessionUser) {
      setUser(sessionUser);
    }
    
    // Async Connection Check with Timeout Race
    Promise.race([
        auth.checkConnection(),
        new Promise(resolve => setTimeout(() => resolve(false), 5000))
    ]).then((connected) => {
        const status = !!connected;
        console.log("Supabase Connection Status:", status ? "Connected" : "Disconnected/Timeout");
        setIsConnected(status);
        setLoading(false);
    });
  }, []);

  // Notification Subscription
  useEffect(() => {
    if (!user) return;

    // Load initial notifications (mock or fetch last few)
    // For now we start empty and listen for realtime updates
    // In a real app we'd fetch db.getNotifications(user) here

    const sub = db.subscribeToNotifications(user, (newNotif) => {
        setNotifications(prev => {
            const next = [newNotif, ...prev];
            return next.slice(0, 50); // keep list bounded
        });
        setUnreadCount(prev => Math.min(prev + 1, 99));
        
        // Optional: Play a sound or show browser notification
        try {
           const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
           audio.play().catch(e => console.log('Audio play failed', e));
        } catch(e) {}
    });

    return () => {
        sub.unsubscribe();
    }
  }, [user]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
  };

  const handleLogout = () => {
    auth.logout();
    setUser(null);
  };
  
  const clearUnread = () => {
      setUnreadCount(0);
  };

  if (loading) return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white">
          <div className="animate-pulse flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mb-4"></div>
              جاري الاتصال بالنظام السحابي...
          </div>
      </div>
  );

  // System Lockout Check (Moved here or kept inside specific pages/layout)
  // For brevity, relying on page specific logic, but Layout handles general structure

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="/" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        <Layout 
          user={user} 
          onLogout={handleLogout} 
          isConnected={isConnected}
          notifications={notifications}
          unreadCount={unreadCount}
          onClearUnread={clearUnread}
        >
          <Routes>
            <Route path="/" element={
               user.role === 'guardian' ? <Parents user={user} /> : <Dashboard user={user} />
            } />
            <Route path="/admin" element={<Admin />} />
            <Route path="/kiosk" element={<Kiosk />} />
            <Route path="/watcher" element={<Watcher />} />
            <Route path="/supervision" element={<Supervision />} />
            <Route path="/parents" element={<Parents user={user} />} />
            <Route path="/support" element={<Support />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
};

export default App;