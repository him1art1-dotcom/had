const SUPPORT_ACCESS_EVENT = 'hader:support-access';

const BACKEND_LABELS = Object.freeze({
  localstorage: 'LocalStorage',
  sqljs: 'SQL.js',
  supabase: 'Supabase',
  rest: 'REST',
  other: 'مزود آخر'
});

const ALLOWED_BACKENDS = new Set(Object.keys(BACKEND_LABELS));
const LOCAL_BACKENDS = new Set(['localstorage', 'sqljs']);
const LS_CACHE_KEY = 'hader:support:schools';

const elements = {
  panel: document.querySelector('[data-support-panel]'),
  tableBody: document.querySelector('[data-support-schools-body]'),
  emptyRow: document.querySelector('[data-support-empty]'),
  refresh: document.querySelector('[data-support-refresh]'),
  addNew: document.querySelector('[data-support-new]'),
  form: document.querySelector('[data-support-form]'),
  formTitle: document.querySelector('[data-support-form-title]'),
  status: document.querySelector('[data-support-status]'),
  id: document.querySelector('[data-support-id]'),
  name: document.querySelector('[data-support-name]'),
  displayName: document.querySelector('[data-support-display]'),
  timezone: document.querySelector('[data-support-timezone]'),
  enabled: document.querySelector('[data-support-enabled]'),
  disabledMessage: document.querySelector('[data-support-disabled-message]'),
  backend: document.querySelector('[data-support-backend]'),
  backendField: document.querySelector('[data-support-backend-field]'),
  otherFields: document.querySelector('[data-support-other-fields]'),
  otherApiBase: document.querySelector('[name="other_api_base"]'),
  otherToken: document.querySelector('[name="other_token"]'),
  otherNote: document.querySelector('[name="other_note"]'),
  cancel: document.querySelector('[data-support-cancel]'),
  save: document.querySelector('[data-support-save]'),
  originalId: document.querySelector('[data-support-original-id]'),
  toastStack: document.querySelector('[data-toast-stack]')
};

const state = {
  schools: [],
  editingId: null,
  loading: false,
  canEditBackend: false
};

init().catch((error) => {
  console.error('Support panel failed to initialise', error);
});

function init() {
  if (!elements.panel) {
    return Promise.resolve();
  }

  bindEvents();
  updateBackendAccess(readSupportAccessFlag());
  beginCreate();
  restoreFromCache();
  return refreshSchools({ silent: true });
}

function bindEvents() {
  elements.refresh?.addEventListener('click', () => refreshSchools());
  elements.addNew?.addEventListener('click', () => beginCreate());
  elements.backend?.addEventListener('change', () => toggleOtherFields());
  elements.cancel?.addEventListener('click', () => beginCreate());

  elements.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSave();
  });

  elements.tableBody?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest('[data-school-id]');
    if (!row) return;
    const schoolId = row.getAttribute('data-school-id');
    if (!schoolId) return;
    if (target.matches('[data-action="edit"]')) {
      event.preventDefault();
      beginEdit(schoolId);
    } else if (target.matches('[data-action="impersonate"]')) {
      event.preventDefault();
      impersonateSchool(schoolId);
    } else if (target.matches('[data-action="toggle-local"]')) {
      event.preventDefault();
      toggleLocalEnhancement(schoolId);
    }
  });

  document.addEventListener(SUPPORT_ACCESS_EVENT, (event) => {
    const allowed = Boolean(event?.detail?.supportAccess);
    updateBackendAccess(allowed);
  });
}

