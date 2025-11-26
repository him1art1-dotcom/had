
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { User, AttendanceRecord, ViolationRecord, Student, ExitRecord, Notification, Role, SystemSettings } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { User as UserIcon, AlertTriangle, Clock, Calendar, ChevronLeft, Loader2, DoorOpen, Bell, CheckCircle, ChevronDown, Search, Shield, Wrench, FileJson, ExternalLink, Smartphone, Hash, X } from 'lucide-react';

const Parents: React.FC<{ user: User }> = ({ user }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // Admin Simulation State
  const isAdmin = [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL].includes(user.role);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'phone' | 'student_id'>('phone');
  const [showDebug, setShowDebug] = useState(false);
  
  // Data States
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exits, setExits] = useState<ExitRecord[]>([]);
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'exits' | 'violations' | 'notifications'>('attendance');

  useEffect(() => {
    // 1. Role Check (Allow Guardians AND Admins)
    auth.requireRole([Role.GUARDIAN, Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL]);
    
    // 2. Load Settings
    db.getSettings().then(setSettings);

    // 3. Determine target guardian phone
    let targetPhone = user.username; // Default for actual guardians

    // If Admin, check URL param or wait for search
    if (isAdmin) {
        const paramPhone = searchParams.get('guardian');
        if (paramPhone) {
            targetPhone = paramPhone;
            setAdminSearchTerm(paramPhone);
            fetchChildren(targetPhone);
        } else {
            setLoading(false);
            return; // Wait for manual search
        }
    } else {
        fetchChildren(targetPhone);
    }
  }, [user, searchParams]);

  const fetchChildren = async (phone: string) => {
      setLoading(true);
      try {
          const myChildren = await db.getStudentsByGuardian(phone);
          setChildren(myChildren);
          if (myChildren.length > 0) {
              setSelectedChild(myChildren[0]);
          } else {
              if (isAdmin) {
                  // Just clear state if admin searches invalid number
                  setChildren([]);
                  setSelectedChild(null);
              }
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleAdminSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adminSearchTerm) return;
      
      setLoading(true);
      try {
          let targetPhone = adminSearchTerm;

          // If searching by Student ID, we need to find the guardian phone first
          if (searchType === 'student_id') {
              const student = await db.getStudentById(adminSearchTerm);
              if (student && student.guardianPhone) {
                  targetPhone = student.guardianPhone;
                  // Update search box to show the resolved phone for clarity
                  setAdminSearchTerm(targetPhone); 
                  setSearchType('phone');
              } else {
                  alert('لم يتم العثور على طالب بهذا المعرف أو لا يوجد رقم ولي أمر مسجل');
                  setLoading(false);
                  return;
              }
          }

          await fetchChildren(targetPhone);
      } catch (e) {
          console.error(e);
          alert('حدث خطأ أثناء البحث');
      } finally {
          setLoading(false);
      }
  };

  // 3. Child Specific Data Load
  useEffect(() => {
    if (!selectedChild) return;

    const fetchChildData = async () => {
        setLoading(true);
        try {
            const [att, ext, viol, notif] = await Promise.all([
                db.getStudentAttendance(selectedChild.id),
                db.getStudentExits(selectedChild.id),
                db.getViolations(selectedChild.id),
                db.getStudentNotifications(selectedChild.id, selectedChild.className)
            ]);
            
            setAttendance(att);
            setExits(ext);
            setViolations(viol);
            setNotifications(notif);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    
    fetchChildData();
  }, [selectedChild]);

  // --- Admin Control Panel Component ---
  const AdminControlPanel = () => (
      <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-fade-in-up">
          <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
          
          <div className="flex items-center justify-between mb-4">
              <h3 className="text-amber-400 font-bold flex items-center gap-2">
                  <Shield className="w-5 h-5" /> لوحة تحكم المشرف
              </h3>
              {selectedChild && (
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setShowDebug(!showDebug)} 
                        className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${showDebug ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' : 'bg-white/5 text-gray-400 border-white/10'}`}
                      >
                          <FileJson className="w-4 h-4" /> فحص البيانات الخام
                      </button>
                      <button 
                        onClick={() => navigate('/admin')} 
                        className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold border border-white/10 transition-all flex items-center gap-2"
                      >
                          <Wrench className="w-4 h-4" /> تصحيح في الإدارة
                      </button>
                  </div>
              )}
          </div>

          <form onSubmit={handleAdminSearch} className="flex flex-col md:flex-row gap-4">
              <div className="flex bg-black/30 p-1 rounded-xl border border-white/10">
                  <button 
                    type="button"
                    onClick={() => setSearchType('phone')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${searchType === 'phone' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                      <Smartphone className="w-4 h-4" /> جوال الولي
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSearchType('student_id')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${searchType === 'student_id' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                      <Hash className="w-4 h-4" /> معرف الطالب
                  </button>
              </div>
              
              <div className="flex-1 relative group">
                  <input 
                    type="text" 
                    placeholder={searchType === 'phone' ? "أدخل رقم الجوال (5xxxxxxxxx)..." : "أدخل معرف الطالب..."}
                    className="w-full input-glass p-3 rounded-xl pl-10 focus:border-amber-500/50"
                    value={adminSearchTerm}
                    onChange={(e) => setAdminSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
              </div>
              
              <button type="submit" className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-900/20 transition-all">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'بحث'}
              </button>
          </form>
      </div>
  );

  // --- Debug Modal ---
  const DebugModal = () => (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0f172a] border border-white/10 w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900">
                  <h3 className="text-blue-400 font-bold font-mono flex items-center gap-2">
                      <FileJson className="w-5 h-5" /> INSPECTOR: {selectedChild?.name}
                  </h3>
                  <button onClick={() => setShowDebug(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-6 custom-scrollbar font-mono text-xs">
                  <div className="space-y-2">
                      <h4 className="text-emerald-400 font-bold">Student Object</h4>
                      <pre className="bg-black p-4 rounded-xl text-emerald-200 overflow-x-auto border border-white/5">{JSON.stringify(selectedChild, null, 2)}</pre>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <h4 className="text-blue-400 font-bold">Attendance Logs ({attendance.length})</h4>
                          <pre className="bg-black p-4 rounded-xl text-blue-200 overflow-x-auto border border-white/5 max-h-60">{JSON.stringify(attendance, null, 2)}</pre>
                      </div>
                      <div className="space-y-2">
                          <h4 className="text-red-400 font-bold">Violations ({violations.length})</h4>
                          <pre className="bg-black p-4 rounded-xl text-red-200 overflow-x-auto border border-white/5 max-h-60">{JSON.stringify(violations, null, 2)}</pre>
                      </div>
                      <div className="space-y-2">
                          <h4 className="text-amber-400 font-bold">Exits ({exits.length})</h4>
                          <pre className="bg-black p-4 rounded-xl text-amber-200 overflow-x-auto border border-white/5 max-h-60">{JSON.stringify(exits, null, 2)}</pre>
                      </div>
                      <div className="space-y-2">
                          <h4 className="text-purple-400 font-bold">Notifications ({notifications.length})</h4>
                          <pre className="bg-black p-4 rounded-xl text-purple-200 overflow-x-auto border border-white/5 max-h-60">{JSON.stringify(notifications, null, 2)}</pre>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  if (loading && !selectedChild && !isAdmin) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-white w-10 h-10" /></div>;

  if (children.length === 0 && !loading && !isAdmin) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                <UserIcon className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-white">عفواً</h2>
            <p className="text-gray-400 mt-2">لا يوجد طلاب مرتبطين برقم الجوال هذا.</p>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      
      {/* School Info Header */}
      {settings && settings.schoolName && (
        <div className="text-center mb-4 animate-fade-in">
            <h3 className="text-lg font-bold text-white font-serif">{settings.schoolName}</h3>
            {settings.schoolManager && <p className="text-xs text-gray-400">إدارة: {settings.schoolManager}</p>}
        </div>
      )}

      {/* Admin Control Panel (Visible Only to Admins) */}
      {isAdmin && <AdminControlPanel />}
      {showDebug && <DebugModal />}

      {(!selectedChild && isAdmin && children.length === 0) ? (
          <div className="text-center py-12 text-gray-500">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>استخدم لوحة التحكم أعلاه للبحث عن ولي أمر أو طالب</p>
          </div>
      ) : !selectedChild ? null : (
        <>
            {/* --- Multi-Child Selector --- */}
            {children.length > 1 && (
                <div className="glass-card p-4 rounded-2xl flex justify-between items-center relative z-20">
                    <label className="text-gray-400 text-sm font-medium">اختر الابن:</label>
                    <div className="relative w-64">
                        <select 
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 appearance-none text-white focus:border-primary-500 outline-none"
                            value={selectedChild.id}
                            onChange={(e) => {
                                const child = children.find(c => c.id === e.target.value);
                                if (child) setSelectedChild(child);
                            }}
                        >
                            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            )}

            {/* --- Student Profile Header --- */}
            <div className="relative rounded-[2.5rem] p-8 overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-slate-900 to-secondary-900 opacity-90 transition-opacity"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500 opacity-10 rounded-full blur-[80px]"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-500 opacity-10 rounded-full blur-[80px]"></div>
                
                <div className="relative z-10 flex items-center gap-8">
                    <div className="w-24 h-24 glass rounded-3xl flex items-center justify-center text-4xl border border-white/20 shadow-xl">
                        <span className="font-serif pt-2 text-white drop-shadow-md">{selectedChild.name.charAt(0)}</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold font-serif text-white mb-2">{selectedChild.name}</h2>
                        <div className="flex flex-wrap gap-2 text-sm text-gray-300">
                            <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10">
                                {selectedChild.className} - {selectedChild.section}
                            </span>
                            <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10 font-mono">
                                #{selectedChild.id}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Tabs --- */}
            <div className="flex overflow-x-auto gap-2 py-2">
                {[
                    { id: 'attendance', label: 'سجل الحضور', icon: Calendar },
                    { id: 'exits', label: 'الاستئذان', icon: DoorOpen },
                    { id: 'violations', label: 'السلوك', icon: AlertTriangle },
                    { id: 'notifications', label: 'الإشعارات', icon: Bell },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl whitespace-nowrap font-medium transition-all ${
                            activeTab === tab.id 
                            ? 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-lg' 
                            : 'glass text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* --- Content Area --- */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-400" /></div>
                ) : (
                    <>
                        {/* 1. Attendance Tab */}
                        {activeTab === 'attendance' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="glass-card p-4 rounded-2xl text-center">
                                        <div className="text-2xl font-bold text-emerald-400 font-mono">{attendance.filter(a => a.status === 'present').length}</div>
                                        <div className="text-xs text-gray-400">حضور</div>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl text-center">
                                        <div className="text-2xl font-bold text-amber-400 font-mono">{attendance.filter(a => a.status === 'late').length}</div>
                                        <div className="text-xs text-gray-400">تأخر</div>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl text-center">
                                        <div className="text-2xl font-bold text-red-400 font-mono">{attendance.filter(a => a.status === 'absent').length}</div>
                                        <div className="text-xs text-gray-400">غياب</div>
                                    </div>
                                </div>

                                <div className="glass-card rounded-2xl overflow-hidden">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-white/5 text-gray-400 border-b border-white/5">
                                            <tr>
                                                <th className="p-4">التاريخ</th>
                                                <th className="p-4">الوقت</th>
                                                <th className="p-4">الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            {attendance.map(record => (
                                                <tr key={record.id} className="hover:bg-white/5">
                                                    <td className="p-4 font-mono">{record.date}</td>
                                                    <td className="p-4 font-mono">{new Date(record.timestamp).toLocaleTimeString('ar-SA')}</td>
                                                    <td className="p-4">
                                                        {record.status === 'present' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> حضور</span>}
                                                        {record.status === 'late' && <span className="text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3"/> متأخر</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                            {attendance.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-500">لا يوجد سجلات</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 2. Exits Tab */}
                        {activeTab === 'exits' && (
                            <div className="glass-card rounded-2xl overflow-hidden">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-white/5 text-gray-400 border-b border-white/5">
                                        <tr>
                                            <th className="p-4">تاريخ الخروج</th>
                                            <th className="p-4">السبب</th>
                                            <th className="p-4">المشرف</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-gray-300">
                                        {exits.map(exit => (
                                            <tr key={exit.id} className="hover:bg-white/5">
                                                <td className="p-4 font-mono">{new Date(exit.exit_time).toLocaleString('ar-SA')}</td>
                                                <td className="p-4">{exit.reason}</td>
                                                <td className="p-4 text-xs text-gray-500">مشرف الفترة</td>
                                            </tr>
                                        ))}
                                        {exits.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-500">لا يوجد سجلات استئذان</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* 3. Violations Tab */}
                        {activeTab === 'violations' && (
                            <div className="space-y-4">
                                {violations.map(v => (
                                    <div key={v.id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2 text-red-300 font-bold">
                                                <AlertTriangle className="w-5 h-5" />
                                                {v.type}
                                            </div>
                                            <span className="text-xs font-mono text-red-400 opacity-70">{new Date(v.created_at).toLocaleDateString('ar-SA')}</span>
                                        </div>
                                        <p className="text-gray-300 text-sm leading-relaxed bg-black/20 p-3 rounded-lg border border-red-500/10">
                                            {v.description}
                                        </p>
                                        <div className="mt-3 flex justify-end">
                                            <span className="text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded-full border border-red-500/20">
                                                مستوى: {v.level}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {violations.length === 0 && (
                                    <div className="glass-card p-10 text-center flex flex-col items-center gap-4 text-gray-500">
                                        <CheckCircle className="w-12 h-12 text-emerald-500/20" />
                                        سجل الطالب نظيف وخالي من المخالفات
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. Notifications Tab */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-4">
                                {notifications.map(notif => {
                                    let borderColor = 'border-blue-500/20';
                                    let iconColor = 'text-blue-400';
                                    let bgColor = 'bg-blue-500/5';
                                    
                                    if (notif.type === 'behavior') { // Admin/Urgent usually behavior related
                                        borderColor = 'border-red-500/30';
                                        iconColor = 'text-red-400';
                                        bgColor = 'bg-red-500/10';
                                    } else if (notif.type === 'attendance') { // Supervisor usually attendance
                                        borderColor = 'border-amber-500/30';
                                        iconColor = 'text-amber-400';
                                        bgColor = 'bg-amber-500/10';
                                    }

                                    return (
                                        <div key={notif.id} className={`relative glass-card p-6 rounded-2xl border ${borderColor} ${bgColor} overflow-hidden`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className={`font-bold ${iconColor} flex items-center gap-2`}>
                                                    <Bell className="w-4 h-4" />
                                                    {notif.type === 'behavior' ? 'تنبيه إداري' : notif.type === 'attendance' ? 'تنبيه مشرف' : 'إشعار عام'}
                                                </h4>
                                                <span className="text-xs text-gray-500 font-mono">{new Date(notif.created_at).toLocaleDateString('ar-SA')}</span>
                                            </div>
                                            <p className="text-gray-300 text-sm leading-relaxed">
                                                {notif.message}
                                            </p>
                                        </div>
                                    );
                                })}
                                {notifications.length === 0 && (
                                    <div className="glass-card p-10 text-center text-gray-500">
                                        لا توجد إشعارات جديدة
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
      )}

    </div>
  );
};

export default Parents;
