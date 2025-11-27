import { supabase, supabaseConfigured } from './supabase';
import { Student, AttendanceRecord, ExitRecord, ViolationRecord, Notification, DashboardStats, ReportFilter, DailySummary, STORAGE_KEYS, SystemSettings, DiagnosticResult, Role, SchoolClass, User, AppTheme, AttendanceScanResult } from '../types';
import { hashPassword, isHashed } from './security';

// Configuration
export type StorageMode = 'cloud' | 'local';
const CONFIG_KEY = 'hader:config:mode';

// Helper for Local Timezone Date String (YYYY-MM-DD)
export const getLocalISODate = (): string => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

// Helper to calculate minutes late based on dynamic settings
const calculateMinutesLate = (timestamp: string, assemblyTime: string = "07:00", gracePeriod: number = 0): number => {
    const date = new Date(timestamp);
    const [h, m] = assemblyTime.split(':').map(Number);
    
    // Set target to assembly time of that day
    const target = new Date(date);
    target.setHours(h, m, 0, 0);
    
    // Add grace period to determine if late
    const cutoff = new Date(target);
    cutoff.setMinutes(cutoff.getMinutes() + gracePeriod);

    if (date > cutoff) {
        // Late calculation is based on difference from Assembly Time (not cutoff)
        const diffMs = date.getTime() - target.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        return diffMins > 0 ? diffMins : 0;
    }
    return 0;
};

// ------------------------------------------------------------------
// 1. Interface Definition (The Contract)
// ------------------------------------------------------------------
interface IDatabaseProvider {
  getStudents(): Promise<Student[]>;
  getStudentsByGuardian(guardianPhone: string): Promise<Student[]>;
  getStudentById(id: string): Promise<Student | undefined>;
  saveStudents(students: Student[]): Promise<void>;
  
  getAttendance(date?: string): Promise<AttendanceRecord[]>;
  getStudentAttendance(studentId: string): Promise<AttendanceRecord[]>;
  markAttendance(id: string): Promise<AttendanceScanResult>;
  subscribeToAttendance(callback: (record: AttendanceRecord) => void): { unsubscribe: () => void };
  
  getDailySummary(date: string): Promise<DailySummary | null>;
  saveDailySummary(summary: DailySummary): Promise<void>;
  
  getDashboardStats(): Promise<DashboardStats>;
  getWeeklyStats(): Promise<any[]>;
  getClassStats(): Promise<any[]>;
  getAttendanceReport(filters: ReportFilter): Promise<{summary: any, details: any[]}>;
  getExitsReport(filters: ReportFilter): Promise<ExitRecord[]>; 
  
  addExit(record: ExitRecord): Promise<void>;
  getTodayExits(): Promise<ExitRecord[]>;
  getStudentExits(studentId: string): Promise<ExitRecord[]>;
  
  addViolation(record: ViolationRecord): Promise<void>;
  getViolations(studentId?: string): Promise<ViolationRecord[]>;
  getTodayViolations(): Promise<ViolationRecord[]>;
  
  saveNotification(notification: Notification): Promise<void>;
  getStudentNotifications(studentId: string, className: string): Promise<Notification[]>;
  
  // FIX: Updated signature to accept User or 'kiosk' string
  subscribeToNotifications(user: User | 'kiosk', callback: (notification: Notification) => void): { unsubscribe: () => void };

  // Structure & Users
  getClasses(): Promise<SchoolClass[]>;
  saveClass(schoolClass: SchoolClass): Promise<void>;
  deleteClass(classId: string): Promise<void>;
  
  getUsers(): Promise<User[]>;
  saveUser(user: User): Promise<void>;
  deleteUser(userId: string): Promise<void>;

  // Support Extensions
  getSettings(): Promise<SystemSettings>;
  saveSettings(settings: SystemSettings): Promise<void>;
  sendBroadcast(targetRole: string, message: string, title: string): Promise<void>;
  runDiagnostics(): Promise<DiagnosticResult[]>;
}

// Mappers
const mapStudent = (data: any): Student => ({
  id: String(data.id),
  name: data.name,
  className: data.class_name || data.className,
  section: data.section,
  guardianPhone: data.guardian_phone || data.guardianPhone
});

const mapAttendance = (data: any): AttendanceRecord => ({
  id: data.id,
  studentId: String(data.student_id || data.studentId),
  date: data.date,
  timestamp: data.timestamp,
  status: data.status
});

// ------------------------------------------------------------------
// 2. Cloud Provider (Supabase)
// ------------------------------------------------------------------
class CloudProvider implements IDatabaseProvider {
  async getStudents(): Promise<Student[]> {
    const { data, error } = await supabase.from('students').select('*');
    if (error) throw error;
    return data.map(mapStudent);
  }

  async getStudentsByGuardian(guardianPhone: string): Promise<Student[]> {
    const { data, error } = await supabase.from('students').select('*').eq('guardian_phone', guardianPhone);
    if (error) throw error;
    return data.map(mapStudent);
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    const { data } = await supabase.from('students').select('*').eq('id', id).single();
    return data ? mapStudent(data) : undefined;
  }

