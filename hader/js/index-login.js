const LS_AUTH = 'hader:auth:session';
const LS_SCHOOL = 'hader:school_id';
const IDLE_MIN = 20;
const IDLE_TIMEOUT = IDLE_MIN * 60 * 1000;
const SUPPORT_ACCESS_EVENT = 'hader:support-access';
const SUPPORT_ROLES = new Set(['support', 'site_admin']);
const SCHOOL_REQUIRED_ROLES = new Set(['school_admin', 'supervisor_general', 'supervisor_class', 'kiosk_view']);
const SUPERVISOR_ROLES = new Set(['supervisor_general', 'supervisor_class']);
const ROLE_LABELS = Object.freeze({
  site_admin: 'Site Admin',
  support: 'دعم المنصة',
  school_admin: 'إدارة المدرسة',
  supervisor_general: 'مشرف عام',
  supervisor_class: 'مشرف فصل',
  kiosk_view: 'عرض الكشك'
});

const ROLE_MESSAGES = Object.freeze({
  site_admin: 'جلسة الإدارة العامة مفعّلة. يمكنك إدارة المدارس من هذه الواجهة.',
  support: 'جلسة الدعم مفعّلة. ستظهر لك أدوات الدعم في الصفحة الحالية.',
  school_admin: 'أنت جاهز لإدارة المدرسة الخاصة بك. استخدم الزر أدناه للانتقال.',
  supervisor_general: 'يمكنك متابعة الإشراف العام من البوابة الخاصة بالمشرفين.',
  supervisor_class: 'يمكنك إدارة الفصول عبر بوابة الإشراف. سيتم طلب بيانات الفصول هناك.',
  kiosk_view: 'يمكنك فتح واجهة الكشك مباشرة للعرض على الشاشة المخصصة.'
});

const elements = {
  modal: document.querySelector('[data-login-modal]'),
  modalBackdrop: document.querySelector('[data-login-dismiss]'),
  modalCancel: document.querySelectorAll('[data-login-cancel]'),
  form: document.querySelector('[data-login-form]'),
  providers: Array.from(document.querySelectorAll('[data-login-form] input[name="provider"]')),
  roleSelect: document.querySelector('[data-login-form] select[name="role"]'),
  schoolGroup: document.querySelector('[data-school-group]'),
  schoolInput: document.querySelector('[data-login-form] input[name="school_id"]'),
  submit: document.querySelector('[data-login-submit]'),
  error: document.querySelector('[data-login-error]'),
  note: document.querySelector('[data-backend-note]'),
  openButton: document.querySelector('[data-login-open]'),
  loginLabel: document.querySelector('[data-login-label]'),
  sessionHub: document.querySelector('[data-session-hub]'),
  sessionRole: document.querySelector('[data-session-role]'),
  sessionMessage: document.querySelector('[data-session-message]'),
  sessionLogout: document.querySelector('[data-session-logout]'),
  adminAction: document.querySelector('[data-role-admin]'),
  supervisorAction: document.querySelector('[data-role-supervisor]'),
  kioskAction: document.querySelector('[data-role-kiosk]'),
  toastStack: document.querySelector('[data-toast-stack]'),
  supportPanel: document.querySelector('[data-support-panel]')
};

let currentSession = null;
let idleTimer = null;
let idleListenersRegistered = false;

function loadSession() {
  const raw = localStorage.getItem(LS_AUTH);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const since = typeof parsed.since === 'number' ? parsed.since : Date.now();
    const last = typeof parsed.last === 'number' ? parsed.last : since;
    const normalized = {
      sub: typeof parsed.sub === 'string' ? parsed.sub : '',
      role: typeof parsed.role === 'string' ? parsed.role : '',
      school_id: parsed.school_id ?? null,
      provider: typeof parsed.provider === 'string' ? parsed.provider : 'local',
      remember: parsed.remember !== false,
      since,
      last
    };
    return normalized.role ? normalized : null;
  } catch (error) {
    console.warn('تعذّر قراءة جلسة الدخول المخزنة.', error);
    return null;
  }
}

function saveSession(session) {
  if (!session) {
    clearSession();
    return;
  }
  const since = typeof session.since === 'number' ? session.since : Date.now();
  const last = typeof session.last === 'number' ? session.last : since;
  const payload = {
    sub: session.sub || '',
    role: session.role || '',
    school_id: session.school_id ?? null,
    provider: session.provider || 'local',
    remember: session.remember !== false,
    since,
    last
  };

  currentSession = payload;
  try {
    localStorage.setItem(LS_AUTH, JSON.stringify(payload));
  } catch (error) {
    console.warn('تعذّر حفظ جلسة الدخول.', error);
  }
}