async function refreshSchools({ silent = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  updateStatus(silent ? '' : 'يتم تحميل قائمة المدارس...', 'info');
  elements.panel?.setAttribute('data-loading', 'true');

  try {
    const remote = await fetchRemoteSchools();
    if (remote && remote.length > 0) {
      state.schools = remote.slice().sort((a, b) => a.id.localeCompare(b.id));
      persistCache(remote);
      remote.forEach((school) => storeSchoolMeta(school));
      updateStatus(silent ? '' : 'تم تحديث قائمة المدارس.', 'success');
    } else if (state.schools.length > 0) {
      updateStatus('تعذّر تحديث البيانات. يتم عرض النسخة المخزنة.', 'warning');
    } else {
      updateStatus('لا توجد بيانات مدارس متاحة حاليًا.', 'warning');
    }
  } catch (error) {
    console.error('تعذّر تحميل المدارس.', error);
    if (state.schools.length > 0) {
      updateStatus('تعذّر التحديث. تم عرض البيانات المخزنة مؤقتًا.', 'warning');
    } else {
      updateStatus('فشل تحميل المدارس. تأكد من إعدادات الخادم.', 'error');
    }
  } finally {
    state.loading = false;
    elements.panel?.removeAttribute('data-loading');
    renderSchools();
  }
}

function restoreFromCache() {
  const cached = readCache();
  if (cached.length > 0) {
    state.schools = cached;
    renderSchools();
  }
}

async function fetchRemoteSchools() {
  const base = getApiBase();
  if (!base) {
    return [];
  }
  const endpoint = `${trimTrailingSlash(base)}/api/schools`;
  const response = await fetch(endpoint, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`فشل جلب المدارس (${response.status})`);
  }
  const payload = await safeJson(response);
  if (!Array.isArray(payload)) {
    console.warn('صيغة المدارس غير متوقعة. سيتم تجاهلها.');
    return [];
  }
  return payload.map(normalizeSchool).filter(Boolean);
}

function normalizeSchool(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const id = sanitizeId(source.id || source.school_id || '');
  if (!id) return null;
  const backendRaw = source.data_backend || source.backend || 'localstorage';
  const backend = ALLOWED_BACKENDS.has(String(backendRaw).toLowerCase())
    ? String(backendRaw).toLowerCase()
    : 'localstorage';
  const localReadySource =
    typeof source.local_ready === 'boolean'
      ? source.local_ready
      : typeof source.localReady === 'boolean'
        ? source.localReady
        : null;
  const localReady =
    localReadySource !== null
      ? localReadySource
      : readLocalEnhancement(id);

  return {
    id,
    name: sanitizeText(source.name || id),
    display_name: sanitizeText(source.display_name || source.displayName || source.name || id),
    timezone: sanitizeText(source.timezone || 'Asia/Riyadh'),
    enabled: source.enabled !== false,
    data_backend: backend,
    backend_meta: normalizeBackendMeta(source.backend_meta || source.backendMeta || null),
    local_ready: Boolean(localReady),
    disabled_message: sanitizeMultiline(source.disabled_message || source.disabledMessage || '')
  };
}

function normalizeBackendMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const copy = { ...meta };
  if (copy.api_base) {
    copy.api_base = String(copy.api_base).trim();
  }
  if (copy.token) {
    copy.token = String(copy.token).trim();
  }
  if (copy.note) {
    copy.note = String(copy.note).trim();
  }
  return copy;
}

function sanitizeId(value) {
  const raw = typeof value === 'string' ? value.trim() : String(value || '').trim();
  return raw.replace(/\s+/g, '_');
}

function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeMultiline(value) {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : String(value || '');
  return text.replace(/\r\n?/g, '\n').trim();
}

function storeSchoolMeta(school) {
  try {
    window.HaderBackendFactory?.storeSchoolMeta?.(school);
  } catch (error) {
    console.warn('تعذّر حفظ بيانات المدرسة المحلية.', error);
  }
}

function persistCache(list) {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn('تعذّر حفظ قائمة المدارس في الذاكرة المؤقتة.', error);
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeSchool)
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    console.warn('تعذّر قراءة نسخة المدارس المخزنة.', error);
    return [];
  }
}

