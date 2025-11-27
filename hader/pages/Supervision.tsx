
import React, { useState, useEffect } from 'react';
import { db, getLocalISODate } from '../services/db';
import { auth } from '../services/auth';
import { Role, Student, DailySummary, ReportFilter, ExitRecord, User } from '../types';
import { Search, DoorOpen, LayoutDashboard, MessageCircle, X, Loader2, Calendar, RefreshCcw, FileSpreadsheet, ClipboardList, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const Supervision: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Navigation State
  const [mainTab, setMainTab] = useState<'attendance' | 'exits'>('attendance');
  const [subTab, setSubTab] = useState<'daily' | 'history'>('daily');

  // Daily Dashboard State
  const [dashboardFilter, setDashboardFilter] = useState<'late' | 'absent' | 'early'>('late');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // History / Reports State
  const [reportFilter, setReportFilter] = useState<ReportFilter>({
      dateFrom: getLocalISODate(),
      dateTo: getLocalISODate(),
      className: '',
      section: ''
  });
  const [reportData, setReportData] = useState<{attendance: any[], exits: any[]} | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Exits Form State
  const [actionStudent, setActionStudent] = useState<Student | null>(null);
  const [formReason, setFormReason] = useState('');

  // Dropdown Data
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);


  useEffect(() => {
    // 1. Role Check
    // Added SITE_ADMIN and SCHOOL_ADMIN to allow them access
    const user = auth.requireRole([Role.SUPERVISOR_GLOBAL, Role.SUPERVISOR_CLASS, Role.SITE_ADMIN, Role.SCHOOL_ADMIN]);
    if(user) setCurrentUser(user);
    
    // 2. Fetch Initial Data
    fetchData(user);
  }, []);

  const fetchData = async (user: User | null) => {
      setLoading(true);
      try {
        const today = getLocalISODate();
        
        // Fetch Summary & Students
        const [sum, allStudents] = await Promise.all([
            db.getDailySummary(today),
            db.getStudents()
        ]);
        
        setSummary(sum);

        // Filter students based on role assignment
        let filteredStudents = allStudents;
        if (user && user.role === Role.SUPERVISOR_CLASS && user.assignedClasses) {
             const assignments = user.assignedClasses;
             filteredStudents = allStudents.filter(s => {
                 const assignment = assignments.find(a => a.className === s.className);
                 if (!assignment) return false;
                 // If sections array is empty, it means all sections. Otherwise check section.
                 if (assignment.sections.length === 0) return true;
                 return assignment.sections.includes(s.section);
             });
        }
        // If Role is SITE_ADMIN, SCHOOL_ADMIN, or SUPERVISOR_GLOBAL, they see allStudents (no filter applied)

        setStudents(filteredStudents);

        // Populate Filters based on visible students only
        setClasses(Array.from(new Set(filteredStudents.map(s => s.className))));
        setSections(Array.from(new Set(filteredStudents.map(s => s.section))));

      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleGenerateReport = async () => {
      setReportLoading(true);
      try {
          // Fetch Attendance and Exits
          // Note: getAttendanceReport fetches ALL data based on filters. 
          // We need to filter the result client-side for Supervisor Class if they try to fetch outside their scope,
          // OR rely on the dropdowns being restricted. Since dropdowns are restricted by 'classes' state above, it's mostly safe.
          // But strict security would require server-side filtering. Here we do client-side post-filter for safety.
          
          const [attReport, exitReport] = await Promise.all([
              db.getAttendanceReport(reportFilter),
              db.getExitsReport(reportFilter)
          ]);
          
          // Filter reports to only show assigned students
          const allowedStudentIds = new Set(students.map(s => s.id));
          
          setReportData({
              attendance: attReport.details.filter(d => allowedStudentIds.has(d.studentId)),
              exits: exitReport.filter(e => allowedStudentIds.has(e.studentId))
          });

      } catch (e) {
          console.error(e);
      } finally {
          setReportLoading(false);
      }
  };

  // --- Logic for Daily Dashboard ---
  const getDashboardList = () => {
      if (!summary) return [];
      
      let targetIds: string[] = [];
      if (dashboardFilter === 'late') targetIds = summary.summary_data.details.late?.map(s => s.id) || [];
      if (dashboardFilter === 'absent') targetIds = summary.summary_data.details.absent?.map(s => s.id) || [];
      if (dashboardFilter === 'early') targetIds = summary.summary_data.details.present?.map(s => s.id) || [];

      // Filter: Only show students that are in our 'students' list (which is already role-filtered)
      let list = students.filter(s => targetIds.includes(s.id));

      if (filterClass) list = list.filter(s => s.className === filterClass);
      if (filterSection) list = list.filter(s => s.section === filterSection);

      return list;
  };

  const openWhatsApp = (student: Student, type: 'absent' | 'late') => {
      if (!student.guardianPhone) {
          alert('لا يوجد رقم هاتف لولي الأمر');
          return;
      }
      
      let phone = student.guardianPhone.trim().replace(/\D/g, '');
      if (phone.startsWith('0')) phone = phone.substring(1);
      if (!phone.startsWith('966')) phone = '966' + phone;

      let msg = '';
      if (type === 'absent') msg = `السلام عليكم ولي أمر الطالب ${student.name}، نود إشعاركم بأن ابنكم تغيب عن المدرسة اليوم.`;
      if (type === 'late') msg = `السلام عليكم ولي أمر الطالب ${student.name}، نود إشعاركم بأن ابنكم وصل متأخراً للمدرسة اليوم.`;
      
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSaveExit = async () => {
      if (!actionStudent) return;
      
      await db.addExit({
          id: '', studentId: actionStudent.id, exit_time: new Date().toISOString(),
          reason: formReason
      });
      alert('تم اعتماد الاستئذان وحفظه في التقارير');
      
      // Reset
      setActionStudent(null);
      setFormReason('');
  };

  // --- Render ---

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-white w-10 h-10" /></div>;

  // Empty State: BLOCKING UI if no Summary (Only for Daily Dashboard part)
  const isDailyBlocked = !summary;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* Main Header */}
        <div className="flex flex-col md:flex-row justify-between gap-4 glass-card p-6 rounded-3xl">
            <div>
                <h1 className="text-3xl font-bold font-serif text-white">بوابة الإشراف</h1>
                <p className="text-gray-400 text-sm">
                    {currentUser?.role === Role.SUPERVISOR_CLASS ? 'إدارة الفصول المسندة' : 'إدارة الحضور والاستئذان (عام)'}
                </p>
            </div>
            {/* Global Class Filter (applies to daily dashboard mainly) */}
            <div className="flex gap-2">
                 <button onClick={() => fetchData(currentUser)} className="p-2 bg-white/5 rounded-xl border border-white/10 text-gray-300 hover:text-white" title="تحديث البيانات">
                    <RefreshCcw className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* MAIN TABS */}
        <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => setMainTab('attendance')}
                className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-2 ${mainTab === 'attendance' ? 'bg-primary-600/20 border-primary-500 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]' : 'glass-card text-gray-400 hover:bg-white/5'}`}
            >
                <ClipboardList className={`w-8 h-8 ${mainTab === 'attendance' ? 'text-primary-400' : 'text-gray-500'}`} />
                <span className="text-xl font-bold font-serif">الحضور</span>
            </button>
            <button 
                onClick={() => setMainTab('exits')}
                className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-2 ${mainTab === 'exits' ? 'bg-secondary-600/20 border-secondary-500 text-white shadow-[0_0_20px_rgba(219,39,119,0.3)]' : 'glass-card text-gray-400 hover:bg-white/5'}`}
            >
                <DoorOpen className={`w-8 h-8 ${mainTab === 'exits' ? 'text-secondary-400' : 'text-gray-500'}`} />
                <span className="text-xl font-bold font-serif">الاستئذان</span>
            </button>
        </div>

        {/* ==================== ATTENDANCE TAB ==================== */}
        {mainTab === 'attendance' && (
            <div className="space-y-6 animate-fade-in">
                {/* Sub Tabs */}
                <div className="flex gap-4 border-b border-white/10 pb-1">
                    <button 
                        onClick={() => setSubTab('daily')}
                        className={`pb-3 px-4 text-sm font-bold transition-all relative ${subTab === 'daily' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        تقارير اليوم
                        {subTab === 'daily' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary-500 rounded-t-full"></div>}
                    </button>
                    <button 
                        onClick={() => setSubTab('history')}
                        className={`pb-3 px-4 text-sm font-bold transition-all relative ${subTab === 'history' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        سجلات وتقارير
                        {subTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary-500 rounded-t-full"></div>}
                    </button>
                </div>

                {/* --- SUB: DAILY REPORTS --- */}
                {subTab === 'daily' && (
                    <>
                    {isDailyBlocked ? (
                        <div className="text-center py-20 animate-fade-in-up">
                             <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                                <Calendar className="w-10 h-10 text-gray-500" />
                                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                             </div>
                             <h2 className="text-2xl font-bold text-white mb-2">بانتظار تقرير المراقب</h2>
                             <p className="text-gray-400">لم يتم رفع سجلات الحضور لليوم بعد</p>
                        </div>
                    ) : (
                        <div className="glass-card rounded-3xl p-6 min-h-[500px]">
                            {/* Filters */}
                            <div className="flex flex-wrap gap-4 mb-6">
                                <select 
                                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none"
                                    value={filterClass} onChange={e => setFilterClass(e.target.value)}
                                >
                                    <option value="">كل الصفوف</option>
                                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select 
                                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none"
                                    value={filterSection} onChange={e => setFilterSection(e.target.value)}
                                >
                                    <option value="">كل الفصول</option>
                                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Status Tabs */}
                            <div className="flex gap-2 mb-6 p-1 bg-black/20 rounded-xl w-fit">
                                <button onClick={() => setDashboardFilter('late')} className={`px-4 py-2 rounded-lg text-sm transition-all ${dashboardFilter === 'late' ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>متأخرين ({summary!.summary_data.stats.late})</button>
                                <button onClick={() => setDashboardFilter('absent')} className={`px-4 py-2 rounded-lg text-sm transition-all ${dashboardFilter === 'absent' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>غياب ({summary!.summary_data.stats.absent})</button>
                                <button onClick={() => setDashboardFilter('early')} className={`px-4 py-2 rounded-lg text-sm transition-all ${dashboardFilter === 'early' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>مبكر ({summary!.summary_data.stats.present})</button>
                            </div>

                            {/* Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {getDashboardList().map(student => (
                                    <div key={student.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-white/20 transition-all group relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-white font-serif text-lg">{student.name}</h3>
                                                <div className="text-xs text-gray-400">{student.className} - {student.section}</div>
                                            </div>
                                            <span className={`w-2 h-2 rounded-full ${dashboardFilter === 'late' ? 'bg-amber-500' : dashboardFilter === 'absent' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                        </div>
                                        {(dashboardFilter === 'absent' || dashboardFilter === 'late') && (
                                            <div className="mt-4 pt-3 border-t border-white/5">
                                                <button 
                                                    onClick={() => openWhatsApp(student, dashboardFilter as any)}
                                                    className="w-full py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                                >
                                                    <MessageCircle className="w-3 h-3" /> مراسلة ولي الأمر
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {getDashboardList().length === 0 && (
                                    <div className="col-span-full text-center py-12 text-gray-500">لا توجد بيانات مطابقة</div>
                                )}
                            </div>
                        </div>
                    )}
                    </>
                )}

                {/* --- SUB: RECORDS & REPORTS --- */}
                {subTab === 'history' && (
                    <div className="glass-card rounded-3xl p-6">
                         {/* Filter Bar */}
                         <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-8">
                              <div>
                                  <label className="text-xs text-gray-400 mb-1 block">من</label>
                                  <input type="date" className="w-full input-glass p-3 rounded-xl" value={reportFilter.dateFrom} onChange={e => setReportFilter({...reportFilter, dateFrom: e.target.value})} />
                              </div>
                              <div>
                                  <label className="text-xs text-gray-400 mb-1 block">إلى</label>
                                  <input type="date" className="w-full input-glass p-3 rounded-xl" value={reportFilter.dateTo} onChange={e => setReportFilter({...reportFilter, dateTo: e.target.value})} />
                              </div>
                              <div>
                                  <label className="text-xs text-gray-400 mb-1 block">الصف</label>
                                  <select className="w-full input-glass p-3 rounded-xl" value={reportFilter.className} onChange={e => setReportFilter({...reportFilter, className: e.target.value, section: ''})}>
                                      <option value="">الكل</option>
                                      {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs text-gray-400 mb-1 block">الفصل</label>
                                  <select className="w-full input-glass p-3 rounded-xl" value={reportFilter.section} onChange={e => setReportFilter({...reportFilter, section: e.target.value})}>
                                      <option value="">الكل</option>
                                      {classes.length > 0 && reportFilter.className && students.filter(s => s.className === reportFilter.className).map(s => s.section).filter((v, i, a) => a.indexOf(v) === i).map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                              <button onClick={handleGenerateReport} disabled={reportLoading} className="w-full py-3 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500">
                                  {reportLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'عرض السجلات'}
                              </button>
                         </div>

                         {reportData && (
                             <div className="space-y-8 animate-fade-in-up">
                                 
                                 {/* Attendance Table */}
                                 <div>
                                     <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-primary-400"/> سجلات الحضور والغياب</h3>
                                     <div className="overflow-x-auto bg-black/20 rounded-2xl border border-white/5">
                                         <table className="w-full text-right text-sm">
                                             <thead className="text-gray-400 border-b border-white/10 bg-white/5">
                                                 <tr>
                                                     <th className="p-4">التاريخ</th>
                                                     <th className="p-4">الطالب</th>
                                                     <th className="p-4">الصف</th>
                                                     <th className="p-4">الحالة</th>
                                                 </tr>
                                             </thead>
                                             <tbody className="divide-y divide-white/5">
                                                 {reportData.attendance.map((row: any, i: number) => (
                                                     <tr key={i} className="hover:bg-white/5">
                                                         <td className="p-4 font-mono text-gray-300">{row.date}</td>
                                                         <td className="p-4 font-bold text-white">{row.studentName}</td>
                                                         <td className="p-4 text-gray-400">{row.className}</td>
                                                         <td className="p-4">
                                                             {row.status === 'present' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> حضور</span>}
                                                             {row.status === 'late' && <span className="text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3"/> تأخر</span>}
                                                             {row.status === 'absent' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> غياب</span>}
                                                         </td>
                                                     </tr>
                                                 ))}
                                             </tbody>
                                         </table>
                                     </div>
                                 </div>

                                 {/* Exits Table */}
                                 <div>
                                     <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><DoorOpen className="w-5 h-5 text-secondary-400"/> سجلات الاستئذان</h3>
                                     <div className="overflow-x-auto bg-black/20 rounded-2xl border border-white/5">
                                         <table className="w-full text-right text-sm">
                                             <thead className="text-gray-400 border-b border-white/10 bg-white/5">
                                                 <tr>
                                                     <th className="p-4">التاريخ</th>
                                                     <th className="p-4">الطالب</th>
                                                     <th className="p-4">وقت الخروج</th>
                                                     <th className="p-4">السبب</th>
                                                 </tr>
                                             </thead>
                                             <tbody className="divide-y divide-white/5">
                                                 {reportData.exits.map((exit: any, i: number) => {
                                                     const st = students.find(s => s.id === exit.studentId);
                                                     if (!st) return null;
                                                     return (
                                                         <tr key={i} className="hover:bg-white/5">
                                                             <td className="p-4 font-mono text-gray-300">{exit.exit_time.split('T')[0]}</td>
                                                             <td className="p-4 font-bold text-white">{st.name}</td>
                                                             <td className="p-4 font-mono text-gray-400">{new Date(exit.exit_time).toLocaleTimeString('ar-SA')}</td>
                                                             <td className="p-4 text-gray-300">{exit.reason}</td>
                                                         </tr>
                                                     );
                                                 })}
                                                 {reportData.exits.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-500">لا يوجد استئذانات في هذه الفترة</td></tr>}
                                             </tbody>
                                         </table>
                                     </div>
                                 </div>

                             </div>
                         )}
                    </div>
                )}
            </div>
        )}

        {/* ==================== EXITS TAB ==================== */}
        {mainTab === 'exits' && (
            <div className="max-w-2xl mx-auto animate-fade-in">
                 <div className="glass-card p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-500/10 rounded-full blur-[50px]"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-secondary-500/20 rounded-xl text-secondary-400">
                                <DoorOpen className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold font-serif text-white">استمارة استئذان</h2>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">الطالب</label>
                                <select 
                                    className="w-full input-glass p-4 rounded-xl text-lg appearance-none"
                                    onChange={(e) => {
                                        const s = students.find(st => st.id === e.target.value);
                                        setActionStudent(s || null);
                                    }}
                                    value={actionStudent?.id || ''}
                                >
                                    <option value="">اختر الطالب...</option>
                                    {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.className})</option>)}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">سبب الاستئذان</label>
                                <textarea 
                                    className="w-full input-glass p-4 rounded-xl h-32 resize-none text-lg"
                                    placeholder="اكتب السبب بوضوح..."
                                    value={formReason}
                                    onChange={e => setFormReason(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={handleSaveExit}
                                disabled={!actionStudent || !formReason}
                                className="w-full py-4 bg-gradient-to-r from-secondary-600 to-pink-600 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-secondary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                اعتماد وحفظ
                            </button>
                            
                            <p className="text-xs text-center text-gray-500 mt-4">
                                سيتم حفظ الاستئذان في سجلات الطالب والتقارير العامة فوراً.
                            </p>
                        </div>
                    </div>
                 </div>
            </div>
        )}

    </div>
  );
};

export default Supervision;
