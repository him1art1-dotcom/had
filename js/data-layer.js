const DEFAULT_GRADE_OPTIONS = Object.freeze([
  'الصف الأول',
  'الصف الثاني',
  'الصف الثالث',
  'الصف الرابع',
  'الصف الخامس'
]);

const DEFAULT_CLASS_OPTIONS = Object.freeze(['أ', 'ب', 'ج', 'د']);

const DEFAULT_STATUS_OPTIONS = Object.freeze(['حاضر', 'متأخر', 'غائب']);

const DEFAULT_SENSITIVE_PERIODS = [
  { label: 'بداية اليوم', hour: 7 },
  { label: 'بداية الحصة الثانية', hour: 8 },
  { label: 'قبل الفسحة', hour: 9 },
  { label: 'بعد الفسحة', hour: 10 },
  { label: 'قبل الانصراف', hour: 12 }
];

let supabaseClientPromise = null;

function deriveActiveSlug() {
  if (typeof window !== 'undefined' && window.HADER_ACTIVE_SLUG) {
    return window.HADER_ACTIVE_SLUG;
  }
  if (typeof window === 'undefined') {
    return 'default';
  }
  const host = window.location && window.location.hostname ? window.location.hostname : '';
  const parts = host.split('.').filter(Boolean);
  let slug = '';
  if (parts.length > 2) {
    slug = parts[0];
  } else if (parts.length === 2) {
    slug = parts[0];
  } else if (parts.length === 1) {
    slug = parts[0];
  }
  if (!slug || slug === 'www' || slug === 'localhost' || /^\d+$/.test(slug)) {
    return 'default';
  }
  return slug;
}

function resolveActiveConfig() {
  if (typeof window === 'undefined') {
    return { slug: 'default', config: {} };
  }
  const configs = window.HADER_SCHOOL_CONFIGS || {};
  const slug = deriveActiveSlug();
  const config = window.HADER_ACTIVE_CONFIG || configs[slug] || configs.default || {};
  return { slug, config };
}

const ACTIVE_CONTEXT = resolveActiveConfig();

function isSupabaseEnabled() {
  return Boolean(
    ACTIVE_CONTEXT &&
      ACTIVE_CONTEXT.config &&
      ACTIVE_CONTEXT.config.supabaseUrl &&
      ACTIVE_CONTEXT.config.supabaseAnon
  );
}

async function ensureSupabaseClient() {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase غير مفعّل لهذه المدرسة.');
  }
  if (!supabaseClientPromise) {
    supabaseClientPromise = (async () => {
      if (typeof window === 'undefined') {
        throw new Error('Supabase غير متاح في هذا السياق.');
      }
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('لم يتم تحميل مكتبة supabase-js.');
      }
      const { supabaseUrl, supabaseAnon } = ACTIVE_CONTEXT.config;
      if (!window.SB_URL) {
        window.SB_URL = supabaseUrl;
      }
      if (!window.SB_ANON) {
        window.SB_ANON = supabaseAnon;
      }
      return window.supabase.createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false }
      });
    })().catch((error) => {
      supabaseClientPromise = null;
      throw error;
    });
  }
  return supabaseClientPromise;
}

function randomItem(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return '';
  }
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function mockAttendance(params = {}) {
  const count = 10 + Math.floor(Math.random() * 11);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const grade = randomItem(DEFAULT_GRADE_OPTIONS);
    const classroom = randomItem(DEFAULT_CLASS_OPTIONS);
    const status = randomItem(DEFAULT_STATUS_OPTIONS);
    const name = `طالب رقم ${String(index + 1).padStart(2, '0')}`;

    let time = '—';
    if (status !== 'غائب') {
      const baseHour = status === 'متأخر' ? 8 : 7;
      const hour = baseHour + Math.floor(Math.random() * 2);
      const minute = Math.floor(Math.random() * 60);
      time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    rows.push({
      name,
      grade,
      classroom,
      status,
      time
    });
  }

  return applyAttendanceFilters(rows, params);
}

function mockStudents() {
  const total = 20 + Math.floor(Math.random() * 21);
  const now = Date.now();
  return Array.from({ length: total }, (_, index) => {
    const grade = randomItem(DEFAULT_GRADE_OPTIONS);
    const classroom = randomItem(DEFAULT_CLASS_OPTIONS);
    const offset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
    return {
      id: index + 1,
      name: `طالب رقم ${String(index + 1).padStart(3, '0')}`,
      grade,
      classroom,
      guardian: `ولي أمر ${String(1000 + index)}`,
      updatedAt: new Date(now - offset).toISOString()
    };
  });
}

function mockTopLatecomers() {
  return Array.from({ length: 10 }, (_, index) => ({
    rank: index + 1,
    name: `طالب رقم ${String(index + 1).padStart(2, '0')}`,
    grade: randomItem(DEFAULT_GRADE_OPTIONS),
    classroom: randomItem(DEFAULT_CLASS_OPTIONS),
    count: 3 + Math.floor(Math.random() * 7)
  }));
}

