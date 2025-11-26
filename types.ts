
export enum Role {
  SITE_ADMIN = 'site_admin',
  SCHOOL_ADMIN = 'school_admin',
  SUPERVISOR_GLOBAL = 'supervisor_global',
  SUPERVISOR_CLASS = 'supervisor_class',
  WATCHER = 'watcher',
  GUARDIAN = 'guardian',
}

export interface ClassAssignment {
  className: string; 
  sections: string[]; 
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: Role;
  assignedClasses?: ClassAssignment[];
}

export interface Student {
  id: string;
  name: string;
  className: string;
  section: string;
  guardianPhone: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  timestamp: string;
  status: 'present' | 'late' | 'absent' | 'excused';
}

export interface ExitRecord {
  id: string;
  studentId: string;
  reason: string;
  exit_time: string;
  created_by?: string;
}

export interface ViolationRecord {
  id: string;
  studentId: string;
  type: string;
  description: string;
  level: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface Notification {
  id: string;
  message: string;
  target_audience: 'all' | 'class' | 'student' | 'admin' | 'supervisor' | 'guardian' | 'kiosk';
  target_id?: string;
  type: 'behavior' | 'attendance' | 'general' | 'announcement' | 'command';
  isPopup?: boolean; // New: Determines if it shows as a modal
  created_at: string;
  title?: string;
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

export interface SchoolClass {
  id: string;
  name: string;
  sections: string[];
}

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
    showStats: boolean;
    headerImage?: string; // Base64 or URL
    screensaverEnabled?: boolean;
    screensaverTimeout?: number; // in minutes
    screensaverImages?: string[]; // Array of Base64 or URLs
}

export interface SystemSettings {
    systemReady: boolean;
    schoolActive: boolean;
    logoUrl: string;
    theme?: AppTheme;
    mode?: 'dark' | 'light';
    kiosk?: KioskSettings;
    schoolName?: string;
    schoolManager?: string;
    assemblyTime?: string;
    gracePeriod?: number;
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
  DAILY_SHARE: 'hader:daily-share',
  SETTINGS: 'hader:settings',
  CLASSES: 'hader:classes', 
};
