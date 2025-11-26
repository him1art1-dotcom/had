
import React, { useState, useEffect } from 'react';
import { db, getLocalISODate } from '../services/db';
import { Student, DashboardStats, ReportFilter, SchoolClass, User, Role, ClassAssignment, KioskSettings, SystemSettings, Notification } from '../types';
import { FileService } from '../services/fileService';
import { FileSpreadsheet, Upload, UserPlus, Database, Loader2, LayoutDashboard, TrendingUp, AlertCircle, Clock, CheckCircle, FileText, Printer, FileCode, FileType, Plus, X, Search, Calendar, Trash2, Users, Trophy, ChevronDown, MoreHorizontal, Target, Sun, Moon, CheckSquare, Square, Eye, Monitor, Building2, Save, Bell, Send, HelpCircle, Image, Play, Power, ImageIcon } from 'lucide-react';
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

  // Notifications State
  const [notifForm, setNotifForm] = useState({ target: 'guardian', title: '', message: '' });
  
  // Targeted Notification State
  const [showTargetNotifModal, setShowTargetNotifModal] = useState(false);
  const [targetStudent, setTargetStudent] = useState<Student | null>(null);
  const [targetNotifData, setTargetNotifData] = useState({ title: '', message: '' });

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showKioskModal, setShowKioskModal] = useState(false);
  const [showSchoolSettingsModal, setShowSchoolSettingsModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'class' | 'user', id: string, name: string } | null>(null);
  const [importConfirmation, setImportConfirmation] = useState<{ count: number, data: Student[] } | null>(null);

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
      showStats: false,
      headerImage: '',
      screensaverEnabled: false,
      screensaverTimeout: 2,
      screensaverImages: []
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
      if (s.kiosk) setKioskSettings(s.kiosk || kioskSettings);
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

  const handleImageUpload = (file: File, type: 'header' | 'screensaver') => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const result = e.target?.result as string;
          if (type === 'header') {
              setKioskSettings({ ...kioskSettings, headerImage: result });
          } else {
              setKioskSettings({ 
                  ...kioskSettings, 
                  screensaverImages: [...(kioskSettings.screensaverImages || []), result] 
              });
          }
      };
      reader.readAsDataURL(file);
  };

  const removeScreensaverImage = (index: number) => {
      const newImages = [...(kioskSettings.screensaverImages || [])];
      newImages.splice(index, 1);
      setKioskSettings({ ...kioskSettings, screensaverImages: newImages });
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
  
  const handleForceScreensaver = async () => {
      setLoading(true);
      try {
          const notification: Notification = {
              id: Math.random().toString(36).substr(2,9),
              title: 'System Command',
              message: 'start_screensaver',
              type: 'command',
              target_audience: 'kiosk',
              created_at: new Date().toISOString()
          };
          await db.saveNotification(notification);
          alert('تم إرسال أمر تشغيل شاشة التوقف للكشك');
      } catch(e) {
          console.error(e);
          alert('فشل الإرسال');
      } finally {
          setLoading(false);
      }
  };

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

  const handleImportPreview = async () => {
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

          setImportConfirmation({ count: newStudents.length, data: newStudents });
          setShowImportModal(false);
      } catch (e) {
          alert('حدث خطأ أثناء قراءة الملف. تأكد من الصيغة.');
      } finally {
          setLoading(false);
      }
  };

  const confirmImport = async () => {
      if (!importConfirmation) return;
      setLoading(true);
      try {
          await db.saveStudents(importConfirmation.data);
          await fetchStudents();
          alert(`تم استيراد ${importConfirmation.count} طالب بنجاح`);
          setImportConfirmation(null);
          setImportFile(null);
      } catch (e) {
          alert('حدث خطأ أثناء الحفظ');
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

  const handleSendNotification = async () => {
      if (!notifForm.message || !notifForm.title) return;
      setLoading(true);
      try {
          const notification: Notification = {
              id: Math.random().toString(36).substr(2,9),
              title: notifForm.title,
              message: notifForm.message,
              type: 'general',
              target_audience: notifForm.target as any,
              created_at: new Date().toISOString()
          };
          await db.saveNotification(notification);
          alert('تم إرسال الإشعار بنجاح');
          setNotifForm({ target: 'guardian', title: '', message: '' });
      } catch(e) {
          console.error(e);
          alert('فشل الإرسال');
      } finally {
          setLoading(false);
      }
  };

  const handleOpenTargetNotification = (student: Student) => {
      setTargetStudent(student);
      setTargetNotifData({ title: '', message: '' });
      setShowTargetNotifModal(true);
  };

  const handleSendTargetNotification = async () => {
      if (!targetStudent || !targetNotifData.title || !targetNotifData.message) return;
      setLoading(true);
      try {
          const notification: Notification = {
              id: Math.random().toString(36).substr(2,9),
              title: targetNotifData.title,
              message: targetNotifData.message,
              type: 'behavior',
              target_audience: 'student',
              target_id: targetStudent.id,
              created_at: new Date().toISOString()
          };
          await db.saveNotification(notification);
          alert(`تم إرسال الإشعار لولي أمر الطالب ${targetStudent.name}`);
          setShowTargetNotifModal(false);
          setTargetStudent(null);
      } catch(e) {
          console.error(e);
          alert('فشل الإرسال');
      } finally {
          setLoading(false);
      }
  };

  const filteredStudents = students.filter(s => 
      s.name.includes(searchTerm) || 
      s.id.includes(searchTerm) ||
      s.className.includes(searchTerm)
  );

  const selectedClassObj = classes.find(c => c.name === newStudent.className);

  // Mock Radar Data if not available
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
        
        {/* Sidebar/Tabs Navigation */}
        <div className="lg:w-64 flex-shrink-0">
            <div className="glass-card rounded-3xl p-4 h-full border border-white/5 flex flex-col gap-2 sticky top-6">
                {[
                    { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
                    { id: 'students', label: 'الطلاب', icon: UserPlus },
                    { id: 'reports', label: 'التقارير', icon: FileText },
                    { id: 'student_reports', label: 'تقارير الطلاب', icon: FileSpreadsheet },
                    { id: 'structure', label: 'الهيكل المدرسي', icon: Database },
                    { id: 'users', label: 'المستخدمين', icon: Users },
                    { id: 'notifications', label: 'الإشعارات', icon: Bell },
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
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setTargetStudent(s); setTargetNotifData({title: '', message: ''}); setShowTargetNotifModal(true); }}
                                        className="p-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
                                        title="إرسال إشعار"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
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
                          </div>
                        ))}
                     </div>
                 </div>
            )}
            
            {/* --- REPORTS TAB --- */}
            {activeTab === 'reports' && (
                <div className="glass-card rounded-3xl p-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8">
                        <div><label className="text-xs text-gray-400 mb-1 block">من</label><input type="date" className="w-full input-glass p-3 rounded-xl" value={reportFilter.dateFrom} onChange={e => setReportFilter({...reportFilter, dateFrom: e.target.value})} /></div>
                        <div><label className="text-xs text-gray-400 mb-1 block">إلى</label><input type="date" className="w-full input-glass p-3 rounded-xl" value={reportFilter.dateTo} onChange={e => setReportFilter({...reportFilter, dateTo: e.target.value})} /></div>
                        <div><label className="text-xs text-gray-400 mb-1 block">الصف</label><select className="w-full input-glass p-3 rounded-xl" value={reportFilter.className} onChange={e => setReportFilter({...reportFilter, className: e.target.value, section: ''})}><option value="">الكل</option>{classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                        <button onClick={handleGenerateReport} disabled={loading} className="w-full py-3 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500 shadow-lg shadow-primary-500/20">{loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'عرض التقرير'}</button>
                    </div>
                    {reportData && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 text-center"><div className="text-3xl font-bold text-blue-400">{reportData.summary.totalRecords}</div><div className="text-xs text-gray-400 uppercase">إجمالي السجلات</div></div>
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 text-center"><div className="text-3xl font-bold text-emerald-400">{reportData.summary.present}</div><div className="text-xs text-gray-400 uppercase">حضور مبكر</div></div>
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/20 text-center"><div className="text-3xl font-bold text-amber-400">{reportData.summary.late}</div><div className="text-xs text-gray-400 uppercase">تأخر</div></div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => handleExport('xlsx')} className="px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-600/30 transition-colors text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Excel</button>
                                <button onClick={() => handleExport('pdf')} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-600/30 transition-colors text-sm flex items-center gap-2"><FileText className="w-4 h-4"/> PDF</button>
                            </div>
                            <div className="border border-white/10 rounded-2xl overflow-hidden">
                                <table className="w-full text-right text-sm"><thead className="bg-white/5 text-gray-400"><tr><th className="p-4">التاريخ</th><th className="p-4">الوقت</th><th className="p-4">الطالب</th><th className="p-4">الصف</th><th className="p-4">الحالة</th></tr></thead><tbody className="divide-y divide-white/5 text-gray-300">{reportData.details.map((row: any, i: number) => (<tr key={i} className="hover:bg-white/5"><td className="p-4 font-mono">{row.date}</td><td className="p-4 font-mono">{new Date(row.time).toLocaleTimeString('ar-SA')}</td><td className="p-4 font-bold">{row.studentName}</td><td className="p-4">{row.className}</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs border ${row.status === 'present' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>{row.status === 'present' ? 'حاضر' : 'تأخر'}</span></td></tr>))}</tbody></table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- STUDENT REPORTS TAB --- */}
            {activeTab === 'student_reports' && (
                <div className="glass-card rounded-3xl p-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8">
                        <div><label className="text-xs text-gray-400 mb-1 block">من</label><input type="date" className="w-full input-glass p-3 rounded-xl" value={reportFilter.dateFrom} onChange={e => setReportFilter({...reportFilter, dateFrom: e.target.value})} /></div>
                        <div><label className="text-xs text-gray-400 mb-1 block">إلى</label><input type="date" className="w-full input-glass p-3 rounded-xl" value={reportFilter.dateTo} onChange={e => setReportFilter({...reportFilter, dateTo: e.target.value})} /></div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">الصف</label>
                            <select className="w-full input-glass p-3 rounded-xl" value={reportFilter.className} onChange={e => setReportFilter({...reportFilter, className: e.target.value, section: ''})}>
                                <option value="">اختر الصف...</option>
                                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={`text-xs text-gray-400 mb-1 block ${!reportFilter.className ? 'opacity-50' : ''}`}>الفصل</label>
                            <select 
                                className={`w-full input-glass p-3 rounded-xl ${!reportFilter.className ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                value={reportFilter.section} 
                                onChange={e => setReportFilter({...reportFilter, section: e.target.value})}
                                disabled={!reportFilter.className}
                            >
                                <option value="">الكل</option>
                                {reportFilter.className && classes.find(c => c.name === reportFilter.className)?.sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <button onClick={handleGenerateReport} disabled={loading || !reportFilter.className} className="w-full py-3 bg-secondary-600 rounded-xl text-white font-bold hover:bg-secondary-500 shadow-lg shadow-secondary-500/20 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'تقرير الطلاب'}</button>
                    </div>
                    {reportData && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => handleExport('xlsx')} className="px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-600/30 transition-colors text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Excel</button>
                                <button onClick={() => handleExport('pdf')} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-600/30 transition-colors text-sm flex items-center gap-2"><FileText className="w-4 h-4"/> PDF</button>
                            </div>
                            <div className="border border-white/10 rounded-2xl overflow-hidden">
                                <table className="w-full text-right text-sm"><thead className="bg-white/5 text-gray-400"><tr><th className="p-4">المعرف</th><th className="p-4">الطالب</th><th className="p-4">الصف</th><th className="p-4">الفصل</th><th className="p-4">عدد أيام الحضور</th><th className="p-4">عدد أيام الغياب</th></tr></thead><tbody className="divide-y divide-white/5 text-gray-300">
                                    {/* Aggregated Student Data Logic needed here usually, but re-using details for now */}
                                    {reportData.details.map((row: any, i: number) => (<tr key={i} className="hover:bg-white/5"><td className="p-4 font-mono">{row.studentId}</td><td className="p-4 font-bold">{row.studentName}</td><td className="p-4">{row.className}</td><td className="p-4">{row.className}</td><td className="p-4 text-emerald-400 font-bold">10</td><td className="p-4 text-red-400 font-bold">2</td></tr>))}
                                </tbody></table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- STRUCTURE TAB --- */}
            {activeTab === 'structure' && (
                <div className="glass-card rounded-3xl p-6 animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Database className="w-5 h-5 text-primary-400" /> الهيكل المدرسي</h3>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-8">
                        <h4 className="text-sm font-bold text-gray-300 mb-4">إضافة صف جديد</h4>
                        <div className="flex gap-4">
                            <input type="text" placeholder="اسم الصف (مثال: أول ثانوي)" className="flex-1 input-glass p-3 rounded-xl" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} />
                            <input type="text" placeholder="الفصول (أ, ب, ج) مفصولة بفاصلة" className="flex-1 input-glass p-3 rounded-xl" value={newClass.sections} onChange={e => setNewClass({...newClass, sections: e.target.value})} />
                            <button onClick={handleAddClass} className="px-6 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500">إضافة</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classes.map(c => (
                            <div key={c.id} className="glass-card p-5 rounded-2xl border border-white/10 relative group">
                                <button onClick={() => handleDeleteClass(c.id, c.name)} className="absolute top-4 left-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                <h4 className="font-bold text-white text-lg mb-2">{c.name}</h4>
                                <div className="flex flex-wrap gap-2">
                                    {c.sections.map(s => <span key={s} className="px-3 py-1 bg-white/5 rounded-lg text-sm text-gray-300 border border-white/5">{s}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- USERS TAB --- */}
            {activeTab === 'users' && (
                <div className="glass-card rounded-3xl p-6 animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-primary-400" /> إدارة المستخدمين</h3>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8">
                        <h4 className="text-sm font-bold text-gray-300 mb-4">إضافة مستخدم جديد</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input type="text" placeholder="الاسم الكامل" className="input-glass p-3 rounded-xl" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                            <input type="text" placeholder="اسم المستخدم" className="input-glass p-3 rounded-xl" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                            <input type="password" placeholder="كلمة المرور" className="input-glass p-3 rounded-xl" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                            <select className="input-glass p-3 rounded-xl" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                <option value="watcher">مراقب (Watcher)</option>
                                <option value="supervisor_class">مشرف صف (Class Supervisor)</option>
                                <option value="supervisor_global">مشرف عام (Global Supervisor)</option>
                                <option value="school_admin">مدير مدرسة (School Admin)</option>
                            </select>
                        </div>
                        
                        {/* Class Assignment UI for Class Supervisors */}
                        {newUser.role === Role.SUPERVISOR_CLASS && (
                            <div className="mb-4 p-4 bg-black/20 rounded-xl border border-white/5 animate-fade-in">
                                <label className="text-xs text-primary-400 mb-3 block font-bold uppercase tracking-wider">إسناد الفصول (اختياري - تركها فارغة يعني جميع الفصول)</label>
                                <div className="space-y-3">
                                    {classes.map(cls => (
                                        <div key={cls.id} className="flex flex-wrap items-center gap-3">
                                            <button 
                                                onClick={() => toggleAssignment(cls.name)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${userAssignments.some(a => a.className === cls.name) ? 'bg-primary-600 text-white border-primary-500' : 'bg-white/5 text-gray-400 border-white/10'}`}
                                            >
                                                {cls.name}
                                            </button>
                                            {userAssignments.find(a => a.className === cls.name) && (
                                                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg animate-fade-in">
                                                    {cls.sections.map(sec => {
                                                        const isSelected = userAssignments.find(a => a.className === cls.name)?.sections.includes(sec);
                                                        return (
                                                            <button 
                                                                key={sec}
                                                                onClick={() => toggleAssignment(cls.name, sec)}
                                                                className={`px-2 py-1 rounded text-xs transition-colors ${isSelected ? 'bg-secondary-600 text-white' : 'hover:bg-white/10 text-gray-500'}`}
                                                            >
                                                                {sec}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={handleAddUser} className="w-full py-3 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500">إنشاء الحساب</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map(u => (
                            <div key={u.id} className="glass-card p-5 rounded-2xl border border-white/10 relative group">
                                <button onClick={() => handleDeleteUser(u.id, u.name)} className="absolute top-4 left-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                <h4 className="font-bold text-white text-lg mb-1">{u.name}</h4>
                                <p className="text-primary-400 text-sm mb-2">@{u.username}</p>
                                <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400 border border-white/5">{u.role}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- NOTIFICATIONS TAB (New) --- */}
            {activeTab === 'notifications' && (
                <div className="glass-card rounded-3xl p-6 animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Bell className="w-5 h-5 text-primary-400" /> مركز الإشعارات</h3>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 max-w-2xl mx-auto">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">إرسال إلى</label>
                                <select 
                                    className="w-full input-glass p-3 rounded-xl" 
                                    value={notifForm.target} 
                                    onChange={e => setNotifForm({...notifForm, target: e.target.value})}
                                >
                                    <option value="guardian">أولياء الأمور</option>
                                    <option value="supervisor">المشرفين</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">عنوان الإشعار</label>
                                <input 
                                    type="text" 
                                    className="w-full input-glass p-3 rounded-xl" 
                                    placeholder="مثال: تنبيه هام"
                                    value={notifForm.title}
                                    onChange={e => setNotifForm({...notifForm, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">نص الرسالة</label>
                                <textarea 
                                    className="w-full input-glass p-3 rounded-xl h-32 resize-none"
                                    placeholder="اكتب نص الرسالة هنا..."
                                    value={notifForm.message}
                                    onChange={e => setNotifForm({...notifForm, message: e.target.value})}
                                />
                            </div>
                            <button 
                                onClick={handleSendNotification} 
                                disabled={!notifForm.message || !notifForm.title}
                                className="w-full py-3 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500 flex items-center justify-center gap-2"
                            >
                                <Send className="w-4 h-4" /> إرسال الإشعار
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
        </div>
      </div>

      {/* --- MODALS (Shared) --- */}
      
      {/* TARGETED NOTIFICATION MODAL */}
      {showTargetNotifModal && targetStudent && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="glass-card w-full max-w-lg rounded-[2rem] p-8 relative border border-white/10">
                    <button onClick={() => { setShowTargetNotifModal(false); setTargetStudent(null); }} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                    
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                            <Send className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-serif text-white">إشعار خاص</h2>
                            <p className="text-sm text-gray-400">إلى ولي أمر الطالب: {targetStudent.name}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">عنوان الإشعار</label>
                            <input 
                                type="text" 
                                className="w-full input-glass p-3 rounded-xl"
                                value={targetNotifData.title}
                                onChange={e => setTargetNotifData({...targetNotifData, title: e.target.value})}
                                placeholder="مثال: استدعاء ولي أمر"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">نص الرسالة</label>
                            <textarea 
                                className="w-full input-glass p-3 rounded-xl h-32 resize-none"
                                placeholder="اكتب الرسالة هنا..."
                                value={targetNotifData.message}
                                onChange={e => setTargetNotifData({...targetNotifData, message: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={async () => {
                                if (!targetStudent || !targetNotifData.title || !targetNotifData.message) return;
                                setLoading(true);
                                try {
                                    const notification: Notification = {
                                        id: Math.random().toString(36).substr(2,9),
                                        title: targetNotifData.title,
                                        message: targetNotifData.message,
                                        type: 'behavior', // Admin messages are usually official/behavior
                                        target_audience: 'student',
                                        target_id: targetStudent.id,
                                        created_at: new Date().toISOString()
                                    };
                                    await db.saveNotification(notification);
                                    alert(`تم إرسال الإشعار لولي أمر الطالب ${targetStudent.name}`);
                                    setShowTargetNotifModal(false);
                                    setTargetStudent(null);
                                } catch(e) {
                                    console.error(e);
                                    alert('فشل الإرسال');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={!targetNotifData.title || !targetNotifData.message}
                            className="w-full py-3 bg-blue-600/80 hover:bg-blue-600 rounded-xl text-white font-bold shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Send className="w-4 h-4" /> إرسال
                        </button>
                    </div>
                </div>
            </div>
      )}

      {/* Kiosk Settings Modal */}
      {showKioskModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
              <div className="glass-card w-full max-w-2xl rounded-3xl p-6 relative border border-white/20 overflow-y-auto max-h-[90vh] custom-scrollbar">
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

                      {/* Screensaver Settings Section */}
                      <div className="mt-6 pt-6 border-t border-white/10">
                          <h4 className="font-bold text-white mb-4 flex items-center gap-2"><Image className="w-5 h-5 text-purple-400" /> تخصيص شاشة التوقف والوسائط</h4>
                          
                          {/* Header Image Upload */}
                          <div className="mb-4">
                              <label className="text-xs text-gray-400 mb-2 block">صورة الهيدر (اختياري)</label>
                              <div className="flex items-center gap-3">
                                  {kioskSettings.headerImage && <img src={kioskSettings.headerImage} className="w-16 h-10 object-cover rounded border border-white/20" alt="Header" />}
                                  <label className="cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-xs text-gray-300 border border-white/10 flex items-center gap-2">
                                      <Upload className="w-4 h-4" /> رفع صورة
                                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], 'header')} />
                                  </label>
                                  {kioskSettings.headerImage && <button onClick={() => setKioskSettings({...kioskSettings, headerImage: ''})} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>}
                              </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-4">
                              <input 
                                  type="checkbox" 
                                  id="screensaverEnabled" 
                                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" 
                                  checked={kioskSettings.screensaverEnabled}
                                  onChange={e => setKioskSettings({...kioskSettings, screensaverEnabled: e.target.checked})}
                              />
                              <label htmlFor="screensaverEnabled" className="text-sm text-gray-300">تفعيل شاشة التوقف التلقائية</label>
                          </div>

                          {kioskSettings.screensaverEnabled && (
                              <div className="space-y-4 pl-4 border-r-2 border-white/10 animate-fade-in">
                                  <div>
                                      <label className="text-xs text-gray-400 mb-1 block">وقت الخمول (دقائق)</label>
                                      <input 
                                          type="number" 
                                          min="1" 
                                          className="w-full input-glass p-3 rounded-xl" 
                                          value={kioskSettings.screensaverTimeout} 
                                          onChange={e => setKioskSettings({...kioskSettings, screensaverTimeout: parseInt(e.target.value)})} 
                                      />
                                  </div>
                                  
                                  <div>
                                      <label className="text-xs text-gray-400 mb-2 block">معرض الصور (صور ثابتة أو متحركة)</label>
                                      <label className="cursor-pointer w-full h-24 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center hover:bg-white/5 hover:border-purple-500/50 transition-all">
                                          <ImageIcon className="w-6 h-6 text-gray-500 mb-1" />
                                          <span className="text-xs text-gray-400">اضغط لرفع الصور</span>
                                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                                              if (e.target.files) {
                                                  // Explicitly cast file to File to fix TS error
                                                  Array.from(e.target.files).forEach(file => handleImageUpload(file as File, 'screensaver'));
                                              }
                                          }} />
                                      </label>
                                      
                                      {/* Gallery Grid */}
                                      {kioskSettings.screensaverImages && kioskSettings.screensaverImages.length > 0 && (
                                          <div className="grid grid-cols-4 gap-2 mt-3">
                                              {kioskSettings.screensaverImages.map((img, idx) => (
                                                  <div key={idx} className="relative group aspect-video rounded-lg overflow-hidden border border-white/10">
                                                      <img src={img} alt={`slide-${idx}`} className="w-full h-full object-cover" />
                                                      <button 
                                                          onClick={() => removeScreensaverImage(idx)}
                                                          className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                      >
                                                          <X className="w-3 h-3" />
                                                      </button>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                          
                          <div className="mt-4 flex gap-2">
                              <button onClick={handleForceScreensaver} className="flex-1 py-3 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-xl hover:bg-purple-600/30 transition-all flex items-center justify-center gap-2 text-sm font-bold">
                                  <Play className="w-4 h-4" /> تشغيل فوري للكشك
                              </button>
                          </div>
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
                  {importFile && <button onClick={handleImportPreview} className="px-6 py-2 bg-emerald-600 rounded-lg text-white font-bold hover:bg-emerald-500 transition-colors">رفع ومعالجة</button>}
              </div>
          </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
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

      {/* IMPORT CONFIRMATION MODAL */}
      {importConfirmation && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
                <div className="glass-card w-full max-w-sm rounded-3xl p-6 border border-white/20 text-center relative">
                    <HelpCircle className="w-8 h-8 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">تأكيد الاستيراد</h3>
                    <p className="text-gray-400 mb-6">تم العثور على <span className="text-white font-bold mx-1">{importConfirmation.count}</span> طالب في الملف. هل تريد متابعة الحفظ؟</p>
                    <div className="flex gap-3"><button onClick={() => { setImportConfirmation(null); setImportFile(null); }} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 font-bold transition-colors">إلغاء</button><button onClick={confirmImport} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold shadow-lg shadow-blue-900/20 transition-colors">تأكيد الحفظ</button></div>
                </div>
            </div>
      )}

    </div>
  );
};

export default Admin;