function mockClassCompliance() {
  const total = 6 + Math.floor(Math.random() * 3);
  return Array.from({ length: total }, () => {
    const compliance = 80 + Math.random() * 20;
    const lateRate = 5 + Math.random() * 10;
    let note = 'يحتاج للمتابعة';
    if (compliance >= 92) {
      note = 'أداء متميز';
    } else if (compliance >= 85) {
      note = 'أداء جيد';
    }
    return {
      classGroup: `${randomItem(DEFAULT_GRADE_OPTIONS)} / ${randomItem(DEFAULT_CLASS_OPTIONS)}`,
      compliance: `${compliance.toFixed(1)}%`,
      lateRate: `${lateRate.toFixed(1)}%`,
      note
    };
  });
}

function mockSensitivePeriods() {
  return DEFAULT_SENSITIVE_PERIODS.map(({ label, hour }) => {
    const lateCount = Math.floor(Math.random() * 12);
    let recommendation = 'الوضع مستقر.';
    if (lateCount >= 9) {
      recommendation = 'توصى بزيادة الإشراف في هذه الفترة.';
    } else if (lateCount >= 5) {
      recommendation = 'ينصح بمتابعة إضافية.';
    }
    return {
      period: label,
      window: `${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`,
      lateCount,
      recommendation
    };
  });
}

function applyAttendanceFilters(rows, params = {}) {
  const filters = params || {};
  return rows.filter((row) => {
    if (filters.grade && row.grade !== filters.grade) {
      return false;
    }
    if (filters.classroom && row.classroom !== filters.classroom) {
      return false;
    }
    if (filters.status) {
      const normalized = normalizeStatus(row.status);
      if (normalized !== normalizeStatus(filters.status)) {
        return false;
      }
    }
    if (filters.startDate || filters.endDate) {
      const day = extractDate(row.time);
      if (filters.startDate && day && day < filters.startDate) {
        return false;
      }
      if (filters.endDate && day && day > filters.endDate) {
        return false;
      }
    }
    return true;
  });
}

