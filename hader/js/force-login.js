(function () {
  const DEFAULT_SLUG = 'myschool';
  const rootId = 'forceLoginRoot';
  let activeBackdrop = null;
  let escHandler = null;
  let previousOverflow = null;

  function resolveSlug() {
    const host = window.location && typeof window.location.hostname === 'string'
      ? window.location.hostname
      : '';
    const parts = host.split('.').filter(Boolean);
    const firstPart = (parts[0] || '').toLowerCase();
    if (!firstPart || firstPart === 'localhost') {
      return DEFAULT_SLUG;
    }
    return firstPart;
  }

  const slug = resolveSlug();
  const configs = window.HADER_SCHOOL_CONFIGS || {};
  const config = configs[slug] || configs.default || {};
  const credentials = config.forceLoginCreds || { user: 'admin', pass: 'admin' };
  const sessionKey = `hader_logged_in:${slug}`;

  window.HADER_ACTIVE_SLUG = slug;
  window.HADER_ACTIVE_CONFIG = config;

  function isLoggedIn() {
    try {
      return window.sessionStorage.getItem(sessionKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function setLoggedIn() {
    try {
      window.sessionStorage.setItem(sessionKey, '1');
    } catch (error) {
      console.warn('تعذّر حفظ حالة تسجيل الدخول.', error);
    }
  }

  function clearLoggedIn() {
    try {
      window.sessionStorage.removeItem(sessionKey);
    } catch (error) {
      console.warn('تعذّر حذف حالة تسجيل الدخول.', error);
    }
  }

  window.haderLogout = function haderLogout() {
    clearLoggedIn();
    window.location.reload();
  };

  function ensureRoot() {
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement('div');
      root.id = rootId;
      document.body.appendChild(root);
    }
    return root;
  }

  function ensureStyles() {
    if (document.getElementById('force-login-style')) {
      return;
    }

    const hasAdminStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((link) => {
      const href = link.getAttribute('href') || '';
      return /admin\.css($|[?#])/i.test(href);
    });

    if (hasAdminStyles) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'force-login-style';
    style.textContent = `
      .force-login-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;}
      .force-login-modal{background:var(--adm-card,#0f1a2f);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px;min-width:320px;max-width:90vw}
      .force-login-modal h3{margin:0 0 8px}
      .force-login-modal p{margin:0}
      .force-login-modal .row{display:flex;flex-direction:column;gap:8px;margin:10px 0}
      .force-login-modal .input{height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;padding:0 10px}
      .force-login-modal .btn{height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:var(--adm-accent,#2f80ed);color:#fff;padding:0 12px}
      .force-login-modal .err{color:#f87171;font-size:.9rem;margin-top:4px;min-height:1.2em}
    `;
    document.head.appendChild(style);
  }

  function lockPage() {
    if (previousOverflow === null) {
      previousOverflow = document.documentElement.style.overflow;
    }
    document.documentElement.style.overflow = 'hidden';
  }

  function unlockPage() {
    if (previousOverflow !== null) {
      document.documentElement.style.overflow = previousOverflow;
      previousOverflow = null;
    }
  }

  function preventEscape(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function closeModal() {
    if (escHandler) {
      document.removeEventListener('keydown', escHandler, true);
      escHandler = null;
    }
    unlockPage();
    if (activeBackdrop) {
      activeBackdrop.remove();
      activeBackdrop = null;
    }
  }

  function showLoginModal() {
    ensureStyles();
    const root = ensureRoot();
    root.innerHTML = '';

    const backdrop = document.createElement('div');
    backdrop.className = 'force-login-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const modal = document.createElement('div');
    modal.className = 'force-login-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'تسجيل دخول إلزامي');

    const title = document.createElement('h3');
    title.textContent = 'تسجيل الدخول إلزامي';

    const hint = document.createElement('p');
    hint.textContent = 'يرجى إدخال بيانات الإدارة للمتابعة.';

    const form = document.createElement('form');
    form.noValidate = true;

    const userRow = document.createElement('div');
    userRow.className = 'row';
    const userLabel = document.createElement('label');
    userLabel.textContent = 'اسم المستخدم';
    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.className = 'input';
    userInput.autocomplete = 'username';
    userInput.required = true;
    userRow.appendChild(userLabel);
    userRow.appendChild(userInput);

    const passRow = document.createElement('div');
    passRow.className = 'row';
    const passLabel = document.createElement('label');
    passLabel.textContent = 'كلمة المرور';
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.className = 'input';
    passInput.autocomplete = 'current-password';
    passInput.required = true;
    passRow.appendChild(passLabel);
    passRow.appendChild(passInput);

    const errorBox = document.createElement('div');
    errorBox.className = 'err';
    errorBox.setAttribute('role', 'alert');

    const actionRow = document.createElement('div');
    actionRow.className = 'row';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn';
    submitBtn.textContent = 'دخول';
    actionRow.appendChild(submitBtn);

    form.appendChild(userRow);
    form.appendChild(passRow);
    form.appendChild(errorBox);
    form.appendChild(actionRow);

    modal.appendChild(title);
    modal.appendChild(hint);
    modal.appendChild(form);
    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    activeBackdrop = backdrop;
    escHandler = preventEscape;
    document.addEventListener('keydown', escHandler, true);

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const enteredUser = userInput.value.trim();
      const enteredPass = passInput.value.trim();
      const expectedUser = typeof credentials.user === 'string' ? credentials.user : 'admin';
      const expectedPass = typeof credentials.pass === 'string' ? credentials.pass : 'admin';

      if (enteredUser === expectedUser && enteredPass === expectedPass) {
        errorBox.textContent = '';
        setLoggedIn();
        closeModal();
        return;
      }

      errorBox.textContent = 'بيانات الدخول غير صحيحة.';
    });

    window.setTimeout(() => {
      userInput.focus();
    }, 0);

    lockPage();
  }

  function enforceLogin() {
    if (!config.forceLogin) {
      return;
    }

    if (isLoggedIn()) {
      return;
    }

    showLoginModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceLogin);
  } else {
    enforceLogin();
  }
})();