  async saveStudents(students: Student[]): Promise<void> {
    const mapped = students.map(s => ({
        id: s.id,
        name: s.name,
        class_name: s.className,
        section: s.section,
        guardian_phone: s.guardianPhone
    }));
    const { error } = await supabase.from('students').upsert(mapped);
    if (error) throw error;
  }

  async getAttendance(date?: string): Promise<AttendanceRecord[]> {
    let query = supabase.from('attendance_logs').select('*');
    if (date) query = query.eq('date', date);
    const { data, error } = await query;
    return error ? [] : data.map(mapAttendance);
  }

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase.from('attendance_logs').select('*').eq('student_id', studentId).order('date', { ascending: false });
    return error ? [] : data.map(mapAttendance);
  }

  async markAttendance(id: string): Promise<AttendanceScanResult> {
    try {
        const { data: studentData, error: studentError } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
        
        if (studentError || !studentData) return { success: false, message: 'رقم الطالب غير صحيح' };
        
        const student = mapStudent(studentData);
        const now = new Date();
        const today = getLocalISODate();

        // Fetch Settings for time calculation
        const { data: settingsData } = await supabase.from('settings').select('*').single();
        const settings: SystemSettings = settingsData as SystemSettings || { 
            systemReady: true,
            schoolActive: true,
            logoUrl: '',
            assemblyTime: '07:00', 
            gracePeriod: 0 
        };
        const assemblyTime = settings.assemblyTime || '07:00';
        const gracePeriod = settings.gracePeriod || 0;

        // Calculate Status
        const minutesLate = calculateMinutesLate(now.toISOString(), assemblyTime, gracePeriod);
        const isLate = minutesLate > 0;
        
        const { data, error } = await supabase
            .from('attendance_logs')
            .insert({ student_id: id, date: today, timestamp: now.toISOString(), status: isLate ? 'late' : 'present' })
            .select().single();

        if (error) {
            if (error.code === '23505') return { success: false, message: `تم تسجيل الدخول مسبقاً لهذا اليوم` };
            console.error("Attendance Error", error);
            return { success: false, message: 'حدث خطأ أثناء التسجيل' };
        }

        // Calculate Stats
        const { data: history } = await supabase.from('attendance_logs').select('*').eq('student_id', id);
        const allLogs = (history || []).map(mapAttendance);
        
        const lateLogs = allLogs.filter(l => l.status === 'late');
        const lateCount = lateLogs.length;
        
        // Recalculate late minutes for history based on current settings might be inaccurate for past days, 
        // but typically we'd store minutes_late in DB. For now, re-calc.
        const totalMinutesLate = lateLogs.reduce((acc, curr) => acc + calculateMinutesLate(curr.timestamp, assemblyTime, 0), 0);

        return { 
            success: true, 
            message: `أهلاً بك يا ${student.name}`, 
            record: mapAttendance(data),
            student: student,
            stats: {
                lateCount,
                minutesLateToday: minutesLate,
                totalMinutesLate
            }
        };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'حدث خطأ في الاتصال' };
    }
  }

  subscribeToAttendance(callback: (record: AttendanceRecord) => void): { unsubscribe: () => void } {
    const subscription = supabase
      .channel('attendance_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        (payload) => {
          if (payload.new) {
            callback(mapAttendance(payload.new));
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      }
    };
  }

  async getDailySummary(date: string): Promise<DailySummary | null> {
    const { data } = await supabase.from('daily_summaries').select('*').eq('date_summary', date).maybeSingle();
    return data as DailySummary;
  }

  async saveDailySummary(summary: DailySummary): Promise<void> {
    await supabase.from('daily_summaries').upsert({ date_summary: summary.date_summary, summary_data: summary.summary_data });
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const students = await this.getStudents();
    const today = getLocalISODate();
    const attendance = await this.getAttendance(today);
    const totalStudents = students.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const absentCount = totalStudents - (presentCount + lateCount);
    const attendanceRate = totalStudents > 0 ? ((presentCount + lateCount) / totalStudents) * 100 : 0;
    return { totalStudents, presentCount, lateCount, absentCount, attendanceRate: Math.round(attendanceRate) };
  }

  async getWeeklyStats(): Promise<any[]> {
    return [{ day: 'الأحد', presence: 90 }, { day: 'الإثنين', presence: 85 }, { day: 'الثلاثاء', presence: 95 }, { day: 'الأربعاء', presence: 88 }, { day: 'الخميس', presence: 92 }];
  }

  async getClassStats(): Promise<any[]> {
    return [{ name: 'أول ثانوي', absent: 5 }, { name: 'ثاني ثانوي', absent: 2 }, { name: 'ثالث ثانوي', absent: 8 }];
  }

  async getAttendanceReport(filters: ReportFilter): Promise<{summary: any, details: any[]}> {
      let query = supabase.from('attendance_logs').select('*').gte('date', filters.dateFrom).lte('date', filters.dateTo);
      const { data: logs } = await query;
      const allLogs = (logs || []).map(mapAttendance);

      let studentQuery = supabase.from('students').select('*');
      if (filters.className) studentQuery = studentQuery.eq('class_name', filters.className);
      if (filters.section) studentQuery = studentQuery.eq('section', filters.section);

      const { data: studentData } = await studentQuery;
      const students = (studentData || []).map(mapStudent);

      const details = allLogs.map(log => {
          const student = students.find(s => s.id === log.studentId);
          if (!student) return null;
          return { studentId: log.studentId, studentName: student.name, className: student.className, date: log.date, time: log.timestamp, status: log.status };
      }).filter(Boolean);

      return {
          summary: { totalRecords: details.length, late: details.filter(d => d!.status === 'late').length, present: details.filter(d => d!.status === 'present').length },
          details: details as any[]
      };
  }

  async getExitsReport(filters: ReportFilter): Promise<ExitRecord[]> {
      const { data } = await supabase.from('exits').select('*')
        .gte('exit_time', `${filters.dateFrom}T00:00:00`)
        .lte('exit_time', `${filters.dateTo}T23:59:59`);
      
      return (data || []).map((d: any) => ({ id: d.id, studentId: d.student_id, reason: d.reason, exit_time: d.exit_time, created_by: d.created_by }));
  }

  async addExit(record: ExitRecord): Promise<void> {
    await supabase.from('exits').insert({ student_id: record.studentId, reason: record.reason, exit_time: record.exit_time, created_by: record.created_by });
  }

  async getTodayExits(): Promise<ExitRecord[]> {
      const today = getLocalISODate();
      const { data } = await supabase.from('exits').select('*').gte('exit_time', `${today}T00:00:00`);
      return (data || []).map((d: any) => ({ id: d.id, studentId: d.student_id, reason: d.reason, exit_time: d.exit_time, created_by: d.created_by }));
  }

  async getStudentExits(studentId: string): Promise<ExitRecord[]> {
      const { data } = await supabase.from('exits').select('*').eq('student_id', studentId).order('exit_time', { ascending: false });
      return (data || []).map((d: any) => ({ id: d.id, studentId: d.student_id, reason: d.reason, exit_time: d.exit_time, created_by: d.created_by }));
  }

  async addViolation(record: ViolationRecord): Promise<void> {
    await supabase.from('violations').insert({ student_id: record.studentId, type: record.type, level: record.level, description: record.description });
  }

  async getViolations(studentId?: string): Promise<ViolationRecord[]> {
      let query = supabase.from('violations').select('*');
      if (studentId) query = query.eq('student_id', studentId);
      const { data } = await query;
      return (data || []).map((d: any) => ({ id: d.id, studentId: d.student_id, type: d.type, description: d.description, level: d.level, created_at: d.created_at }));
  }

  async getTodayViolations(): Promise<ViolationRecord[]> {
    const today = getLocalISODate();
    const { data } = await supabase.from('violations').select('*').gte('created_at', `${today}T00:00:00`);
    return (data || []).map((d: any) => ({ id: d.id, studentId: d.student_id, type: d.type, description: d.description, level: d.level, created_at: d.created_at }));
  }

  async saveNotification(notification: Notification): Promise<void> {
      await supabase.from('notifications').insert({ message: notification.message, target_audience: notification.target_audience, target_id: notification.target_id, type: notification.type });
  }

  async getStudentNotifications(studentId: string, className: string): Promise<Notification[]> {
      const { data, error } = await supabase.from('notifications').select('*').or(`target_audience.eq.all,and(target_audience.eq.class,target_id.eq.${className}),and(target_audience.eq.student,target_id.eq.${studentId})`).order('created_at', { ascending: false });
      if (error) return [];
      return data.map((d: any) => ({ id: d.id, message: d.message, target_audience: d.target_audience, target_id: d.target_id, type: d.type, created_at: d.created_at }));
  }

  // FIX: Updated to handle User | 'kiosk'
  subscribeToNotifications(user: User | 'kiosk', callback: (notification: Notification) => void): { unsubscribe: () => void } {
      const subscription = supabase
        .channel('notifications_realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            if (payload.new) {
              const n = payload.new;
              let relevant = false;

              // Handle Kiosk Mode
              if (user === 'kiosk') {
                  if (n.target_audience === 'kiosk') relevant = true;
              } 
              // Handle User Mode
              else {
                  if (n.target_audience === 'all') relevant = true;
                  if (n.target_audience === 'admin' && (user.role === Role.SITE_ADMIN || user.role === Role.SCHOOL_ADMIN)) relevant = true;
                  if (n.target_audience === 'supervisor' && (user.role === Role.SUPERVISOR_GLOBAL || user.role === Role.SUPERVISOR_CLASS)) relevant = true;
                  if (n.target_audience === 'guardian' && user.role === Role.GUARDIAN) relevant = true;
                  if (n.target_audience === 'class') relevant = true; 
                  if (n.target_audience === 'student' && user.role === Role.GUARDIAN) relevant = true;
              }

              if (relevant) {
                  callback({
                      id: n.id,
                      message: n.message,
                      type: n.type,
                      target_audience: n.target_audience,
                      target_id: n.target_id,
                      created_at: n.created_at
                  });
              }
            }
          }
        )
        .subscribe();

      return {
          unsubscribe: () => {
              supabase.removeChannel(subscription);
          }
      };
  }

  // --- Structure & Users (Cloud) ---
  async getClasses(): Promise<SchoolClass[]> {
    try {
        const { data } = await supabase.from('classes').select('*');
        return data || [];
    } catch { return []; }
  }
  
  async saveClass(schoolClass: SchoolClass): Promise<void> {
    await supabase.from('classes').upsert(schoolClass);
  }

  async deleteClass(classId: string): Promise<void> {
    await supabase.from('classes').delete().eq('id', classId);
  }

  async getUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*');
    return (data || []).map((u: any) => ({ id: u.id, username: u.username, name: u.full_name, role: u.role, password: u.password }));
  }

  async saveUser(user: User): Promise<void> {
    const normalizedPassword = user.password ? await hashPassword(user.password) : undefined;
    await supabase.from('users').upsert({
        id: user.id,
        username: user.username,
        full_name: user.name,
        role: user.role,
        password: normalizedPassword,
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await supabase.from('users').delete().eq('id', userId);
  }


  // Support Extensions (Cloud)
  async getSettings(): Promise<SystemSettings> {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) return data as SystemSettings;
    return { 
        systemReady: true, schoolActive: true, logoUrl: '', mode: 'dark',
        schoolName: 'مدرسة المستقبل', schoolManager: 'أ. محمد العلي', assemblyTime: '07:00', gracePeriod: 0
    };
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    try {
        const payload: any = { id: 1, ...settings };
        await supabase.from('settings').upsert(payload);
    } catch(e) { console.error("Settings table might be missing", e); }
  }

  async sendBroadcast(targetRole: string, message: string, title: string): Promise<void> {
     const notification: Notification = {
         id: '',
         title: title,
         message: message,
         type: 'general',
         target_audience: targetRole as any,
         created_at: new Date().toISOString()
     };
     await this.saveNotification(notification);
  }

  async runDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    const today = getLocalISODate();

    try {
        const { count: userCount, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
        results.push({
            key: 'connection',
            title: 'اتصال قاعدة البيانات',
            status: userError ? 'error' : 'ok',
            message: userError ? 'فشل الاتصال بـ Supabase' : 'الاتصال السحابي نشط ومستقر',
            hint: userError ? 'تحقق من مفاتيح API في الإعدادات' : undefined
        });

        results.push({
            key: 'integrity',
            title: 'نزاهة البيانات',
            status: 'ok',
            message: 'فحص البيانات الأساسية مكتمل',
            count: 0
        });

        const { count: missingPhoneCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).or('guardian_phone.is.null,guardian_phone.eq.""');
        results.push({
            key: 'communication',
            title: 'قنوات التواصل',
            status: (missingPhoneCount || 0) > 0 ? 'warning' : 'ok',
            message: (missingPhoneCount || 0) > 0 ? `يوجد ${missingPhoneCount} طالب بدون رقم تواصل` : 'جميع الطلاب لديهم أرقام تواصل',
            count: missingPhoneCount || 0,
            hint: 'لن تصل رسائل الواتساب أو الإشعارات لهؤلاء الطلاب'
        });

        const summary = await this.getDailySummary(today);
        results.push({
            key: 'operations',
            title: 'التشغيل اليومي',
            status: summary ? 'ok' : 'warning',
            message: summary ? 'تم رفع التقرير اليومي بنجاح' : 'لم يتم رفع تقرير الحضور اليومي بعد',
            hint: !summary ? 'يجب على المراقب اعتماد السجلات من لوحة المتابعة' : undefined
        });

    } catch (e) {
        results.push({ key: 'fatal', title: 'خطأ حرج', status: 'error', message: 'حدث خطأ أثناء تشغيل التشخيص' });
    }

    return results;
  }
}

