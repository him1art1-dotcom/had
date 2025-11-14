(function () {
  const host = window.location?.hostname || "";
  const parts = host.split(".").filter(Boolean);
  let slug = parts.length > 2 ? parts[0] : parts[0] || "";
  if (slug === "www" || slug === "localhost" || /^\d+$/.test(slug)) {
    slug = "";
  }
  const slugKey = slug || "default";
  const configs = window.HADER_SCHOOL_CONFIGS || {};
  const config = configs[slugKey] || configs.default || {};
  const sessionKey = `hader_logged_in:${slugKey}`;
  const credentials = config.forceLoginCreds || { user: "admin", pass: "admin" };

  window.HADER_ACTIVE_SLUG = slugKey;
  window.HADER_ACTIVE_CONFIG = config;

  let escHandler = null;

  function ensureStyles() {
    if (document.getElementById("force-login-style")) return;
    const style = document.createElement("style");
    style.id = "force-login-style";
    style.textContent = `
      .force-login-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(5, 10, 18, 0.82);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9998;
        padding: 24px;
      }
      .force-login-modal {
        background: #0f1a2f;
        color: #e9eef7;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        max-width: 360px;
        width: 100%;
        padding: 24px;
        font-family: "Tajawal", "Cairo", sans-serif;
      }
      .force-login-modal h2 {
        margin: 0 0 12px;
        font-size: 1.4rem;
        font-weight: 700;
      }
      .force-login-modal p {
        margin: 0 0 16px;
        color: rgba(233, 238, 247, 0.82);
      }
      .force-login-form {
        display: grid;
        gap: 12px;
      }
      .force-login-form label {
        display: grid;
        gap: 6px;
        font-weight: 600;
      }
      .force-login-form input[type="text"],
      .force-login-form input[type="password"] {
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(11, 19, 32, 0.75);
        color: #e9eef7;
        padding: 10px 12px;
        font-size: 1rem;
      }
      .force-login-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
      .force-login-btn {
        min-width: 120px;
        padding: 10px 18px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        background: rgba(47, 128, 237, 0.9);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      .force-login-btn:disabled {
        opacity: 0.6;
        cursor: progress;
      }
      .force-login-error {
        color: #f87171;
        font-weight: 600;
        margin-top: 4px;
        min-height: 18px;
      }
    `;
    document.head.appendChild(style);
  }

  function disablePageInteraction() {
    document.documentElement.style.overflow = "hidden";
  }

  function restorePageInteraction() {
    document.documentElement.style.overflow = "";
  }

  function handleEsc(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function setLoggedIn() {
    try {
      window.sessionStorage.setItem(sessionKey, "1");
    } catch (err) {
      console.warn("Unable to persist login session", err);
    }
  }

  function clearLogin() {
    try {
      window.sessionStorage.removeItem(sessionKey);
    } catch (err) {
      console.warn("Unable to clear login session", err);
    }
  }

  function isLoggedIn() {
    try {
      return window.sessionStorage.getItem(sessionKey) === "1";
    } catch (err) {
      return false;
    }
  }

  function showLoginModal() {
    ensureStyles();
    disablePageInteraction();

    const backdrop = document.createElement("div");
    backdrop.className = "force-login-backdrop";
    backdrop.setAttribute("role", "presentation");

    const modal = document.createElement("div");
    modal.className = "force-login-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "force-login-title");

    modal.innerHTML = `
      <h2 id="force-login-title">تسجيل دخول إلزامي</h2>
      <p>يجب تسجيل الدخول لمتابعة الاستخدام.</p>
      <form class="force-login-form" novalidate>
        <label>
          <span>اسم المستخدم</span>
          <input type="text" name="username" autocomplete="username" required />
        </label>
        <label>
          <span>كلمة المرور</span>
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <div class="force-login-error" data-error></div>
        <div class="force-login-actions">
          <button type="submit" class="force-login-btn">تسجيل الدخول</button>
        </div>
      </form>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const form = modal.querySelector(".force-login-form");
    const usernameInput = form.querySelector('input[name="username"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const errorEl = form.querySelector("[data-error]");
    usernameInput.focus();

    const preventOutsideClose = (event) => {
      if (event.target === backdrop) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    backdrop.addEventListener("click", preventOutsideClose, true);

    escHandler = handleEsc;
    document.addEventListener("keydown", escHandler, true);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      const expectedUser = credentials.user || "admin";
      const expectedPass = credentials.pass || "admin";
      if (username === expectedUser && password === expectedPass) {
        setLoggedIn();
        errorEl.textContent = "";
        cleanup();
        return;
      }
      errorEl.textContent = "بيانات الدخول غير صحيحة.";
    });

    function cleanup() {
      if (escHandler) {
        document.removeEventListener("keydown", escHandler, true);
        escHandler = null;
      }
      restorePageInteraction();
      backdrop.remove();
    }
  }

  function enforceLogin() {
    if (!config.forceLogin) {
      registerLogoutButton();
      return;
    }
    if (isLoggedIn()) {
      registerLogoutButton();
      return;
    }
    showLoginModal();
    registerLogoutButton();
  }

  function registerLogoutButton() {
    const btn = document.querySelector("[data-force-logout]");
    if (!btn || btn.dataset.forceLogoutBound === "1") return;
    btn.dataset.forceLogoutBound = "1";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      clearLogin();
      window.location.reload();
    });
  }

  // إتاحة واجهة عامة لاستخدامات الفحص الصحي وغيرها
  window.forceLogin = window.forceLogin || {
    enforce: enforceLogin,
    logout: clearLogin,
    isLoggedIn
  };

  document.addEventListener("DOMContentLoaded", enforceLogin);
})();
