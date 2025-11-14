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
    const resolved =
      ACTIVE_SCHOOL_ID ||
      (typeof window !== "undefined"
        ? window.SCHOOL_ID || localStorage.getItem("hader:school_id")
        : null);
    return String(resolved || "default");
  }

  function schoolKey(base) {
    return nsKey(base, getActiveSchoolId());
  }

  function readSchoolItem(base) {
    const key = schoolKey(base);
    return localStorage.getItem(key) || localStorage.getItem(base);
  }

  function writeSchoolItem(base, value) {
    localStorage.setItem(schoolKey(base), value);
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

  const STORE_PREFERENCE_KEY = "aa_store_preference";
  const SETTINGS_KEY = "aa_settings";
  const STUDENTS_KEY = "aa_students";
  const ATTENDANCE_KEY = "aa_attendance";
  const SETTINGS_CHANNEL_NAME = "hader-settings";
  const ATTENDANCE_CHANNEL_NAME = "attendance-sync";
  const SUPERVISION_REPORTS_KEY = "aa_supervision_reports";
  const SUPERVISION_REPORT_CHANNEL = "supervision-reports";
  const AUTO_DISPATCH_KEY = "aa_supervisor_auto_dispatch";

  const INITIAL_BACKEND_CHOICE = readBackendChoice();
  const SCHOOL_LOCK_MESSAGE = "راجع الدعم الفني";

  const DEFAULT_SETTINGS = Object.freeze({
    schoolStart: "07:00",
    graceMinutes: 10,
    uiTheme: "system",
    schoolName: "",
    principalName: "",
    customThemeBackground: DEFAULT_CUSTOM_THEME.background,
    customThemeTextStrong: DEFAULT_CUSTOM_THEME.strong,
    customThemeTextMuted: DEFAULT_CUSTOM_THEME.muted,
    uiCardShadowIntensity: 100,
    uiCardBorderColor: null,
    uiCardBorderWidth: null,
    statusCardAutoHideMinutes: 3,
    remoteSyncEnabled: false,
    remoteSyncEndpoint: "",
    remoteSyncAuthToken: "",
    remoteSyncSchoolCode: "",
    remoteSyncMode: "time",
    remoteSyncTime: "08:00",
    remoteSyncCountdownMinutes: 30,
    remoteSyncSupervisors: [],
    remoteSyncSupervisorsText: ""
  });
  const STATE_KEYS = Object.freeze(["present", "late", "absent"]);
  const STATE_LABELS = Object.freeze({
    present: "حاضر",
    late: "متأخر",
    absent: "غائب"
  });
  const COPYRIGHT_NOTICE = "© جميع الحقوق محفوظة | أ. هيثم الزهراني | Him.Art";

  const elements = {
    dayLabel: document.querySelector("[data-day-label]"),
    lastUpdate: document.querySelector("[data-last-update]"),
    storeIndicator: document.querySelector("[data-store-indicator]"),
    storeLabel: document.querySelector("[data-store-label]"),
    storeMessage: document.querySelector("[data-store-message]"),
    lockOverlay: document.querySelector("[data-school-lock]"),
    lockDialog: document.querySelector("[data-school-lock-dialog]"),
    lockMessage: document.querySelector("[data-school-lock-message]"),
    refreshButton: document.querySelector("[data-refresh]"),
    summary: {
      present: document.querySelector("[data-present-count]"),
      late: document.querySelector("[data-late-count]"),
      absent: document.querySelector("[data-absent-count]")
    },
    listCounts: {
      present: document.querySelector("[data-count-present]"),
      late: document.querySelector("[data-count-late]"),
      absent: document.querySelector("[data-count-absent]")
    },
    listBodies: {
      present: document.querySelector("[data-list-body=present]"),
      late: document.querySelector("[data-list-body=late]"),
      absent: document.querySelector("[data-list-body=absent]")
    },
    emptyStates: {
      present: document.querySelector("[data-empty=present]"),
      late: document.querySelector("[data-empty=late]"),
      absent: document.querySelector("[data-empty=absent]")
    },
    exportButtons: Array.from(document.querySelectorAll("[data-export-button]")),
    dispatch: {
      sendButton: document.querySelector("[data-dispatch-now]"),
      timeInput: document.querySelector("[data-dispatch-time]"),
      toggleButton: document.querySelector("[data-dispatch-toggle]"),
      status: document.querySelector("[data-dispatch-status]")
    }
  };
  elements.schoolName = Array.from(document.querySelectorAll("[data-school-name]"));

  const state = {
    store: null,
    storeType: mapBackendToStore(INITIAL_BACKEND_CHOICE),
    backendChoice: INITIAL_BACKEND_CHOICE,
    backendConnectionState: "unknown",
    backendErrorMessage: "",
    settings: { ...DEFAULT_SETTINGS, theme: DEFAULT_SETTINGS.uiTheme },
    students: [],
    todayKey: getDayKey(new Date()),
    buckets: {
      present: [],
      late: [],
      absent: []
    },
    dispatch: {
      autoEnabled: false,
      time: "08:00",
      lastAutoKey: "",
      lastDispatchedAt: "",
      timerId: null
    },
    schoolMeta: null
  };
  let dayWatcherId = null;

  const settingsChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SETTINGS_CHANNEL_NAME) : null;
  const attendanceChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(ATTENDANCE_CHANNEL_NAME) : null;
  const supervisionReportChannel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SUPERVISION_REPORT_CHANNEL) : null;

  refreshSchoolMeta();
  init().catch((error) => {
    console.error("فشل تهيئة لوحة المراقبة", error);
    if (elements.emptyStates.absent) {
      elements.emptyStates.absent.textContent = "تعذّر تحميل البيانات. يرجى التحقق من التخزين.";
    }
  });

  async function init() {
    applyThemePreference(state.settings.uiTheme);

    const { store, type } = await resolveStore();
    state.store = store;
    state.storeType = type;
    updateStoreIndicator();

    state.settings = await loadSettings();
    applySettings(state.settings);
    state.students = await loadStudents();

    await refreshBuckets();
    updateDayLabel();
    state.dispatch = { ...state.dispatch, ...loadDispatchPreferences() };
    applyDispatchPreferences();
    bindEvents();
    subscribeToUpdates();
    startDayWatcher();
    startDispatchScheduler();
  }

  async function resolveStore() {
    const preferredType = mapBackendToStore(state.backendChoice);

    if (preferredType === "sql" && typeof window.HaderStores?.createSqlStore === "function") {
      try {
        const instance = await window.HaderStores.createSqlStore();
        if (instance) {
          return { store: instance, type: "sql" };
        }
      } catch (error) {
        console.warn("تعذّر إنشاء مخزن SQL.js. سيتم استخدام LocalStorage.", error);
      }
    }

    if (typeof window.HaderStores?.createLocalStore === "function") {
      const localStore = window.HaderStores.createLocalStore({
        activeSchoolId: getActiveSchoolId()
      });
      if (localStore) {
        return { store: localStore, type: "local" };
      }
    }

    return { store: createInlineLocalStore(), type: "local" };
  }

  function createInlineLocalStore() {
    return {
      async getStudents() {
        return readStudentsFallback();
      },
      async getSettings() {
        return readSettingsFallback();
      },
      async getAttendanceDay(day) {
        const map = readAttendanceFallback();
        return map[day] ? { ...map[day] } : {};
      }
    };
  }

  function normalizeBackendName(name) {
    return typeof name === "string" && name.trim() ? name.trim().toLowerCase() : "localstorage";
  }

  function readCurrentSchoolMeta() {
    const schoolId = ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
    try {
      const factory = window.HaderBackendFactory;
      if (factory?.getSchoolMeta) {
        const meta = factory.getSchoolMeta(schoolId);
        if (meta && typeof meta === "object") {
          return { ...meta };
        }
      }
    } catch (error) {
      console.warn("تعذّر قراءة بيانات المدرسة من المصنع.", error);
    }

    const metaKey = `hader:school:${schoolId}:meta`;
    try {
      const raw = localStorage.getItem(metaKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (error) {
      console.warn("تعذّر قراءة بيانات المدرسة من LocalStorage.", error);
    }
    return null;
  }

  function refreshSchoolMeta() {
    const meta = readCurrentSchoolMeta();
    state.schoolMeta = meta;
    applySchoolLock(meta);
    return meta;
  }

  function applySchoolLock(meta) {
    const effectiveMeta = meta || state.schoolMeta || null;
    const isEnabled = !effectiveMeta || effectiveMeta.enabled !== false;
    const messageSource =
      effectiveMeta && typeof effectiveMeta?.disabled_message === "string"
        ? effectiveMeta.disabled_message.trim()
        : "";
    const message = messageSource || SCHOOL_LOCK_MESSAGE;

    if (!isEnabled) {
      if (elements.lockOverlay) {
        elements.lockOverlay.hidden = false;
      }
      if (elements.lockMessage) {
        elements.lockMessage.textContent = message;
      }
      if (document?.body?.dataset) {
        document.body.dataset.schoolLocked = "true";
      }
      if (elements.lockDialog && typeof elements.lockDialog.focus === "function") {
        const target = elements.lockDialog;
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => target.focus());
        } else {
          target.focus();
        }
      }
    } else {
      if (elements.lockOverlay) {
        elements.lockOverlay.hidden = true;
      }
      if (document?.body?.dataset) {
        delete document.body.dataset.schoolLocked;
      }
    }
  }

  function readBackendChoice() {
    try {
      const factory = window.HaderBackendFactory;
      const schoolId = ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
      if (factory?.getSchoolBackendChoice) {
        return normalizeBackendName(factory.getSchoolBackendChoice(schoolId));
      }
      if (factory?.getFallbackBackend) {
        return normalizeBackendName(factory.getFallbackBackend());
      }
    } catch (error) {
      console.warn("تعذّر قراءة إعداد الإشارة المضيئة للمشرف.", error);
    }

    const stored = localStorage.getItem(STORE_PREFERENCE_KEY);
    return stored === "sql" ? "sqljs" : "localstorage";
  }

  function mapBackendToStore(name) {
    const normalized = normalizeBackendName(name);
    if (normalized === "sqljs") return "sql";
    return "local";
  }

  function isRemoteBackend(name) {
    const normalized = normalizeBackendName(name);
    return normalized === "rest" || normalized === "supabase" || normalized === "other";
  }

  function isLocalBackend(name) {
    const normalized = normalizeBackendName(name);
    return normalized === "localstorage" || normalized === "sqljs";
  }

  function isLocalEnhancementActive() {
    try {
      const factory = window.HaderBackendFactory;
      const schoolId =
        ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
      if (factory?.isLocalEnhanced) {
        return factory.isLocalEnhanced(schoolId);
      }
      const metaKey = `hader:school:${schoolId}:meta`;
      const raw = localStorage.getItem(metaKey);
      if (raw) {
        const meta = JSON.parse(raw);
        if (meta && typeof meta.local_ready === "boolean") {
          return meta.local_ready;
        }
      }
    } catch (error) {
      console.warn("تعذّر قراءة حالة التفعيل المحلي.", error);
    }
    return false;
  }

  function sanitizeBackendErrorMessage(message) {
    if (!message) return "";
    const text = String(message).trim();
    if (!text) return "";
    if (/failed to fetch/i.test(text) || /network ?error/i.test(text)) {
      return "تعذّر الاتصال بالخادم. تحقق من الشبكة أو إعدادات CORS.";
    }
    if (/sql-wasm/i.test(text) || /wasm/i.test(text)) {
      return "ملف SQL.js مفقود أو غير قابل للوصول. تأكد من وجود sql-wasm.wasm في المسار الصحيح.";
    }
    return text;
  }

  function describeBackendError(error, fallback) {
    const defaultMessage = fallback || "تعذّر الاتصال بالمصدر الحالي.";
    if (!error) {
      return defaultMessage;
    }
    if (typeof error === "string") {
      const sanitized = sanitizeBackendErrorMessage(error);
      return sanitized || defaultMessage;
    }
    if (typeof error.message === "string" && error.message.trim()) {
      const sanitized = sanitizeBackendErrorMessage(error.message);
      if (sanitized) return sanitized;
    }
    if (typeof error.status === "number" && Number.isFinite(error.status)) {
      return `تعذّر الاتصال بالمصدر (رمز ${error.status}).`;
    }
    return defaultMessage;
  }

  function setBackendOk() {
    state.backendConnectionState = "ok";
    state.backendErrorMessage = "";
  }

  function setBackendError(error, fallback) {
    state.backendConnectionState = "error";
    state.backendErrorMessage = describeBackendError(error, fallback);
  }

  async function loadSettings() {
    if (!state.store?.getSettings) {
      return readSettingsFallback();
    }
    try {
      const settings = await state.store.getSettings();
      setBackendOk();
      if (isRemoteBackend(state.backendChoice)) {
        updateStoreIndicator();
      }
      return normalizeSettings(settings);
    } catch (error) {
      console.warn("تعذّر تحميل الإعدادات من المخزن.", error);
      if (isRemoteBackend(state.backendChoice)) {
        setBackendError(error, "تعذّر تحميل الإعدادات من المصدر الحالي.");
        updateStoreIndicator();
      }
      return readSettingsFallback();
    }
  }

  async function loadStudents() {
    if (!state.store?.getStudents) {
      return readStudentsFallback();
    }
    try {
      const list = await state.store.getStudents();
      setBackendOk();
      if (isRemoteBackend(state.backendChoice)) {
        updateStoreIndicator();
      }
      return normalizeStudents(list);
    } catch (error) {
      console.warn("تعذّر تحميل قائمة الطلاب من المخزن.", error);
      if (isRemoteBackend(state.backendChoice)) {
        setBackendError(error, "تعذّر تحميل قائمة الطلاب من المصدر الحالي.");
        updateStoreIndicator();
      }
      return readStudentsFallback();
    }
  }

  async function loadAttendanceDay(day) {
    if (!state.store?.getAttendanceDay) {
      const map = readAttendanceFallback();
      return map[day] ? { ...map[day] } : {};
    }
    try {
      const records = await state.store.getAttendanceDay(day);
      setBackendOk();
      if (isRemoteBackend(state.backendChoice)) {
        updateStoreIndicator();
      }
      return normalizeAttendanceRecords(records);
    } catch (error) {
      console.warn("تعذّر تحميل سجلات الحضور لليوم", day, error);
      if (isRemoteBackend(state.backendChoice)) {
        setBackendError(error, "تعذّر تحميل سجلات الحضور من المصدر الحالي.");
        updateStoreIndicator();
      }
      return {};
    }
  }

  async function refreshBuckets(options = {}) {
    if (options.reloadSettings) {
      state.settings = await loadSettings();
      applySettings(state.settings);
    }
    if (options.reloadStudents) {
      state.students = await loadStudents();
    }

    const attendance = await loadAttendanceDay(state.todayKey);
    state.buckets = buildBuckets(state.students, attendance, state.settings);
    renderBuckets();
    updateCounts();
    updateLastUpdate(new Date());
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

  function clampNumberWithin(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const lower = typeof min === "number" ? min : Number.NEGATIVE_INFINITY;
    const upper = typeof max === "number" ? max : Number.POSITIVE_INFINITY;
    const clamped = Math.min(Math.max(numeric, lower), upper);
    return Number.isFinite(clamped) ? clamped : fallback;
  }

  function sanitizeCardBorderWidth(value) {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const clamped = clampNumberWithin(numeric, CARD_BORDER_WIDTH_LIMITS.min, CARD_BORDER_WIDTH_LIMITS.max, null);
    return clamped == null ? null : Math.round(clamped * 100) / 100;
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
      shadowIntensity: clampNumberWithin(
        base.uiCardShadowIntensity,
        CARD_SHADOW_LIMITS.min,
        CARD_SHADOW_LIMITS.max,
        defaults.shadowIntensity
      ),
      borderColor: sanitizeCardBorderColor(base.uiCardBorderColor),
      borderWidth: sanitizeCardBorderWidth(base.uiCardBorderWidth)
    };
  }

  function applyCardDecorationsFromSettings(source) {
    const decorations = normalizeCardDecorations(source || state.settings);
    if (typeof THEME_LIBRARY?.applyCardDecorations === "function") {
      THEME_LIBRARY.applyCardDecorations(decorations);
      return;
    }
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (!root) return;
    if (decorations.borderColor) {
      root.style.setProperty("--surface-card-border-color", decorations.borderColor);
    } else {
      root.style.removeProperty("--surface-card-border-color");
    }
    if (decorations.borderWidth != null) {
      root.style.setProperty("--surface-card-border-width", `${decorations.borderWidth}px`);
    } else {
      root.style.removeProperty("--surface-card-border-width");
    }
    if (decorations.shadowIntensity == null || Math.abs(decorations.shadowIntensity - 100) < 0.001) {
      root.style.removeProperty("--surface-card-shadow");
    } else {
      root.style.setProperty("--surface-card-shadow", "var(--shadow-soft)");
    }
  }

  function normalizeTheme(theme) {
    if (typeof THEME_LIBRARY?.sanitizeTheme === "function") {
      return THEME_LIBRARY.sanitizeTheme(theme);
    }
    const value = typeof theme === "string" ? theme.trim() : "";
    return AVAILABLE_THEMES.includes(value) ? value : DEFAULT_SETTINGS.uiTheme;
  }

  function buildBuckets(students, attendanceMap, settings) {
    const normalizedMap = normalizeAttendanceRecords(attendanceMap);
    const threshold = getThresholdSeconds(settings);
    const result = {
      present: [],
      late: [],
      absent: []
    };

    students.forEach((student) => {
      const id = student.id;
      if (!id) return;
      const arrivalTime = normalizedMap[id] || null;
      const entry = {
        id,
        name: student.name,
        grade: student.grade,
        class: student.class,
        arrivalTime
      };

      if (!arrivalTime) {
        result.absent.push(entry);
        return;
      }

      const diff = parseTimeToSeconds(arrivalTime) - threshold;
      if (Number.isFinite(diff) && diff > 0) {
        result.late.push(entry);
      } else {
        result.present.push(entry);
      }
    });

    return {
      present: sortEntries(result.present),
      late: sortEntries(result.late),
      absent: sortEntries(result.absent)
    };
  }

  function sortEntries(list) {
    return [...list].sort((a, b) => {
      const gradeCompare = compareValues(a.grade, b.grade);
      if (gradeCompare !== 0) return gradeCompare;
      const classCompare = compareValues(a.class, b.class);
      if (classCompare !== 0) return classCompare;
      const nameCompare = compareValues(a.name, b.name);
      if (nameCompare !== 0) return nameCompare;
      return compareValues(a.id, b.id);
    });
  }

  function compareValues(a, b) {
    const aStr = sanitizeSortValue(a);
    const bStr = sanitizeSortValue(b);
    if (!aStr && !bStr) return 0;
    if (!aStr) return 1;
    if (!bStr) return -1;
    return aStr.localeCompare(bStr, "ar", { sensitivity: "base", numeric: true });
  }

  function sanitizeSortValue(value) {
    if (typeof value === "string") {
      return value.trim();
    }
    if (value == null) return "";
    return String(value).trim();
  }

  function renderBuckets() {
    STATE_KEYS.forEach((key) => {
      const body = elements.listBodies[key];
      const empty = elements.emptyStates[key];
      const rows = state.buckets[key] || [];

      if (body) {
        body.innerHTML = "";
        const fragment = document.createDocumentFragment();
        rows.forEach((entry) => {
          const tr = document.createElement("tr");
          appendCell(tr, entry.name);
          appendCell(tr, entry.id);
          appendCell(tr, entry.grade || "—");
          appendCell(tr, entry.class || "—");
          appendCell(tr, entry.arrivalTime || "—");
          fragment.appendChild(tr);
        });
        body.appendChild(fragment);
      }

      if (empty) {
        empty.hidden = rows.length > 0;
      }
    });
  }

  function appendCell(row, value) {
    const td = document.createElement("td");
    td.textContent = typeof value === "string" ? value : String(value ?? "");
    row.appendChild(td);
  }

  function updateCounts() {
    const presentCount = state.buckets.present.length;
    const lateCount = state.buckets.late.length;
    const absentCount = state.buckets.absent.length;

    if (elements.summary.present) elements.summary.present.textContent = presentCount.toString();
    if (elements.summary.late) elements.summary.late.textContent = lateCount.toString();
    if (elements.summary.absent) elements.summary.absent.textContent = absentCount.toString();

    if (elements.listCounts.present) elements.listCounts.present.textContent = presentCount.toString();
    if (elements.listCounts.late) elements.listCounts.late.textContent = lateCount.toString();
    if (elements.listCounts.absent) elements.listCounts.absent.textContent = absentCount.toString();
  }

  function updateLastUpdate(date) {
    if (!elements.lastUpdate) return;
    const label = date
      .toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .replace(/^24/, "00");
    elements.lastUpdate.textContent = label;
  }

  function updateDayLabel() {
    if (!elements.dayLabel) return;
    const iso = `${state.todayKey}T00:00:00`;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      elements.dayLabel.textContent = date.toLocaleDateString("ar-SA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      return;
    }
    elements.dayLabel.textContent = state.todayKey.replace(/-/g, "/");
  }

  function updateStoreIndicator() {
    if (!elements.storeLabel || !elements.storeIndicator) return;
    const latest = readBackendChoice();
    if (latest) {
      state.backendChoice = latest;
    }
    let stateName = "local";
    let label = "غير متصل";
    let showMessage = true;
    const meta = state.schoolMeta || readCurrentSchoolMeta();
    if (!state.schoolMeta && meta) {
      state.schoolMeta = meta;
    }
    const supportMessage = SCHOOL_LOCK_MESSAGE;
    const metaMessage =
      meta && typeof meta?.disabled_message === "string" && meta.disabled_message.trim()
        ? meta.disabled_message.trim()
        : supportMessage;
    let message = metaMessage;
    if (meta && meta.enabled === false) {
      stateName = "error";
      label = "غير متصل";
      showMessage = true;
    } else if (state.backendConnectionState === "error") {
      stateName = "error";
      message = state.backendErrorMessage || metaMessage;
    } else if (isRemoteBackend(state.backendChoice)) {
      stateName = "central";
      label = "متصل";
      showMessage = false;
      message = "";
    } else if (isLocalBackend(state.backendChoice) && isLocalEnhancementActive()) {
      stateName = "local-enhanced";
      label = "متصل";
      showMessage = false;
      message = "";
    } else {
      message = metaMessage;
    }
    elements.storeLabel.textContent = label;
    elements.storeIndicator.dataset.state = stateName;
    if (elements.storeMessage) {
      if (showMessage && message) {
        elements.storeMessage.textContent = message;
        elements.storeMessage.hidden = false;
      } else {
        elements.storeMessage.hidden = true;
      }
    }
  }

  function bindEvents() {
    elements.refreshButton?.addEventListener("click", () => {
      refreshBuckets({ reloadStudents: true }).catch((error) => {
        console.error("تعذّر تحديث القوائم يدويًا", error);
      });
    });

    elements.exportButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const list = button.dataset.list;
        const format = button.dataset.format;
        handleExport(list, format);
      });
    });

    elements.dispatch?.sendButton?.addEventListener("click", handleDispatchNow);
    elements.dispatch?.timeInput?.addEventListener("change", handleDispatchTimeChange);
    elements.dispatch?.toggleButton?.addEventListener("click", handleDispatchToggle);
  }

  function handleExport(listKey, format) {
    if (!STATE_KEYS.includes(listKey)) return;
    const rows = state.buckets[listKey] || [];
    if (format === "csv") {
      exportCsv(listKey, rows);
    } else if (format === "html") {
      exportHtml(listKey, rows);
    } else if (format === "pdf") {
      openPrintableView(listKey, rows, { mode: "pdf", autoPrint: true, closeAfterPrint: true });
    } else if (format === "print") {
      openPrintableView(listKey, rows, { mode: "print", autoPrint: true, closeAfterPrint: false });
    }
  }

  function handleDispatchNow() {
    dispatchSupervisionReport({ source: "manual" }).catch((error) => {
      console.error("فشل إرسال تقرير المراقبة يدويًا", error);
      updateDispatchStatus("تعذّر إرسال التقارير يدويًا. حاول مرة أخرى.", "error");
    });
  }

  function handleDispatchTimeChange(event) {
    const nextValue = normalizeTimeValue(event.target.value, state.dispatch.time);
    state.dispatch.time = nextValue;
    state.dispatch.lastAutoKey = "";
    syncDispatchControls();
    saveDispatchPreferences();
    updateDispatchStatus(`تم تحديث وقت الجدولة إلى ${nextValue}.`, "info");
    startDispatchScheduler();
  }

  function handleDispatchToggle() {
    state.dispatch.autoEnabled = !state.dispatch.autoEnabled;
    if (!state.dispatch.autoEnabled) {
      stopDispatchScheduler();
      state.dispatch.lastAutoKey = "";
      updateDispatchStatus("تم إيقاف الجدولة التلقائية. الإرسال اليدوي فقط.", "warning");
    } else {
      state.dispatch.lastAutoKey = "";
      updateDispatchStatus(`تم تفعيل الجدولة عند ${state.dispatch.time}.`, "success");
      startDispatchScheduler();
    }
    syncDispatchControls();
    saveDispatchPreferences();
  }

  function loadDispatchPreferences() {
    const raw = readSchoolItem(AUTO_DISPATCH_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        autoEnabled: Boolean(parsed.autoEnabled),
        time: normalizeTimeValue(parsed.time, state.dispatch.time),
        lastAutoKey: typeof parsed.lastAutoKey === "string" ? parsed.lastAutoKey : "",
        lastDispatchedAt: typeof parsed.lastDispatchedAt === "string" ? parsed.lastDispatchedAt : ""
      };
    } catch (error) {
      console.warn("تعذّر قراءة إعدادات جدولة التقارير.", error);
      return {};
    }
  }

  function saveDispatchPreferences() {
    try {
      const payload = {
        autoEnabled: state.dispatch.autoEnabled,
        time: state.dispatch.time,
        lastAutoKey: state.dispatch.lastAutoKey,
        lastDispatchedAt: state.dispatch.lastDispatchedAt
      };
      writeSchoolItem(AUTO_DISPATCH_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("تعذّر حفظ إعدادات جدولة التقارير.", error);
    }
  }

  function applyDispatchPreferences() {
    syncDispatchControls();
    updateDispatchStatus();
  }

  function syncDispatchControls() {
    if (elements.dispatch?.timeInput) {
      elements.dispatch.timeInput.value = state.dispatch.time;
    }
    if (elements.dispatch?.toggleButton) {
      elements.dispatch.toggleButton.textContent = state.dispatch.autoEnabled ? "إيقاف الجدولة" : "تفعيل الجدولة";
    }
  }

  function updateDispatchStatus(message, variant = "info") {
    if (!elements.dispatch?.status) return;
    if (message) {
      elements.dispatch.status.textContent = message;
      elements.dispatch.status.dataset.state = variant;
      return;
    }
    let base = state.dispatch.autoEnabled
      ? `الجدولة مفعلة عند ${state.dispatch.time}.`
      : "الإرسال اليدوي فقط.";
    if (state.dispatch.lastDispatchedAt) {
      base += ` آخر إرسال ${formatDispatchTimestamp(state.dispatch.lastDispatchedAt)}.`;
    }
    elements.dispatch.status.textContent = base;
    elements.dispatch.status.dataset.state = "info";
  }

  function startDispatchScheduler() {
    stopDispatchScheduler();
    if (!state.dispatch.autoEnabled) {
      return;
    }
    const tick = () => {
      evaluateAutoDispatch();
      state.dispatch.timerId = window.setTimeout(tick, 30 * 1000);
    };
    tick();
  }

  function stopDispatchScheduler() {
    if (state.dispatch.timerId) {
      clearTimeout(state.dispatch.timerId);
      state.dispatch.timerId = null;
    }
  }

  function evaluateAutoDispatch() {
    if (!state.dispatch.autoEnabled) return;
    if (!isValidTimeValue(state.dispatch.time)) return;
    const now = new Date();
    const todayKey = getDayKey(now);
    if (todayKey !== state.todayKey) {
      state.todayKey = todayKey;
      updateDayLabel();
      refreshBuckets({ reloadStudents: true }).catch((error) => {
        console.error("تعذّر تحديث القوائم قبل الإرسال التلقائي", error);
      });
    }
    const autoKey = buildAutoDispatchKey(todayKey, state.dispatch.time);
    if (state.dispatch.lastAutoKey === autoKey) return;
    if (!hasReachedTime(now, state.dispatch.time)) return;
    dispatchSupervisionReport({ source: "auto" }).catch((error) => {
      console.error("فشل إرسال التقارير المجدولة", error);
      updateDispatchStatus("تعذّر الإرسال التلقائي. حاول يدويًا.", "error");
    });
  }

  async function dispatchSupervisionReport(options = {}) {
    try {
      await refreshBuckets();
      const report = buildSupervisionReport(options);
      persistSupervisionReport(report);
      broadcastSupervisionReport(report, options.source);
      state.dispatch.lastDispatchedAt = report.generatedAt;
      if (options.source === "auto") {
        state.dispatch.lastAutoKey = buildAutoDispatchKey(report.dayKey, state.dispatch.time);
      }
      saveDispatchPreferences();
      const total = report.records.length;
      const timeLabel = formatDispatchTime(report.generatedAt);
      const message = options.source === "auto"
        ? `تم إرسال التقارير تلقائيًا (${total} سجل) عند ${timeLabel}.`
        : `تم إرسال التقارير (${total} سجل) عند ${timeLabel}.`;
      updateDispatchStatus(message, "success");
      window.setTimeout(() => {
        if (elements.dispatch?.status?.dataset.state === "success") {
          updateDispatchStatus();
        }
      }, 6000);
    } catch (error) {
      console.error("فشل إنشاء تقرير المراقبة", error);
      updateDispatchStatus("تعذّر تجهيز التقارير. حاول مرة أخرى.", "error");
    }
  }

  function buildSupervisionReport(options = {}) {
    const now = new Date();
    const dayKey = state.todayKey;
    const records = [];
    STATE_KEYS.forEach((status) => {
      const list = state.buckets[status] || [];
      list.forEach((entry) => {
        records.push({
          status,
          name: entry.name || "",
          id: entry.id || "",
          grade: entry.grade || "",
          class: entry.class || "",
          arrivalTime: entry.arrivalTime || ""
        });
      });
    });
    const totals = {
      present: state.buckets.present.length,
      late: state.buckets.late.length,
      absent: state.buckets.absent.length
    };
    const id = `${dayKey}-${now.toISOString()}`;
    return {
      id,
      generatedAt: now.toISOString(),
      dayKey,
      dayLabel: formatDayLabel(),
      totals: { ...totals, total: records.length },
      records,
      meta: {
        source: "supervisor",
        mode: options.source || "manual",
        storeType: state.storeType
      }
    };
  }

  function persistSupervisionReport(report) {
    let list = [];
    const raw = readSchoolItem(SUPERVISION_REPORTS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((item) => item && item.id !== report.id);
        }
      } catch (error) {
        console.warn("تعذّر قراءة قائمة تقارير الإشراف الحالية.", error);
      }
    }
    list.unshift(report);
    if (list.length > 30) {
      list.length = 30;
    }
    try {
      writeSchoolItem(SUPERVISION_REPORTS_KEY, JSON.stringify(list));
    } catch (error) {
      console.warn("تعذّر حفظ تقرير الإشراف في التخزين.", error);
    }
  }

  function broadcastSupervisionReport(report, source) {
    if (!supervisionReportChannel) return;
    const message =
      source === "auto"
        ? "تم إرسال تقرير المراقبة تلقائيًا."
        : "تم إرسال تقرير المراقبة يدويًا.";
    try {
      supervisionReportChannel.postMessage({ type: "supervision-report", payload: report, message });
    } catch (error) {
      console.warn("تعذّر بث تقرير الإشراف عبر القناة.", error);
    }
  }

  function buildAutoDispatchKey(dayKey, time) {
    return `${dayKey}|${time}`;
  }

  function normalizeTimeValue(value, fallback) {
    if (typeof value !== "string") return fallback || "08:00";
    const trimmed = value.trim();
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
    if (!match) return fallback || "08:00";
    return `${match[1]}:${match[2]}`;
  }

  function isValidTimeValue(value) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value || "");
  }

  function hasReachedTime(now, time) {
    if (!isValidTimeValue(time)) return false;
    const [hour, minute] = time.split(":").map((part) => parseInt(part, 10));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = hour * 60 + minute;
    return nowMinutes >= targetMinutes;
  }

  function formatDispatchTime(isoString) {
    if (!isoString) return "--:--";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "--:--";
    return date
      .toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
      .replace(/^24/, "00");
  }

  function formatDispatchTimestamp(isoString) {
    if (!isoString) return "—";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "—";
    const dayKey = getDayKey(date);
    const isToday = dayKey === state.todayKey;
    const dateLabel = date.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
    const timeLabel = formatDispatchTime(isoString);
    return isToday ? `اليوم عند ${timeLabel}` : `${dateLabel} عند ${timeLabel}`;
  }

  function buildAttendanceRowsMarkup(rows) {
    return rows
      .map(
        (entry) => `
        <tr>
          <td>${escapeHtml(entry.name)}</td>
          <td>${escapeHtml(entry.id)}</td>
          <td>${escapeHtml(entry.grade || "—")}</td>
          <td>${escapeHtml(entry.class || "—")}</td>
          <td>${escapeHtml(entry.arrivalTime || "—")}</td>
        </tr>`
      )
      .join("");
  }

  function buildAttendanceTableMarkup(rows) {
    return `<table>
      <thead>
        <tr>
          <th>الاسم</th>
          <th>الرقم</th>
          <th>الصف</th>
          <th>الفصل</th>
          <th>وقت الوصول</th>
        </tr>
      </thead>
      <tbody>
        ${buildAttendanceRowsMarkup(rows)}
      </tbody>
    </table>`;
  }

  function exportCsv(listKey, rows) {
    const header = ["الاسم", "الرقم", "الصف", "الفصل", "وقت الوصول"];
    const lines = [header.join(",")];
    rows.forEach((entry) => {
      lines.push(
        [entry.name, entry.id, entry.grade || "", entry.class || "", entry.arrivalTime || ""]
          .map(escapeCsv)
          .join(",")
      );
    });
    lines.push(`# ${COPYRIGHT_NOTICE}`);
    const csvContent = "\ufeff" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${buildFilename(listKey)}.csv`);
  }

  function exportHtml(listKey, rows) {
    const title = buildListTitle(listKey);
    const tableMarkup = buildAttendanceTableMarkup(rows);
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: 'Tajawal', 'Cairo', sans-serif; margin: 0; background: #ffffff; color: #0f1c2b; min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 16px; }
      .doc-header { display: flex; flex-direction: column; gap: 8px; }
      .doc-header h1 { margin: 0; font-size: 24px; }
      .doc-meta { margin: 0; color: #4f637b; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #dde3f0; padding: 12px 16px; text-align: right; font-size: 14px; }
      th { background: #f4f6fb; font-weight: 600; }
      footer { margin-top: auto; padding: 16px 32px; text-align: center; color: #4f637b; font-size: 13px; border-top: 1px solid #dde3f0; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <div class="doc-header">
        <h1>${escapeHtml(title)}</h1>
        <p class="doc-meta">اليوم: ${escapeHtml(formatDayLabel())}</p>
        <p class="doc-meta">عدد السجلات: ${rows.length}</p>
      </div>
      ${tableMarkup}
    </main>
    <footer>${escapeHtml(COPYRIGHT_NOTICE)}</footer>
  </body>
</html>`;

    const blob = new Blob(["\ufeff" + html], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, `${buildFilename(listKey)}.html`);
  }

  function openPrintableView(listKey, rows, options = {}) {
    const title = buildListTitle(listKey);
    const message = options.mode === "pdf"
      ? "للحصول على نسخة PDF اختر \"حفظ كملف PDF\" من مربع الطباعة."
      : "تحقق من إعدادات الطباعة قبل الاعتماد على النسخة الورقية.";
    const tableMarkup = buildAttendanceTableMarkup(rows);
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: 'Tajawal', 'Cairo', sans-serif; margin: 0; background: #ffffff; color: #0f1c2b; min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1 0 auto; padding: 28px 32px; display: flex; flex-direction: column; gap: 14px; }
      .doc-header { display: flex; flex-direction: column; gap: 8px; }
      .doc-header h1 { margin: 0; font-size: 24px; }
      .note { margin: 0; color: #4f637b; font-size: 14px; }
      .doc-meta { margin: 0; color: #4f637b; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #dde3f0; padding: 10px 14px; text-align: right; font-size: 14px; }
      th { background: #f4f6fb; font-weight: 600; }
      footer { margin-top: auto; padding: 16px 32px; text-align: center; color: #4f637b; font-size: 13px; border-top: 1px solid #dde3f0; line-height: 1.6; }
      @page { size: A4 portrait; margin: 20mm; }
      @media print { footer { page-break-inside: avoid; } }
    </style>
  </head>
  <body>
    <main>
      <div class="doc-header">
        <h1>${escapeHtml(title)}</h1>
        <p class="note">${escapeHtml(message)}</p>
        <p class="doc-meta">اليوم: ${escapeHtml(formatDayLabel())} — عدد السجلات: ${rows.length}</p>
      </div>
      ${tableMarkup}
    </main>
    <footer>${escapeHtml(COPYRIGHT_NOTICE)}</footer>
  </body>
</html>`;

    const printWindow = window.open("", "_blank", "noopener");
    if (!printWindow) {
      console.warn("تعذّر فتح نافذة الطباعة");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    if (options.autoPrint) {
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (error) {
          console.warn("تعذّر تشغيل أمر الطباعة", error);
        } finally {
          if (options.closeAfterPrint) {
            printWindow.close();
          }
        }
      }, 250);
    }
  }

  function formatDayLabel() {
    const iso = `${state.todayKey}T00:00:00`;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("ar-SA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
    return state.todayKey.replace(/-/g, "/");
  }

  function buildFilename(listKey) {
    return `attendance-${listKey}-${state.todayKey}`;
  }

  function buildListTitle(listKey) {
    const label = STATE_LABELS[listKey] || listKey;
    return `قائمة «${label}»`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function startDayWatcher() {
    if (dayWatcherId) {
      window.clearTimeout(dayWatcherId);
      dayWatcherId = null;
    }

    const tick = () => {
      const currentKey = getDayKey(new Date());
      if (currentKey !== state.todayKey) {
        state.todayKey = currentKey;
        updateDayLabel();
        refreshBuckets({ reloadStudents: true }).catch((error) => {
          console.error("تعذّر تحديث القوائم بعد تغيير اليوم", error);
        });
        state.dispatch.lastAutoKey = "";
        saveDispatchPreferences();
        startDispatchScheduler();
        updateDispatchStatus();
      }
      dayWatcherId = window.setTimeout(tick, 60 * 1000);
    };

    tick();
  }

  function subscribeToUpdates() {
    settingsChannel?.addEventListener("message", (event) => {
      if (event?.data?.type === "settings-updated" && event.data.payload) {
        state.settings = { ...state.settings, ...event.data.payload };
        applySettings(state.settings);
        refreshBuckets().catch((error) => console.error("تعذّر تحديث القوائم بعد تعديل الإعدادات", error));
      }
    });

    attendanceChannel?.addEventListener("message", (event) => {
      if (event?.data?.type === "attendance-recorded") {
        const dayKey = event.data.payload?.dayKey || state.todayKey;
        if (dayKey === state.todayKey) {
          refreshBuckets().catch((error) => console.error("تعذّر تحديث القوائم بعد تسجيل الحضور", error));
        }
      }
    });

    window.addEventListener("storage", (event) => {
      if (matchesSchoolKey(event.key, SETTINGS_KEY) && event.newValue) {
        refreshBuckets({ reloadSettings: true }).catch((error) => console.error("تعذّر مزامنة الإعدادات", error));
      }
      if (matchesSchoolKey(event.key, STUDENTS_KEY) && event.newValue) {
        refreshBuckets({ reloadStudents: true }).catch((error) => console.error("تعذّر مزامنة الطلاب", error));
      }
      if (matchesSchoolKey(event.key, ATTENDANCE_KEY) && event.newValue) {
        refreshBuckets().catch((error) => console.error("تعذّر مزامنة الحضور", error));
      }
      if (matchesSchoolKey(event.key, AUTO_DISPATCH_KEY) && event.newValue) {
        state.dispatch = { ...state.dispatch, ...loadDispatchPreferences() };
        applyDispatchPreferences();
        startDispatchScheduler();
      }
      if (event.key === STORE_PREFERENCE_KEY) {
        updateStoreIndicator();
      } else if (event.key && event.key.endsWith(":local_ready")) {
        const matches = /hader:school:([^:]+):local_ready$/.exec(event.key);
        const currentSchool =
          ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
        if (!matches || matches[1] === currentSchool) {
          if (isLocalBackend(state.backendChoice)) {
            const ready = window.HaderBackendFactory?.isLocalEnhanced?.(currentSchool);
            if (ready) {
              setBackendOk();
            } else if (state.backendConnectionState !== "error") {
              state.backendConnectionState = "unknown";
              state.backendErrorMessage = "";
            }
          }
          refreshSchoolMeta();
          updateStoreIndicator();
        }
      } else if (event.key && event.key.endsWith(":meta")) {
        const matches = /hader:school:([^:]+):meta$/.exec(event.key);
        const currentSchool =
          ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
        if (!matches || matches[1] === currentSchool) {
          if (isLocalBackend(state.backendChoice)) {
            const ready = window.HaderBackendFactory?.isLocalEnhanced?.(currentSchool);
            if (ready) {
              setBackendOk();
            } else if (state.backendConnectionState !== "error") {
              state.backendConnectionState = "unknown";
              state.backendErrorMessage = "";
            }
          }
          refreshSchoolMeta();
          updateStoreIndicator();
        }
      }
    });
    window.addEventListener("hader:local-ready-change", (event) => {
      const detail = event?.detail || {};
      const currentSchool =
        ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
      if (!detail.schoolId || detail.schoolId === currentSchool) {
        if (isLocalBackend(state.backendChoice)) {
          if (detail.localReady) {
            setBackendOk();
          } else if (state.backendConnectionState !== "error") {
            state.backendConnectionState = "unknown";
            state.backendErrorMessage = "";
          }
        }
        refreshSchoolMeta();
        updateStoreIndicator();
      }
    });
    window.addEventListener("hader:school-meta", (event) => {
      const detail = event?.detail || {};
      const currentSchool =
        ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
      if (!detail.schoolId || detail.schoolId === currentSchool) {
        state.schoolMeta = detail.meta || readCurrentSchoolMeta();
        applySchoolLock(state.schoolMeta);
        updateStoreIndicator();
      }
    });
  }

  function applySettings(nextSettings) {
    state.settings = normalizeSettings(nextSettings);
    applyThemePreference(state.settings.uiTheme);
    updateSchoolName(state.settings.schoolName);
  }

  function sanitizeTheme(theme) {
    return normalizeTheme(theme);
  }

  function applyThemePreference(theme) {
    const normalized = normalizeTheme(theme);
    const colors = normalizeCustomThemeColors(state.settings);
    if (typeof THEME_LIBRARY?.applyTheme === "function") {
      THEME_LIBRARY.applyTheme(normalized, { customColors: colors });
    } else if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.setAttribute("data-theme", normalized);
    }
    applyCardDecorationsFromSettings(state.settings);
  }

  function updateSchoolName(name) {
    const clean = typeof name === "string" ? name.trim() : "";
    const hasName = clean !== "";
    const fallback = "اسم المدرسة غير محدد";
    if (!Array.isArray(elements.schoolName)) return;
    elements.schoolName.forEach((node) => {
      if (!node) return;
      node.textContent = hasName ? clean : fallback;
      if ("hidden" in node) {
        node.hidden = !hasName;
      }
      if (node.dataset) {
        node.dataset.empty = String(!hasName);
      }
    });
  }

  function normalizeStudents(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => normalizeStudent(item))
      .filter(Boolean);
  }

  function normalizeStudent(item) {
    if (!item || typeof item !== "object") return null;
    const id = "id" in item ? String(item.id).trim() : "";
    if (!id) return null;
    const name = "name" in item && item.name != null ? String(item.name).trim() : "";
    const grade = "grade" in item && item.grade != null ? String(item.grade).trim() : "";
    const klass = "class" in item && item.class != null ? String(item.class).trim() : "";
    return { id, name, grade, class: klass };
  }

  function normalizeAttendanceRecords(records) {
    if (!records || typeof records !== "object") return {};
    const map = {};
    Object.entries(records).forEach(([id, time]) => {
      const key = String(id || "").trim();
      const value = typeof time === "string" ? time.trim() : String(time || "").trim();
      if (!key || !value) return;
      map[key] = value;
    });
    return map;
  }

  function readSettingsFallback() {
    const raw = readSchoolItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw);
      return normalizeSettings(parsed);
    } catch (error) {
      console.warn("تعذّر قراءة الإعدادات من LocalStorage.", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function normalizeSettings(input) {
    const base = { ...DEFAULT_SETTINGS };
    if (!input || typeof input !== "object") {
      const colors = normalizeCustomThemeColors(base);
      base.customThemeBackground = colors.background;
      base.customThemeTextStrong = colors.strong;
      base.customThemeTextMuted = colors.muted;
      const theme = normalizeTheme(base.uiTheme || base.theme);
      base.uiTheme = theme;
      base.theme = theme;
      const decorations = normalizeCardDecorations(base);
      base.uiCardShadowIntensity = decorations.shadowIntensity;
      base.uiCardBorderColor = decorations.borderColor;
      base.uiCardBorderWidth = decorations.borderWidth;
      return base;
    }
    Object.entries(DEFAULT_SETTINGS).forEach(([key]) => {
      if (key in input) {
        base[key] = input[key];
      }
    });
    if ("theme" in input && typeof input.theme !== "undefined") {
      base.theme = input.theme;
    }
    const colors = normalizeCustomThemeColors(base);
    base.customThemeBackground = colors.background;
    base.customThemeTextStrong = colors.strong;
    base.customThemeTextMuted = colors.muted;
    const theme = normalizeTheme(base.uiTheme || base.theme);
    base.uiTheme = theme;
    base.theme = theme;
    const decorations = normalizeCardDecorations(base);
    base.uiCardShadowIntensity = decorations.shadowIntensity;
    base.uiCardBorderColor = decorations.borderColor;
    base.uiCardBorderWidth = decorations.borderWidth;
    return base;
  }

  function readStudentsFallback() {
    const raw = readSchoolItem(STUDENTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return normalizeStudents(parsed);
    } catch (error) {
      console.warn("تعذّر قراءة الطلاب من LocalStorage.", error);
      return [];
    }
  }

  function readAttendanceFallback() {
    const raw = readSchoolItem(ATTENDANCE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const result = {};
      Object.entries(parsed).forEach(([day, records]) => {
        const key = String(day || "").trim();
        if (!key || !records || typeof records !== "object") return;
        result[key] = normalizeAttendanceRecords(records);
      });
      return result;
    } catch (error) {
      console.warn("تعذّر قراءة سجلات الحضور من LocalStorage.", error);
      return {};
    }
  }

  function parseTimeToSeconds(time) {
    if (typeof time !== "string" || time.trim() === "") {
      return 0;
    }
    const [hoursStr = "0", minutesStr = "0", secondsStr = "0"] = time.split(":");
    const hours = parseInt(hoursStr, 10) || 0;
    const minutes = parseInt(minutesStr, 10) || 0;
    const seconds = parseInt(secondsStr, 10) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function getThresholdSeconds(settings) {
    const base = typeof settings.schoolStart === "string" ? settings.schoolStart : DEFAULT_SETTINGS.schoolStart;
    const [hoursStr = "07", minutesStr = "00"] = base.split(":");
    const hours = parseInt(hoursStr, 10) || 0;
    const minutes = parseInt(minutesStr, 10) || 0;
    const grace = Number(settings.graceMinutes ?? DEFAULT_SETTINGS.graceMinutes) || 0;
    return (hours * 60 + minutes + grace) * 60;
  }

  function getDayKey(date) {
    return date.toISOString().slice(0, 10);
  }
})();