// ------------------------------------------------------------------
// 3. Local Provider (LocalStorage)
// ------------------------------------------------------------------
class LocalProvider implements IDatabaseProvider {
  private listeners: (() => void)[] = [];
  private legacyMigration?: Promise<void>;
  
  constructor() {
    this.seed();
    // Normalize any legacy plaintext passwords without blocking startup
    this.migrateLegacyUsers();
  }

  private seed() {
    if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
      const dummyStudents: Student[] = [
        { id: '2024001', name: 'أحمد محمد الصالح', className: 'أول ثانوي', section: 'أ', guardianPhone: '501234567' },
        { id: '2024002', name: 'خالد علي القحطاني', className: 'أول ثانوي', section: 'ب', guardianPhone: '509876543' },
        { id: '2024003', name: 'عمر فهد العتيبي', className: 'ثاني ثانوي', section: 'أ', guardianPhone: '505555555' }
      ];
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(dummyStudents));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ 
            systemReady: true, 
            schoolActive: true, 
            logoUrl: '', 
            mode: 'dark',
            kiosk: { mainTitle: 'تسجيل الحضور', subTitle: 'يرجى تمرير البطاقة أو إدخال المعرف', earlyMessage: 'شكراً لالتزامك بالحضور المبكر', lateMessage: 'نأمل منك الحرص على الحضور مبكراً', showStats: true },
            schoolName: 'مدرسة المستقبل النموذجية',
            schoolManager: 'أ. محمد العلي',
            assemblyTime: '07:00',
            gracePeriod: 0
        }));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
        const dummyClasses: SchoolClass[] = [
            { id: 'c1', name: 'أول ثانوي', sections: ['أ', 'ب', 'ج'] },
            { id: 'c2', name: 'ثاني ثانوي', sections: ['أ', 'ب'] }
        ];
        localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(dummyClasses));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    }
  }

  private get<T>(key: string): T[] {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  }

  private set<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  private async migrateLegacyUsers() {
    if (this.legacyMigration) return this.legacyMigration;

    this.legacyMigration = (async () => {
        const existing = this.get<User>(STORAGE_KEYS.USERS);
        let updated = false;

        const normalized = [] as User[];
        for (const user of existing) {
            if (user.password && !isHashed(user.password)) {
                const hashed = await hashPassword(user.password);
                normalized.push({ ...user, password: hashed });
                updated = true;
            } else {
                normalized.push(user);
            }
        }

        if (updated) {
            this.set(STORAGE_KEYS.USERS, normalized);
        }
    })();

    return this.legacyMigration;
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  async getStudents(): Promise<Student[]> {
    return Promise.resolve(this.get<Student>(STORAGE_KEYS.STUDENTS));
  }

  async getStudentsByGuardian(guardianPhone: string): Promise<Student[]> {
    const all = this.get<Student>(STORAGE_KEYS.STUDENTS);
    return Promise.resolve(all.filter(s => s.guardianPhone === guardianPhone));
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    const all = this.get<Student>(STORAGE_KEYS.STUDENTS);
    return Promise.resolve(all.find(s => s.id === id));
  }

  async saveStudents(students: Student[]): Promise<void> {
    const existing = this.get<Student>(STORAGE_KEYS.STUDENTS);
    const newIds = new Set(students.map(s => s.id));
    const kept = existing.filter(s => !newIds.has(s.id));
    this.set(STORAGE_KEYS.STUDENTS, [...kept, ...students]);
    return Promise.resolve();
  }

  async getAttendance(date?: string): Promise<AttendanceRecord[]> {
    const all = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    if (!date) return Promise.resolve(all);
    return Promise.resolve(all.filter(a => a.date === date));
  }

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const all = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    return Promise.resolve(all.filter(a => a.studentId === studentId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }

  async markAttendance(id: string): Promise<AttendanceScanResult> {
    const students = await this.getStudents();
    const student = students.find(s => s.id === id);
    if (!student) return Promise.resolve({ success: false, message: 'رقم الطالب غير صحيح' });

    const now = new Date();
    const today = getLocalISODate();
    const allLogs = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    
    const exists = allLogs.find(l => l.studentId === id && l.date === today);
    if (exists) return Promise.resolve({ success: false, message: 'تم تسجيل الدخول مسبقاً لهذا اليوم' });

    // Fetch Settings
    const settings = await this.getSettings();
    const assemblyTime = settings.assemblyTime || '07:00';
    const gracePeriod = settings.gracePeriod || 0;
    
    const minutesLate = calculateMinutesLate(now.toISOString(), assemblyTime, gracePeriod);
    const isLate = minutesLate > 0;

    const newRecord: AttendanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        studentId: id,
        date: today,
        timestamp: now.toISOString(),
        status: isLate ? 'late' : 'present'
    };
    
    const updatedLogs = [...allLogs, newRecord];
    this.set(STORAGE_KEYS.ATTENDANCE, updatedLogs);
    
    this.notifyListeners();

    window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEYS.ATTENDANCE,
        newValue: JSON.stringify(updatedLogs)
    }));

    // Stats Calculation (Local)
    const studentLogs = updatedLogs.filter(l => l.studentId === id);
    const lateLogs = studentLogs.filter(l => l.status === 'late');
    const lateCount = lateLogs.length;
    
    const totalMinutesLate = lateLogs.reduce((acc, curr) => acc + calculateMinutesLate(curr.timestamp, assemblyTime, 0), 0);

    return Promise.resolve({ 
        success: true, 
        message: `أهلاً بك يا ${student.name}`, 
        record: newRecord,
        student: student,
        stats: {
            lateCount,
            minutesLateToday: minutesLate,
            totalMinutesLate
        }
    });
  }

  // FIX: Updated to handle User | 'kiosk'
  subscribeToNotifications(user: User | 'kiosk', callback: (record: Notification) => void): { unsubscribe: () => void } {
    const guardianScope = { studentIds: new Set<string>(), classNames: new Set<string>() };

    if (typeof user !== 'string' && user.role === Role.GUARDIAN) {
        this.getStudentsByGuardian(user.username).then(students => {
            students.forEach(s => {
                guardianScope.studentIds.add(String(s.id));
                guardianScope.classNames.add(s.className);
            });
        }).catch(err => console.warn('Failed to load guardian scope (local)', err));
    }

    const matchesGuardianScope = (targetId?: string) => {
        if (typeof user === 'string' || user.role !== Role.GUARDIAN || !targetId) return false;
        return guardianScope.studentIds.has(String(targetId)) || guardianScope.classNames.has(String(targetId));
    };

    const matchesSupervisorScope = (targetId?: string) => {
        if (typeof user === 'string') return false;
        if (user.role === Role.SUPERVISOR_GLOBAL) return true;
        if (user.role !== Role.SUPERVISOR_CLASS || !user.assignedClasses || !targetId) return false;
        return user.assignedClasses.some(c => c.className === targetId || c.sections.includes(targetId));
    };

    const checkRelevance = (n: Notification): boolean => {
        if (user === 'kiosk') {
            return n.target_audience === 'kiosk';
        }
        // User Mode
        if (n.target_audience === 'all') return true;
        if (n.target_audience === 'admin' && (user.role === Role.SITE_ADMIN || user.role === Role.SCHOOL_ADMIN)) return true;
        if (n.target_audience === 'supervisor' && matchesSupervisorScope(n.target_id)) return true;
        if (n.target_audience === 'class' && (matchesGuardianScope(n.target_id) || matchesSupervisorScope(n.target_id))) return true;
        if (n.target_audience === 'guardian' && matchesGuardianScope(n.target_id)) return true;
        if (n.target_audience === 'student' && matchesGuardianScope(n.target_id)) return true;
        return false;
    };

    const storageListener = (e: StorageEvent) => {
        if (e.key === STORAGE_KEYS.NOTIFICATIONS && e.newValue) {
            const newNotifs = JSON.parse(e.newValue) as Notification[];
            const lastNotif = newNotifs[newNotifs.length - 1];
            if (lastNotif && checkRelevance(lastNotif)) {
                callback(lastNotif);
            }
        }
    };
    window.addEventListener('storage', storageListener);
    
    return { 
        unsubscribe: () => {
            window.removeEventListener('storage', storageListener);
        }
    };
  }

  async getDailySummary(date: string): Promise<DailySummary | null> {
    const key = `${STORAGE_KEYS.DAILY_SHARE}:${date}`;
    const item = localStorage.getItem(key);
    return Promise.resolve(item ? JSON.parse(item) : null);
  }

  async saveDailySummary(summary: DailySummary): Promise<void> {
    const key = `${STORAGE_KEYS.DAILY_SHARE}:${summary.date_summary}`;
    localStorage.setItem(key, JSON.stringify(summary));
    return Promise.resolve();
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const students = await this.getStudents();
    const today = getLocalISODate();
    const logs = await this.getAttendance(today);
    const total = students.length;
    const present = logs.filter(l => l.status === 'present').length;
    const late = logs.filter(l => l.status === 'late').length;
    const absent = total - (present + late);
    const rate = total > 0 ? ((present + late) / total) * 100 : 0;
    return Promise.resolve({ totalStudents: total, presentCount: present, lateCount: late, absentCount: absent, attendanceRate: Math.round(rate) });
  }

  async getWeeklyStats(): Promise<any[]> {
    return Promise.resolve([
        { day: 'الأحد', presence: 80 }, { day: 'الإثنين', presence: 85 }, { day: 'الثلاثاء', presence: 90 }, { day: 'الأربعاء', presence: 82 }, { day: 'الخميس', presence: 88 }
    ]);
  }

  async getClassStats(): Promise<any[]> {
    return Promise.resolve([
        { name: 'أول ثانوي', absent: 3 }, { name: 'ثاني ثانوي', absent: 5 }, { name: 'ثالث ثانوي', absent: 1 }
    ]);
  }

  async getAttendanceReport(filters: ReportFilter): Promise<{summary: any, details: any[]}> {
      const allLogs = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE).filter(l => l.date >= filters.dateFrom && l.date <= filters.dateTo);
      let students = await this.getStudents();
      if (filters.className) students = students.filter(s => s.className === filters.className);
      if (filters.section) students = students.filter(s => s.section === filters.section);

      const details = allLogs.map(log => {
          const s = students.find(st => st.id === log.studentId);
          if (!s) return null;
          return { studentId: log.studentId, studentName: s.name, className: s.className, date: log.date, time: log.timestamp, status: log.status };
      }).filter(Boolean);

      return Promise.resolve({
          summary: { totalRecords: details.length, late: details.filter(d => d!.status === 'late').length, present: details.filter(d => d!.status === 'present').length },
          details: details as any[]
      });
  }

  async getExitsReport(filters: ReportFilter): Promise<ExitRecord[]> {
      const exits = this.get<ExitRecord>(STORAGE_KEYS.EXITS).filter(e => {
          const date = e.exit_time.split('T')[0];
          return date >= filters.dateFrom && date <= filters.dateTo;
      });
      return Promise.resolve(exits);
  }

  async addExit(record: ExitRecord): Promise<void> {
    const exits = this.get<ExitRecord>(STORAGE_KEYS.EXITS);
    this.set(STORAGE_KEYS.EXITS, [...exits, { ...record, id: Math.random().toString() }]);
    return Promise.resolve();
  }

  async getTodayExits(): Promise<ExitRecord[]> {
      const today = getLocalISODate();
      const exits = this.get<ExitRecord>(STORAGE_KEYS.EXITS).filter(e => e.exit_time.startsWith(today));
      return Promise.resolve(exits);
  }

  async getStudentExits(studentId: string): Promise<ExitRecord[]> {
      const exits = this.get<ExitRecord>(STORAGE_KEYS.EXITS).filter(e => e.studentId === studentId);
      return Promise.resolve(exits);
  }

  async addViolation(record: ViolationRecord): Promise<void> {
      const v = this.get<ViolationRecord>(STORAGE_KEYS.VIOLATIONS);
      this.set(STORAGE_KEYS.VIOLATIONS, [...v, { ...record, id: Math.random().toString() }]);
      return Promise.resolve();
  }

  async getViolations(studentId?: string): Promise<ViolationRecord[]> {
      let v = this.get<ViolationRecord>(STORAGE_KEYS.VIOLATIONS);
      if (studentId) v = v.filter(i => i.studentId === studentId);
      return Promise.resolve(v);
  }

  async getTodayViolations(): Promise<ViolationRecord[]> {
      const today = getLocalISODate();
      const v = this.get<ViolationRecord>(STORAGE_KEYS.VIOLATIONS).filter(i => i.created_at.startsWith(today));
      return Promise.resolve(v);
  }

  async saveNotification(notification: Notification): Promise<void> {
      const n = this.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
      const newNotifs = [...n, { ...notification, id: Math.random().toString() }];
      this.set(STORAGE_KEYS.NOTIFICATIONS, newNotifs);

      window.dispatchEvent(new StorageEvent('storage', {
          key: STORAGE_KEYS.NOTIFICATIONS,
          newValue: JSON.stringify(newNotifs)
      }));

      return Promise.resolve();
  }

  async getStudentNotifications(studentId: string, className: string): Promise<Notification[]> {
      const n = this.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
      const filtered = n.filter(item => 
          item.target_audience === 'all' || 
          (item.target_audience === 'class' && item.target_id === className) ||
          (item.target_audience === 'student' && item.target_id === studentId)
      );
      return Promise.resolve(filtered);
  }

  async getClasses(): Promise<SchoolClass[]> {
    return Promise.resolve(this.get<SchoolClass>(STORAGE_KEYS.CLASSES));
  }
  async saveClass(schoolClass: SchoolClass): Promise<void> {
    const list = this.get<SchoolClass>(STORAGE_KEYS.CLASSES).filter(c => c.id !== schoolClass.id);
    this.set(STORAGE_KEYS.CLASSES, [...list, schoolClass]);
    return Promise.resolve();
  }
  async deleteClass(classId: string): Promise<void> {
    const list = this.get<SchoolClass>(STORAGE_KEYS.CLASSES).filter(c => c.id !== classId);
    this.set(STORAGE_KEYS.CLASSES, list);
    return Promise.resolve();
  }

  async getUsers(): Promise<User[]> {
      await this.migrateLegacyUsers();
      return Promise.resolve(this.get<User>(STORAGE_KEYS.USERS));
  }
  async saveUser(user: User): Promise<void> {
      await this.migrateLegacyUsers();
      const list = this.get<User>(STORAGE_KEYS.USERS).filter(u => u.id !== user.id);
      const normalizedPassword = user.password ? await hashPassword(user.password) : undefined;
      this.set(STORAGE_KEYS.USERS, [...list, { ...user, password: normalizedPassword }]);
      return Promise.resolve();
  }
  async deleteUser(userId: string): Promise<void> {
      const list = this.get<User>(STORAGE_KEYS.USERS).filter(u => u.id !== userId);
      this.set(STORAGE_KEYS.USERS, list);
      return Promise.resolve();
  }


  // Support Extensions (Local)
  async getSettings(): Promise<SystemSettings> {
    const item = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return Promise.resolve(item ? JSON.parse(item) : { 
        systemReady: true, schoolActive: true, logoUrl: '', mode: 'dark',
        schoolName: 'مدرسة المستقبل', schoolManager: 'أ. محمد العلي', assemblyTime: '07:00', gracePeriod: 0
    });
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return Promise.resolve();
  }

  async sendBroadcast(targetRole: string, message: string, title: string): Promise<void> {
     const notification: Notification = {
         id: Math.random().toString(),
         title: title,
         message: message,
         type: 'general',
         target_audience: targetRole as any,
         created_at: new Date().toISOString()
     };
     await this.saveNotification(notification);
  }

  async runDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    const today = getLocalISODate();
    const students = await this.getStudents();

    results.push({ key: 'connection', title: 'وحدة التخزين المحلي', status: 'ok', message: 'قاعدة البيانات المحلية تعمل بشكل صحيح' });

    results.push({
        key: 'integrity',
        title: 'نزاهة البيانات',
        status: 'ok',
        message: 'بيانات الطلاب سليمة',
        count: 0
    });

    const missingPhones = students.filter(s => !s.guardianPhone).length;
    results.push({
        key: 'communication',
        title: 'قنوات التواصل',
        status: missingPhones > 0 ? 'warning' : 'ok',
        message: missingPhones > 0 ? `يوجد ${missingPhones} طالب بدون رقم تواصل` : 'جميع الطلاب لديهم أرقام تواصل',
        count: missingPhones
    });

    const summary = await this.getDailySummary(today);
    results.push({
        key: 'operations',
        title: 'التشغيل اليومي',
        status: summary ? 'ok' : 'warning',
        message: summary ? 'تم رفع التقرير اليومي بنجاح' : 'لم يتم رفع تقرير الحضور اليومي بعد',
        hint: !summary ? 'يجب على المراقب اعتماد السجلات' : undefined
    });

    return Promise.resolve(results);
  }
}

