
export enum Role {
  SITE_ADMIN = 'site_admin',
  SCHOOL_ADMIN = 'school_admin',
  SUPERVISOR_GLOBAL = 'supervisor_global',
  SUPERVISOR_CLASS = 'supervisor_class',
  WATCHER = 'watcher',
  GUARDIAN = 'guardian',
}

export interface ClassAssignment {
  className: string; // اسم الصف (مثال: أول ثانوي)
  sections: string[]; // الفصول المسندة (مثال: ['أ', 'ج']). مصفوفة فارغة تعني كل الفصول.
}

export interface User {
  id: string;
  username: string;
  password?: string; // stored plainly for demo purposes only
  name: string;
  role: Role;
  assignedClasses?: ClassAssignment[]; // التحديث هنا: هيكلة جديدة للإسناد
}

export interface Student {
  id: string; // The generated ID (المعرف)
  name: string;
  className: string;
  section: string;
  guardianPhone: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  status: 'present' | 'late' | 'absent' | 'excused';
}

export interface ExitRecord {
  id: string;
  studentId: string;
  reason: string;
  exit_time: string; // ISO string
  created_by?: string;
}

export interface ViolationRecord {
  id: string;
  studentId: string;
  type: string;
  description: string; // Mapped from 'notes' in app logic if needed, or sql 'description'
  level: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface Notification {
  id: string;
  message: string;
  target_audience: 'all' | 'class' | 'student' | 'admin' | 'supervisor' | 'guardian';
  target_id?: string; // ID of student or class name
  type: 'behavior' | 'attendance' | 'general';
  created_at: string;
  title?: string; // Optional helper for UI
}

export interface DashboardStats {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    attendanceRate: number;
}

export interface ReportFilter {
    dateFrom: string;
    dateTo: string;
    className?: string;
    section?: string;
}

export interface DailySummary {
    id?: string;
    date_summary: string;
    summary_data: {
        stats: {
            total: number;
            present: number;
            late: number;
            absent: number;
        };
        details: {
            present: { id: string; name: string }[];
            late: { id: string; name: string }[];
            absent: { id: string; name: string }[];
        };
        shared_by: string;
        shared_at: string;
    };
}

// Structure Management
export interface SchoolClass {
  id: string;
  name: string; // e.g. "الصف الأول الثانوي"
  sections: string[]; // e.g. ["أ", "ب", "ج"]
}

// New Types for Support & Diagnostics
export interface AppTheme {
  primary400: string;
  primary500: string;
  primary600: string;
  secondary400: string;
  secondary500: string;
  secondary600: string;
}

export interface KioskSettings {
    mainTitle: string;
    subTitle: string;
    earlyMessage: string;
    lateMessage: string;
    showStats: boolean; // New toggle
}

export interface SystemSettings {
    systemReady: boolean;
    schoolActive: boolean;
    logoUrl: string;
    theme?: AppTheme;
    mode?: 'dark' | 'light';
    kiosk?: KioskSettings;
    
    // School Settings
    schoolName?: string;
    schoolManager?: string;
    assemblyTime?: string; // HH:mm (24 hour format)
    gracePeriod?: number; // minutes
}

export interface DiagnosticResult {
    key: string;
    title: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
    hint?: string;
    count?: number;
}

export interface AttendanceScanResult {
    success: boolean;
    message: string;
    record?: AttendanceRecord;
    student?: Student;
    stats?: {
        lateCount: number;
        minutesLateToday: number;
        totalMinutesLate: number;
    }
}

export const STORAGE_KEYS = {
  SESSION: 'hader:session',
  THEME: 'hader:theme',
  STUDENTS: 'hader:students',
  USERS: 'hader:users',
  ATTENDANCE: 'hader:attendance',
  EXITS: 'hader:exits',
  VIOLATIONS: 'hader:violations',
  NOTIFICATIONS: 'hader:notifications',
  DAILY_SHARE: 'hader:daily-share', // prefix
  SETTINGS: 'hader:settings',
  CLASSES: 'hader:classes', 
};