function clearSession() {
  currentSession = null;
  try {
    localStorage.removeItem(LS_AUTH);
  } catch (error) {
    console.warn('تعذّر مسح جلسة الدخول.', error);
  }
}

function syncSchoolId(id) {
  if (typeof window !== 'undefined' && id) {
    window.SCHOOL_ID = id;
  } else if (typeof window !== 'undefined' && !id) {
    try {
      delete window.SCHOOL_ID;
    } catch (_err) {
      window.SCHOOL_ID = null;
    }
  }

  if (id) {
    try {
      localStorage.setItem(LS_SCHOOL, String(id));
    } catch (error) {
      console.warn('تعذّر حفظ school_id.', error);
    }
  } else {
    try {
      localStorage.removeItem(LS_SCHOOL);
    } catch (error) {
      console.warn('تعذّر حذف school_id.', error);
    }
  }
}

function restoreSchoolIdFromStorage() {
  const stored = localStorage.getItem(LS_SCHOOL);
  if (stored && typeof window !== 'undefined') {
    window.SCHOOL_ID = stored;
  }
}

function startIdle() {
  stopIdle();
  if (!currentSession) return;
  idleTimer = window.setTimeout(() => {
    logout({ reason: 'idle' });
  }, IDLE_TIMEOUT);
}

function stopIdle() {
  if (idleTimer) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function touch() {
  if (!currentSession) return;
  currentSession.last = Date.now();
  try {
    localStorage.setItem(LS_AUTH, JSON.stringify(currentSession));
  } catch (error) {
    console.warn('تعذّر تحديث وقت الجلسة.', error);
  }
  startIdle();
}

function registerIdleListeners() {
  if (idleListenersRegistered) return;
  const handler = () => touch();
  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, handler, true);
  });
  window.addEventListener('focus', handler);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) handler();
  });
  idleListenersRegistered = true;
}

function applyRoleUI(session) {
  if (!elements.sessionHub) return;

  elements.adminAction?.setAttribute('hidden', 'true');
  elements.supervisorAction?.setAttribute('hidden', 'true');
  elements.kioskAction?.setAttribute('hidden', 'true');
  if (elements.sessionMessage) {
    elements.sessionMessage.textContent = 'سجّل الدخول للوصول إلى الواجهات المغلقة.';
  }
  elements.sessionHub.hidden = true;
  elements.sessionHub.dataset.role = '';

  if (!session) {
    updateSupportPanel(false);
    broadcastSupportAccess(null, false);
    return;
  }

  const role = session.role;
  elements.sessionHub.hidden = false;
  elements.sessionHub.dataset.role = role;
  const label = ROLE_LABELS[role] || role;
  if (elements.sessionRole) {
    elements.sessionRole.textContent = label;
  }
  if (elements.sessionMessage) {
    elements.sessionMessage.textContent = ROLE_MESSAGES[role] || '';
  }

  if (role === 'school_admin') {
    elements.adminAction?.removeAttribute('hidden');
  } else if (SUPERVISOR_ROLES.has(role)) {
    elements.supervisorAction?.removeAttribute('hidden');
  } else if (role === 'kiosk_view') {
    elements.kioskAction?.removeAttribute('hidden');
  }

  const supportAccess = SUPPORT_ROLES.has(role);
  updateSupportPanel(supportAccess);
  broadcastSupportAccess(session, supportAccess);
}

function updateSupportPanel(unlockBySession) {
  if (!elements.supportPanel) return;
  if (unlockBySession) {
    elements.supportPanel.hidden = false;
    elements.supportPanel.dataset.sessionUnlocked = 'true';
  } else if (elements.supportPanel.dataset.sessionUnlocked === 'true') {
    delete elements.supportPanel.dataset.sessionUnlocked;
    if (elements.supportPanel.dataset.pinUnlocked !== 'true') {
      elements.supportPanel.hidden = true;
    }
  }
  elements.supportPanel.dataset.supportAccess = unlockBySession ? 'true' : 'false';
}

function broadcastSupportAccess(session, supportAccess) {
  try {
    const detail = {
      supportAccess: Boolean(supportAccess),
      role: session?.role || null,
      schoolId: session?.school_id ?? null
    };
    document.dispatchEvent(new CustomEvent(SUPPORT_ACCESS_EVENT, { detail }));
  } catch (error) {
    console.warn('تعذّر إرسال تحديث صلاحيات الدعم.', error);
  }
}

function updateFab(session) {
  if (!elements.openButton || !elements.loginLabel) return;
  if (session) {
    elements.openButton.dataset.state = 'active';
    const label = ROLE_LABELS[session.role] || 'جلسة مفعّلة';
    elements.loginLabel.textContent = `جلسة ${label}`;
  } else {
    delete elements.openButton.dataset.state;
    elements.loginLabel.textContent = 'دخول';
  }
}

