(function (global) {
  'use strict';

  const factory = global.HaderBackendFactory;
  if (!factory || typeof factory.registerBackend !== 'function') {
    return;
  }

  const DEFAULT_TABLES = Object.freeze({
    settings: 'settings',
    attendance: 'attendance',
    leaveRequests: 'leave_requests'
  });

  let supabaseClient = null;
  let cachedCredentials = null;

  function normalizeError(error, fallbackMessage) {
    if (error instanceof Error) {
      return error;
    }
    if (!error) {
      return new Error(fallbackMessage || 'خطأ غير معروف في Supabase.');
    }
    if (typeof error === 'string') {
      return new Error(error);
    }
    if (typeof error === 'object') {
      const message =
        error.message ||
        error.error_description ||
        error.error ||
        fallbackMessage ||
        'تعذّر إتمام العملية مع Supabase.';
      return new Error(message);
    }
    return new Error(fallbackMessage || 'تعذّر إتمام العملية مع Supabase.');
  }

  function resolveCredentials() {
    const url = global.SB_URL || global.sbUrl || null;
    const anon = global.SB_ANON || global.sbAnon || null;
    if (!url || !anon) {
      throw new Error('يجب تعريف window.SB_URL و window.SB_ANON قبل استخدام مزوّد Supabase.');
    }
    return { url: String(url), anon: String(anon) };
  }

  function ensureSupabaseClient() {
    const credentials = resolveCredentials();
    if (
      supabaseClient &&
      cachedCredentials &&
      cachedCredentials.url === credentials.url &&
      cachedCredentials.anon === credentials.anon
    ) {
      return supabaseClient;
    }

    const supabaseModule = global.supabase;
    if (!supabaseModule || typeof supabaseModule.createClient !== 'function') {
      throw new Error('مكتبة Supabase غير محمّلة. أضِف @supabase/supabase-js قبل backend-supabase.js.');
    }

    supabaseClient = supabaseModule.createClient(credentials.url, credentials.anon, {
      auth: {
        persistSession: false
      }
    });
    cachedCredentials = credentials;
    return supabaseClient;
  }

  function resolveTableName(name, overrides) {
    const normalized = String(name || '').trim();
    if (!normalized) return null;
    if (overrides && overrides[name]) {
      return overrides[name];
    }
    return DEFAULT_TABLES[name] || normalized;
  }

  function ensureSchoolId(context, override) {
    const schoolId = override || context.schoolId || global.SCHOOL_ID || global.localStorage?.getItem('hader:school_id');
    if (!schoolId) {
      throw new Error('المعرف school_id غير محدد للمزوّد Supabase.');
    }
    return String(schoolId);
  }

  function normalizeIsoDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return value.toISOString();
    }
    const raw = String(value).trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.valueOf())) {
      return raw;
    }
    return parsed.toISOString();
  }

  function decodeSettingsRow(row) {
    if (!row || typeof row !== 'object') {
      return {};
    }
    if (row.data && typeof row.data === 'object') {
      return { ...row.data };
    }
    if (row.payload && typeof row.payload === 'object') {
      return { ...row.payload };
    }
    const clone = { ...row };
    delete clone.school_id;
    delete clone.created_at;
    delete clone.updated_at;
    return clone;
  }

  function groupAttendanceRows(rows) {
    const buckets = new Map();
    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const day =
        row.day ||
        row.date ||
        row.attendance_day ||
        row.attendanceDate ||
        (row.created_at ? String(row.created_at).slice(0, 10) : null);
      if (!day) return;
      const studentId =
        row.student_id ||
        row.studentId ||
        row.student ||
        row.student_code ||
        row.studentCode ||
        row.id;
      if (!studentId) return;
      const record = buckets.get(day) || { day, records: {}, rows: [] };
      const time = row.time || row.check_in || row.arrived_at || row.timestamp || row.recorded_at || null;
      if (time) {
        record.records[String(studentId)] = String(time);
      }
      record.rows.push({ ...row });
      buckets.set(day, record);
    });
    return Array.from(buckets.values()).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  }

  function createSupabaseAdapter(context = {}) {
    const client = ensureSupabaseClient();
    const tableOverrides = context.tables || global.HaderSupabaseTables || null;

    const tableNames = {
      settings: resolveTableName('settings', tableOverrides),
      attendance: resolveTableName('attendance', tableOverrides),
      leaveRequests: resolveTableName('leaveRequests', tableOverrides)
    };

    async function testConnection() {
      const schoolId = ensureSchoolId(context);
      const table = tableNames.settings;
      try {
        const { error } = await client
          .from(table)
          .select('school_id')
          .eq('school_id', schoolId)
          .limit(1)
          .maybeSingle();
        if (error) {
          throw normalizeError(error, 'تعذّر الاتصال بجدول الإعدادات في Supabase.');
        }
        return true;
      } catch (error) {
        throw normalizeError(error, 'فشل اختبار الاتصال بمشروع Supabase.');
      }
    }

    async function getSettings(options = {}) {
      const schoolId = ensureSchoolId(context, options.schoolId);
      const table = tableNames.settings;
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('school_id', schoolId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        throw normalizeError(error, 'تعذّر جلب إعدادات المدرسة من Supabase.');
      }
      if (!data) {
        return {};
      }
      return decodeSettingsRow(data);
    }

    async function setSettings(patch = {}, options = {}) {
      if (!patch || typeof patch !== 'object') {
        throw new Error('المعطيات المرسلة لتحديث الإعدادات غير صالحة.');
      }
      const schoolId = ensureSchoolId(context, options.schoolId);
      const table = tableNames.settings;
      const current = await getSettings({ schoolId });
      const merged = { ...current, ...patch };
      const payload = {
        school_id: schoolId,
        data: merged,
        updated_at: new Date().toISOString()
      };
      const { error } = await client
        .from(table)
        .upsert(payload, { onConflict: 'school_id' })
        .select('school_id')
        .maybeSingle();
      if (error) {
        throw normalizeError(error, 'تعذّر حفظ إعدادات المدرسة في Supabase.');
      }
      return merged;
    }

    async function createLeaveRequest(request = {}, options = {}) {
      if (!request || typeof request !== 'object') {
        throw new Error('بيانات طلب الإذن غير صالحة.');
      }
      const schoolId = ensureSchoolId(context, options.schoolId || request.school_id);
      const table = tableNames.leaveRequests;
      const payload = {
        ...request,
        school_id: schoolId,
        created_at: request.created_at || new Date().toISOString()
      };
      const { data, error } = await client
        .from(table)
        .insert(payload)
        .select('*')
        .maybeSingle();
      if (error) {
        throw normalizeError(error, 'تعذّر إنشاء طلب الإذن في Supabase.');
      }
      return data;
    }

    async function fetchLeaveRequests(params = {}) {
      const { from, to } = params;
      const schoolId = ensureSchoolId(context, params.schoolId);
      const table = tableNames.leaveRequests;
      let query = client.from(table).select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
      if (from) {
        const isoFrom = normalizeIsoDate(from);
        if (isoFrom) {
          query = query.gte('created_at', isoFrom);
        }
      }
      if (to) {
        const isoTo = normalizeIsoDate(to);
        if (isoTo) {
          query = query.lte('created_at', isoTo);
        }
      }
      const { data, error } = await query;
      if (error) {
        throw normalizeError(error, 'تعذّر جلب طلبات الإذن من Supabase.');
      }
      return Array.isArray(data) ? data : [];
    }

    async function fetchAttendance(params = {}) {
      const { date, from, to } = params;
      const schoolId = ensureSchoolId(context, params.schoolId);
      const table = tableNames.attendance;
      let query = client.from(table).select('*').eq('school_id', schoolId);
      if (date) {
        query = query.eq('day', date);
      }
      if (from) {
        query = query.gte('day', from);
      }
      if (to) {
        query = query.lte('day', to);
      }
      query = query.order('day', { ascending: true }).order('student_id', { ascending: true });
      const { data, error } = await query;
      if (error) {
        throw normalizeError(error, 'تعذّر جلب سجلات الحضور من Supabase.');
      }
      const rows = Array.isArray(data) ? data : [];
      if (date && !from && !to) {
        const bucket = groupAttendanceRows(rows).find((entry) => entry.day === date);
        return bucket || { day: date, records: {}, rows: [] };
      }
      return groupAttendanceRows(rows);
    }

    return {
      testConnection,
      getSettings,
      setSettings,
      createLeaveRequest,
      fetchLeaveRequests,
      fetchAttendance
    };
  }

  factory.registerBackend('supabase', {
    init() {
      ensureSupabaseClient();
    },
    create(context) {
      return createSupabaseAdapter(context);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
