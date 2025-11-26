
import React, { useState, useEffect, useRef } from 'react';
import { db, getLocalISODate } from '../services/db';
import { auth } from '../services/auth';
import { Scan, Sparkles, Loader2, Wifi, Clock, Calendar, AlertCircle, CheckCircle, Users, Image as ImageIcon } from 'lucide-react';
import { AttendanceScanResult, KioskSettings, Role, DashboardStats } from '../types';

const Kiosk: React.FC = () => {
  const [inputId, setInputId] = useState('');
  const [scanResult, setScanResult] = useState<AttendanceScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Settings
  const [settings, setSettings] = useState<KioskSettings>({
      mainTitle: 'تسجيل الحضور',
      subTitle: 'يرجى تمرير البطاقة أو إدخال المعرف',
      earlyMessage: 'شكراً لالتزامك بالحضور المبكر',
      lateMessage: 'نأمل منك الحرص على الحضور مبكراً',
      showStats: false,
      headerImage: '',
      screensaverEnabled: false,
      screensaverTimeout: 2,
      screensaverImages: []
  });
  
  // Screensaver State
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [screensaverIndex, setScreensaverIndex] = useState(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Live Stats
  const [liveStats, setLiveStats] = useState<{total: number, present: number} | null>(null);
  
  // Time
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchStats = async () => {
      try {
          const stats = await db.getDashboardStats();
          setLiveStats({ total: stats.totalStudents, present: stats.presentCount + stats.lateCount });
      } catch(e) {}
  };

  // Reset Idle Timer
  const resetIdleTimer = () => {
      if (isScreensaverActive) {
          setIsScreensaverActive(false);
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      if (settings.screensaverEnabled) {
          const timeoutMs = (settings.screensaverTimeout || 2) * 60 * 1000;
          idleTimerRef.current = setTimeout(() => {
              setIsScreensaverActive(true);
          }, timeoutMs);
      }
  };

  useEffect(() => {
      // 1. Load Settings
      db.getSettings().then(s => {
          if (s.kiosk) {
              setSettings(s.kiosk);
              // Init timer once settings loaded
              if (s.kiosk.screensaverEnabled) {
                  const timeoutMs = (s.kiosk.screensaverTimeout || 2) * 60 * 1000;
                  idleTimerRef.current = setTimeout(() => setIsScreensaverActive(true), timeoutMs);
              }
          }
          if (s.kiosk?.showStats) fetchStats();
      });
      
      // 2. Clock Interval
      const clockInterval = setInterval(() => {
          setCurrentTime(new Date());
      }, 1000);

      // 3. Role Check
      auth.requireRole([Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.WATCHER]);

      // 4. Listen for Commands (Force Screensaver)
      const sub = db.subscribeToNotifications('kiosk', (notif) => {
          if (notif.type === 'command' && notif.message === 'start_screensaver') {
              setIsScreensaverActive(true);
          }
      });

      // 5. Activity Listeners
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
      const handleActivity = () => resetIdleTimer();
      events.forEach(e => window.addEventListener(e, handleActivity));

      return () => {
          clearInterval(clockInterval);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          sub.unsubscribe();
          events.forEach(e => window.removeEventListener(e, handleActivity));
      };
  }, [settings.screensaverEnabled, settings.screensaverTimeout]); // Re-run if settings change

  // Screensaver Carousel Logic
  useEffect(() => {
      if (!isScreensaverActive || !settings.screensaverImages?.length) return;
      
      const interval = setInterval(() => {
          setScreensaverIndex(prev => (prev + 1) % (settings.screensaverImages?.length || 1));
      }, 5000); // Switch image every 5 seconds

      return () => clearInterval(interval);
  }, [isScreensaverActive, settings.screensaverImages]);

  useEffect(() => {
    if (!isScreensaverActive) inputRef.current?.focus();
  }, [loading, scanResult, isScreensaverActive]);

  const handleBlur = () => {
      if (!loading && !isScreensaverActive) setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputId || loading) return;

    if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }

    setLoading(true);
    const result = await db.markAttendance(inputId);
    
    if (result.success && settings.showStats && liveStats) {
        await fetchStats(); 
    }
    
    setLoading(false);
    setScanResult(result);
    setInputId('');
    inputRef.current?.focus();
    
    // Reset idle timer manually here to ensure screen stays awake during interaction
    resetIdleTimer();
    
    timerRef.current = setTimeout(() => {
        setScanResult(null);
    }, 120000); 
  };

  // SCREENSAVER COMPONENT
  if (isScreensaverActive && settings.screensaverImages && settings.screensaverImages.length > 0) {
      return (
          <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden cursor-pointer" onClick={resetIdleTimer}>
              {settings.screensaverImages.map((img, index) => (
                  <div 
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === screensaverIndex ? 'opacity-100' : 'opacity-0'}`}
                  >
                      <img src={img} alt="Screensaver" className="w-full h-full object-cover" />
                  </div>
              ))}
              <div className="absolute bottom-10 right-10 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-white font-mono text-xl">
                  {currentTime.toLocaleTimeString('ar-SA')}
              </div>
              <div className="absolute top-10 left-10 text-white/50 text-sm animate-pulse">
                  اضغط على الشاشة للمتابعة
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden relative bg-[#0f172a]" onClick={() => inputRef.current?.focus()}>
      {/* Dynamic Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-primary-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-secondary-600/20 rounded-full blur-[100px] mix-blend-screen animate-blob"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-[1]"></div>
      
      <div className="w-full max-w-5xl text-center space-y-8 relative z-10 flex flex-col items-center">
        
        {/* Header Image Section */}
        {settings.headerImage ? (
            <div className="w-full max-w-3xl mb-4 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative group">
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent opacity-60"></div>
                <img src={settings.headerImage} alt="Header" className="w-full h-48 object-cover" />
                <div className="absolute bottom-4 right-6 text-right">
                    <h1 className="text-4xl font-bold font-serif text-white text-glow tracking-wide">{settings.mainTitle}</h1>
                </div>
            </div>
        ) : (
            /* Default Text Header */
            <div className="space-y-6 w-full">
               <h1 className="text-7xl font-bold font-serif text-white text-glow tracking-wide">
                 {settings.mainTitle}
               </h1>
            </div>
        )}
        
        {/* Clock */}
        <div className="inline-flex items-center justify-center gap-3 px-8 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
            <Clock className="w-6 h-6 text-primary-400 animate-pulse" />
            <span className="text-3xl font-mono text-white font-bold pt-1">
                {currentTime.toLocaleTimeString('ar-SA')}
            </span>
        </div>

        {/* Subtitle */}
        <p className="text-primary-300 text-2xl font-light tracking-wide flex items-center justify-center gap-2">
             <Sparkles className="w-5 h-5" />
             {settings.subTitle}
             <Sparkles className="w-5 h-5" />
        </p>

        {/* Input Section */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto relative group perspective-1000">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-white to-secondary-500 rounded-[2rem] blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
          
          <div className="relative bg-dark-900/60 backdrop-blur-xl rounded-[1.9rem] p-2 border border-white/10 shadow-2xl">
             <div className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-500">
                {loading ? <Loader2 className="w-8 h-8 animate-spin text-primary-400" /> : <Scan className="w-8 h-8 animate-pulse" />}
             </div>
             <input
                ref={inputRef}
                type="text"
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                onBlur={handleBlur}
                disabled={loading}
                className="w-full bg-transparent text-white text-center text-5xl font-mono py-6 outline-none placeholder-gray-700 tracking-[0.2em] disabled:opacity-50"
                placeholder="مسح البطاقة..."
                autoComplete="off"
              />
          </div>
        </form>

        {/* Live Stats Card (If Enabled) */}
        {settings.showStats && liveStats && (
            <div className="absolute top-10 left-10 hidden md:block animate-fade-in-up">
                <div className="glass-card p-4 rounded-2xl border border-white/10 bg-black/20 text-center w-48">
                    <div className="flex justify-center mb-2">
                        <Users className="w-6 h-6 text-primary-400" />
                    </div>
                    <div className="text-3xl font-bold font-mono text-white mb-1">
                        {liveStats.present} <span className="text-sm text-gray-500">/ {liveStats.total}</span>
                    </div>
                    <div className="text-xs text-gray-400">إجمالي الحضور</div>
                </div>
            </div>
        )}

        {/* Info Panel */}
        <div className="w-full h-[350px] flex items-center justify-center relative">
          {scanResult && (
            <div className="w-full animate-fade-in-up">
                {/* Success/Info State */}
                {scanResult.success && scanResult.student ? (
                    <div className="glass-card p-8 rounded-[2.5rem] border-t-4 border-t-emerald-500 bg-black/40">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            
                            {/* Profile & Status */}
                            <div className="text-right space-y-2 flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                                        <span className="text-3xl font-bold text-white">{scanResult.student.name.charAt(0)}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold text-white font-serif">{scanResult.student.name}</h2>
                                        <p className="text-gray-400 text-lg">{scanResult.student.className} - {scanResult.student.section}</p>
                                    </div>
                                </div>
                                
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${scanResult.record?.status === 'late' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                                    {scanResult.record?.status === 'late' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                    <span className="font-bold text-lg">
                                        {scanResult.record?.status === 'late' ? 'متأخر' : 'حضور مبكر'}
                                    </span>
                                </div>
                                
                                <p className="text-gray-300 mt-2 text-lg font-light">
                                    {scanResult.record?.status === 'late' ? settings.lateMessage : settings.earlyMessage}
                                </p>
                            </div>

                            {/* Stats Cards */}
                            {scanResult.stats && (
                                <div className="flex gap-4">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-32 text-center flex flex-col gap-2 hover:bg-white/10 transition-colors">
                                        <span className="text-xs text-gray-400">مرات التأخر</span>
                                        <span className="text-3xl font-bold text-amber-400 font-mono">{scanResult.stats.lateCount}</span>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-32 text-center flex flex-col gap-2 hover:bg-white/10 transition-colors">
                                        <span className="text-xs text-gray-400">تأخر اليوم</span>
                                        <span className="text-3xl font-bold text-red-400 font-mono">{scanResult.stats.minutesLateToday} <span className="text-xs">د</span></span>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-32 text-center flex flex-col gap-2 hover:bg-white/10 transition-colors">
                                        <span className="text-xs text-gray-400">إجمالي الدقائق</span>
                                        <span className="text-3xl font-bold text-white font-mono">{scanResult.stats.totalMinutesLate} <span className="text-xs">د</span></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-8 rounded-[2.5rem] bg-red-500/10 border-red-500/30 text-center">
                        <h2 className="text-3xl font-bold text-red-400 mb-2">{scanResult.message}</h2>
                        <p className="text-gray-400">يرجى المحاولة مرة أخرى أو مراجعة الإدارة</p>
                    </div>
                )}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default Kiosk;