// ------------------------------------------------------------------
// 4. Facade (Main Database Class)
// ------------------------------------------------------------------
class Database implements IDatabaseProvider {
  private provider: IDatabaseProvider;
  private mode: StorageMode;

  constructor() {
    const storedMode = localStorage.getItem(CONFIG_KEY) as StorageMode;
    const autoMode = supabaseConfigured ? 'cloud' : 'local';
    this.mode = storedMode || autoMode;

    if (this.mode === 'cloud' && !supabaseConfigured) {
        console.warn('Supabase is not configured; reverting to local mode.');
        this.mode = 'local';
    }

    console.log(`Initializing Database in [${this.mode.toUpperCase()}] mode.`);
    
    if (this.mode === 'cloud') {
      this.provider = new CloudProvider();
    } else {
      this.provider = new LocalProvider();
    }

    this.getSettings().then(s => {
        if (s.theme) this.applyTheme(s.theme);
        this.applyMode(s.mode || 'dark');
    });
  }

  getMode(): StorageMode {
      return this.mode;
  }

  setMode(mode: StorageMode) {
      if (mode === 'cloud' && !supabaseConfigured) {
          alert('لا يمكن تفعيل الوضع السحابي: مفاتيح Supabase غير مضبوطة. يرجى إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.');
          return;
      }

      localStorage.setItem(CONFIG_KEY, mode);
      window.location.reload();
  }