function renderSchools() {
  if (!elements.tableBody) return;
  elements.tableBody.innerHTML = '';
  if (state.schools.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="5">لا توجد مدارس مسجلة بعد.</td>';
    elements.tableBody.appendChild(emptyRow);
    return;
  }

  state.schools.forEach((school) => {
    const row = document.createElement('tr');
    row.setAttribute('data-school-id', school.id);

    const nameCell = document.createElement('td');
    nameCell.className = 'support-table__cell support-table__cell--name';
    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'support-school';
    const title = document.createElement('span');
    title.className = 'support-school__title';
    title.textContent = school.display_name || school.name || school.id;
    const id = document.createElement('span');
    id.className = 'support-school__id';
    id.textContent = school.id;
    nameWrapper.appendChild(title);
    nameWrapper.appendChild(id);
    nameCell.appendChild(nameWrapper);

    const tzCell = document.createElement('td');
    tzCell.textContent = school.timezone || '—';

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `support-badge support-badge--${school.enabled ? 'active' : 'inactive'}`;
    statusBadge.textContent = school.enabled ? 'مفعّلة' : 'موقوفة';
    statusCell.appendChild(statusBadge);

    const backendCell = document.createElement('td');
    const backendBadge = document.createElement('span');
    const backendClasses = ['support-backend', `support-backend--${school.data_backend}`];
    const isLocalBackend = LOCAL_BACKENDS.has(school.data_backend);
    if (isLocalBackend && school.local_ready) {
      backendClasses.push('support-backend--local-ready');
    }
    backendBadge.className = backendClasses.join(' ');
    const backendLabel = BACKEND_LABELS[school.data_backend] || school.data_backend;
    backendBadge.textContent = isLocalBackend
      ? school.local_ready
        ? `${backendLabel} — مفعّل`
        : `${backendLabel} — افتراضي`
      : backendLabel;
    backendCell.appendChild(backendBadge);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'support-table__actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'support-table__button';
    editButton.textContent = 'تعديل';
    editButton.setAttribute('data-action', 'edit');
    const impersonateButton = document.createElement('button');
    impersonateButton.type = 'button';
    impersonateButton.className = 'support-table__button';
    impersonateButton.textContent = 'انتحال الجلسة';
    impersonateButton.setAttribute('data-action', 'impersonate');
    actionsCell.appendChild(editButton);
    if (state.canEditBackend && isLocalBackend) {
      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'support-table__button';
      toggleButton.textContent = school.local_ready ? 'تعطيل التفعيل المحلي' : 'تفعيل كامل للوضع المحلي';
      toggleButton.setAttribute('data-action', 'toggle-local');
      toggleButton.setAttribute('data-state', school.local_ready ? 'enabled' : 'disabled');
      actionsCell.appendChild(toggleButton);
    }
    actionsCell.appendChild(impersonateButton);

    row.appendChild(nameCell);
    row.appendChild(tzCell);
    row.appendChild(statusCell);
    row.appendChild(backendCell);
    row.appendChild(actionsCell);

    elements.tableBody.appendChild(row);
  });
}

function beginCreate() {
  state.editingId = null;
  if (elements.formTitle) {
    elements.formTitle.textContent = 'إضافة مدرسة جديدة';
  }
  if (elements.save) {
    elements.save.textContent = 'حفظ المدرسة';
  }
  elements.originalId && (elements.originalId.value = '');
  elements.id && (elements.id.value = '');
  elements.name && (elements.name.value = '');
  elements.displayName && (elements.displayName.value = '');
  elements.timezone && (elements.timezone.value = 'Asia/Riyadh');
  elements.enabled && (elements.enabled.value = 'true');
  if (elements.disabledMessage) {
    elements.disabledMessage.value = '';
  }
  elements.backend && (elements.backend.value = 'localstorage');
  if (elements.otherApiBase) elements.otherApiBase.value = '';
  if (elements.otherToken) elements.otherToken.value = '';
  if (elements.otherNote) elements.otherNote.value = '';
  toggleOtherFields();
  updateStatus('', 'info');
}

function beginEdit(schoolId) {
  const school = state.schools.find((item) => item.id === schoolId);
  if (!school) {
    updateStatus('تعذّر العثور على المدرسة المطلوبة.', 'error');
    return;
  }
  state.editingId = school.id;
  if (elements.formTitle) {
    elements.formTitle.textContent = `تعديل المدرسة: ${school.display_name || school.id}`;
  }
  if (elements.save) {
    elements.save.textContent = 'تحديث المدرسة';
  }
  if (elements.originalId) elements.originalId.value = school.id;
  if (elements.id) elements.id.value = school.id;
  if (elements.name) elements.name.value = school.name || school.id;
  if (elements.displayName) elements.displayName.value = school.display_name || school.name || school.id;
  if (elements.timezone) elements.timezone.value = school.timezone || 'Asia/Riyadh';
  if (elements.enabled) elements.enabled.value = school.enabled ? 'true' : 'false';
  if (elements.disabledMessage) {
    elements.disabledMessage.value = school.disabled_message || '';
  }
  if (elements.backend) elements.backend.value = school.data_backend || 'localstorage';
  if (elements.otherApiBase) elements.otherApiBase.value = school.backend_meta?.api_base || '';
  if (elements.otherToken) elements.otherToken.value = school.backend_meta?.token || '';
  if (elements.otherNote) elements.otherNote.value = school.backend_meta?.note || '';
  toggleOtherFields();
  updateStatus('', 'info');
}

