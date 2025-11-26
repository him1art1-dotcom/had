
import React, { useState, useEffect } from 'react';
import { db, getLocalISODate } from '../services/db';
import { auth } from '../services/auth';
import { Role, Student, AttendanceRecord, ExitRecord, ViolationRecord, Notification } from '../types';
import { Shield, Filter, Search, Clock, AlertTriangle, CheckCircle, Loader2, Calendar, DoorOpen, Bell, FileSpreadsheet, Printer, Plus, Trash2, Send, X } from 'lucide-react';
import { FileService } from '../services/fileService';

const Supervision: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'daily' | 'exits' | 'violations' | 'notifications'>('daily');
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [logs, setLogs] = useState<AttendanceRecord[]>([]);
    const [exits, setExits] = useState<ExitRecord[]>([]);
    const [violations, setViolations] = useState<ViolationRecord[]>([]);
    
    // Filters
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [dashboardFilter, setDashboardFilter] = useState<'early' | 'late' | 'absent'>('late');

    // Modal States
    const [showExitModal, setShowExitModal] = useState(false);
    const [newExit, setNewExit] = useState({ studentId: '', reason: '' });
    
    const [showViolationModal, setShowViolationModal] = useState(false);
    const [newViolation, setNewViolation] = useState({ studentId: '', type: '', description: '', level: 'low' });

    const [showNotifModal, setShowNotifModal] = useState(false);
    const [notifForm, setNotifForm] = useState({ target: 'all', message: '' });

    useEffect(() => {
        auth.requireRole([Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL, Role.SUPERVISOR_CLASS]);
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const today = getLocalISODate();
            const [allStudents, todaysLogs, todayExits, todayViolations] = await Promise.all([
                db.getStudents(),
                db.getAttendance(today),
                db.getTodayExits(),
                db.getTodayViolations()
            ]);
            setStudents(allStudents);
            setLogs(todaysLogs);
            setExits(todayExits);
            setViolations(todayViolations);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Data Processing
    const classes = Array.from(new Set(students.map(s => s.className))).sort();
    const sections = Array.from(new Set(students.map(s => s.section))).sort();

    const presentOnlyCount = logs.filter(l => l.status === 'present').length;
    const lateCount = logs.filter(l => l.status === 'late').length;
    const totalPresent = presentOnlyCount + lateCount; 
    const absentCount = students.length > 0 ? Math.max(0, students.length - totalPresent) : 0;
    
    const kpi = { present: totalPresent, late: lateCount, absent: absentCount };

    // Filtered List for Attendance Tab
    const getFilteredAttendance = () => {
        let filtered = students;
        if (filterClass) filtered = filtered.filter(s => s.className === filterClass);
        if (filterSection) filtered = filtered.filter(s => s.section === filterSection);

        const presentIds = new Set(logs.filter(l => l.status === 'present').map(l => l.studentId));
        const lateIds = new Set(logs.filter(l => l.status === 'late').map(l => l.studentId));
        
        if (dashboardFilter === 'early') filtered = filtered.filter(s => presentIds.has(s.id));
        else if (dashboardFilter === 'late') filtered = filtered.filter(s => lateIds.has(s.id));
        else if (dashboardFilter === 'absent') filtered = filtered.filter(s => !presentIds.has(s.id) && !lateIds.has(s.id));

        return filtered;
    };

    // Handlers
    const handleExport = (type: 'xlsx' | 'pdf', data: any[], title: string, columns: any[]) => {
        if (type === 'xlsx') FileService.exportToExcel(data, title);
        else FileService.exportToPDF(columns, data, title, title);
    };

    const handleAddExit = async () => {
        if (!newExit.studentId || !newExit.reason) return;
        const exitRecord: ExitRecord = {
            id: Math.random().toString(),
            studentId: newExit.studentId,
            reason: newExit.reason,
            exit_time: new Date().toISOString(),
            created_by: auth.getSession()?.username
        };
        await db.addExit(exitRecord);
        setShowExitModal(false);
        setNewExit({ studentId: '', reason: '' });
        fetchData();
        alert('تم تسجيل الخروج');
    };

    const handleAddViolation = async () => {
        if (!newViolation.studentId || !newViolation.type) return;
        const record: ViolationRecord = {
            id: Math.random().toString(),
            studentId: newViolation.studentId,
            type: newViolation.type,
            description: newViolation.description,
            level: newViolation.level as 'low' | 'medium' | 'high',
            created_at: new Date().toISOString()
        };
        await db.addViolation(record);
        setShowViolationModal(false);
        setNewViolation({ studentId: '', type: '', description: '', level: 'low' });
        fetchData();
        alert('تم تسجيل المخالفة');
    };

    const handleSendNotification = async () => {
        if (!notifForm.message) return;
        const notification: Notification = {
            id: Math.random().toString(),
            message: notifForm.message,
            target_audience: notifForm.target as any,
            type: 'general',
            created_at: new Date().toISOString()
        };
        await db.saveNotification(notification);
        setShowNotifModal(false);
        setNotifForm({ target: 'all', message: '' });
        alert('تم إرسال الإشعار');
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-white w-10 h-10" /></div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary-600/20 rounded-2xl border border-primary-500/20">
                        <Shield className="w-8 h-8 text-primary-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif text-white">بوابة الإشراف</h1>
                        <p className="text-gray-400 text-sm">إدارة الحضور، السلوك، والاستئذان</p>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex overflow-x-auto gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                {[
                    { id: 'daily', label: 'الحضور اليومي', icon: Calendar },
                    { id: 'exits', label: 'الاستئذان', icon: DoorOpen },
                    { id: 'violations', label: 'المخالفات', icon: AlertTriangle },
                    { id: 'notifications', label: 'الإشعارات', icon: Bell },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl whitespace-nowrap font-bold transition-all flex-1 justify-center ${
                            activeTab === tab.id 
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* === TAB 1: DAILY ATTENDANCE === */}
            {activeTab === 'daily' && (
                <div className="glass-card rounded-[2.5rem] p-6 border border-white/10 animate-fade-in">
                    {/* KPI Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-bold text-emerald-400">{kpi.present - kpi.late}</div>
                            <div className="text-xs text-emerald-300">حضور مبكر</div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-bold text-amber-400">{kpi.late}</div>
                            <div className="text-xs text-amber-300">تأخر</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-bold text-red-400">{kpi.absent}</div>
                            <div className="text-xs text-red-300">غياب</div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap gap-4 mb-6 justify-between items-center">
                        <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-white/5">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-400">تصفية:</span>
                            </div>
                            <select 
                                className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-primary-500 min-w-[150px]"
                                value={filterClass} 
                                onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
                            >
                                <option value="">كل الصفوف</option>
                                {classes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select 
                                className={`bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-primary-500 min-w-[150px] ${!filterClass ? 'opacity-50 cursor-not-allowed' : ''}`}
                                value={filterSection} 
                                onChange={e => setFilterSection(e.target.value)}
                                disabled={!filterClass}
                            >
                                <option value="">كل الفصول</option>
                                {filterClass && students.filter(s => s.className === filterClass).map(s => s.section).filter((v, i, a) => a.indexOf(v) === i).sort().map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex bg-black/20 rounded-xl p-1">
                                <button onClick={() => setDashboardFilter('early')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'early' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>مبكر</button>
                                <button onClick={() => setDashboardFilter('late')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'late' ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>متأخر</button>
                                <button onClick={() => setDashboardFilter('absent')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardFilter === 'absent' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>غائب</button>
                            </div>
                            <button 
                                onClick={() => {
                                    const data = getFilteredAttendance().map(s => ({ id: s.id, name: s.name, class: s.className, status: dashboardFilter }));
                                    handleExport('xlsx', data, `تقرير_${dashboardFilter}_${getLocalISODate()}`, []);
                                }}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-emerald-400" title="Excel"
                            >
                                <FileSpreadsheet className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => {
                                    const data = getFilteredAttendance().map(s => ({ id: s.id, name: s.name, class: s.className, status: dashboardFilter }));
                                    const cols = [{header: 'ID', key: 'id'}, {header: 'Name', key: 'name'}, {header: 'Class', key: 'class'}];
                                    handleExport('pdf', data, `تقرير_${dashboardFilter}_${getLocalISODate()}`, cols);
                                }}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-red-400" title="PDF"
                            >
                                <Printer className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="text-xs text-gray-400 bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="p-4">المعرف</th>
                                    <th className="p-4">الطالب</th>
                                    <th className="p-4">الصف</th>
                                    <th className="p-4">الحالة</th>
                                    <th className="p-4">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {getFilteredAttendance().length > 0 ? getFilteredAttendance().map((s) => (
                                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-mono text-sm text-gray-400">{s.id}</td>
                                        <td className="p-4 font-bold text-white">{s.name}</td>
                                        <td className="p-4 text-sm text-gray-300">{s.className} - {s.section}</td>
                                        <td className="p-4">
                                            {dashboardFilter === 'late' && <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20 flex w-fit items-center gap-1"><Clock className="w-3 h-3"/> متأخر</span>}
                                            {dashboardFilter === 'absent' && <span className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20 flex w-fit items-center gap-1"><AlertTriangle className="w-3 h-3"/> غائب</span>}
                                            {dashboardFilter === 'early' && <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20 flex w-fit items-center gap-1"><CheckCircle className="w-3 h-3"/> حاضر</span>}
                                        </td>
                                        <td className="p-4 flex gap-2">
                                            <button className="text-xs bg-white/5 px-3 py-1.5 rounded-lg text-gray-300 hover:bg-white/10 border border-white/10">ملف الطالب</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد نتائج</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* === TAB 2: EXITS === */}
            {activeTab === 'exits' && (
                <div className="glass-card rounded-[2.5rem] p-6 border border-white/10 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white text-xl">سجل الاستئذان اليومي</h3>
                        <button onClick={() => setShowExitModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 rounded-xl text-white text-sm font-bold hover:bg-primary-500 shadow-lg"><Plus className="w-4 h-4" /> تسجيل خروج</button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="text-xs text-gray-400 bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="p-4">وقت الخروج</th>
                                    <th className="p-4">الطالب</th>
                                    <th className="p-4">السبب</th>
                                    <th className="p-4">المسؤول</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {exits.map((exit, i) => {
                                    const st = students.find(s => s.id === exit.studentId);
                                    return (
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="p-4 font-mono text-gray-300">{new Date(exit.exit_time).toLocaleTimeString('ar-SA')}</td>
                                            <td className="p-4 font-bold text-white">{st ? st.name : exit.studentId}</td>
                                            <td className="p-4 text-gray-300">{exit.reason}</td>
                                            <td className="p-4 text-xs text-gray-500">{exit.created_by || '-'}</td>
                                        </tr>
                                    );
                                })}
                                {exits.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">لا توجد حالات استئذان اليوم</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* === TAB 3: VIOLATIONS === */}
            {activeTab === 'violations' && (
                <div className="glass-card rounded-[2.5rem] p-6 border border-white/10 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white text-xl">مخالفات اليوم</h3>
                        <button onClick={() => setShowViolationModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-xl text-white text-sm font-bold hover:bg-red-500 shadow-lg"><Plus className="w-4 h-4" /> تسجيل مخالفة</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="text-xs text-gray-400 bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="p-4">الطالب</th>
                                    <th className="p-4">نوع المخالفة</th>
                                    <th className="p-4">الوصف</th>
                                    <th className="p-4">المستوى</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {violations.map((v, i) => {
                                    const st = students.find(s => s.id === v.studentId);
                                    return (
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="p-4 font-bold text-white">{st ? st.name : v.studentId}</td>
                                            <td className="p-4 text-red-400">{v.type}</td>
                                            <td className="p-4 text-gray-300 text-sm">{v.description}</td>
                                            <td className="p-4"><span className="text-xs border border-white/10 px-2 py-1 rounded">{v.level}</span></td>
                                        </tr>
                                    );
                                })}
                                {violations.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">لا توجد مخالفات مسجلة اليوم</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* === TAB 4: NOTIFICATIONS === */}
            {activeTab === 'notifications' && (
                <div className="glass-card rounded-[2.5rem] p-6 border border-white/10 animate-fade-in">
                    <div className="max-w-xl mx-auto bg-white/5 p-6 rounded-3xl border border-white/5">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Bell className="w-5 h-5 text-primary-400" /> إرسال إشعار جديد</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">الجمهور</label>
                                <select className="w-full input-glass p-3 rounded-xl" value={notifForm.target} onChange={e => setNotifForm({...notifForm, target: e.target.value})}>
                                    <option value="all">الجميع (عام)</option>
                                    <option value="guardian">أولياء الأمور</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">الرسالة</label>
                                <textarea 
                                    className="w-full input-glass p-3 rounded-xl h-32 resize-none" 
                                    placeholder="اكتب نص الإشعار..." 
                                    value={notifForm.message}
                                    onChange={e => setNotifForm({...notifForm, message: e.target.value})}
                                />
                            </div>
                            <button onClick={handleSendNotification} className="w-full py-3 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500 flex items-center justify-center gap-2">
                                <Send className="w-4 h-4" /> إرسال الآن
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showExitModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-md rounded-3xl p-6 border border-white/20 relative">
                        <button onClick={() => setShowExitModal(false)} className="absolute left-4 top-4 text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                        <h3 className="text-xl font-bold text-white mb-4">تسجيل خروج طالب</h3>
                        <div className="space-y-4">
                            <select className="w-full input-glass p-3 rounded-xl" value={newExit.studentId} onChange={e => setNewExit({...newExit, studentId: e.target.value})}>
                                <option value="">اختر الطالب...</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input type="text" placeholder="سبب الخروج" className="w-full input-glass p-3 rounded-xl" value={newExit.reason} onChange={e => setNewExit({...newExit, reason: e.target.value})} />
                            <button onClick={handleAddExit} className="w-full py-3 bg-primary-600 rounded-xl text-white font-bold">حفظ</button>
                        </div>
                    </div>
                </div>
            )}

            {showViolationModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-md rounded-3xl p-6 border border-white/20 relative">
                        <button onClick={() => setShowViolationModal(false)} className="absolute left-4 top-4 text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                        <h3 className="text-xl font-bold text-white mb-4">تسجيل مخالفة سلوكية</h3>
                        <div className="space-y-4">
                            <select className="w-full input-glass p-3 rounded-xl" value={newViolation.studentId} onChange={e => setNewViolation({...newViolation, studentId: e.target.value})}>
                                <option value="">اختر الطالب...</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input type="text" placeholder="نوع المخالفة" className="w-full input-glass p-3 rounded-xl" value={newViolation.type} onChange={e => setNewViolation({...newViolation, type: e.target.value})} />
                            <textarea placeholder="وصف المخالفة" className="w-full input-glass p-3 rounded-xl h-24 resize-none" value={newViolation.description} onChange={e => setNewViolation({...newViolation, description: e.target.value})} />
                            <select className="w-full input-glass p-3 rounded-xl" value={newViolation.level} onChange={e => setNewViolation({...newViolation, level: e.target.value})}>
                                <option value="low">منخفض (تنبيه شفهي)</option>
                                <option value="medium">متوسط (تعهد خطي)</option>
                                <option value="high">عالي (استدعاء ولي أمر)</option>
                            </select>
                            <button onClick={handleAddViolation} className="w-full py-3 bg-red-600 rounded-xl text-white font-bold hover:bg-red-500">تسجيل</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Supervision;
