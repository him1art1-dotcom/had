(function (global) {
  'use strict';

  const factory = global.HaderBackendFactory;
  if (!factory || typeof factory.registerBackend !== 'function') {
    return;
  }

  const DEFAULT_PATHS = Object.freeze({
    testConnection: '/api/health',
    getSettings: '/api/settings/{sid}',
    setSettings: '/api/settings/{sid}',
    fetchAttendance: '/api/attendance/{date}?school_id={sid}',
    fetchAttendanceRange: '/api/attendance?school_id={sid}',
    fetchLeaveRequests: '/api/leave-requests?school_id={sid}&from={from}&to={to}',
    createLeaveRequest: '/api/leave-requests'
  });

  const GLOBAL_CONFIG_KEYS = ['HaderRestConfig', 'HaderOtherRestConfig'];

  function readJson(key) {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('تعذّر قراءة بيانات التهيئة من LocalStorage.', error);
      return null;
    }
  }

  function resolveSchoolMeta(schoolId) {
    if (!schoolId) return {};
    const key = `hader:school:${schoolId}:meta`;
    const meta = readJson(key);
    if (!meta || typeof meta !== 'object') return {};
    return meta.backend_meta || {};
  }

  function fillTemplate(template, context) {
    return String(template || '').replace(/\{(\w+)\}/g, (match, token) => {
      if (token in context && context[token] != null) {
        return encodeURIComponent(String(context[token]));
      }
      return '';
    });
  }

  function mergeHeaders(baseHeaders, overrideHeaders) {
    const headers = { ...baseHeaders };
    Object.entries(overrideHeaders || {}).forEach(([key, value]) => {
      if (value == null) return;
      headers[key] = value;
    });
    return headers;
  }

  function resolveGlobalConfig() {
    for (const key of GLOBAL_CONFIG_KEYS) {
      const value = global[key];
      if (value && typeof value === 'object') {
        return value;
      }
    }
    return {};
  }

  function resolveConfig(context) {
    const schoolId = context.schoolId || global.SCHOOL_ID || global.localStorage?.getItem('hader:school_id');
    const globalConfig = resolveGlobalConfig();
    const meta = resolveSchoolMeta(schoolId);

    const base = context.base || meta.api_base || globalConfig.base || '';
    const tokenHeader = context.tokenHeader || meta.token_header || globalConfig.tokenHeader;
    const headers = mergeHeaders(globalConfig.headers || {}, meta.headers || {});
    if (meta.token) {
      if (tokenHeader && typeof tokenHeader === 'string') {
        headers[tokenHeader] = meta.token;
      } else if (!headers.Authorization) {
        headers.Authorization = `Bearer ${meta.token}`;
      }
    }

    const paths = {
      ...DEFAULT_PATHS,
      ...(globalConfig.paths || {}),
      ...(meta.paths || {}),
      ...(context.paths || {})
    };

    const credentials =
      context.credentials || meta.credentials || globalConfig.credentials || (base.startsWith('http') ? 'include' : 'same-origin');

    return {
      base,
      headers,
      paths,
      credentials,
      schoolId: schoolId ? String(schoolId) : null
    };
  }

  function buildUrl(config, path) {
    if (!config.base) {
      throw new Error('لم يتم ضبط عنوان الخادم لمزوّد REST الخارجي.');
    }
    const url = new URL(path, config.base);
    return url.toString();
  }

  function parseJsonResponse(response, text) {
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn('تعذّر تحليل استجابة JSON من مزوّد REST.', error);
      return text;
    }
  }

  async function sendRequest(config, descriptor, { method = 'GET', body, params = {} } = {}) {
    const template = config.paths[descriptor];
    if (!template) {
      throw new Error(`المسار ${descriptor} غير معرّف في إعدادات مزوّد REST الخارجي.`);
    }
    const filledPath = fillTemplate(template, params);
    const url = buildUrl(config, filledPath);
    const headers = mergeHeaders({ Accept: 'application/json' }, config.headers);
    const init = { method, headers };
    if (body != null) {
      if (!('Content-Type' in headers)) {
        headers['Content-Type'] = 'application/json';
      }
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    init.credentials = config.credentials || 'include';

    let response;
    try {
      response = await fetch(url, init);
    } catch (networkError) {
      throw networkError instanceof Error
        ? new Error(`تعذّر الوصول إلى الواجهة الخارجية: ${networkError.message}`)
        : new Error('تعذّر الوصول إلى الواجهة الخارجية (انقطاع الاتصال).');
    }
    const text = await response.text();
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      const parsed = parseJsonResponse(response, text);
      if (parsed && typeof parsed === 'object') {
        message = parsed.message || parsed.error || message;
      }
      throw new Error(`تعذّر تنفيذ الطلب (${message}).`);
    }
    return parseJsonResponse(response, text);
  }

  function normalizeAttendancePayload(payload) {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      if (payload.length === 0) return [];
      if (payload[0] && typeof payload[0] === 'object' && 'records' in payload[0]) {
        return payload;
      }
      return groupRows(payload);
    }
    if (payload.day && payload.records) {
      return [payload];
    }
    if (payload.records) {
      return [{ day: payload.day || payload.date || '', records: payload.records, rows: payload.rows || [] }];
    }
    return [];
  }

  function groupRows(rows) {
    const buckets = new Map();
    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const day = row.day || row.date || row.attendance_day || row.attendanceDate || '';
      if (!day) return;
      const studentId =
        row.student_id ||
        row.studentId ||
        row.student_code ||
        row.student ||
        row.id ||
        null;
      if (!studentId) return;
      const record = buckets.get(day) || { day, records: {}, rows: [] };
      const time = row.time || row.arrived_at || row.check_in || row.timestamp || row.recorded_at;
      if (time) {
        record.records[String(studentId)] = String(time);
      }
      record.rows.push({ ...row });
      buckets.set(day, record);
    });
    return Array.from(buckets.values()).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  }

  function createRestAdapter(context = {}) {
    const config = resolveConfig(context);
    if (!config.base) {
      console.warn('لم يتم ضبط base URL لمزوّد REST الآخر. سيتم إظهار الخطأ عند أول طلب.');
    }

    async function testConnection() {
      try {
        await sendRequest(config, 'testConnection', { method: 'GET', params: { sid: config.schoolId } });
        return true;
      } catch (error) {
        throw error instanceof Error
          ? error
          : new Error('فشل اختبار الاتصال بمزوّد REST الخارجي.');
      }
    }

    async function getSettings(options = {}) {
      const schoolId = options.schoolId || config.schoolId;
      const response = await sendRequest(config, 'getSettings', {
        method: 'GET',
        params: { sid: schoolId }
      });
      if (!response || typeof response !== 'object') {
        return {};
      }
      if (response.data && typeof response.data === 'object') {
        return { ...response.data };
      }
      if (response.payload && typeof response.payload === 'object') {
        return { ...response.payload };
      }
      return { ...response };
    }

    async function setSettings(patch = {}, options = {}) {
      if (!patch || typeof patch !== 'object') {
        throw new Error('تنسيق البيانات المرسلة لتحديث الإعدادات غير صحيح.');
      }
      const schoolId = options.schoolId || config.schoolId;
      const response = await sendRequest(config, 'setSettings', {
        method: 'PATCH',
        body: { ...patch, school_id: schoolId },
        params: { sid: schoolId }
      });
      if (response && typeof response === 'object') {
        if (response.data && typeof response.data === 'object') {
          return { ...response.data };
        }
        if (response.payload && typeof response.payload === 'object') {
          return { ...response.payload };
        }
        return { ...response };
      }
      return patch;
    }

    async function fetchAttendance(params = {}) {
      const schoolId = params.schoolId || config.schoolId;
      const contextParams = {
        sid: schoolId,
        date: params.date || '',
        from: params.from || '',
        to: params.to || ''
      };
      const descriptor = params.from || params.to ? 'fetchAttendanceRange' : 'fetchAttendance';
      const response = await sendRequest(config, descriptor, { method: 'GET', params: contextParams });
      const normalized = normalizeAttendancePayload(response);
      if (params.date && !params.from && !params.to) {
        return normalized.find((bucket) => bucket.day === params.date) || { day: params.date, records: {}, rows: [] };
      }
      return normalized;
    }

    async function fetchLeaveRequests(params = {}) {
      const schoolId = params.schoolId || config.schoolId;
      const response = await sendRequest(config, 'fetchLeaveRequests', {
        method: 'GET',
        params: {
          sid: schoolId,
          from: params.from || '',
          to: params.to || ''
        }
      });
      if (!response) return [];
      if (Array.isArray(response)) return response;
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
      if (response.items && Array.isArray(response.items)) {
        return response.items;
      }
      return [];
    }

    async function createLeaveRequest(payload = {}, options = {}) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('بيانات طلب الإذن غير صالحة للإرسال.');
      }
      const schoolId = options.schoolId || config.schoolId;
      const body = { ...payload, school_id: schoolId };
      const response = await sendRequest(config, 'createLeaveRequest', {
        method: 'POST',
        body,
        params: { sid: schoolId }
      });
      if (response && typeof response === 'object') {
        if (response.data && typeof response.data === 'object') {
          return response.data;
        }
        return response;
      }
      return body;
    }

    return {
      testConnection,
      getSettings,
      setSettings,
      fetchAttendance,
      fetchLeaveRequests,
      createLeaveRequest
    };
  }

  function register(name) {
    factory.registerBackend(name, {
      create(context) {
        return createRestAdapter(context);
      }
    });
  }

  register('rest');
  register('other');
})(typeof window !== 'undefined' ? window : globalThis);