async function handleSave() {
  if (!elements.form) return;
  const formData = new FormData(elements.form);
  const id = sanitizeId(formData.get('id'));
  const name = sanitizeText(formData.get('name')) || id;
  const displayName = sanitizeText(formData.get('display_name')) || name;
  const timezone = sanitizeText(formData.get('timezone')) || 'Asia/Riyadh';
  const enabled = formData.get('enabled') !== 'false';
  const disabledMessage = sanitizeMultiline(formData.get('disabled_message'));
  let backendRaw;
  if (state.canEditBackend) {
    backendRaw = sanitizeText(formData.get('data_backend')) || 'localstorage';
  } else if (elements.backend) {
    backendRaw = sanitizeText(elements.backend.value) || 'localstorage';
  } else {
    backendRaw = 'localstorage';
  }
  const backend = ALLOWED_BACKENDS.has(backendRaw) ? backendRaw : 'localstorage';

  if (!id) {
    updateStatus('يرجى إدخال معرف المدرسة.', 'error');
    return;
  }

  const payload = {
    id,
    name,
    display_name: displayName,
    timezone,
    enabled,
    data_backend: backend,
    disabled_message: disabledMessage
  };

  if (backend === 'other') {
    if (state.canEditBackend) {
      payload.backend_meta = {
        api_base: sanitizeText(formData.get('other_api_base')),
        token: sanitizeText(formData.get('other_token')),
        note: sanitizeText(formData.get('other_note'))
      };
    } else {
      const existingMeta = state.schools.find((item) => item.id === (state.editingId || id))?.backend_meta;
      if (existingMeta) {
        payload.backend_meta = { ...existingMeta };
      }
    }
  }

  const editingOriginalId = state.editingId || elements.originalId?.value || null;
  const existingSchool = state.schools.find((item) => item.id === (editingOriginalId || id));
  if (existingSchool && typeof existingSchool.local_ready === 'boolean') {
    payload.local_ready = existingSchool.local_ready;
  } else {
    payload.local_ready = readLocalEnhancement(id);
  }
  const base = getApiBase();
  let remoteSaved = null;
  let remoteSuccess = false;

  if (base) {
    const endpoint = editingOriginalId
      ? `${trimTrailingSlash(base)}/api/schools/${encodeURIComponent(editingOriginalId)}`
      : `${trimTrailingSlash(base)}/api/schools`;
    const method = editingOriginalId ? 'PUT' : 'POST';
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`فشل حفظ المدرسة (${response.status})`);
      }
      const body = await safeJson(response);
      remoteSaved = normalizeSchool(body) || normalizeSchool(payload);
      remoteSuccess = true;
    } catch (error) {
      console.warn('فشل حفظ المدرسة عبر REST.', error);
      remoteSaved = normalizeSchool(payload);
      remoteSuccess = false;
    }
  } else {
    remoteSaved = normalizeSchool(payload);
  }

  if (!remoteSaved) {
    updateStatus('تعذّر حفظ بيانات المدرسة.', 'error');
    return;
  }

  const updatedList = state.schools.filter((item) => item.id !== (editingOriginalId || remoteSaved.id));
  updatedList.push(remoteSaved);
  state.schools = updatedList.sort((a, b) => a.id.localeCompare(b.id));
  persistCache(state.schools);
  storeSchoolMeta(remoteSaved);

  if (remoteSuccess) {
    try {
      window.HaderBackendFactory?.removeSchoolOverride?.(remoteSaved.id);
    } catch (error) {
      console.warn('تعذّر حذف التفضيل المحلي للمدرسة.', error);
    }
  } else {
    setSchoolOverride(remoteSaved.id, remoteSaved.data_backend);
    updateStatus('تم حفظ المدرسة محليًا. تحقق من الخادم لاحقًا للمزامنة.', 'warning');
  }

  renderSchools();
  beginCreate();
  showToast('تم حفظ بيانات المدرسة بنجاح.');
}

