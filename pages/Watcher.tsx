
import React, { useEffect, useState } from 'react';
import { db, getLocalISODate } from '../services/db';
import { auth } from '../services/auth';
import { Role, Student, AttendanceRecord, DailySummary } from '../types';
import { Share2, Users, Clock, AlertCircle, CheckCircle, RefreshCcw, Loader2, Search, Send, Check, FileSpreadsheet, Printer, FileText, Edit3 } from 'lucide-react';
import { FileService } from '../services/fileService';

const Watcher: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'early' | 'late' | 'absent'>('early');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  
  // Categorized Data (Calculated Client-Side)
  const [presentList, setPresentList] = useState<Student[]>([]);
  const [lateList, setLateList] = useState<Student[]>([]);
  const [absentList, setAbsentList] = useState<Student[]>([]);

  // Report State
  const [reportExists, setReportExists] = useState(false);
  const [lastSharedAt, setLastSharedAt] = useState<string | null>(null);
  const [lastSharedLogCount, setLastSharedLogCount] = useState(0);

  useEffect(() => {
      // 1. Role Check
      auth.requireRole([Role.WATCHER, Role.SUPERVISOR_GLOBAL, Role.SITE_ADMIN, Role.SCHOOL_ADMIN]);

      // 2. Initial Fetch
      fetchDailyData();

      // 3. Realtime Subscription
      const sub = db.subscribeToAttendance((newRecord) => {
          setLogs(prevLogs => {
              if (prevLogs.find(l => l.studentId === newRecord.studentId)) return prevLogs;
              return [...prevLogs, newRecord];
          });
      });

      return () => {
          sub.unsubscribe();
      };
  }, []);

  // 4. Reactive List Calculation
  useEffect(() => {
      if (students.length === 0) return;

      const presentIds = new Set(logs.filter(l => l.status === 'present').map(l => l.studentId));
      const lateIds = new Set(logs.filter(l => l.status === 'late').map(l => l.studentId));
      
      const pList = students.filter(s => presentIds.has(s.id));
      const lList = students.filter(s => lateIds.has(s.id));
      const aList = students.filter(s => !presentIds.has(s.id) && !lateIds.has(s.id));

      setPresentList(pList);
      setLateList(lList);
      setAbsentList(aList);
  }, [logs, students]);

  const fetchDailyData = async () => {
      setLoading(true);
      try {
          const today = getLocalISODate();
          const [allStudents, todaysLogs, existingSummary] = await Promise.all([
              db.getStudents(),
              db.getAttendance(today), 
              db.getDailySummary(today)
          ]);

          setStudents(allStudents);
          setLogs(todaysLogs);
          
          if (existingSummary) {
              setReportExists(true);
              setLastSharedAt(existingSummary.summary_data.shared_at);
              const stats = existingSummary.summary_data.stats;
              setLastSharedLogCount((stats.present || 0) + (stats.late || 0));
          }

      } catch (e) {
          console.error("Error fetching watcher data", e);
      } finally {
          setLoading(false);
      }
  };

  const handleShareReport = async () => {
      const confirmMessage = reportExists 
          ? 'يوجد تقرير سابق. سيتم تحديث البيانات الحالية في بوابة الإشراف. هل أنت متأكد؟' 
          : 'هل أنت متأكد من اعتماد سجلات اليوم وإرسالها لبوابة الإشراف؟';

      if (window.confirm(confirmMessage)) {
          setSubmitting(true);
          try {
              const user = auth.getSession();
              const today = getLocalISODate();
              const now = new Date().toISOString();
              
              const summary: DailySummary = {
                  date_summary: today,
                  summary_data: {
                      stats: {
                          total: students.length,
                          present: presentList.length,
                          late: lateList.length,
                          absent: absentList.length
                      },
                      details: {
                          present: presentList.map(s => ({ id: s.id, name: s.name })),
                          late: lateList.map(s => ({ id: s.id, name: s.name })),
                          absent: absentList.map(s => ({ id: s.id, name: s.name }))
                      },
                      shared_by: user?.username || 'Unknown',
                      shared_at: now
                  }
              };

              await db.saveDailySummary(summary);
              setReportExists(true);
              setLastSharedAt(now);
              setLastSharedLogCount(logs.length);
              alert(reportExists ? 'تم تحديث التقرير بنجاح' : 'تم اعتماد السجلات وإرسالها للإشراف بنجاح');
          } catch (e) {
              alert('حدث خطأ أثناء إرسال التقرير');
              console.error(e);
          } finally {
              setSubmitting(false);
          }
      }
  };

  // Export Functionality
  const handleExport = (type: 'xlsx' | 'pdf') => {
      const list = getCurrentList();
      const title = `تقرير الحضور - ${activeTab === 'early' ? 'الحضور المبكر' : activeTab === 'late' ? 'المتأخرين' : 'الغياب'} - ${getLocalISODate()}`;
      
      const exportData = list.map(s => {
          const log = logs.find(l => l.studentId === s.id);
          return {
              id: s.id,
              name: s.name,
              class: s.className,
              section: s.section,
              time: log ? new Date(log.timestamp).toLocaleTimeString('ar-SA') : '-',
              status: activeTab === 'early' ? 'حاضر' : activeTab === 'late' ? 'متأخر' : 'غائب'
          };
      });

      const columns = [
          { header: 'المعرف', key: 'id' },
          { header: 'الاسم', key: 'name' },
          { header: 'الصف', key: 'class' },
          { header: 'الفصل', key: 'section' },
          { header: 'الوقت', key: 'time' },
          { header: 'الحالة', key: 'status' }
      ];

      if (type === 'xlsx') {
          FileService.exportToExcel(exportData, title);
      } else {
          FileService.exportToPDF(columns, exportData, title, title);
      }
  };

  const getCurrentList = () => {
      let list: Student[] = [];
      if (activeTab === 'early') list = presentList;
      if (activeTab === 'late') list = lateList;
      if (activeTab === 'absent') list = absentList;
      
      return list.filter(s => 
          s.name.includes(searchTerm) || 
          s.id.includes(searchTerm) ||
          s.className.includes(searchTerm)
      );
  };

  const hasNewData = logs.length > 0 && (!reportExists || logs.length !== lastSharedLogCount);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
           <h2 className="text-3xl font-bold font-serif text-white mb-2 flex items-center gap-3">
              المراقبة اليومية
              {loading && <Loader2 className="w-5 h-5 animate-spin text-primary-400" />}
           </h2>
           <p className="text-gray-400 text-sm">متابعة الحضور المباشر واعتماد التقرير للإشراف</p>
           {lastSharedAt && (
               <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                   <CheckCircle className="w-3 h-3" />
                   آخر إرسال للإشراف: {new Date(lastSharedAt).toLocaleTimeString('ar-SA')}
               </div>
           )}
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
             {/* Update Button */}
             <button 
                onClick={fetchDailyData}
                disabled={loading}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors group"
                title="تحديث البيانات"
             >
                 <RefreshCcw className={`w-5 h-5 text-gray-300 group-hover:rotate-180 transition-transform duration-700 ${loading ? 'animate-spin' : ''}`} />
             </button>

             {/* Share Button */}
             <button 
                onClick={handleShareReport} 
                disabled={submitting || !hasNewData}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-xl shadow-lg transition-all border border-white/10 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    reportExists 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20' 
                    : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white shadow-primary-500/20'
                }`}
             >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    reportExists ? <Edit3 className="w-4 h-4" /> : <Send className="w-4 h-4" />
                )}
                {reportExists ? 'تحديث التقرير اليومي' : 'مشاركة مع الإشراف'}
             </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border-r-4 border-blue-500 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
             <div className="text-gray-400 text-sm font-medium">إجمالي الطلاب</div>
             <div className="p-2 bg-blue-500/10 rounded-lg"><Users className="w-5 h-5 text-blue-400"/></div>
          </div>
          <div className="text-4xl font-bold text-white font-mono tracking-tighter">{students.length}</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border-r-4 border-emerald-500 flex flex-col justify-between h-32">
           <div className="flex justify-between items-start">
             <div className="text-gray-400 text-sm font-medium">حضور مبكر</div>
             <div className="p-2 bg-emerald-500/10 rounded-lg"><CheckCircle className="w-5 h-5 text-emerald-400"/></div>
           </div>
           <div className="text-4xl font-bold text-emerald-400 font-mono tracking-tighter">{presentList.length}</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border-r-4 border-amber-500 flex flex-col justify-between h-32">
           <div className="flex justify-between items-start">
             <div className="text-gray-400 text-sm font-medium">تأخر</div>
             <div className="p-2 bg-amber-500/10 rounded-lg"><Clock className="w-5 h-5 text-amber-400"/></div>
           </div>
           <div className="text-4xl font-bold text-amber-400 font-mono tracking-tighter">{lateList.length}</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border-r-4 border-red-500 flex flex-col justify-between h-32">
           <div className="flex justify-between items-start">
             <div className="text-gray-400 text-sm font-medium">غائب</div>
             <div className="p-2 bg-red-500/10 rounded-lg"><AlertCircle className="w-5 h-5 text-red-400"/></div>
           </div>
           <div className="text-4xl font-bold text-red-400 font-mono tracking-tighter">{absentList.length}</div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="glass-card rounded-3xl overflow-hidden border border-white/10 min-h-[600px] flex flex-col">
        {/* Tabs & Search */}
        <div className="bg-black/20 p-4 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex bg-black/40 rounded-xl p-1 w-full md:w-auto overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('early')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'early' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    مبكر ({presentList.length})
                </button>
                <button 
                    onClick={() => setActiveTab('late')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'late' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    متأخر ({lateList.length})
                </button>
                <button 
                    onClick={() => setActiveTab('absent')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'absent' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    غائب ({absentList.length})
                </button>
            </div>
            
            <div className="flex gap-2 items-center">
                <div className="relative w-full md:w-64 group">
                    <Search className="absolute right-3 top-3 w-4 h-4 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="بحث باسم الطالب..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-primary-500/50 focus:bg-white/10 transition-all"
                    />
                </div>
                
                {/* Export Buttons */}
                <button onClick={() => handleExport('xlsx')} className="p-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-xl text-emerald-400 transition-colors" title="تصدير Excel">
                    <FileSpreadsheet className="w-5 h-5" />
                </button>
                <button onClick={() => handleExport('pdf')} className="p-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/20 rounded-xl text-red-400 transition-colors" title="طباعة PDF">
                    <Printer className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto flex-1 bg-gradient-to-b from-white/5 to-transparent">
            <table className="w-full text-right">
                <thead className="text-xs text-gray-400 bg-white/5 border-b border-white/5 font-medium uppercase tracking-wider">
                    <tr>
                        <th className="p-5">المعرف</th>
                        <th className="p-5">اسم الطالب</th>
                        <th className="p-5">الصف</th>
                        <th className="p-5">الفصل</th>
                        {activeTab !== 'absent' && <th className="p-5">وقت التسجيل</th>}
                        <th className="p-5">الحالة</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {getCurrentList().map((student, idx) => {
                        const log = logs.find(l => l.studentId === student.id);
                        return (
                            <tr key={student.id} className="hover:bg-white/5 transition-colors group animate-fade-in" style={{animationDelay: `${idx * 50}ms`}}>
                                <td className="p-5 font-mono text-primary-300 text-sm opacity-80">{student.id}</td>
                                <td className="p-5 font-bold text-white font-serif text-lg">{student.name}</td>
                                <td className="p-5 text-gray-300 text-sm">{student.className}</td>
                                <td className="p-5 text-gray-300 text-sm">{student.section}</td>
                                {activeTab !== 'absent' && (
                                    <td className="p-5 font-mono text-sm text-gray-400 group-hover:text-white transition-colors">
                                        {log ? new Date(log.timestamp).toLocaleTimeString('ar-SA') : '-'}
                                    </td>
                                )}
                                <td className="p-5">
                                    {activeTab === 'early' && <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded border border-emerald-500/20">حاضر</span>}
                                    {activeTab === 'late' && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded border border-amber-500/20">متأخر</span>}
                                    {activeTab === 'absent' && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/20">غائب</span>}
                                </td>
                            </tr>
                        );
                    })}
                    {getCurrentList().length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-16 text-center text-gray-500 flex flex-col items-center justify-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                    <Search className="w-8 h-8 text-gray-600" />
                                </div>
                                لا توجد بيانات لعرضها في هذه القائمة
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Watcher;