function getSelectedProvider() {
  const selected = elements.providers.find((input) => input.checked);
  return selected ? selected.value : 'local';
}

function updateBackendNote() {
  if (!elements.note) return;
  const provider = getSelectedProvider();
  if (provider === 'rest') {
    const base = getApiBase();
    elements.note.textContent = base
      ? `سيتم الاتصال عبر REST: ${base.replace(/\/$/, '')}`
      : 'لم يتم إعداد REST API بعد. اضبط window.API_BASE قبل الاستخدام.';
  } else if (provider === 'supabase') {
    elements.note.textContent = 'يتطلب هذا الخيار تفعيل تكامل Supabase في الواجهة الخلفية.';
  } else {
    elements.note.textContent = 'وضع Local مناسب للتجارب. تأكد من استخدام REST أو Supabase عند النشر.';
  }
}

function updateRoleFields() {
  if (!elements.roleSelect || !elements.schoolGroup || !elements.schoolInput) return;
  const role = elements.roleSelect.value;
  const requiresSchool = SCHOOL_REQUIRED_ROLES.has(role);
  if (requiresSchool) {
    elements.schoolGroup.hidden = false;
    elements.schoolInput.required = true;
  } else {
    elements.schoolGroup.hidden = true;
    elements.schoolInput.required = false;
    elements.schoolInput.value = '';
  }
}

async function loginLocal({ username, password, role, schoolId }) {
  const expected = window.LOCAL_TEST_PASS || '123456';
  if (!password) {
    throw new Error('أدخل كلمة المرور.');
  }
  if (password !== expected) {
    throw new Error('كلمة المرور غير صحيحة لوضع Local.');
  }
  return {
    sub: username || role,
    role,
    school_id: schoolId || null
  };
}

async function loginREST({ username, password, role, schoolId }) {
  const base = getApiBase();
  if (!base) {
    throw new Error('لم يتم إعداد REST API.');
  }
  const endpoint = `${trimTrailingSlash(base)}/auth/login`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      username,
      password,
      role,
      school_id: schoolId || undefined
    })
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || 'فشل تسجيل الدخول عبر REST.';
    throw new Error(message);
  }

  return data;
}

async function loginSupabase(payload) {
  if (typeof window.HaderSupabase?.login === 'function') {
    return window.HaderSupabase.login(payload);
  }
  throw new Error('تكامل Supabase غير مفعّل.');
}

function trimTrailingSlash(input) {
  return input.replace(/\/$/, '');
}

function getApiBase() {
  return (
    window.API_BASE ||
    window.REST_API_BASE ||
    window.APP_API_BASE ||
    window?.ENV?.API_BASE ||
    ''
  );
}

function showError(message) {
  if (!elements.error) return;
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function clearError() {
  if (!elements.error) return;
  elements.error.textContent = '';
  elements.error.hidden = true;
}

function openLoginModal() {
  if (!elements.modal) return;
  clearError();
  elements.modal.removeAttribute('hidden');
  elements.modal.setAttribute('aria-hidden', 'false');
  document.body?.classList.add('login-modal-open');
  updateBackendNote();
  updateRoleFields();
  const usernameInput = elements.form?.elements?.username;
  if (usernameInput) {
    usernameInput.focus();
    usernameInput.select?.();
  }
}

function closeLoginModal() {
  if (!elements.modal) return;
  elements.modal.setAttribute('hidden', 'true');
  elements.modal.setAttribute('aria-hidden', 'true');
  document.body?.classList.remove('login-modal-open');
  elements.openButton?.focus();
}

async function handleLogin(event) {
  event.preventDefault();
  if (!elements.form || !elements.submit) return;

  const formData = new FormData(elements.form);
  const provider = formData.get('provider') || 'local';
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || '').trim();
  const schoolIdRaw = String(formData.get('school_id') || '').trim();
  const schoolId = schoolIdRaw || null;
  const remember = formData.get('remember') !== null;

  if (!username) {
    showError('الرجاء إدخال البريد أو المعرّف.');
    return;
  }
  if (!password) {
    showError('الرجاء إدخال كلمة المرور أو PIN.');
    return;
  }
  if (!role) {
    showError('اختر الدور المطلوب.');
    return;
  }
  if (SCHOOL_REQUIRED_ROLES.has(role) && !schoolId) {
    showError('هذا الدور يتطلب إدخال school_id.');
    return;
  }

  clearError();
  elements.submit.disabled = true;
  elements.submit.textContent = 'جاري التحقق...';

  try {
    let result;
    if (provider === 'rest') {
      result = await loginREST({ username, password, role, schoolId });
    } else if (provider === 'supabase') {
      result = await loginSupabase({ username, password, role, schoolId });
    } else {
      result = await loginLocal({ username, password, role, schoolId });
    }

    const now = Date.now();
    const resolved = {
      sub: result?.sub || username,
      role: result?.role || role,
      school_id: result?.school_id ?? schoolId,
      provider,
      remember,
      since: now,
      last: now
    };

    saveSession(resolved);
    syncSchoolId(resolved.school_id || null);
    applyRoleUI(resolved);
    updateFab(resolved);
    startIdle();
    elements.form.reset();
    updateRoleFields();
    updateBackendNote();
    closeLoginModal();
    showToast('تم تسجيل الدخول بنجاح.');
  } catch (error) {
    showError(error?.message || 'تعذّر تسجيل الدخول.');
  } finally {
    elements.submit.disabled = false;
    elements.submit.textContent = 'دخول';
  }
}

