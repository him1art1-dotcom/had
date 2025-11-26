
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
import { User, Notification, SystemSettings, Role } from './types';
import { db } from './services/db';
import { ShieldAlert, Lock } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Sync Check for speed
    const sessionUser = auth.getSession();
    if (sessionUser) {
      setUser(sessionUser);
    }
    
    // Fetch Settings immediately to check lockout status
    db.getSettings().then(setSettings);

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

    const sub = db.subscribeToNotifications(user, (newNotif) => {
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
        
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
    // Refresh settings on login to ensure up-to-date lockout status
    db.getSettings().then(setSettings);
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

  // --- SYSTEM LOCKOUT CHECK ---
  // If user is logged in, School is NOT active, and User is NOT Site Admin (Tech Support)
  if (user && settings && !settings.schoolActive && user.role !== Role.SITE_ADMIN) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0f172a] relative overflow-hidden">
            {/* Background Animation */}
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-red-600/20 blur-[128px] animate-pulse"></div>
            
            <div className="glass-card max-w-lg w-full p-10 rounded-[2.5rem] text-center border border-red-500/30 relative z-10 shadow-2xl shadow-red-900/50">
                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                    <Lock className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-4xl font-bold font-serif text-white mb-4">تم تعطيل النظام</h1>
                <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                    عذراً، تم إيقاف خدمات المدرسة مؤقتاً.
                    <br />
                    يرجى التواصل مع <span className="text-red-400 font-bold">الدعم الفني</span> لإعادة التفعيل.
                </p>
                <button 
                    onClick={handleLogout}
                    className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10 font-bold"
                >
                    تسجيل خروج
                </button>
            </div>
            <div className="mt-8 text-gray-500 text-sm font-mono">System ID: {settings.schoolName || 'Unknown'}</div>
        </div>
      );
  }

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