function extractDate(value) {
  if (!value) {
    return '';
  }
  if (value.length === 5 && value.includes(':')) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(value) {
  if (!value) {
    return '';
  }
  const raw = String(value).trim();
  if (!raw) {
    return '';
  }
  const lowered = raw.toLowerCase();
  if (lowered === 'present' || lowered === 'on_time') {
    return 'حاضر';
  }
  if (lowered === 'late' || lowered === 'delayed') {
    return 'متأخر';
  }
  if (lowered === 'absent' || lowered === 'absence') {
    return 'غائب';
  }
  return raw;
}

function normalizeGrade(value) {
  if (!value) {
    return '';
  }
  return String(value).trim();
}

function normalizeClassroom(value) {
  if (!value) {
    return '';
  }
  return String(value).trim();
}

function normalizeName(value, fallback) {
  const raw = value ? String(value).trim() : '';
  if (raw) {
    return raw;
  }
  return fallback || '';
}

function normalizeTime(value) {
  if (!value) {
    return '—';
  }
  if (typeof value === 'string' && value.length === 5 && value.includes(':')) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    const text = String(value).trim();
    return text || '—';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function fetchAttendanceSupabase(params = {}) {
  const client = await ensureSupabaseClient();
  let query = client.from('attendance').select('*').limit(250);

  if (params && params.startDate) {
    query = query.gte('event_date', params.startDate);
  }
  if (params && params.endDate) {
    query = query.lte('event_date', params.endDate);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  if (!Array.isArray(data)) {
    return [];
  }
  const rows = data.map((row, index) => ({
    name: normalizeName(row.name || row.student_name || row.student || row.full_name, `طالب ${index + 1}`),
    grade: normalizeGrade(row.grade || row.grade_name || row.class_grade),
    classroom: normalizeClassroom(row.classroom || row.class || row.section || row.class_section),
    status: normalizeStatus(row.status || row.attendance_status || row.state),
    time: normalizeTime(row.time || row.check_in || row.recorded_at || row.created_at)
  }));

  return applyAttendanceFilters(rows, params);
}

async function fetchStudentsSupabase() {
  const client = await ensureSupabaseClient();
  const { data, error } = await client
    .from('students')
    .select('*')
    .limit(250);
  if (error) {
    throw error;
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((row, index) => ({
    id: row.id || row.student_id || index + 1,
    name: normalizeName(row.name || row.student_name || row.full_name, `طالب ${index + 1}`),
    grade: normalizeGrade(row.grade || row.grade_name || row.class_grade),
    classroom: normalizeClassroom(row.classroom || row.class || row.section || row.class_section),
    guardian: normalizeName(row.guardian || row.guardian_name || row.parent_name, '—'),
    updatedAt: row.updated_at || row.modified_at || row.updatedAt || new Date().toISOString()
  }));
}

async function dl_fetchAttendance(params = {}) {
  if (isSupabaseEnabled()) {
    try {
      return await fetchAttendanceSupabase(params);
    } catch (error) {
      console.warn('Supabase attendance fallback:', error);
    }
  }
  return mockAttendance(params);
}

async function dl_fetchStudents(params = {}) {
  if (isSupabaseEnabled()) {
    try {
      return await fetchStudentsSupabase(params);
    } catch (error) {
      console.warn('Supabase students fallback:', error);
    }
  }
  return mockStudents();
}

async function dl_fetchTopLatecomers() {
  if (isSupabaseEnabled()) {
    try {
      const rows = await dl_fetchAttendance({});
      const counter = new Map();
      rows.forEach((row) => {
        if (normalizeStatus(row.status) !== 'متأخر') {
          return;
        }
        const key = row.name || 'غير معروف';
        const record = counter.get(key) || {
          name: row.name || 'غير معروف',
          grade: row.grade || '—',
          classroom: row.classroom || '—',
          count: 0
        };
        record.count += 1;
        counter.set(key, record);
      });
      const sorted = Array.from(counter.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((entry, index) => ({
          rank: index + 1,
          ...entry
        }));
      if (sorted.length) {
        return sorted;
      }
    } catch (error) {
      console.warn('Supabase latecomers fallback:', error);
    }
  }
  return mockTopLatecomers();
}

async function dl_fetchClassCompliance() {
  if (isSupabaseEnabled()) {
    try {
      const rows = await dl_fetchAttendance({});
      const groups = new Map();
      rows.forEach((row) => {
        const grade = row.grade || '—';
        const classroom = row.classroom || '—';
        const key = `${grade} / ${classroom}`;
        const entry = groups.get(key) || {
          grade,
          classroom,
          present: 0,
          late: 0,
          absent: 0
        };
        const status = normalizeStatus(row.status);
        if (status === 'حاضر') {
          entry.present += 1;
        } else if (status === 'متأخر') {
          entry.late += 1;
        } else {
          entry.absent += 1;
        }
        groups.set(key, entry);
      });
      const results = Array.from(groups.values()).map((entry) => {
        const total = entry.present + entry.late + entry.absent;
        const compliance = total ? (entry.present / total) * 100 : 0;
        const lateRate = total ? (entry.late / total) * 100 : 0;
        let note = 'يحتاج للمتابعة';
        if (compliance >= 92) {
          note = 'أداء متميز';
        } else if (compliance >= 85) {
          note = 'أداء جيد';
        }
        return {
          classGroup: `${entry.grade} / ${entry.classroom}`,
          compliance: `${compliance.toFixed(1)}%`,
          lateRate: `${lateRate.toFixed(1)}%`,
          note
        };
      });
      if (results.length) {
        return results.sort((a, b) => Number.parseFloat(b.compliance) - Number.parseFloat(a.compliance));
      }
    } catch (error) {
      console.warn('Supabase class compliance fallback:', error);
    }
  }
  return mockClassCompliance();
}

async function dl_fetchSensitivePeriods() {
  if (isSupabaseEnabled()) {
    try {
      const rows = await dl_fetchAttendance({});
      const buckets = new Map();
      rows.forEach((row) => {
        const time = normalizeTime(row.time);
        if (!time || time === '—' || !time.includes(':')) {
          return;
        }
        const hour = Number.parseInt(time.split(':')[0], 10);
        if (!Number.isFinite(hour)) {
          return;
        }
        const bucket = buckets.get(hour) || { hour, late: 0, total: 0 };
        bucket.total += 1;
        if (normalizeStatus(row.status) === 'متأخر') {
          bucket.late += 1;
        }
        buckets.set(hour, bucket);
      });
      const results = Array.from(buckets.values())
        .sort((a, b) => a.hour - b.hour)
        .map((bucket) => {
          const lateCount = bucket.late;
          let recommendation = 'الوضع مستقر.';
          if (lateCount >= 9) {
            recommendation = 'توصى بزيادة الإشراف في هذه الفترة.';
          } else if (lateCount >= 5) {
            recommendation = 'ينصح بمتابعة إضافية.';
          }
          return {
            period: `الساعة ${String(bucket.hour).padStart(2, '0')}`,
            window: `${String(bucket.hour).padStart(2, '0')}:00 - ${String(bucket.hour + 1).padStart(2, '0')}:00`,
            lateCount,
            recommendation
          };
        });
      if (results.length) {
        return results;
      }
    } catch (error) {
      console.warn('Supabase sensitive periods fallback:', error);
    }
  }
  return mockSensitivePeriods();
}

export const DL_GRADE_OPTIONS = DEFAULT_GRADE_OPTIONS;
export const DL_CLASS_OPTIONS = DEFAULT_CLASS_OPTIONS;
export const DL_STATUS_OPTIONS = DEFAULT_STATUS_OPTIONS;

export {
  dl_fetchAttendance,
  dl_fetchStudents,
  dl_fetchTopLatecomers,
  dl_fetchClassCompliance,
  dl_fetchSensitivePeriods
};

export function dl_getActiveContext() {
  return { ...ACTIVE_CONTEXT };
}
