
import React, { useState, useEffect } from 'react';
import { db, getLocalISODate } from '../services/db';
import { Student, DashboardStats, ReportFilter, SchoolClass, User, Role, ClassAssignment, KioskSettings, SystemSettings } from '../types';
import { FileService } from '../services/fileService';
import { FileSpreadsheet, Upload, UserPlus, Database, Loader2, LayoutDashboard, TrendingUp, AlertCircle, Clock, CheckCircle, FileText, Printer, FileCode, FileType, Plus, X, Search, Calendar, Trash2, Users, Trophy, ChevronDown, MoreHorizontal, Target, Sun, Moon, CheckSquare, Square, Eye, Monitor, Building2, Save } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { auth } from '../services/auth';
import { useNavigate } from 'react-router-dom';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  
  // Dashboard State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [classStats, setClassStats] = useState<any[]>([]);

  // Students State
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Structure State
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [newClass, setNewClass] = useState({ name: '', sections: '' });

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'watcher' });
  const [userAssignments, setUserAssignments] = useState<ClassAssignment[]>([]);

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showKioskModal, setShowKioskModal] = useState(false);
  const [showSchoolSettingsModal, setShowSchoolSettingsModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'class' | 'user', id: string, name: string } | null>(null);

  // New Student Form State
  const [newStudent, setNewStudent] = useState({
      name: '',
      className: '',
      section: '',
      guardianPhone: ''
  });
  
  // Kiosk Settings State
  const [kioskSettings, setKioskSettings] = useState<KioskSettings>({
      mainTitle: 'تسجيل الحضور',
      subTitle: 'يرجى تمرير البطاقة أو إدخال المعرف',
      earlyMessage: 'شكراً لالتزامك بالحضور المبكر',
      lateMessage: 'نأمل منك الحرص على الحضور مبكراً',
      showStats: false
  });
  
  // School Settings State
  const [schoolSettings, setSchoolSettings] = useState<{name: string, manager: string, assemblyTime: string, gracePeriod: number}>({
      name: '', manager: '', assemblyTime: '07:00', gracePeriod: 0
  });

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);

  // Reports State
  const [reportFilter, setReportFilter] = useState<ReportFilter>({
      dateFrom: getLocalISODate(),
      dateTo: getLocalISODate(),
      className: '',
      section: ''
  });
  const [reportData, setReportData] = useState<{summary: any, details: any[]} | null>(null);

  // General Settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    auth.requireRole([Role.SITE_ADMIN, Role.SCHOOL_ADMIN]);
  }, []);

  // --- Fetchers ---
  const fetchDashboard = async () => {
      setLoading(true);
      try {
          const [s, w, c] = await Promise.all([
              db.getDashboardStats(),
              db.getWeeklyStats(),
              db.getClassStats()
          ]);
          setStats(s);
          setWeeklyStats(w);
          setClassStats(c);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchStudents = async () => {
      setLoading(true);
      try {
          const data = await db.getStudents();
          setStudents(data);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchStructure = async () => {
      setLoading(true);
      try {
          const data = await db.getClasses();
          setClasses(data);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchUsers = async () => {
      setLoading(true);
      try {
          const data = await db.getUsers();
          const filteredUsers = data.filter(u => u.role !== Role.SITE_ADMIN);
          setUsers(filteredUsers);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const initSettings = async () => {
      const s = await db.getSettings();
      setSystemSettings(s);
      if (s.mode) setMode(s.mode);
      if (s.kiosk) setKioskSettings(s.kiosk);
      setSchoolSettings({
          name: s.schoolName || '',
          manager: s.schoolManager || '',
          assemblyTime: s.assemblyTime || '07:00',
          gracePeriod: s.gracePeriod || 0
      });
  }

  useEffect(() => {
    initSettings();
    if (activeTab === 'dashboard') fetchDashboard();
    if (activeTab === 'students') { fetchStudents(); fetchStructure(); }
    if (activeTab === 'student_reports') fetchStructure();
    if (activeTab === 'structure') fetchStructure();
    if (activeTab === 'users') { fetchUsers(); fetchStructure(); }
  }, [activeTab]);

  // --- Handlers ---
  const toggleMode = async () => {
      const newMode = mode === 'dark' ? 'light' : 'dark';
      setMode(newMode);
      const s = await db.getSettings();
      await db.saveSettings({ ...s, mode: newMode });
  }
  
  const handleSaveKioskSettings = async () => {
      setLoading(true);
      try {
          const s = await db.getSettings();
          await db.saveSettings({ ...s, kiosk: kioskSettings });
          alert('تم حفظ إعدادات الكشك بنجاح');
          setShowKioskModal(false);
      } catch(e) {
          alert('حدث خطأ أثناء الحفظ');
      } finally {
          setLoading(false);
      }
  };

  const handleSaveSchoolSettings = async () => {
      setLoading(true);
      try {
          const s = await db.getSettings();
          await db.saveSettings({ 
              ...s, 
              schoolName: schoolSettings.name,
              schoolManager: schoolSettings.manager,
              assemblyTime: schoolSettings.assemblyTime,
              gracePeriod: Number(schoolSettings.gracePeriod)
          });
          setSystemSettings({
              ...s,
              schoolName: schoolSettings.name,
              schoolManager: schoolSettings.manager,
              assemblyTime: schoolSettings.assemblyTime,
              gracePeriod: Number(schoolSettings.gracePeriod)
          });
          alert('تم حفظ إعدادات المدرسة بنجاح');
          setShowSchoolSettingsModal(false);
      } catch(e) {
          alert('حدث خطأ أثناء الحفظ');
      } finally {
          setLoading(false);
      }
  }
  
  const handleAddStudent = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const studentToAdd: Student = {
              id: `2024${Math.floor(Math.random() * 100000)}`,
              ...newStudent
          };
          await db.saveStudents([studentToAdd]);
          await fetchStudents();
          setShowAddModal(false);
          setNewStudent({ name: '', className: '', section: '', guardianPhone: '' });
          alert('تم إضافة الطالب بنجاح');
      } catch (e) {
          alert('حدث خطأ أثناء الإضافة');
      } finally {
          setLoading(false);
      }
  };

  const handleImport = async () => {
      if (!importFile) return;
      setLoading(true);
      try {
          const rawData = await FileService.parseImportFile(importFile);
          
          const getValue = (row: any, keys: string[]) => {
              for (const k of keys) {
                  const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                  if (foundKey) return row[foundKey];
              }
              return null;
          };

          const newStudents: Student[] = rawData.map((row: any) => ({
              id: String(getValue(row, ['المعرف', 'id']) || `2024${Math.floor(Math.random()*100000)}`),
              name: getValue(row, ['الاسم', 'name']) || 'Unknown',
              className: getValue(row, ['الصف', 'className']) || 'General',
              section: getValue(row, ['الفصل', 'section']) || 'A',
              guardianPhone: String(getValue(row, ['الجوال', 'guardianPhone']) || '000')
          })).filter(s => s.name !== 'Unknown');

          await db.saveStudents(newStudents);
          await fetchStudents();
          alert(`تم استيراد ${newStudents.length} طالب بنجاح`);
          setImportFile(null);
          setShowImportModal(false);
      } catch (e) {
          alert('حدث خطأ أثناء قراءة الملف. تأكد من الصيغة.');
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleAddClass = async () => {
      if(!newClass.name) return;
      await db.saveClass({
          id: Math.random().toString(36).substr(2,9),
          name: newClass.name,
          sections: newClass.sections.split(',').map(s => s.trim()).filter(Boolean)
      });
      setNewClass({ name: '', sections: '' });
      fetchStructure();
  };

  const handleDeleteClass = (id: string, name: string) => {
      setDeleteConfirmation({ type: 'class', id, name });
  };

  const handleAddUser = async () => {
      if(!newUser.username || !newUser.password) return;
      await db.saveUser({
          id: Math.random().toString(36).substr(2,9),
          name: newUser.name,
          username: newUser.username,
          password: newUser.password,
          role: newUser.role as any,
          assignedClasses: newUser.role === Role.SUPERVISOR_CLASS ? userAssignments : undefined
      });
      setNewUser({ name: '', username: '', password: '', role: 'watcher' });
      setUserAssignments([]);
      fetchUsers();
  };

  const handleDeleteUser = (id: string, name: string) => {
      setDeleteConfirmation({ type: 'user', id, name });
  };
  
  const confirmDeleteAction = async () => {
      if (!deleteConfirmation) return;
      
      setLoading(true);
      try {
          if (deleteConfirmation.type === 'class') {
              await db.deleteClass(deleteConfirmation.id);
              await fetchStructure();
          } else {
              await db.deleteUser(deleteConfirmation.id);
              await fetchUsers();
          }
          setDeleteConfirmation(null);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };


  const handleGenerateReport = async () => {
      setLoading(true);
      try {
          const data = await db.getAttendanceReport(reportFilter);
          setReportData(data);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleExport = (type: 'xlsx' | 'csv' | 'html' | 'pdf') => {
      if (!reportData) return;
      const filename = `تقرير_الحضور_${reportFilter.dateFrom}_${reportFilter.dateTo}`;
      const title = `تقرير الحضور - ${reportFilter.dateFrom} إلى ${reportFilter.dateTo}`;
      const exportData = reportData.details.map(d => ({
          studentId: d.studentId,
          studentName: d.studentName,
          className: d.className,
          date: d.date,
          status: d.status === 'present' ? 'حاضر' : d.status === 'late' ? 'متأخر' : 'غائب',
          time: new Date(d.time).toLocaleTimeString('ar-SA')
      }));
      const columns = [
          { header: 'المعرف', key: 'studentId' },
          { header: 'الاسم', key: 'studentName' },
          { header: 'الصف', key: 'className' },
          { header: 'التاريخ', key: 'date' },
          { header: 'الوقت', key: 'time' },
          { header: 'الحالة', key: 'status' },
      ];
      switch(type) {
          case 'xlsx': FileService.exportToExcel(exportData, filename); break;
          case 'csv': FileService.exportToCSV(exportData, filename); break;
          case 'html': FileService.exportToHTML(columns, exportData, filename, title); break;
          case 'pdf': FileService.exportToPDF(columns, exportData, filename, title); break;
      }
  };

  const toggleAssignment = (className: string, section?: string) => {
      setUserAssignments(prev => {
          const exists = prev.find(a => a.className === className);
          if (!exists) {
              return [...prev, { className, sections: section ? [section] : [] }];
          } else {
              if (!section) {
                   return prev.filter(a => a.className !== className);
              } else {
                  const sectionExists = exists.sections.includes(section);
                  let newSections = sectionExists 
                      ? exists.sections.filter(s => s !== section) 
                      : [...exists.sections, section];
                  
                  return prev.map(a => a.className === className ? { ...a, sections: newSections } : a);
              }
          }
      });
  };

  const filteredStudents = students.filter(s => 
      s.name.includes(searchTerm) || 
      s.id.includes(searchTerm) ||
      s.className.includes(searchTerm)
  );

  const selectedClassObj = classes.find(c => c.name === newStudent.className);

  const RADAR_DATA = [
      { subject: 'الحضور', A: 120, fullMark: 150 },
      { subject: 'الانضباط', A: 98, fullMark: 150 },
      { subject: 'المشاركه', A: 86, fullMark: 150 },
      { subject: 'النشاط', A: 99, fullMark: 150 },
      { subject: 'السلوك', A: 85, fullMark: 150 },
      { subject: 'الواجبات', A: 65, fullMark: 150 },
  ];
  
  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 px-2 gap-4 no-print">
         <div className="flex items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold font-serif text-white">لوحة الإدارة</h1>
                {systemSettings && (
                    <p className="text-sm text-gray-400 mt-1">{systemSettings.schoolName} - {systemSettings.schoolManager}</p>
                )}
            </div>
            
            <button 
                onClick={toggleMode}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title={mode === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            >
                {mode === 'dark' ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-blue-200" />}
            </button>
            
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowKioskModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-gray-300 hover:bg-white/10 transition-colors"
                >
                    <Monitor className="w-4 h-4" /> تخصيص الكشك
                </button>
                <button 
                    onClick={() => setShowSchoolSettingsModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-gray-300 hover:bg-white/10 transition-colors"
                >
                    <Building2 className="w-4 h-4" /> إعدادات المدرسة
                </button>
            </div>
         </div>
         
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="hidden md:flex items-center gap-2 bg-[#1e293b]/50 px-4 py-2 rounded-full border border-white/10 text-sm">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-gray-300">أداء المدرسة:</span>
                <span className="text-emerald-400 font-bold">ممتاز</span>
            </div>
            <div className="relative flex-1 md:flex-none">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="بحث شامل..." className="bg-[#1e293b] border border-white/10 rounded-full py-2 pr-10 pl-4 text-sm text-white focus:border-primary-500 w-full md:w-64 input-glass" />
            </div>
         </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Sidebar/Tabs Navigation - Vertical on Large screens */}
        <div className="lg:w-64 flex-shrink-0">
            <div className="glass-card rounded-3xl p-4 h-full border border-white/5 flex flex-col gap-2 sticky top-6">
                {[
                    { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
                    { id: 'students', label: 'الطلاب', icon: UserPlus },
                    { id: 'reports', label: 'التقارير', icon: FileText },
                    { id: 'student_reports', label: 'تقارير الطلاب', icon: FileSpreadsheet },
                    { id: 'structure', label: 'الهيكل المدرسي', icon: Database },
                    { id: 'users', label: 'المستخدمين', icon: Users },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all duration-300 ${
                            activeTab === tab.id
                            ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/20' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
            
            {loading && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary-400" />
                </div>
            )}

            {/* --- DASHBOARD TAB --- */}
            {activeTab === 'dashboard' && stats ? (
                <div className="animate-fade-in space-y-6">
                    {/* Top Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                           { title: 'إجمالي الطلاب', val: stats.totalStudents, change: '+12%', color: 'text-white' },
                           { title: 'نسبة الحضور', val: `${stats.attendanceRate}%`, change: '+5.4%', color: 'text-emerald-400' },
                           { title: 'حالات الغياب', val: stats.absentCount, change: '-2.1%', color: 'text-red-400' },
                           { title: 'حالات التأخير', val: stats.lateCount, change: '+0.5%', color: 'text-amber-400' },
                        ].map((stat, i) => (
                            <div key={i} className="glass-card p-6 rounded-[2rem] border border-white/5 bg-[#1e293b]/60 hover:bg-[#1e293b]/80 transition-colors">
                                <div className="text-gray-400 text-sm mb-2 font-medium">{stat.title}</div>
                                <div className="flex items-end justify-between">
                                    <div className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.val}</div>
                                    <div className="text-xs bg-white/5 px-2 py-1 rounded-lg text-emerald-400 border border-white/5">{stat.change}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Widget: Leading Classes */}
                        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60 flex flex-col">
                            <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-cyan-400"></div> الأكثر انضباطاً
                            </h3>
                            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {classStats.slice(0, 5).map((cls, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-300 font-medium">{cls.name}</span>
                                            <span className="text-emerald-400 font-mono">+{90 + (i * 2)}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-[#0f172a] rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{width: `${90 + (i*2)}%`}}></div>
                                        </div>
                                    </div>
                                ))}
                                <div className="mt-auto pt-4 border-t border-white/5">
                                    <div className="text-xs text-gray-500 mb-2">إجمالي المتفوقين</div>
                                    <div className="text-2xl font-bold text-white font-mono">870 طالب</div>
                                </div>
                            </div>
                        </div>

                        {/* Widget: Main Area Chart */}
                        <div className="lg:col-span-6 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60 min-h-[400px]">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-white font-bold text-lg">تحليل البيانات</h3>
                                    <p className="text-xs text-gray-400">اتجاه الحضور الأسبوعي</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-300 border border-white/10 cursor-pointer hover:bg-white/10">أسبوعي</span>
                                    <span className="px-3 py-1 rounded-full bg-primary-600 text-xs text-white border border-primary-500 cursor-pointer">شهري</span>
                                </div>
                            </div>
                            <div className="h-[300px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={weeklyStats}>
                                        <defs>
                                            <linearGradient id="colorPresence" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="day" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff'}}
                                            itemStyle={{color: '#fff'}}
                                        />
                                        <Area type="monotone" dataKey="presence" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPresence)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <div className="absolute top-10 right-20 bg-[#1e293b] border border-white/10 px-3 py-1 rounded-full text-xs text-white shadow-lg animate-pulse">
                                    +71.11% تحسن
                                </div>
                            </div>
                        </div>

                        {/* Widget: Radar Chart */}
                        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60 flex flex-col items-center justify-center relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-6">
                                 <MoreHorizontal className="text-gray-500" />
                             </div>
                             <h3 className="text-white font-bold w-full mb-4 text-center">مؤشر الأداء</h3>
                             <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_DATA}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                                        <Radar name="Performance" dataKey="A" stroke="#06b6d4" strokeWidth={2} fill="#06b6d4" fillOpacity={0.3} />
                                    </RadarChart>
                                </ResponsiveContainer>
                             </div>
                             <div className="text-xs text-gray-400 mt-2 text-center w-full px-4">
                                 تحليل شامل للسلوك والانضباط المدرسي
                             </div>
                        </div>
                    </div>

                    {/* Bottom Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Donut Charts Section */}
                        <div className="lg:col-span-4 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60">
                             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-400" /> إحصائيات الحضور
                             </h3>
                             <div className="flex items-center justify-center gap-4">
                                 <div className="relative w-40 h-40">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'حضور', value: stats.presentCount },
                                                    { name: 'غياب', value: stats.absentCount },
                                                    { name: 'تأخر', value: stats.lateCount },
                                                ]}
                                                innerRadius={40}
                                                outerRadius={60}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                <Cell fill="#10b981" />
                                                <Cell fill="#ef4444" />
                                                <Cell fill="#f59e0b" />
                                            </Pie>
                                            <Tooltip contentStyle={{backgroundColor: '#1e293b', borderRadius: '8px', border: 'none'}} />
                                        </PieChart>
                                     </ResponsiveContainer>
                                     <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                         <span className="text-2xl font-bold text-white">{stats.attendanceRate}%</span>
                                         <span className="text-[10px] text-gray-400">نسبة عامة</span>
                                     </div>
                                 </div>
                                 <div className="space-y-2 text-sm">
                                     <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> <span className="text-gray-300">حضور</span> <span className="text-white font-bold">{stats.presentCount}</span></div>
                                     <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> <span className="text-gray-300">غياب</span> <span className="text-white font-bold">{stats.absentCount}</span></div>
                                     <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500"></span> <span className="text-gray-300">تأخر</span> <span className="text-white font-bold">{stats.lateCount}</span></div>
                                 </div>
                             </div>
                        </div>

                         {/* Activity Bar Chart */}
                         <div className="lg:col-span-5 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                   <Target className="w-5 h-5 text-pink-500" /> الطلاب الجدد والنشطين
                                </h3>
                                <div className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">2024</div>
                            </div>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Jan', val: 40 }, { name: 'Feb', val: 60 }, { name: 'Mar', val: 45 },
                                        { name: 'Apr', val: 80 }, { name: 'May', val: 70 }, { name: 'Jun', val: 90 },
                                        { name: 'Jul', val: 65 }, { name: 'Aug', val: 85 }, { name: 'Sep', val: 100 },
                                    ]} barSize={10}>
                                        <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} />
                                        <Bar dataKey="val" fill="#ec4899" radius={[10, 10, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        {/* Quick Action Widget */}
                        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-gradient-to-br from-primary-900 to-[#1e293b] flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform">
                             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                             <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary-500 rounded-full blur-[60px] opacity-40 group-hover:opacity-60 transition-opacity"></div>
                             
                             <div className="relative z-10">
                                 <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-lg">
                                     <Printer className="w-8 h-8 text-white" />
                                 </div>
                                 <h3 className="text-xl font-bold text-white mb-2">تقرير فوري</h3>
                                 <p className="text-sm text-gray-300 mb-4">طباعة تقرير الحضور لهذا اليوم بضغطة واحدة</p>
                                 <button onClick={() => { setReportFilter({...reportFilter, dateFrom: getLocalISODate(), dateTo: getLocalISODate()}); handleGenerateReport(); }} className="px-6 py-2 bg-white text-primary-900 font-bold rounded-xl shadow-lg hover:bg-gray-100 transition-colors">
                                     طباعة الآن
                                 </button>
                             </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'dashboard' && (
                <div className="w-full h-64 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
            )}

            {/* --- STUDENTS TAB --- */}
            {activeTab === 'students' && (
                 <div className="animate-fade-in space-y-4">
                     <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                        <div><h2 className="text-2xl font-bold font-serif text-white">إدارة الطلاب</h2></div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600/30 font-bold transition-all whitespace-nowrap"><FileSpreadsheet className="w-4 h-4" /> استيراد</button>
                            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-500 font-bold shadow-lg shadow-primary-500/20 transition-all whitespace-nowrap"><Plus className="w-4 h-4" /> إضافة طالب</button>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredStudents.map((s, index) => (
                          <div 
                            key={s.id}
                            className="glass-card group relative p-6 rounded-[2rem] hover:-translate-y-2 transition-all duration-500 border border-white/5 bg-[#1e293b]/40 overflow-hidden"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-[40px] group-hover:bg-primary-500/20 transition-all"></div>
                            
                            <div className="relative z-10">
                              <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-xl font-bold font-serif text-white shadow-inner">
                                  {s.name.charAt(0)}
                                </div>
                                <div className="bg-white/5 px-3 py-1 rounded-full text-xs font-mono text-primary-300 border border-white/5">
                                  {s.id}
                                </div>
                              </div>
                              
                              <h3 className="text-xl font-bold text-white mb-1 truncate">{s.name}</h3>
                              <p className="text-sm text-gray-400 mb-4">{s.className} - {s.section}</p>
                              
                              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Users className="w-4 h-4" />
                                  <span>{s.guardianPhone}</span>
                                </div>
                                <button 
                                    onClick={() => navigate(`/parents?guardian=${s.guardianPhone}`)}
                                    className="p-2 bg-secondary-500/20 text-secondary-300 rounded-lg hover:bg-secondary-500/30 transition-colors"
                                    title="عرض كولي أمر"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                     </div>
                 </div>
            )}
            
            {/* ... Other tabs remain unchanged ... */}
            
        </div>
      </div>

      {/* --- MODALS (Shared) --- */}
      
      {/* Kiosk Settings Modal */}
      {showKioskModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
              <div className="glass-card w-full max-w-lg rounded-3xl p-6 relative border border-white/20">
                  <button onClick={() => setShowKioskModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                  <h3 className="text-2xl font-bold font-serif text-white mb-6 flex items-center gap-2"><Monitor className="w-6 h-6 text-primary-400" /> إعدادات الكشك</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">العنوان الرئيسي</label>
                          <input type="text" className="w-full input-glass p-3 rounded-xl" value={kioskSettings.mainTitle} onChange={e => setKioskSettings({...kioskSettings, mainTitle: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">العنوان الفرعي</label>
                          <input type="text" className="w-full input-glass p-3 rounded-xl" value={kioskSettings.subTitle} onChange={e => setKioskSettings({...kioskSettings, subTitle: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs text-emerald-400 mb-1 block">رسالة الحضور المبكر</label>
                          <input type="text" className="w-full input-glass p-3 rounded-xl border-emerald-500/30" value={kioskSettings.earlyMessage} onChange={e => setKioskSettings({...kioskSettings, earlyMessage: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs text-amber-400 mb-1 block">رسالة التأخر</label>
                          <input type="text" className="w-full input-glass p-3 rounded-xl border-amber-500/30" value={kioskSettings.lateMessage} onChange={e => setKioskSettings({...kioskSettings, lateMessage: e.target.value})} />
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                          <input 
                              type="checkbox" 
                              id="showStats" 
                              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" 
                              checked={kioskSettings.showStats}
                              onChange={e => setKioskSettings({...kioskSettings, showStats: e.target.checked})}
                          />
                          <label htmlFor="showStats" className="text-sm text-gray-300">إظهار بطاقة الإحصائيات (إجمالي الطلاب/الحضور)</label>
                      </div>
                      <button onClick={handleSaveKioskSettings} className="w-full py-4 mt-4 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500 shadow-lg">حفظ التغييرات</button>
                  </div>
              </div>
          </div>
      )}

      {/* School Settings Modal */}
      {showSchoolSettingsModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
              <div className="glass-card w-full max-w-lg rounded-3xl p-6 relative border border-white/20">
                  <button onClick={() => setShowSchoolSettingsModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                  <h3 className="text-2xl font-bold font-serif text-white mb-6 flex items-center gap-2"><Building2 className="w-6 h-6 text-primary-400" /> إعدادات المدرسة</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">اسم المدرسة</label>
                          <input type="text" className="w-full input-glass p-3 rounded-xl" value={schoolSettings.name} onChange={e => setSchoolSettings({...schoolSettings, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">مدير المدرسة</label>
                          <input type="text" className="w-full input-glass p-3 rounded-xl" value={schoolSettings.manager} onChange={e => setSchoolSettings({...schoolSettings, manager: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">وقت الطابور (HH:MM)</label>
                              <input type="time" className="w-full input-glass p-3 rounded-xl text-center" value={schoolSettings.assemblyTime} onChange={e => setSchoolSettings({...schoolSettings, assemblyTime: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">مدة السماح (دقائق)</label>
                              <input type="number" className="w-full input-glass p-3 rounded-xl text-center" value={schoolSettings.gracePeriod} onChange={e => setSchoolSettings({...schoolSettings, gracePeriod: parseInt(e.target.value)})} />
                          </div>
                      </div>
                      <div className="text-xs text-gray-500 p-3 bg-white/5 rounded-xl">
                          <AlertCircle className="w-4 h-4 inline-block ml-1 mb-1" />
                          سيتم احتساب التأخير إذا سجل الطالب بعد "وقت الطابور + مدة السماح".
                      </div>
                      <button onClick={handleSaveSchoolSettings} className="w-full py-4 mt-4 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500 shadow-lg">حفظ البيانات</button>
                  </div>
              </div>
          </div>
      )}

      {/* Other modals ... */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="glass-card w-full max-w-lg rounded-3xl p-6 relative animate-fade-in-up border border-white/20">
                  <button onClick={() => setShowAddModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                  <h3 className="text-2xl font-bold font-serif text-white mb-6 flex items-center gap-2"><UserPlus className="w-6 h-6 text-primary-400" /> إضافة طالب جديد</h3>
                  <form onSubmit={handleAddStudent} className="space-y-4">
                      <input type="text" required className="w-full input-glass p-3 rounded-xl" placeholder="الاسم" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                      <div className="grid grid-cols-1 gap-4">
                          <input type="text" required className="w-full input-glass p-3 rounded-xl font-mono" placeholder="جوال ولي الأمر" value={newStudent.guardianPhone} onChange={e => setNewStudent({...newStudent, guardianPhone: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4"><select className="w-full input-glass p-3 rounded-xl" value={newStudent.className} onChange={e => setNewStudent({...newStudent, className: e.target.value, section: ''})} required><option value="">اختر الصف...</option>{classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>{selectedClassObj && selectedClassObj.sections.length > 0 ? (<select className="w-full input-glass p-3 rounded-xl" value={newStudent.section} onChange={e => setNewStudent({...newStudent, section: e.target.value})} required><option value="">اختر الفصل...</option>{selectedClassObj.sections.map(sec => (<option key={sec} value={sec}>{sec}</option>))}</select>) : (<input type="text" required className="w-full input-glass p-3 rounded-xl" placeholder="أ، ب، ج..." value={newStudent.section} onChange={e => setNewStudent({...newStudent, section: e.target.value})} />)}</div>
                      <button type="submit" className="w-full py-4 mt-4 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500 shadow-lg">حفظ وإضافة</button>
                  </form>
              </div>
          </div>
      )}

      {showImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="glass-card w-full max-w-2xl rounded-3xl p-8 relative animate-fade-in-up border border-white/20 text-center">
                  <button onClick={() => setShowImportModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                  <FileSpreadsheet className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold font-serif text-white mb-2">استيراد بيانات الطلاب</h2>
                  <p className="text-gray-400 mb-6 text-sm">الملف يجب أن يحتوي على الأعمدة التالية: المعرف، الاسم، الصف، الفصل، الجوال</p>
                  <label className="block w-full cursor-pointer group mb-6"><div className="border-2 border-dashed border-white/10 rounded-3xl p-10 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/5 transition-all"><Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" /><span className="text-lg font-bold text-gray-300">اضغط لاختيار ملف</span></div><input type="file" className="hidden" accept=".csv, .xlsx" onChange={(e) => setImportFile(e.target.files?.[0] || null)} /></label>
                  {importFile && <button onClick={handleImport} className="px-6 py-2 bg-emerald-600 rounded-lg text-white font-bold hover:bg-emerald-500 transition-colors">رفع ومعالجة</button>}
              </div>
          </div>
      )}

      {deleteConfirmation && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
                <div className="glass-card w-full max-w-sm rounded-3xl p-6 border border-white/20 text-center relative">
                    <Trash2 className="w-8 h-8 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">تأكيد الحذف</h3>
                    <p className="text-gray-400 mb-6">هل أنت متأكد من حذف <span className="text-white font-bold mx-1">{deleteConfirmation.name}</span>؟</p>
                    <div className="flex gap-3"><button onClick={() => setDeleteConfirmation(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 font-bold transition-colors">إلغاء</button><button onClick={confirmDeleteAction} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold shadow-lg shadow-red-900/20 transition-colors">حذف</button></div>
                </div>
            </div>
      )}

    </div>
  );
};

export default Admin;
