const factoryApi = ((global) => {
  'use strict';

  const DEFAULT_BACKEND = 'localstorage';
  const FALLBACK_KEY = 'hader:data_backend';
  const SCHOOL_META_PREFIX = 'hader:school:';
  const META_SUFFIX = ':meta';
  const BACKEND_OVERRIDE_SUFFIX = ':data_backend';
  const LOCAL_READY_SUFFIX = ':local_ready';

  const _registry = new Map();
  let activeName = null;

  function normalizeName(name) {
    if (!name) return DEFAULT_BACKEND;
    return String(name).trim().toLowerCase();
  }

  function getSchoolStorageKey(schoolId, suffix) {
    const id = schoolId ? String(schoolId).trim() : '';
    if (!id) return null;
    return `${SCHOOL_META_PREFIX}${id}${suffix}`;
  }

  function readJson(key) {
    if (!key) return null;
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('تعذّر قراءة البيانات من LocalStorage.', error);
      return null;
    }
  }

  function writeJson(key, value) {
    if (!key) return;
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('تعذّر حفظ البيانات في LocalStorage.', error);
    }
  }

  function setItem(key, value) {
    if (!key) return;
    try {
      if (value == null) {
        global.localStorage?.removeItem(key);
      } else {
        global.localStorage?.setItem(key, String(value));
      }
    } catch (error) {
      console.warn('تعذّر تحديث LocalStorage.', error);
    }
  }

  function getItem(key) {
    if (!key) return null;
    try {
      return global.localStorage?.getItem(key) ?? null;
    } catch (error) {
      console.warn('تعذّر قراءة LocalStorage.', error);
      return null;
    }
  }

  function readLocalEnhancementFlag(schoolId) {
    const flagKey = getSchoolStorageKey(schoolId, LOCAL_READY_SUFFIX);
    const stored = getItem(flagKey);
    if (stored === 'true') return true;
    if (stored === 'false') return false;

    const metaKey = getSchoolStorageKey(schoolId, META_SUFFIX);
    const meta = readJson(metaKey);
    if (meta && typeof meta.local_ready === 'boolean') {
      return meta.local_ready;
    }

    return false;
  }

  function setLocalEnhancementFlag(schoolId, enabled) {
    const flagKey = getSchoolStorageKey(schoolId, LOCAL_READY_SUFFIX);
    setItem(flagKey, enabled ? 'true' : 'false');

    const metaKey = getSchoolStorageKey(schoolId, META_SUFFIX);
    const existing = readJson(metaKey);
    if (existing) {
      const nextMeta = { ...existing, local_ready: Boolean(enabled) };
      if (!('disabled_message' in nextMeta)) {
        nextMeta.disabled_message = '';
      }
      writeJson(metaKey, nextMeta);
      broadcastSchoolMeta(existing.id || schoolId, nextMeta);
    } else if (schoolId) {
      const nextMeta = {
        id: schoolId,
        local_ready: Boolean(enabled),
        disabled_message: ''
      };
      writeJson(metaKey, nextMeta);
      broadcastSchoolMeta(schoolId, nextMeta);
    }
  }

  function currentSchoolId() {
    try {
      const raw = global.localStorage?.getItem('hader:auth:session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.school_id) {
          return String(session.school_id);
        }
      }
    } catch (error) {
      console.warn('تعذّر قراءة الجلسة الحالية لاشتقاق المدرسة.', error);
    }

    const stored = getItem('hader:school_id');
    if (stored) {
      return String(stored);
    }

    return 'school_1';
  }

  function getSchoolBackendChoice(schoolId) {
    const overrideKey = getSchoolStorageKey(schoolId, BACKEND_OVERRIDE_SUFFIX);
    const override = getItem(overrideKey);
    if (override) {
      return normalizeName(override);
    }

    const metaKey = getSchoolStorageKey(schoolId, META_SUFFIX);
    const meta = readJson(metaKey);
    if (meta && meta.data_backend) {
      return normalizeName(meta.data_backend);
    }

    const fallback = getItem(FALLBACK_KEY);
    return normalizeName(fallback || DEFAULT_BACKEND);
  }

  function currentBackendName() {
    const sid = currentSchoolId();
    const key = getSchoolStorageKey(sid, BACKEND_OVERRIDE_SUFFIX);
    const explicit = getItem(key);
    if (explicit) {
      return normalizeName(explicit);
    }

    const fallback = getItem(FALLBACK_KEY);
    return normalizeName(fallback || DEFAULT_BACKEND);
  }

  async function getBackend(options = {}) {
    const schoolId = options.schoolId || global.SCHOOL_ID || getItem('hader:school_id') || 'school_1';
    const explicit = options.name || global.DATA_BACKEND;
    const name = normalizeName(explicit || getSchoolBackendChoice(schoolId));

    activeName = name;

    const impl = _registry.get(name);
    if (!impl) {
      throw new Error(`Backend "${name}" غير مسجل`);
    }

    if (typeof impl.init === 'function' && !impl.__initialized) {
      await impl.init({ schoolId, name });
      impl.__initialized = true;
    }

    if (typeof impl.create === 'function') {
      return impl.create({ schoolId, name });
    }

    return impl;
  }

  function registerBackend(name, descriptor) {
    const normalized = normalizeName(name);
    if (!normalized) {
      throw new Error('اسم مزود البيانات مطلوب.');
    }
    if (!descriptor || (typeof descriptor !== 'object' && typeof descriptor !== 'function')) {
      throw new Error('مُعرف المزود غير صالح.');
    }

    if (typeof descriptor === 'function') {
      _registry.set(normalized, { create: descriptor });
      return;
    }

    _registry.set(normalized, { ...descriptor });
  }

  function listBackends() {
    return supportedBackends();
  }

  function supportedBackends() {
    return Array.from(_registry.keys());
  }

  function setFallbackBackend(name) {
    setItem(FALLBACK_KEY, normalizeName(name));
  }

  function getFallbackBackend() {
    return normalizeName(getItem(FALLBACK_KEY));
  }

  function storeSchoolMeta(school) {
    if (!school || typeof school !== 'object') return;
    const id = school.id || school.school_id;
    const metaKey = getSchoolStorageKey(id, META_SUFFIX);
    if (!metaKey) return;
    const localReady =
      typeof school.local_ready === 'boolean'
        ? school.local_ready
        : readLocalEnhancementFlag(id);
    const payload = {
      id,
      name: school.name || '',
      display_name: school.display_name || school.displayName || '',
      timezone: school.timezone || '',
      enabled: school.enabled !== false,
      data_backend: normalizeName(school.data_backend || DEFAULT_BACKEND),
      backend_meta: school.backend_meta || school.backendMeta || null,
      local_ready: localReady,
      disabled_message: sanitizeDisabledMessage(school.disabled_message || school.disabledMessage)
    };
    writeJson(metaKey, payload);
    setLocalEnhancementFlag(id, localReady);
    broadcastSchoolMeta(id, payload);
  }

  function sanitizeDisabledMessage(value) {
    if (value == null) return '';
    const text = typeof value === 'string' ? value : String(value || '');
    return text.replace(/\r\n?/g, '\n').trim();
  }

  function broadcastSchoolMeta(schoolId, meta) {
    if (!schoolId) return;
    if (typeof global.dispatchEvent !== 'function') return;
    const detail = {
      schoolId,
      meta: meta && typeof meta === 'object' ? { ...meta } : null
    };
    try {
      let event;
      if (typeof global.CustomEvent === 'function') {
        event = new CustomEvent('hader:school-meta', { detail });
      } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('hader:school-meta', false, false, detail);
      }
      if (event) {
        global.dispatchEvent(event);
      }
    } catch (error) {
      console.warn('تعذّر بث تحديث بيانات المدرسة.', error);
    }
  }

  function removeSchoolOverride(schoolId) {
    const overrideKey = getSchoolStorageKey(schoolId, BACKEND_OVERRIDE_SUFFIX);
    if (!overrideKey) return;
    try {
      global.localStorage?.removeItem(overrideKey);
    } catch (error) {
      console.warn('تعذّر حذف تفضيل المدرسة.', error);
    }
  }

  const api = {
    registerBackend,
    getBackend,
    getSchoolBackendChoice,
    getSchoolMeta(schoolId) {
      const metaKey = getSchoolStorageKey(schoolId, META_SUFFIX);
      return readJson(metaKey);
    },
    listBackends,
    setFallbackBackend,
    getFallbackBackend,
    storeSchoolMeta,
    removeSchoolOverride,
    isLocalEnhanced(schoolId) {
      return readLocalEnhancementFlag(schoolId);
    },
    setLocalEnhancement(schoolId, enabled) {
      setLocalEnhancementFlag(schoolId, enabled);
    },
    getActiveBackendName() {
      return activeName;
    },
    supportedBackends,
    currentSchoolId,
    currentBackendName,
    switchBackend(name) {
      const backendName = normalizeName(name);
      const sid = currentSchoolId();
      const key = getSchoolStorageKey(sid, BACKEND_OVERRIDE_SUFFIX);
      setItem(key, backendName);
      return true;
    }
  };

  return api;
})(typeof window !== 'undefined' ? window : globalThis);

const globalTarget = typeof window !== 'undefined' ? window : globalThis;
globalTarget.HaderBackendFactory = Object.assign(globalTarget.HaderBackendFactory || {}, factoryApi);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = factoryApi;
}

export const registerBackend = factoryApi.registerBackend;
export const getBackend = factoryApi.getBackend;
export const getSchoolBackendChoice = factoryApi.getSchoolBackendChoice;
export const listBackends = factoryApi.listBackends;
export const setFallbackBackend = factoryApi.setFallbackBackend;
export const getFallbackBackend = factoryApi.getFallbackBackend;
export const storeSchoolMeta = factoryApi.storeSchoolMeta;
export const removeSchoolOverride = factoryApi.removeSchoolOverride;
export const isLocalEnhanced = factoryApi.isLocalEnhanced;
export const setLocalEnhancement = factoryApi.setLocalEnhancement;
export const getActiveBackendName = factoryApi.getActiveBackendName;
export const supportedBackends = factoryApi.supportedBackends;
export const currentSchoolId = factoryApi.currentSchoolId;
export const currentBackendName = factoryApi.currentBackendName;
export const switchBackend = factoryApi.switchBackend;

export default factoryApi;