function impersonateSchool(schoolId) {
  const school = state.schools.find((item) => item.id === schoolId);
  if (!school) {
    updateStatus('تعذّر العثور على المدرسة المطلوبة للانتحال.', 'error');
    return;
  }
  try {
    localStorage.setItem('hader:school_id', school.id);
    window.SCHOOL_ID = school.id;
    window.DATA_BACKEND = school.data_backend;
    storeSchoolMeta(school);
    showToast(`تم تعيين المدرسة النشطة: ${school.display_name || school.id}`);
  } catch (error) {
    console.error('تعذّر ضبط المدرسة الحالية.', error);
    updateStatus('تعذّر ضبط المدرسة الحالية.', 'error');
  }
}

function toggleOtherFields() {
  if (!elements.backend || !elements.otherFields) return;
  if (!state.canEditBackend) {
    elements.otherFields.hidden = true;
    return;
  }
  const shouldShow = elements.backend.value === 'other';
  elements.otherFields.hidden = !shouldShow;
}

function updateStatus(message, level = 'info') {
  if (!elements.status) return;
  elements.status.textContent = message || '';
  elements.status.dataset.status = level;
}

function updateBackendAccess(allowed) {
  state.canEditBackend = Boolean(allowed);
  if (elements.backend) {
    elements.backend.disabled = !state.canEditBackend;
  }
  if (elements.backendField) {
    elements.backendField.hidden = !state.canEditBackend;
  }
  if (!state.canEditBackend && elements.backend && !elements.backend.value) {
    elements.backend.value = 'localstorage';
  }
  toggleOtherFields();
  renderSchools();
}

function readSupportAccessFlag() {
  if (!elements.panel) return false;
  return elements.panel.dataset.supportAccess === 'true';
}

function setSchoolOverride(schoolId, backend) {
  const key = schoolId ? `hader:school:${schoolId}:data_backend` : null;
  if (!key) return;
  try {
    localStorage.setItem(key, backend);
  } catch (error) {
    console.warn('تعذّر حفظ التفضيل المحلي للإشارة المضيئة.', error);
  }
}

function readLocalEnhancement(schoolId) {
  try {
    const factory = window.HaderBackendFactory;
    if (factory?.isLocalEnhanced) {
      return factory.isLocalEnhanced(schoolId);
    }
  } catch (error) {
    console.warn('تعذّر قراءة حالة التفعيل المحلي.', error);
  }
  return false;
}

function toggleLocalEnhancement(schoolId) {
  const school = state.schools.find((item) => item.id === schoolId);
  if (!school) {
    updateStatus('تعذّر العثور على المدرسة المطلوبة.', 'error');
    return;
  }
  if (!LOCAL_BACKENDS.has(school.data_backend)) {
    updateStatus('لا يمكن تفعيل الوضع المحلي إلا لمدارس LocalStorage أو SQL.js.', 'warning');
    return;
  }
  const nextValue = !school.local_ready;
  school.local_ready = nextValue;
  try {
    window.HaderBackendFactory?.setLocalEnhancement?.(school.id, nextValue);
  } catch (error) {
    console.warn('تعذّر تحديث حالة التفعيل المحلي.', error);
  }
  persistCache(state.schools);
  storeSchoolMeta(school);
  renderSchools();
  try {
    window.dispatchEvent(
      new CustomEvent('hader:local-ready-change', {
        detail: { schoolId: school.id, localReady: nextValue }
      })
    );
  } catch (error) {
    console.warn('تعذّر إرسال إشعار التفعيل المحلي.', error);
  }
  showToast(nextValue ? 'تم تفعيل الوضع المحلي بكامل المزايا.' : 'تم تعطيل التفعيل المحلي.');
}

function showToast(message) {
  if (!message || !elements.toastStack) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('is-exiting');
    window.setTimeout(() => toast.remove(), 320);
  }, 3200);
}

function getApiBase() {
  const value = typeof window !== 'undefined' ? window.API_BASE : null;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  try {
    const meta = document.querySelector('meta[name="hader-api-base"]');
    const content = meta?.getAttribute('content');
    return content && content.trim() ? content.trim() : '';
  } catch (error) {
    return '';
  }
}

function trimTrailingSlash(input) {
  return input ? input.replace(/\/+$/, '') : '';
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (error) {
    console.warn('تعذّر تحليل الاستجابة كـ JSON.', error);
    return null;
  }
}