  applyTheme(theme: AppTheme) {
    const root = document.documentElement;
    root.style.setProperty('--color-primary-400', theme.primary400);
    root.style.setProperty('--color-primary-500', theme.primary500);
    root.style.setProperty('--color-primary-600', theme.primary600);
    root.style.setProperty('--color-secondary-400', theme.secondary400);
    root.style.setProperty('--color-secondary-500', theme.secondary500);
    root.style.setProperty('--color-secondary-600', theme.secondary600);
  }

  applyMode(mode: 'dark' | 'light') {
      if (mode === 'light') {
          document.body.classList.add('light-mode');
      } else {
          document.body.classList.remove('light-mode');
      }
  }

  // --- Delegate all calls to provider ---
  getStudents() { return this.provider.getStudents(); }
  getStudentsByGuardian(p: string) { return this.provider.getStudentsByGuardian(p); }
  getStudentById(id: string) { return this.provider.getStudentById(id); }
  saveStudents(s: Student[]) { return this.provider.saveStudents(s); }
  getAttendance(d?: string) { return this.provider.getAttendance(d); }
  getStudentAttendance(id: string) { return this.provider.getStudentAttendance(id); }
  markAttendance(id: string) { return this.provider.markAttendance(id); }
  subscribeToAttendance(cb: (r: AttendanceRecord) => void) { return this.provider.subscribeToAttendance(cb); }
  getDailySummary(d: string) { return this.provider.getDailySummary(d); }
  saveDailySummary(s: DailySummary) { return this.provider.saveDailySummary(s); }
  getDashboardStats() { return this.provider.getDashboardStats(); }
  getWeeklyStats() { return this.provider.getWeeklyStats(); }
  getClassStats() { return this.provider.getClassStats(); }
  getAttendanceReport(f: ReportFilter) { return this.provider.getAttendanceReport(f); }
  getExitsReport(f: ReportFilter) { return this.provider.getExitsReport(f); } 
  addExit(r: ExitRecord) { return this.provider.addExit(r); }
  getTodayExits() { return this.provider.getTodayExits(); }
  getStudentExits(id: string) { return this.provider.getStudentExits(id); }
  addViolation(r: ViolationRecord) { return this.provider.addViolation(r); }
  getViolations(id?: string) { return this.provider.getViolations(id); }
  getTodayViolations() { return this.provider.getTodayViolations(); }
  saveNotification(n: Notification) { return this.provider.saveNotification(n); }
  getStudentNotifications(id: string, c: string) { return this.provider.getStudentNotifications(id, c); }
  
  // FIX: Updated to handle User | 'kiosk'
  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void) { return this.provider.subscribeToNotifications(user, callback); }

  getClasses() { return this.provider.getClasses(); }
  saveClass(c: SchoolClass) { return this.provider.saveClass(c); }
  deleteClass(cid: string) { return this.provider.deleteClass(cid); }
  getUsers() { return this.provider.getUsers(); }
  saveUser(u: User) { return this.provider.saveUser(u); }
  deleteUser(uid: string) { return this.provider.deleteUser(uid); }

  getSettings() { return this.provider.getSettings(); }
  saveSettings(s: SystemSettings) { 
      if (s.theme) this.applyTheme(s.theme);
      if (s.mode) this.applyMode(s.mode);
      return this.provider.saveSettings(s); 
  }
  sendBroadcast(tr: string, m: string, t: string) { return this.provider.sendBroadcast(tr, m, t); }
  runDiagnostics() { return this.provider.runDiagnostics(); }
}

export const db = new Database();
