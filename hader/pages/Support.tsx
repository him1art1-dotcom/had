
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Role, SystemSettings, DiagnosticResult, AppTheme } from '../types';
import { Activity, CheckCircle, Server, RefreshCw, Power, Database, Cloud, HardDrive, ToggleLeft, ToggleRight, Save, ShieldCheck, AlertTriangle, XCircle, Megaphone, Send, Loader2, Image, Palette, Check, X, Sun, Moon, Info, Link2 } from 'lucide-react';
import { checkSupabaseConnection, supabaseConfigured } from '../services/supabase';

const Support: React.FC = () => {
  const currentMode = db.getMode();
  const [loading, setLoading] = useState(true);
  const [diagLoading, setDiagLoading] = useState(false);
  const [cloudReachable, setCloudReachable] = useState<boolean | null>(null);
  
  // State
  const [settings, setSettings] = useState<SystemSettings>({ systemReady: true, schoolActive: true, logoUrl: '', mode: 'dark' });
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  
  // Theme Preview State
  const [previewMode, setPreviewMode] = useState(false);
  const [initialTheme, setInitialTheme] = useState<AppTheme | null>(null);
  
  // Broadcast Form
  const [broadcast, setBroadcast] = useState({ role: 'all', message: '' });

  useEffect(() => {
      auth.requireRole([Role.SITE_ADMIN]);
      loadData();
      probeCloud();
  }, []);

  const cloudStatusLabel = useMemo(() => {
      if (!supabaseConfigured) return 'مفاتيح Supabase غير مضبوطة';
      if (cloudReachable === false) return 'المخدم غير متاح حالياً';
      if (cloudReachable === true) return 'السحابة متصلة وجاهزة';
      return 'جارٍ التحقق من الاتصال بالسحابة...';
  }, [cloudReachable]);

  const loadData = async () => {
      setLoading(true);
      try {
          const s = await db.getSettings();
          setSettings(s);
          if (s.theme) {
              setInitialTheme(s.theme);
          } else {
              setInitialTheme({
                  primary400: '167 139 250', primary500: '124 58 237', primary600: '109 40 217',
                  secondary400: '244 114 182', secondary500: '219 39 119', secondary600: '190 24 93'
              });
          }
          await runDiagnostics();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const probeCloud = async () => {
      if (!supabaseConfigured) {
          setCloudReachable(false);
          return;
      }

      setCloudReachable(null);
      const ok = await checkSupabaseConnection();
      setCloudReachable(ok);
  };

  const runDiagnostics = async () => {
      setDiagLoading(true);
      try {
          const results = await db.runDiagnostics();
          setDiagnostics(results);
      } catch(e) { console.error(e); }
      finally { setDiagLoading(false); }
  };

  const toggleSetting = async (key: keyof SystemSettings) => {
      const newSettings = { ...settings, [key]: !settings[key as any] };
      setSettings(newSettings);
      await db.saveSettings(newSettings);
      if (key === 'schoolActive') runDiagnostics();
  };

  const toggleDisplayMode = async () => {
      const newMode: 'dark' | 'light' = settings.mode === 'light' ? 'dark' : 'light';
      const newSettings = { ...settings, mode: newMode };
      setSettings(newSettings);
      db.applyMode(newMode); // Apply immediately visually
      await db.saveSettings(newSettings);
  };

  const saveLogo = async () => {
      await db.saveSettings(settings);
      alert('تم حفظ رابط الشعار');
  };

  const getThemeObject = (themeName: string): AppTheme => {
      switch(themeName) {
          case 'ocean':
              return {
                  primary400: '56 189 248', primary500: '14 165 233', primary600: '2 132 199', // Sky/Blue
                  secondary400: '45 212 191', secondary500: '20 184 166', secondary600: '13 148 136' // Teal
              };
          case 'nature':
              return {
                  primary400: '74 222 128', primary500: '34 197 94', primary600: '22 163 74', // Green
                  secondary400: '163 230 53', secondary500: '132 204 22', secondary600: '101 163 13' // Lime
              };
          case 'sunset':
              return {
                  primary400: '251 146 60', primary500: '249 115 22', primary600: '234 88 12', // Orange
                  secondary400: '248 113 113', secondary500: '239 68 68', secondary600: '220 38 38' // Red
              };
          default: // Default / Violet
              return {
                  primary400: '167 139 250', primary500: '124 58 237', primary600: '109 40 217',
                  secondary400: '244 114 182', secondary500: '219 39 119', secondary600: '190 24 93'
              };
      }
  };

  const previewTheme = (themeName: string) => {
      const theme = getThemeObject(themeName);
      db.applyTheme(theme);
      setSettings({ ...settings, theme });
      setPreviewMode(true);
  };

  const confirmTheme = async () => {
      await db.saveSettings(settings);
      setInitialTheme(settings.theme || null);
      setPreviewMode(false);
      alert('تم حفظ الثيم الجديد بنجاح');
  };

  const cancelTheme = () => {
      if (initialTheme) {
          db.applyTheme(initialTheme);
          setSettings({ ...settings, theme: initialTheme });
      }
      setPreviewMode(false);
  };

  const handleBroadcast = async () => {
      if (!broadcast.message) return;
      await db.sendBroadcast(broadcast.role, broadcast.message, 'تنبيه من الدعم الفني');
      alert('تم إرسال التعميم بنجاح');
      setBroadcast({ ...broadcast, message: '' });
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-white w-10 h-10" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-4xl font-bold mb-2 text-white font-serif">مركز الدعم والصيانة</h2>
            <p className="text-gray-400">مراقبة حالة النظام، التشخيص الذكي، وإدارة البث</p>
          </div>
          <div className="flex gap-3">
              <button onClick={() => window.location.reload()} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300" title="إعادة تحميل النظام">
                  <RefreshCw className="w-5 h-5" />
              </button>
          </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 1. System Controls & Theme */}
          <div className="lg:col-span-1 space-y-6">
              <div className="glass-card p-6 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-2 mb-6 text-white text-lg font-serif">
                     <Power className="text-primary-400 w-5 h-5" /> تحكم النظام
                  </h3>
                  
                  <div className="space-y-4">
                      {/* Toggle Display Mode */}
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div>
                              <div className="font-bold text-gray-200">وضع العرض</div>
                              <div className="text-xs text-gray-500">{settings.mode === 'light' ? 'إشراقة الصباح' : 'حلم المساء'}</div>
                          </div>
                          <button onClick={toggleDisplayMode} className="text-amber-400 hover:scale-105 transition-transform p-2 rounded-full bg-white/10">
                              {settings.mode === 'light' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6 text-blue-300" />}
                          </button>
                      </div>

                      {/* Toggle System Ready */}
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div>
                              <div className="font-bold text-gray-200">حالة النظام</div>
                              <div className="text-xs text-gray-500">System Ready</div>
                          </div>
                          <button onClick={() => toggleSetting('systemReady')} className="text-primary-400 hover:scale-105 transition-transform">
                              {settings.systemReady ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-gray-600" />}
                          </button>
                      </div>

                      {/* Toggle School Active */}
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div>
                              <div className="font-bold text-gray-200">تفعيل المدرسة</div>
                              <div className="text-xs text-gray-500">School Active</div>
                          </div>
                          <button onClick={() => toggleSetting('schoolActive')} className="text-secondary-400 hover:scale-105 transition-transform">
                              {settings.schoolActive ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-gray-600" />}
                          </button>
                      </div>

                       {/* Storage Mode Switcher */}
                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                          <div className="font-bold text-gray-200 mb-2 flex items-center gap-2">
                              <Database className="w-4 h-4" /> وضع التخزين
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => db.setMode('local')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentMode === 'local' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-500'}`}
                              >
                                  Local
                              </button>
                              <button
                                onClick={() => db.setMode('cloud')}
                                disabled={!supabaseConfigured}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentMode === 'cloud' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'} ${!supabaseConfigured ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                  Cloud
                              </button>
                          </div>
                          <div className="mt-3 rounded-xl border border-white/5 bg-white/5 p-3 flex items-start gap-3 text-xs text-gray-300">
                              <div className={`p-2 rounded-lg ${supabaseConfigured ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                                  {supabaseConfigured ? <Cloud className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 space-y-1">
                                  <div className="font-bold text-white text-sm">جاهزية السحابة</div>
                                  <div className="text-gray-400">{cloudStatusLabel}</div>
                                  {!supabaseConfigured && (
                                      <div className="flex items-center gap-1 text-amber-300">
                                          <Link2 className="w-3 h-3" /> أضف متغيرات VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env.local
                                      </div>
                                  )}
                                  {supabaseConfigured && (
                                      <button
                                        onClick={probeCloud}
                                        className="text-[11px] text-primary-300 hover:text-white flex items-center gap-1"
                                      >
                                          <RefreshCw className={`w-3 h-3 ${cloudReachable === null ? 'animate-spin' : ''}`} />
                                          إعادة فحص الاتصال
                                      </button>
                                  )}
                              </div>
                          </div>
                       </div>
                  </div>
              </div>
              
              {/* Theme Settings */}
              <div className="glass-card p-6 rounded-[2rem] border border-white/10">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold flex items-center gap-2 text-white text-lg font-serif">
                         <Palette className="text-secondary-400 w-5 h-5" /> ألوان النظام
                      </h3>
                      {previewMode && (
                          <div className="flex gap-2">
                              <button onClick={confirmTheme} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 border border-emerald-500/20 transition-colors" title="اعتماد">
                                  <Check className="w-4 h-4" />
                              </button>
                              <button onClick={cancelTheme} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/20 transition-colors" title="إلغاء">
                                  <X className="w-4 h-4" />
                              </button>
                          </div>
                      )}
                  </div>
                  
                  {previewMode && (
                      <div className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg mb-4 text-center border border-amber-500/20">
                          معاينة: اضغط ✔ للحفظ أو ✘ للإلغاء
                      </div>
                  )}

                  <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => previewTheme('default')} className="w-full aspect-square rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 hover:scale-105 transition-transform border border-white/20" title="الأصلي"></button>
                      <button onClick={() => previewTheme('ocean')} className="w-full aspect-square rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 hover:scale-105 transition-transform border border-white/20" title="المحيط"></button>
                      <button onClick={() => previewTheme('nature')} className="w-full aspect-square rounded-xl bg-gradient-to-br from-green-500 to-lime-500 hover:scale-105 transition-transform border border-white/20" title="الطبيعة"></button>
                      <button onClick={() => previewTheme('sunset')} className="w-full aspect-square rounded-xl bg-gradient-to-br from-orange-500 to-red-500 hover:scale-105 transition-transform border border-white/20" title="الغروب"></button>
                  </div>
              </div>

              {/* Logo Settings */}
              <div className="glass-card p-6 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-2 mb-4 text-white text-lg font-serif">
                     <Image className="text-primary-400 w-5 h-5" /> هوية المدرسة
                  </h3>
                  <div className="space-y-2">
                      <label className="text-xs text-gray-400">رابط الشعار (Logo URL)</label>
                      <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="w-full input-glass p-3 rounded-xl text-sm" 
                            placeholder="https://..."
                            value={settings.logoUrl}
                            onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                          />
                          <button onClick={saveLogo} className="p-3 bg-white/10 rounded-xl hover:bg-primary-600 transition-colors">
                              <Save className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          {/* 2. Smart Diagnostics */}
          <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-8 rounded-[2rem] border border-white/10 min-h-[400px]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold flex items-center gap-3 text-white text-xl font-serif">
                         <ShieldCheck className="text-emerald-400 w-6 h-6" /> التشخيص الذكي
                      </h3>
                      <button onClick={runDiagnostics} disabled={diagLoading} className="text-sm text-primary-300 hover:text-white flex items-center gap-1">
                          {diagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          فحص الآن
                      </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {diagnostics.map((diag) => (
                          <div 
                            key={diag.key} 
                            className={`relative group overflow-hidden p-6 rounded-[1.5rem] border backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                                diag.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-900/20' :
                                diag.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40 hover:shadow-amber-900/20' :
                                'bg-red-500/5 border-red-500/20 hover:border-red-500/40 hover:shadow-red-900/20'
                            }`}
                          >
                              {/* Background Glow */}
                              <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${
                                  diag.status === 'ok' ? 'bg-emerald-500' :
                                  diag.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                              }`}></div>

                              <div className="relative z-10 h-full flex flex-col">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-xl ${
                                              diag.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' :
                                              diag.status === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                                          }`}>
                                              {diag.status === 'ok' ? <CheckCircle className="w-5 h-5" /> :
                                               diag.status === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                                               <XCircle className={`w-5 h-5 ${diag.status === 'error' ? 'animate-pulse' : ''}`} />}
                                          </div>
                                          <div>
                                              <h4 className={`font-bold font-serif text-lg ${
                                                  diag.status === 'ok' ? 'text-emerald-100' :
                                                  diag.status === 'warning' ? 'text-amber-100' : 'text-red-100'
                                              }`}>{diag.title}</h4>
                                              <span className={`text-[10px] font-mono uppercase tracking-wider ${
                                                  diag.status === 'ok' ? 'text-emerald-500' :
                                                  diag.status === 'warning' ? 'text-amber-500' : 'text-red-500'
                                              }`}>
                                                  {diag.status.toUpperCase()}
                                              </span>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <p className="text-gray-300 text-sm leading-relaxed mb-4 pl-1">{diag.message}</p>
                                  
                                  {diag.hint && (
                                      <div className={`mt-auto text-xs p-3 rounded-xl flex items-start gap-2 transition-all ${
                                          diag.status === 'warning' ? 'bg-amber-500/10 text-amber-200 border border-amber-500/10' : 
                                          diag.status === 'error' ? 'bg-red-500/10 text-red-200 border border-red-500/10' :
                                          'bg-emerald-500/10 text-emerald-200 border border-emerald-500/10'
                                      }`}>
                                          <span className="font-bold whitespace-nowrap">💡 إصلاح:</span> 
                                          <span>{diag.hint}</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* 3. Broadcast Center */}
              <div className="glass-card p-8 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-3 mb-6 text-white text-xl font-serif">
                     <Megaphone className="text-secondary-400 w-6 h-6" /> مركز البث
                  </h3>
                  
                  <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-1/3 space-y-4">
                          <label className="block text-sm text-gray-400">الجمهور المستهدف</label>
                          <select 
                            className="w-full input-glass p-4 rounded-xl appearance-none"
                            value={broadcast.role}
                            onChange={(e) => setBroadcast({...broadcast, role: e.target.value})}
                          >
                              <option value="all">الجميع (All Users)</option>
                              <option value="admin">الإدارة (Admins)</option>
                              <option value="supervisor">المشرفين (Supervisors)</option>
                              <option value="guardian">أولياء الأمور (Guardians)</option>
                          </select>
                          <div className="p-4 bg-white/5 rounded-xl text-xs text-gray-500 leading-relaxed">
                              سيتم إرسال هذا الإشعار لجميع المستخدمين المندرجين تحت الفئة المختارة. سيظهر في مركز الإشعارات لديهم.
                          </div>
                      </div>
                      
                      <div className="w-full md:w-2/3 space-y-4">
                          <label className="block text-sm text-gray-400">نص الرسالة</label>
                          <textarea 
                            className="w-full input-glass p-4 rounded-xl h-32 resize-none"
                            placeholder="اكتب رسالة الدعم الفني هنا..."
                            value={broadcast.message}
                            onChange={(e) => setBroadcast({...broadcast, message: e.target.value})}
                          />
                          <button 
                            onClick={handleBroadcast}
                            disabled={!broadcast.message}
                            className="w-full py-4 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl font-bold text-white shadow-lg hover:shadow-primary-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                              <Send className="w-4 h-4" /> إرسال التعميم
                          </button>
                      </div>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};

export default Support;
