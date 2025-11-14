(function () {
  const ACTIVE_SCHOOL_ID =
    typeof window !== "undefined"
      ? window.SCHOOL_ID || localStorage.getItem("hader:school_id") || null
      : null;
  if (typeof window !== "undefined" && ACTIVE_SCHOOL_ID && !window.SCHOOL_ID) {
    window.SCHOOL_ID = ACTIVE_SCHOOL_ID;
  }

  const nsKey =
    (typeof window !== "undefined" && (window.HaderStores?.nsKey || window.nsKey)) ||
    ((base, schoolId) => `${base}_${String(schoolId || "default")}`);

  function getActiveSchoolId() {
    if (typeof window === "undefined") {
      return "default";
    }
    const resolved =
      window.SCHOOL_ID ||
      ACTIVE_SCHOOL_ID ||
      localStorage.getItem("hader:school_id") ||
      "default";
    return String(resolved || "default");
  }

  function schoolKey(base) {
    return nsKey(base, getActiveSchoolId());
  }

  function readSchoolItem(base) {
    const key = schoolKey(base);
    return localStorage.getItem(key) || localStorage.getItem(base);
  }

  function matchesSchoolKey(eventKey, base) {
    if (!eventKey) return false;
    const expected = schoolKey(base);
    return eventKey === expected || eventKey === base;
  }
  const THEME_LIBRARY = window.HaderTheme || null;
  const FALLBACK_THEMES = Object.freeze(["light", "dark", "system"]);
  const AVAILABLE_THEMES = THEME_LIBRARY?.AVAILABLE_THEMES || FALLBACK_THEMES;
  const DEFAULT_CUSTOM_THEME =
    THEME_LIBRARY?.DEFAULT_CUSTOM_COLORS || Object.freeze({ background: "#0b1320", strong: "#2f80ed", muted: "#a7b2c7" });
  const CARD_SHADOW_LIMITS = THEME_LIBRARY?.CARD_SHADOW_LIMITS || Object.freeze({ min: 0, max: 300 });
  const CARD_BORDER_WIDTH_LIMITS = THEME_LIBRARY?.CARD_BORDER_WIDTH_LIMITS || Object.freeze({ min: 0, max: 12 });

  const DEFAULT_SETTINGS = Object.freeze({
    schoolStart: "07:00",
    graceMinutes: 10,
    theme: "light",
    kioskBannerUrl: "",
    kioskBannerName: "",
    morningMessage: "",
    phrasesEarly: ["بداية مشرقة!"],
    phrasesLate: ["لا تفوّت الدقائق الجميلة."],
    generalTip: "الانضباط يرفع مقامك — احضر بدري وكن قدوة.",
    schoolName: "",
    principalName: "",
    usePinForAdmin: false,
    usePinForSupervisor: false,
    adminPinHash: "",
    supervisorPinHash: "",
    pinMaxAttempts: 5,
    pinLockMinutes: 10,
    uiTheme: "system",
    customThemeBackground: DEFAULT_CUSTOM_THEME.background,
    customThemeTextStrong: DEFAULT_CUSTOM_THEME.strong,
    customThemeTextMuted: DEFAULT_CUSTOM_THEME.muted,
    uiCardShadowIntensity: 100,
    uiCardBorderColor: null,
    uiCardBorderWidth: null,
    statusCardAutoHideMinutes: 3
  });

  const ROUTES = {
    student: "student.html",
    leave: "leave.html",
    parents: "parents.html",
    supervisor: "supervisor.html",
    admin: "admin.html"
  };

  const ROLE_LABELS = {
    admin: "لوحة الإدارة",
    supervisor: "لوحة المراقبة",
    leave: "بوابة الإشراف",
    parents: "أوليآء الأمور"
  };

  const DIRECT_ROLES = new Set(["student", "leave", "parents"]);

  const settingsChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("hader-settings") : null;

  const elements = {
    generalTip: document.querySelector("[data-general-tip] span:last-child"),
    cards: document.querySelectorAll(".access-card"),
    pinNotes: {
      admin: document.querySelector('[data-pin-note="admin"]'),
      supervisor: document.querySelector('[data-pin-note="supervisor"]')
    },
    schoolName: Array.from(document.querySelectorAll("[data-school-name]")),
    modal: document.querySelector("[data-pin-modal]"),
    pinForm: document.querySelector("[data-pin-form]"),
    pinInput: document.querySelector("[data-pin-form] input[name=pin]"),
    pinSubmit: document.querySelector("[data-pin-submit]"),
    pinMessage: document.querySelector("[data-pin-message]"),
    pinTitle: document.querySelector("[data-pin-title]"),
    pinCancel: document.querySelector("[data-pin-cancel]")
  };

  let settings = readSettings();
  let currentRole = null;
  let lockTimerId = null;

  applyThemePreference(settings.uiTheme);
  applySettings(settings);
  bindCardActions();
  bindModalActions();
  subscribeToUpdates();

  function readSettings() {
    const raw = readSchoolItem("aa_settings");
    if (!raw) {
      return normalizeSettingsObject({});
    }

    try {
      const parsed = JSON.parse(raw);
      return normalizeSettingsObject(parsed);
    } catch (err) {
      console.warn("تعذّر قراءة الإعدادات. سيتم استخدام القيم الافتراضية.", err);
      return normalizeSettingsObject({});
    }
  }

  function applySettings(nextSettings) {
    settings = normalizeSettingsObject(nextSettings);
    applyThemePreference(settings.uiTheme);
    updateSchoolName(settings.schoolName);
    if (elements.generalTip) {
      const tip = settings.generalTip && settings.generalTip.trim() !== "" ? settings.generalTip : DEFAULT_SETTINGS.generalTip;
      elements.generalTip.textContent = tip;
    }

    updatePinNotes("admin", settings.usePinForAdmin);
    updatePinNotes("supervisor", settings.usePinForSupervisor);
  }

  function sanitizeHexColor(value, fallback) {
    if (typeof THEME_LIBRARY?.sanitizeColor === "function") {
      return THEME_LIBRARY.sanitizeColor(value, fallback);
    }
    const raw = typeof value === "string" ? value.trim() : "";
    if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
      return raw.startsWith("#") ? raw.toLowerCase() : `#${raw.toLowerCase()}`;
    }
    return fallback;
  }

  function normalizeCustomThemeColors(source) {
    if (typeof THEME_LIBRARY?.normalizeCustomColors === "function") {
      return THEME_LIBRARY.normalizeCustomColors({
        background: source?.background ?? source?.customThemeBackground,
        strong: source?.strong ?? source?.customThemeTextStrong,
        muted: source?.muted ?? source?.customThemeTextMuted
      });
    }
    const background = sanitizeHexColor(
      source?.background ?? source?.customThemeBackground,
      DEFAULT_CUSTOM_THEME.background
    );
    const strong = sanitizeHexColor(source?.strong ?? source?.customThemeTextStrong, DEFAULT_CUSTOM_THEME.strong);
    const muted = sanitizeHexColor(source?.muted ?? source?.customThemeTextMuted, DEFAULT_CUSTOM_THEME.muted);
    return {
      background,
      strong,
      muted,
      accent: strong
    };
  }

  function sanitizeCardBorderWidth(value) {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const clamped = Math.min(Math.max(numeric, CARD_BORDER_WIDTH_LIMITS.min), CARD_BORDER_WIDTH_LIMITS.max);
    return Math.round(clamped * 100) / 100;
  }

  function sanitizeCardBorderColor(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed === "") return null;
    return sanitizeHexColor(trimmed, null);
  }

  function normalizeCardDecorations(source) {
    const base = source && typeof source === "object" ? source : {};
    const defaults = {
      shadowIntensity: DEFAULT_SETTINGS.uiCardShadowIntensity,
      borderColor: DEFAULT_SETTINGS.uiCardBorderColor,
      borderWidth: DEFAULT_SETTINGS.uiCardBorderWidth
    };
    if (typeof THEME_LIBRARY?.normalizeCardDecorations === "function") {
      return THEME_LIBRARY.normalizeCardDecorations(
        {
          shadowIntensity: base.uiCardShadowIntensity,
          borderColor: base.uiCardBorderColor,
          borderWidth: base.uiCardBorderWidth
        },
        defaults
      );
    }
    return {
      shadowIntensity: clampNumber(
        base.uiCardShadowIntensity,
        CARD_SHADOW_LIMITS.min,
        CARD_SHADOW_LIMITS.max,
        defaults.shadowIntensity
      ),
      borderColor: sanitizeCardBorderColor(base.uiCardBorderColor),
      borderWidth: sanitizeCardBorderWidth(base.uiCardBorderWidth)
    };
  }

  function normalizeSettingsObject(input) {
    const source = input && typeof input === "object" ? input : {};
    const merged = { ...DEFAULT_SETTINGS, ...source };
    const colors = normalizeCustomThemeColors(merged);
    merged.customThemeBackground = colors.background;
    merged.customThemeTextStrong = colors.strong;
    merged.customThemeTextMuted = colors.muted;
    const normalizedTheme = normalizeTheme(merged.uiTheme || merged.theme);
    merged.uiTheme = normalizedTheme;
    merged.theme = normalizedTheme;
    const decorations = normalizeCardDecorations(merged);
    merged.uiCardShadowIntensity = decorations.shadowIntensity;
    merged.uiCardBorderColor = decorations.borderColor;
    merged.uiCardBorderWidth = decorations.borderWidth;
    return merged;
  }

  function normalizeTheme(input) {
    if (typeof THEME_LIBRARY?.sanitizeTheme === "function") {
      return THEME_LIBRARY.sanitizeTheme(input);
    }
    const theme = typeof input === "string" ? input.trim() : "";
    return AVAILABLE_THEMES.includes(theme) ? theme : DEFAULT_SETTINGS.uiTheme;
  }

  function applyThemePreference(theme) {
    const normalized = normalizeTheme(theme);
    const colors = normalizeCustomThemeColors(settings);
    if (typeof THEME_LIBRARY?.applyTheme === "function") {
      THEME_LIBRARY.applyTheme(normalized, { customColors: colors });
    } else if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.theme = normalized;
    }
    if (typeof THEME_LIBRARY?.applyCardDecorations === "function") {
      const decorations = normalizeCardDecorations(settings);
      THEME_LIBRARY.applyCardDecorations(decorations);
    }
  }

  function updatePinNotes(role, usePin) {
    const noteEl = elements.pinNotes[role];
    if (!noteEl) return;

    if (usePin) {
      noteEl.textContent = "يتطلب إدخال PIN قبل المتابعة.";
    } else {
      noteEl.textContent = "الدخول مباشر دون الحاجة إلى PIN.";
    }
  }

  function bindCardActions() {
    elements.cards.forEach((card) => {
      const role = card.dataset.role;
      card.addEventListener("click", () => handleAccess(role));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleAccess(role);
        }
      });
    });
  }

  function bindModalActions() {
    elements.pinCancel?.addEventListener("click", closePinModal);

    elements.pinForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentRole) return;
      if (isRoleLocked(currentRole)) {
        return;
      }
      const pinValue = elements.pinInput.value.trim();
      if (!pinValue) {
        showPinMessage("يرجى إدخال PIN صالح.", "error");
        return;
      }

      setPinSubmitting(true);
      try {
        const hash = await sha256Base64(pinValue);
        const expectedHash = currentRole === "admin" ? settings.adminPinHash : settings.supervisorPinHash;

        if (!expectedHash) {
          showPinMessage("لم يتم ضبط PIN لهذا الدور بعد. يرجى التواصل مع الإدارة.", "error");
          setPinSubmitting(false);
          return;
        }

        if (hash === expectedHash) {
          resetPinAttempts(currentRole);
          showPinMessage("تم التحقق بنجاح. سيتم تحويلك الآن...", "success");
          setTimeout(() => {
            navigateToRole(currentRole);
            closePinModal();
          }, 400);
          return;
        }

        registerFailedAttempt(currentRole);
      } catch (err) {
        console.error("فشل التحقق من PIN", err);
        showPinMessage("حدث خطأ أثناء التحقق. حاول مرة أخرى.", "error");
      } finally {
        setPinSubmitting(false);
      }
    });

    elements.modal?.addEventListener("click", (event) => {
      if (event.target === elements.modal) {
        closePinModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && elements.modal?.getAttribute("aria-hidden") === "false") {
        closePinModal();
      }
    });
  }

  function updateSchoolName(name) {
    const cleanName = typeof name === "string" ? name.trim() : "";
    const hasName = cleanName !== "";
    if (!Array.isArray(elements.schoolName)) {
      return;
    }
    const fallback = "اسم المدرسة غير محدد";
    elements.schoolName.forEach((node) => {
      if (!node) return;
      node.textContent = hasName ? cleanName : fallback;
      if ("hidden" in node) {
        node.hidden = !hasName;
      }
      if (node.dataset) {
        node.dataset.empty = String(!hasName);
      }
    });
  }

  function subscribeToUpdates() {
    if (settingsChannel) {
      settingsChannel.addEventListener("message", (event) => {
        if (event?.data?.type === "settings-updated" && event.data.payload) {
          applySettings({ ...settings, ...event.data.payload });
        }
      });
    }

    window.addEventListener("storage", (event) => {
      if (matchesSchoolKey(event.key, "aa_settings") && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          applySettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch (err) {
          console.warn("تعذّر مزامنة الإعدادات من التخزين.", err);
        }
      }
    });
  }

  function handleAccess(role) {
    if (!role || !ROUTES[role]) {
      return;
    }

    if (DIRECT_ROLES.has(role)) {
      navigateToRole(role);
      return;
    }

    const requiresPin = role === "admin" ? settings.usePinForAdmin : settings.usePinForSupervisor;
    if (!requiresPin) {
      navigateToRole(role);
      return;
    }

    openPinModal(role);
  }

  function navigateToRole(role) {
    const target = ROUTES[role];
    if (!target) return;
    window.location.href = target;
  }

  function openPinModal(role) {
    currentRole = role;
    const label = ROLE_LABELS[role] ?? "";
    elements.pinTitle.textContent = `إدخال PIN - ${label}`;
    elements.modal.setAttribute("aria-hidden", "false");
    elements.modal.style.display = "flex";
    elements.pinForm.reset();
    showPinMessage("", "info");
    elements.pinInput.focus();
    assessLockState(role);
  }

  function closePinModal() {
    if (lockTimerId) {
      clearTimeout(lockTimerId);
      lockTimerId = null;
    }
    elements.modal?.setAttribute("aria-hidden", "true");
    elements.modal.style.display = "none";
    elements.pinInput.value = "";
    showPinMessage("", "info");
    setPinSubmitting(false);
    currentRole = null;
  }

  function showPinMessage(message, variant) {
    if (!elements.pinMessage) return;
    elements.pinMessage.textContent = message;
    elements.pinMessage.dataset.variant = variant || "info";
  }

  function setPinSubmitting(isSubmitting) {
    if (!elements.pinSubmit || !elements.pinInput) return;
    elements.pinSubmit.disabled = isSubmitting;
    elements.pinInput.readOnly = isSubmitting;
  }

  function loadPinAttempts(role) {
    const key = `aa_pinAttempts_${role}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { count: 0, until: null };
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        count: typeof parsed.count === "number" ? parsed.count : 0,
        until: typeof parsed.until === "number" ? parsed.until : null
      };
    } catch (err) {
      console.warn("تعذّر قراءة سجل المحاولات.", err);
      return { count: 0, until: null };
    }
  }

  function savePinAttempts(role, data) {
    const key = `aa_pinAttempts_${role}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  function resetPinAttempts(role) {
    savePinAttempts(role, { count: 0, until: null });
    if (lockTimerId) {
      clearTimeout(lockTimerId);
      lockTimerId = null;
    }
    if (currentRole === role) {
      showPinMessage("", "info");
      elements.pinInput.readOnly = false;
      elements.pinSubmit.disabled = false;
    }
  }

  function registerFailedAttempt(role) {
    const attempts = loadPinAttempts(role);
    const maxAttempts = Number(settings.pinMaxAttempts) || DEFAULT_SETTINGS.pinMaxAttempts;
    attempts.count += 1;

    if (attempts.count >= maxAttempts) {
      const lockMinutes = Number(settings.pinLockMinutes) || DEFAULT_SETTINGS.pinLockMinutes;
      const lockUntil = Date.now() + lockMinutes * 60 * 1000;
      attempts.until = lockUntil;
      savePinAttempts(role, attempts);
      beginLockCountdown(role, lockUntil, lockMinutes);
      return;
    }

    savePinAttempts(role, attempts);
    const remaining = maxAttempts - attempts.count;
    const attemptWord = remaining === 1 ? "محاولة أخيرة" : `${remaining} محاولات متبقية`;
    showPinMessage(`PIN غير صحيح. ${attemptWord}.`, "error");
  }

  function beginLockCountdown(role, untilTimestamp, lockMinutes) {
    if (lockTimerId) {
      clearTimeout(lockTimerId);
      lockTimerId = null;
    }

    setPinSubmitting(false);
    elements.pinInput.readOnly = true;
    elements.pinSubmit.disabled = true;

    const updateCountdown = () => {
      const remainingMs = untilTimestamp - Date.now();
      if (remainingMs <= 0) {
        resetPinAttempts(role);
        showPinMessage("يمكنك المحاولة مجددًا الآن.", "info");
        return;
      }
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(remainingSeconds / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
      showPinMessage(`تم قفل المحاولات لمدة ${lockMinutes} دقائق. متبقٍ ${minutes}:${seconds}.`, "error");
      lockTimerId = window.setTimeout(updateCountdown, 1000);
    };

    updateCountdown();
  }

  function isRoleLocked(role) {
    const attempts = loadPinAttempts(role);
    if (!attempts.until) return false;
    if (Date.now() >= attempts.until) {
      resetPinAttempts(role);
      return false;
    }
    beginLockCountdown(role, attempts.until, Number(settings.pinLockMinutes) || DEFAULT_SETTINGS.pinLockMinutes);
    return true;
  }

  function assessLockState(role) {
    const attempts = loadPinAttempts(role);
    if (attempts.until && Date.now() < attempts.until) {
      beginLockCountdown(role, attempts.until, Number(settings.pinLockMinutes) || DEFAULT_SETTINGS.pinLockMinutes);
    } else {
      resetPinAttempts(role);
    }
  }

  async function sha256Base64(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }
})();
