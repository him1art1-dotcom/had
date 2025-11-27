
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Shield, Users, Clock, LayoutDashboard, Settings, UserCircle, Activity, X, Bell, Info } from 'lucide-react';
import { Role, User, Notification, SystemSettings } from '../types';
import { db } from '../services/db';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  isConnected: boolean;
  notifications?: Notification[]; 
  unreadCount?: number;           
  onClearUnread?: () => void;     
}

const Layout: React.FC<LayoutProps> = ({ 
    children, 
    user, 
    onLogout, 
    isConnected,
    notifications = [],
    unreadCount = 0,
    onClearUnread
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    db.getSettings().then(setSettings);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!user) return <>{children}</>;

  // Kiosk mode for student attendance - no layout
  if (location.pathname === '/kiosk') return <>{children}</>;

  const menuItems = [
    { label: 'الرئيسية', icon: LayoutDashboard, path: '/', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL, Role.WATCHER, Role.SUPERVISOR_CLASS] },
    { label: 'الإدارة', icon: Settings, path: '/admin', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN] },
    { label: 'كشك الحضور', icon: Clock, path: '/kiosk', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.WATCHER] },
    { label: 'المراقبة اليومية', icon: Activity, path: '/watcher', roles: [Role.SITE_ADMIN, Role.WATCHER, Role.SCHOOL_ADMIN] },
    { label: 'الإشراف', icon: Shield, path: '/supervision', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL, Role.SUPERVISOR_CLASS] },
    { label: 'الدعم الفني', icon: Activity, path: '/support', roles: [Role.SITE_ADMIN] },
  ];

  const allowedItems = menuItems.filter(item => item.roles.includes(user.role));

  const toggleNotifications = () => {
      if (!notifOpen && unreadCount > 0 && onClearUnread) {
          onClearUnread();
      }
      setNotifOpen(!notifOpen);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-gray-100">
      {/* Mobile Header */}
      <div className="md:hidden glass p-4 flex justify-between items-center z-20 border-b border-white/10 sticky top-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-serif text-white text-glow">حاضر</h1>
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} title={isConnected ? 'متصل' : 'غير متصل'}></div>
        </div>
        <div className="flex items-center gap-2">
            {/* Notification Bell (Mobile) */}
            <button 
                onClick={toggleNotifications}
                className="p-2 rounded-lg bg-white/5 border border-white/10 relative"
            >
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg bg-white/5 border border-white/10">
               <Menu className="w-6 h-6 text-white" />
            </button>
        </div>
      </div>

      {/* Notification Dropdown (Shared for Mobile/Desktop relative logic tricky, using absolute positioning) */}
      {notifOpen && (
          <div ref={notifRef} className="fixed top-16 right-4 md:right-auto md:left-20 z-50 w-80 glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up">
              <div className="p-3 border-b border-white/10 bg-black/20 flex justify-between items-center">
                  <h3 className="font-bold text-white text-sm">الإشعارات</h3>
                  <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4"/></button>
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                          <Bell className="w-8 h-8 opacity-20" />
                          لا توجد إشعارات جديدة
                      </div>
                  ) : (
                      <div className="divide-y divide-white/5">
                          {notifications.map((n, i) => (
                              <div key={i} className="p-3 hover:bg-white/5 transition-colors">
                                  <div className="flex items-start gap-3">
                                      <div className={`p-2 rounded-full ${n.type === 'behavior' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                          <Info className="w-4 h-4" />
                                      </div>
                                      <div>
                                          <h4 className="text-sm font-bold text-gray-200">{n.title || 'تنبيه جديد'}</h4>
                                          <p className="text-xs text-gray-400 mt-1">{n.message}</p>
                                          <span className="text-[10px] text-gray-600 mt-2 block">{new Date(n.created_at).toLocaleTimeString('ar-SA')}</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 right-0 z-30 w-72 glass-panel transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform 
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
        md:translate-x-0 md:static md:inset-auto md:flex md:flex-col
        border-l border-white/5
      `}>
        <div className="p-8 border-b border-white/5 relative">
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="md:hidden absolute top-4 left-4 p-2 rounded-full bg-white/5 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-500 to-secondary-500 p-[1px] mb-4 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
               <div className="w-full h-full rounded-2xl bg-[#0f172a] flex items-center justify-center">
                  <span className="font-serif text-3xl text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 pt-2">ح</span>
               </div>
            </div>
            <h2 className="text-3xl font-bold font-serif text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400 text-glow">حاضر</h2>
            
            {settings && (
                <div className="mt-2 text-center animate-fade-in">
                    <p className="text-sm font-bold text-white tracking-wide">{settings.schoolName || 'School System'}</p>
                    {settings.schoolManager && <p className="text-[10px] text-gray-500 mt-1">مدير المدرسة: {settings.schoolManager}</p>}
                </div>
            )}
          </div>
        </div>

        <div className="p-6 border-b border-white/5">
           <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 relative overflow-hidden">
             <div className={`absolute top-2 left-2 w-2 h-2 rounded-full transition-colors duration-500 ${isConnected ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`} title={isConnected ? 'النظام متصل' : 'فقد الاتصال'}></div>
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 p-[2px]">
               <div className="w-full h-full rounded-full bg-dark-900 flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-white" />
               </div>
             </div>
             <div className="overflow-hidden flex-1">
               <p className="text-sm font-bold text-white truncate font-serif">{user.name}</p>
               <p className="text-[10px] text-primary-300 uppercase tracking-wider truncate">{user.role.replace('_', ' ')}</p>
             </div>
             
             {/* Desktop Notification Bell */}
             <button 
                onClick={toggleNotifications}
                className="hidden md:flex p-2 rounded-lg hover:bg-white/10 transition-colors relative"
             >
                 <Bell className="w-5 h-5 text-gray-300" />
                 {unreadCount > 0 && (
                     <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border border-black"></span>
                 )}
             </button>
           </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-2 px-4">
            {allowedItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`relative w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group overflow-hidden ${
                    location.pathname === item.path 
                      ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.15)] border border-primary-500/30' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white hover:border hover:border-white/10 border border-transparent'
                  }`}
                >
                  {location.pathname === item.path && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-secondary-500 rounded-r-full"></div>
                  )}
                  <item.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${location.pathname === item.path ? 'text-primary-400' : 'text-gray-500 group-hover:text-primary-300'}`} />
                  <span className={`font-medium tracking-wide ${location.pathname === item.path ? 'font-bold' : ''}`}>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-white hover:bg-red-500/10 px-4 py-3 rounded-xl transition-all border border-transparent hover:border-red-500/20 group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>تسجيل خروج</span>
          </button>
        </div>
        
        <div className="p-4 text-center">
           <p className="text-[10px] text-gray-600 font-light">© 2024 Him.Art System</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 scroll-smooth">
        {children}
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-20 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