async function logout({ reason } = {}) {
  if (!currentSession) return;
  const session = { ...currentSession };
  closeLoginModal();
  clearSession();
  syncSchoolId(null);
  applyRoleUI(null);
  updateFab(null);
  stopIdle();

  if (session.provider === 'rest') {
    const base = getApiBase();
    if (base) {
      const endpoint = `${trimTrailingSlash(base)}/auth/logout`;
      try {
        await fetch(endpoint, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.warn('تعذّر إنهاء جلسة REST.', error);
      }
    }
  }

  if (reason === 'idle') {
    showToast('تم تسجيل الخروج بسبب الخمول.');
  } else {
    showToast('تم تسجيل الخروج.');
  }
}

function showToast(message) {
  if (!elements.toastStack || !message) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('is-exiting');
    window.setTimeout(() => {
      toast.remove();
    }, 320);
  }, 3200);
}

function bindEvents() {
  elements.openButton?.addEventListener('click', () => openLoginModal());
  elements.modalBackdrop?.addEventListener('click', () => closeLoginModal());
  elements.modalCancel?.forEach((btn) => btn.addEventListener('click', () => closeLoginModal()));
  elements.form?.addEventListener('submit', handleLogin);
  elements.roleSelect?.addEventListener('change', () => updateRoleFields());
  elements.providers.forEach((input) => {
    input.addEventListener('change', () => updateBackendNote());
  });
  elements.adminAction?.addEventListener('click', () => {
    window.location.href = 'admin.html';
  });
  elements.supervisorAction?.addEventListener('click', () => {
    window.location.href = 'supervisor.html';
  });
  elements.kioskAction?.addEventListener('click', () => {
    window.location.href = 'student.html';
  });
  elements.sessionLogout?.addEventListener('click', () => logout());

  document.addEventListener('keydown', (event) => {
    if (event.altKey && !event.shiftKey && !event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      if (elements.modal?.hasAttribute('hidden')) {
        openLoginModal();
      } else {
        closeLoginModal();
      }
    }
    if (event.altKey && !event.shiftKey && !event.ctrlKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      logout();
    }
    if (event.key === 'Escape' && !elements.modal?.hasAttribute('hidden')) {
      closeLoginModal();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === LS_AUTH) {
      const next = loadSession();
      if (!next) {
        currentSession = null;
        applyRoleUI(null);
        updateFab(null);
        stopIdle();
      } else {
        currentSession = next;
        syncSchoolId(next.school_id || localStorage.getItem(LS_SCHOOL));
        applyRoleUI(next);
        updateFab(next);
        startIdle();
      }
    }
    if (event.key === LS_SCHOOL && typeof window !== 'undefined') {
      if (event.newValue) {
        window.SCHOOL_ID = event.newValue;
      } else {
        try {
          delete window.SCHOOL_ID;
        } catch (_err) {
          window.SCHOOL_ID = null;
        }
      }
    }
  });
}

function initializeFromStorage() {
  restoreSchoolIdFromStorage();
  const session = loadSession();
  if (!session) {
    updateFab(null);
    applyRoleUI(null);
    return;
  }
  const now = Date.now();
  const last = session.last || session.since || now;
  if (now - last >= IDLE_TIMEOUT) {
    clearSession();
    syncSchoolId(null);
    showToast('تم تسجيل الخروج بسبب الخمول.');
    updateFab(null);
    applyRoleUI(null);
    return;
  }

  currentSession = session;
  syncSchoolId(session.school_id || localStorage.getItem(LS_SCHOOL));
  applyRoleUI(session);
  updateFab(session);
  startIdle();
}

function setup() {
  bindEvents();
  registerIdleListeners();
  initializeFromStorage();
}

setup();

export { LS_AUTH, IDLE_MIN, loadSession, saveSession, clearSession, touch, startIdle, applyRoleUI, logout };
