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
  const ADMIN_SUPERVISOR_IDENTIFIER = "ADMIN_SUPER";
  const TECHNICAL_SUPERVISOR_IDENTIFIER = "ADMIN_TECH";
  const MASTER_SUPERVISOR_IDENTIFIERS = Object.freeze([
    ADMIN_SUPERVISOR_IDENTIFIER,
    TECHNICAL_SUPERVISOR_IDENTIFIER
  ]);
  const DEFAULT_CUSTOM_THEME =
    THEME_LIBRARY?.DEFAULT_CUSTOM_COLORS || Object.freeze({ background: "#0b1320", strong: "#2f80ed", muted: "#a7b2c7" });
  const CARD_SHADOW_LIMITS = THEME_LIBRARY?.CARD_SHADOW_LIMITS || Object.freeze({ min: 0, max: 300 });
  const CARD_BORDER_WIDTH_LIMITS = THEME_LIBRARY?.CARD_BORDER_WIDTH_LIMITS || Object.freeze({ min: 0, max: 12 });

  const STORE_PREFERENCE_KEY = "aa_store_preference";
  const SETTINGS_KEY = "aa_settings";
  const STUDENTS_KEY = "aa_students";
  const PERMISSIONS_KEY = "aa_permissions";
  const SETTINGS_CHANNEL_NAME = "hader-settings";
  const PERMISSION_CHANNEL_NAME = "permission-sync";
  const SUPERVISION_REPORTS_KEY = "aa_supervision_reports";
  const SUPERVISION_REPORT_CHANNEL = "supervision-reports";
  const ATTENDANCE_STATUS_KEYS = Object.freeze(["present", "late", "absent"]);
  const ATTENDANCE_STATUS_LABELS = Object.freeze({
    present: "حاضر",
    late: "متأخر",
    absent: "غائب"
  });
  const COPYRIGHT_NOTICE = "© جميع الحقوق محفوظة | أ. هيثم الزهراني | Him.Art";

  const INITIAL_BACKEND_CHOICE = readBackendChoice();
  const SCHOOL_LOCK_MESSAGE = "راجع الدعم الفني";

  const DEFAULT_SETTINGS = Object.freeze({
    schoolStart: "07:00",
    graceMinutes: 10,
    theme: "light",
    kioskBannerUrl: "",
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
    leaveTheme: "system",
    leaveAccentColor: DEFAULT_CUSTOM_THEME.strong,
    leaveMorningMessage: "",
    leaveAnnouncementMessages: [],
    leaveTip: "الانضباط يرفع مقامك — احضر بدري وكن قدوة.",
    leaveHeroUrl: "",
    leaveHeroName: "",
    statusCardAutoHideMinutes: 3,
    leaveGeneralSupervisorIds: MASTER_SUPERVISOR_IDENTIFIERS.slice(),
    leaveClassSupervisorIds: MASTER_SUPERVISOR_IDENTIFIERS.slice(),
    leaveAdminIds: MASTER_SUPERVISOR_IDENTIFIERS.slice(),
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

  const THEME_OPTIONS = AVAILABLE_THEMES;

  const ACCESS_SESSION_KEY = "aa_leave_access_session";
  const ACCESS_ROLES = Object.freeze({
    general: { key: "leaveGeneralSupervisorIds", label: "المشرف العام" },
    class: { key: "leaveClassSupervisorIds", label: "مشرف الصفوف" },
    admin: { key: "leaveAdminIds", label: "الإدارة" }
  });

  const elements = {
    storeIndicator: document.querySelector("[data-store-indicator]"),
    storeLabel: document.querySelector("[data-store-label]"),
    storeMessage: document.querySelector("[data-store-message]"),
    lockOverlay: document.querySelector("[data-school-lock]"),
    lockDialog: document.querySelector("[data-school-lock-dialog]"),
    lockMessage: document.querySelector("[data-school-lock-message]"),
    form: document.querySelector("[data-permission-form]"),
    idInput: document.querySelector("[data-id-input]"),
    reasonInput: document.querySelector("[data-reason-input]"),
    noteInput: document.querySelector("[data-note-input]"),
    formStatus: document.querySelector("[data-form-status]"),
    studentPreview: document.querySelector("[data-student-preview]"),
    studentName: document.querySelector("[data-student-name]"),
    studentMeta: document.querySelector("[data-student-meta]"),
    studentStatus: document.querySelector("[data-student-status]"),
    permissionTable: document.querySelector("[data-permission-table]"),
    permissionSummary: document.querySelector("[data-permission-summary]"),
    refreshToday: document.querySelector("[data-refresh-today]"),
    dayLabel: document.querySelector("[data-day-label]"),
    generalTip: document.querySelector("[data-general-tip]"),
    generalTipText: document.querySelector("[data-general-tip-text]"),
    hero: document.querySelector("[data-leave-hero]"),
    heroImage: document.querySelector("[data-leave-hero-image]"),
    messaging: document.querySelector("[data-leave-messaging]"),
    morningCard: document.querySelector("[data-morning-card]"),
    morningText: document.querySelector("[data-morning-text]"),
    announcementCard: document.querySelector("[data-announcement-card]"),
    announcementList: document.querySelector("[data-announcement-list]"),
    schoolName: Array.from(document.querySelectorAll("[data-school-name]")),
    accessGate: document.querySelector("[data-access-gate]"),
    accessForm: document.querySelector("[data-access-form]"),
    accessRoleSelect: document.querySelector("[data-access-role-select]"),
    accessIdentifier: document.querySelector("[data-access-identifier]"),
    accessError: document.querySelector("[data-access-error]"),
    accessChip: document.querySelector("[data-access-chip]"),
    accessChipRole: document.querySelector("[data-access-chip-role]"),
    accessSignOut: document.querySelector("[data-access-signout]"),
    tabsHost: document.querySelector("[data-tabs-host]"),
    panels: Array.from(document.querySelectorAll("[data-tab-panel]")),
    attendance: {
      reportSelect: document.querySelector("[data-attendance-report-select]"),
      reportLabel: document.querySelector("[data-attendance-report-label]"),
      reportStatus: document.querySelector("[data-report-status]"),
      summaryCounts: {
        present: document.querySelector("[data-attendance-count=present]"),
        late: document.querySelector("[data-attendance-count=late]"),
        absent: document.querySelector("[data-attendance-count=absent]"),
        total: document.querySelector("[data-attendance-count=total]"),
      },
      statusFilters: document.querySelector("[data-status-filters]"),
      gradeFilter: document.querySelector("[data-filter-grade]"),
      classFilter: document.querySelector("[data-filter-class]"),
      searchInput: document.querySelector("[data-filter-search]"),
      tableBody: document.querySelector("[data-attendance-table]"),
      emptyState: document.querySelector("[data-attendance-empty]"),
      exportButtons: Array.from(document.querySelectorAll("[data-attendance-export]")),
      refreshButton: document.querySelector("[data-refresh-reports]")
    }
  };
  elements.tabButtons = Array.from(document.querySelectorAll("[data-tab-trigger]"));

  const state = {
    store: null,
    storeType: mapBackendToStore(INITIAL_BACKEND_CHOICE),
    backendChoice: INITIAL_BACKEND_CHOICE,
    backendConnectionState: "unknown",
    backendErrorMessage: "",
    settings: normalizeSettingsObject({}),
    students: [],
    todayKey: getDayKey(new Date()),
    todayPermissions: [],
    currentStudent: null,
    access: { role: null, identifier: "" },
    activeTab: "permissions",
    attendanceReports: [],
    selectedReportId: "",
    attendanceRecords: [],
    attendanceFilters: {
      statuses: new Set(["present", "late", "absent"]),
      grade: "",
      class: "",
      search: ""
    },
    schoolMeta: null
  };

  let accessInitialized = false;

  const settingsChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SETTINGS_CHANNEL_NAME) : null;
  const permissionChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(PERMISSION_CHANNEL_NAME) : null;
  const supervisionReportChannel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SUPERVISION_REPORT_CHANNEL) : null;

  refreshSchoolMeta();
  init().catch((error) => {
    console.error("فشل تهيئة بوابة الإشراف", error);
    showFormStatus("تعذّر تحميل البيانات. تحقق من التخزين.", "error");
  });

  async function init() {
    const { store, type } = await resolveStore();
    state.store = store;
    state.storeType = type;
    updateStoreIndicator();

    await Promise.all([loadSettings(), loadStudents()]);
    applySettings(state.settings);
    await refreshToday();
    updateDayLabel();
    await refreshAttendanceReports({ silent: true });
    bindEvents();
    subscribeToUpdates();
    accessInitialized = true;
    enforceAccessSession();
    resetStatusButtons();
    switchTab(state.activeTab);
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
        console.warn("تعذّر إنشاء مخزن SQL.js. سيتم الاعتماد على LocalStorage.", error);
      }
    }

    if (typeof window.HaderStores?.createLocalStore === "function") {
      const localStore = window.HaderStores.createLocalStore({
        activeSchoolId: getActiveSchoolId()
      });
      return { store: localStore, type: "local" };
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
      async getPermissionsDay(day) {
        return readPermissionsFallback()[day] ? [...readPermissionsFallback()[day]] : [];
      },
      async addPermission(entry) {
        const map = readPermissionsFallback();
        const normalized = normalizePermission(entry);
        const day = normalized.createdAt.slice(0, 10);
        const list = map[day] ? [...map[day]] : [];
        list.push(normalized);
        list.sort(sortByCreatedAt);
        map[day] = list;
        writePermissionsFallback(map);
        return normalized;
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
        const dialog = elements.lockDialog;
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => dialog.focus());
        } else {
          dialog.focus();
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
      console.warn("تعذّر قراءة إعداد الإشارة المضيئة لبوابة الإشراف.", error);
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

  function readSettingsFallback() {
    const raw = readSchoolItem(SETTINGS_KEY);
    if (!raw) return normalizeSettingsObject({});
    try {
      const parsed = JSON.parse(raw);
      return normalizeSettingsObject(parsed);
    } catch (error) {
      console.warn("تعذّر قراءة الإعدادات من LocalStorage.", error);
      return normalizeSettingsObject({});
    }
  }

  function readStudentsFallback() {
    const raw = readSchoolItem(STUDENTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed
            .filter((item) => item && typeof item.id !== "undefined")
            .map((item) => ({
              id: String(item.id).trim(),
              name: typeof item.name === "string" ? item.name : "",
              grade: typeof item.grade === "string" ? item.grade : "",
              class: typeof item.class === "string" ? item.class : ""
            }))
        : [];
    } catch (error) {
      console.warn("تعذّر قراءة الطلاب من LocalStorage.", error);
      return [];
    }
  }

  function readPermissionsFallback() {
    const raw = readSchoolItem(PERMISSIONS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const map = {};
      Object.entries(parsed).forEach(([day, list]) => {
        if (!Array.isArray(list)) return;
        list
          .map(normalizePermission)
          .filter(Boolean)
          .forEach((entry) => {
            const key = entry.createdAt.slice(0, 10) || day;
            if (!map[key]) {
              map[key] = [];
            }
            map[key].push(entry);
          });
      });
      Object.values(map).forEach((bucket) => bucket.sort(sortByCreatedAt));
      return map;
    } catch (error) {
      console.warn("تعذّر قراءة سجل طلبات الإشراف من LocalStorage.", error);
      return {};
    }
  }

  function writePermissionsFallback(map) {
    const payload = {};
    Object.entries(map).forEach(([day, list]) => {
      payload[day] = list.map((entry) => ({
        studentId: entry.studentId,
        createdAt: entry.createdAt,
        reason: entry.reason,
        note: entry.note,
        status: entry.status
      }));
    });
    writeSchoolItem(PERMISSIONS_KEY, JSON.stringify(payload));
  }

  async function loadSettings() {
    if (typeof state.store?.getSettings === "function") {
      try {
        const loaded = await state.store.getSettings();
        state.settings = normalizeSettingsObject(loaded);
        setBackendOk();
        if (isRemoteBackend(state.backendChoice)) {
          updateStoreIndicator();
        }
        return;
      } catch (error) {
        console.warn("تعذّر تحميل إعدادات الإشارة المضيئة لبوابة الإشراف.", error);
        if (isRemoteBackend(state.backendChoice)) {
          setBackendError(error, "تعذّر تحميل الإعدادات من المصدر الحالي.");
          updateStoreIndicator();
        }
      }
    }
    state.settings = readSettingsFallback();
  }

  async function loadStudents() {
    if (typeof state.store?.getStudents === "function") {
      try {
        state.students = await state.store.getStudents();
        setBackendOk();
        if (isRemoteBackend(state.backendChoice)) {
          updateStoreIndicator();
        }
        return;
      } catch (error) {
        console.warn("تعذّر تحميل قائمة الطلاب من المخزن النشط.", error);
        if (isRemoteBackend(state.backendChoice)) {
          setBackendError(error, "تعذّر تحميل قائمة الطلاب من المصدر الحالي.");
          updateStoreIndicator();
        }
      }
    }
    state.students = readStudentsFallback();
  }

  async function refreshToday() {
    state.todayKey = getDayKey(new Date());
    if (typeof state.store?.getPermissionsDay === "function") {
      try {
        state.todayPermissions = await state.store.getPermissionsDay(state.todayKey);
        setBackendOk();
        if (isRemoteBackend(state.backendChoice)) {
          updateStoreIndicator();
        }
      } catch (error) {
        console.warn("تعذّر تحميل طلبات الإشراف لليوم من المخزن النشط.", error);
        if (isRemoteBackend(state.backendChoice)) {
          setBackendError(error, "تعذّر تحميل طلبات الإشراف من المصدر الحالي.");
          updateStoreIndicator();
        }
        const mapFallback = readPermissionsFallback();
        state.todayPermissions = mapFallback[state.todayKey] ? [...mapFallback[state.todayKey]] : [];
      }
    } else {
      const map = readPermissionsFallback();
      state.todayPermissions = map[state.todayKey] ? [...map[state.todayKey]] : [];
    }
    state.todayPermissions.sort(sortByCreatedAt);
    renderTodayPermissions();
  }

  async function refreshAttendanceReports(options = {}) {
    try {
      await loadAttendanceReports();
      updateAttendanceReportSelect();
      applyAttendanceReport(state.selectedReportId);
      resetStatusButtons();
      if (options.message) {
        showAttendanceStatus(options.message, options.variant || "info");
      } else if (!options.silent) {
        showAttendanceStatus("تم تحديث سجلات الحضور.", "success");
      }
    } catch (error) {
      console.error("تعذّر تحديث سجلات الحضور", error);
      showAttendanceStatus("تعذّر تحديث سجلات الحضور.", "error");
    }
  }

  async function loadAttendanceReports() {
    const list = readSupervisionReportsFallback();
    state.attendanceReports = list;
    if (!list.length) {
      state.selectedReportId = "";
      state.attendanceRecords = [];
      return;
    }

    if (!state.selectedReportId || !list.some((item) => item.id === state.selectedReportId)) {
      state.selectedReportId = list[0].id;
    }

    const active = list.find((item) => item.id === state.selectedReportId) || list[0];
    state.attendanceRecords = Array.isArray(active.records) ? [...active.records] : [];
  }

  function readSupervisionReportsFallback() {
    const raw = readSchoolItem(SUPERVISION_REPORTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => normalizeSupervisionReport(entry))
        .filter(Boolean)
        .sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));
    } catch (error) {
      console.warn("تعذّر قراءة تقارير الإشراف من LocalStorage.", error);
      return [];
    }
  }

  function normalizeSupervisionReport(source) {
    if (!source || typeof source !== "object") return null;
    const id = typeof source.id === "string" && source.id.trim() !== "" ? source.id.trim() : null;
    const generatedAtRaw = typeof source.generatedAt === "string" ? source.generatedAt : null;
    const generatedDate = generatedAtRaw ? new Date(generatedAtRaw) : new Date();
    const generatedAt = Number.isNaN(generatedDate.getTime()) ? new Date().toISOString() : generatedDate.toISOString();
    const dayKey = typeof source.dayKey === "string" && source.dayKey ? source.dayKey : generatedAt.slice(0, 10);
    const dayLabel = typeof source.dayLabel === "string" ? source.dayLabel : "";
    const totalsSource = source.totals && typeof source.totals === "object" ? source.totals : {};
    const records = Array.isArray(source.records) ? source.records.map(normalizeAttendanceRecord).filter(Boolean) : [];
    const totals = {
      present: toSafeInteger(totalsSource.present, records.filter((item) => item.status === "present").length),
      late: toSafeInteger(totalsSource.late, records.filter((item) => item.status === "late").length),
      absent: toSafeInteger(totalsSource.absent, records.filter((item) => item.status === "absent").length)
    };
    const totalCount = totals.present + totals.late + totals.absent;
    return {
      id: id || `${dayKey}-${generatedAt}`,
      generatedAt,
      dayKey,
      dayLabel,
      totals: { ...totals, total: totalCount },
      records,
      meta: typeof source.meta === "object" && source.meta ? { ...source.meta } : {}
    };
  }

  function normalizeAttendanceRecord(source) {
    if (!source || typeof source !== "object") return null;
    const status = typeof source.status === "string" ? source.status.trim().toLowerCase() : "";
    if (!status) return null;
    const validStatus = ATTENDANCE_STATUS_KEYS.includes(status) ? status : "present";
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const grade = typeof source.grade === "string" ? source.grade.trim() : "";
    const className = typeof source.class === "string" ? source.class.trim() : "";
    const arrival = typeof source.arrivalTime === "string" ? source.arrivalTime.trim() : "";
    return {
      status: validStatus,
      name,
      id,
      grade,
      class: className,
      arrivalTime: arrival
    };
  }

  function updateAttendanceReportSelect() {
    const select = elements.attendance?.reportSelect;
    if (!select) return;
    select.innerHTML = "";

    if (!state.attendanceReports.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "— لا توجد تقارير —";
      select.appendChild(option);
      select.value = "";
      select.disabled = true;
      return;
    }

    select.disabled = false;
    state.attendanceReports.forEach((report) => {
      const option = document.createElement("option");
      option.value = report.id;
      option.textContent = buildReportOptionLabel(report);
      select.appendChild(option);
    });
    select.value = state.selectedReportId || state.attendanceReports[0].id;
  }

  function applyAttendanceReport(reportId) {
    const report = state.attendanceReports.find((item) => item.id === reportId);
    if (!report) {
      state.attendanceRecords = [];
      updateAttendanceSummary();
      renderAttendanceTable();
      updateAttendanceReportLabel(null);
      updateAttendanceFilterOptions([]);
      return;
    }

    state.selectedReportId = report.id;
    state.attendanceRecords = Array.isArray(report.records) ? [...report.records] : [];
    updateAttendanceFilterOptions(state.attendanceRecords);
    updateAttendanceSummary();
    renderAttendanceTable();
    updateAttendanceReportLabel(report);
  }

  function updateAttendanceFilterOptions(records) {
    const gradeSelect = elements.attendance?.gradeFilter;
    const classSelect = elements.attendance?.classFilter;
    const grades = new Set();
    const classes = new Set();

    records.forEach((record) => {
      if (record.grade) grades.add(record.grade);
      if (record.class) classes.add(record.class);
    });

    if (gradeSelect) {
      const current = gradeSelect.value;
      gradeSelect.innerHTML = "";
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "جميع الصفوف";
      gradeSelect.appendChild(defaultOption);
      Array.from(grades)
        .sort()
        .forEach((grade) => {
          const option = document.createElement("option");
          option.value = grade;
          option.textContent = grade;
          gradeSelect.appendChild(option);
        });
      if (current && grades.has(current)) {
        gradeSelect.value = current;
        state.attendanceFilters.grade = current;
      } else {
        gradeSelect.value = "";
        state.attendanceFilters.grade = "";
      }
    }

    if (classSelect) {
      const current = classSelect.value;
      classSelect.innerHTML = "";
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "جميع الفصول";
      classSelect.appendChild(defaultOption);
      Array.from(classes)
        .sort()
        .forEach((className) => {
          const option = document.createElement("option");
          option.value = className;
          option.textContent = className;
          classSelect.appendChild(option);
        });
      if (current && classes.has(current)) {
        classSelect.value = current;
        state.attendanceFilters.class = current;
      } else {
        classSelect.value = "";
        state.attendanceFilters.class = "";
      }
    }
  }

  function updateAttendanceSummary() {
    const counts = { present: 0, late: 0, absent: 0 };
    const filtered = getFilteredAttendanceRecords();
    filtered.forEach((record) => {
      if (counts[record.status] != null) {
        counts[record.status] += 1;
      }
    });
    const total = filtered.length;

    if (elements.attendance?.summaryCounts.present) {
      elements.attendance.summaryCounts.present.textContent = counts.present.toString();
    }
    if (elements.attendance?.summaryCounts.late) {
      elements.attendance.summaryCounts.late.textContent = counts.late.toString();
    }
    if (elements.attendance?.summaryCounts.absent) {
      elements.attendance.summaryCounts.absent.textContent = counts.absent.toString();
    }
    if (elements.attendance?.summaryCounts.total) {
      elements.attendance.summaryCounts.total.textContent = total.toString();
    }
  }

  function renderAttendanceTable() {
    const tbody = elements.attendance?.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";
    const records = getFilteredAttendanceRecords();
    if (!records.length) {
      updateAttendanceEmptyState(false);
      return;
    }

    const rows = records
      .map(
        (record) => `
        <tr>
          <td>${escapeHtml(ATTENDANCE_STATUS_LABELS[record.status] || record.status)}</td>
          <td>${escapeHtml(record.name || "—")}</td>
          <td>${escapeHtml(record.id || "—")}</td>
          <td>${escapeHtml(record.grade || "—")}</td>
          <td>${escapeHtml(record.class || "—")}</td>
          <td>${escapeHtml(record.arrivalTime || "—")}</td>
        </tr>`
      )
      .join("");
    tbody.innerHTML = rows;
    updateAttendanceEmptyState(true);
  }

  function getFilteredAttendanceRecords() {
    const records = Array.isArray(state.attendanceRecords) ? state.attendanceRecords : [];
    const statuses = state.attendanceFilters.statuses || new Set(ATTENDANCE_STATUS_KEYS);
    const grade = state.attendanceFilters.grade || "";
    const className = state.attendanceFilters.class || "";
    const search = state.attendanceFilters.search?.trim().toLowerCase() || "";

    return records.filter((record) => {
      if (!statuses.has(record.status)) return false;
      if (grade && record.grade !== grade) return false;
      if (className && record.class !== className) return false;
      if (search) {
        const haystack = `${record.name || ""} ${record.id || ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function updateAttendanceEmptyState(hasRecords) {
    if (!elements.attendance?.emptyState) return;
    elements.attendance.emptyState.hidden = hasRecords;
  }

  function updateAttendanceReportLabel(report) {
    if (!elements.attendance?.reportLabel) return;
    if (!report) {
      elements.attendance.reportLabel.textContent = "لم يتم استلام أي تقرير بعد.";
      return;
    }
    const day = report.dayLabel || formatDate(report.dayKey);
    const timeLabel = formatTime(report.generatedAt);
    elements.attendance.reportLabel.textContent = `${day} — أرسل عند ${timeLabel}`;
  }

  function buildReportOptionLabel(report) {
    const day = report.dayLabel || formatDate(report.dayKey);
    const timeLabel = formatTime(report.generatedAt);
    return `${day} — ${timeLabel}`;
  }

  function showAttendanceStatus(message, variant = "info") {
    if (!elements.attendance?.reportStatus) return;
    elements.attendance.reportStatus.textContent = message || "";
    elements.attendance.reportStatus.dataset.state = variant;
  }

  function handleStatusFilterClick(event) {
    const target = event.target?.closest("[data-status-toggle]");
    if (!target) return;
    const status = target.dataset.statusToggle;
    if (!ATTENDANCE_STATUS_KEYS.includes(status)) return;
    const statuses = state.attendanceFilters.statuses;
    if (statuses.has(status)) {
      if (statuses.size === 1) {
        return; // لا يمكن تعطيل جميع الحالات
      }
      statuses.delete(status);
      target.classList.remove("is-active");
      target.setAttribute("aria-pressed", "false");
    } else {
      statuses.add(status);
      target.classList.add("is-active");
      target.setAttribute("aria-pressed", "true");
    }
    updateAttendanceSummary();
    renderAttendanceTable();
  }

  function resetStatusButtons() {
    const host = elements.attendance?.statusFilters;
    if (!host) return;
    const statuses = state.attendanceFilters.statuses;
    Array.from(host.querySelectorAll("[data-status-toggle]"))
      .filter((button) => ATTENDANCE_STATUS_KEYS.includes(button.dataset.statusToggle))
      .forEach((button) => {
        if (statuses.has(button.dataset.statusToggle)) {
          button.classList.add("is-active");
          button.setAttribute("aria-pressed", "true");
        } else {
          button.classList.remove("is-active");
          button.setAttribute("aria-pressed", "false");
        }
      });
  }

  function handleGradeFilterChange(event) {
    state.attendanceFilters.grade = event.target.value || "";
    updateAttendanceSummary();
    renderAttendanceTable();
  }

  function handleClassFilterChange(event) {
    state.attendanceFilters.class = event.target.value || "";
    updateAttendanceSummary();
    renderAttendanceTable();
  }

  function handleSearchInput(event) {
    state.attendanceFilters.search = event.target.value || "";
    updateAttendanceSummary();
    renderAttendanceTable();
  }

  function handleReportSelectChange(event) {
    const nextId = event.target.value;
    applyAttendanceReport(nextId);
    resetStatusButtons();
  }

  function handleRefreshReportsClick() {
    refreshAttendanceReports().catch((error) => {
      console.error("فشل تحديث تقارير الحضور", error);
    });
  }

  function handleAttendanceExport(event) {
    const button = event.currentTarget;
    if (!button) return;
    const format = button.dataset.format;
    const report = state.attendanceReports.find((item) => item.id === state.selectedReportId);
    if (!report) {
      showAttendanceStatus("لا يوجد تقرير نشط للتصدير.", "error");
      return;
    }
    const records = getFilteredAttendanceRecords();
    if (!records.length) {
      showAttendanceStatus("لا توجد سجلات مطابقة للتصدير.", "warning");
      return;
    }

    if (format === "csv") {
      exportAttendanceCsv(report, records);
      showAttendanceStatus("تم إنشاء ملف CSV بنجاح.", "success");
    } else if (format === "html") {
      exportAttendanceHtml(report, records);
      showAttendanceStatus("تم إنشاء ملف HTML بنجاح.", "success");
    } else if (format === "pdf") {
      openPrintableAttendance(report, records, { mode: "pdf" });
      showAttendanceStatus("تم فتح نافذة الطباعة. اختر حفظ كملف PDF.", "info");
    } else if (format === "print") {
      openPrintableAttendance(report, records, { mode: "print" });
      showAttendanceStatus("تم فتح نافذة الطباعة.", "info");
    }
  }

  function exportAttendanceCsv(report, records) {
    const header = ["الحالة", "الاسم", "الرقم", "الصف", "الفصل", "وقت الوصول"];
    const lines = [header.join(",")];
    records.forEach((record) => {
      lines.push(
        [
          ATTENDANCE_STATUS_LABELS[record.status] || record.status,
          record.name || "",
          record.id || "",
          record.grade || "",
          record.class || "",
          record.arrivalTime || ""
        ]
          .map(escapeCsv)
          .join(",")
      );
    });
    lines.push(`# ${COPYRIGHT_NOTICE}`);
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${buildAttendanceFilename(report)}.csv`);
  }

  function exportAttendanceHtml(report, records) {
    const tableMarkup = buildAttendanceTableMarkup(records);
    const dayLabel = report.dayLabel || formatDate(report.dayKey);
    const timeLabel = formatTime(report.generatedAt);
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(dayLabel)} — تقرير الحضور</title>
    <style>
      body { font-family: 'Tajawal', 'Cairo', sans-serif; margin: 0; background: #ffffff; color: #0f1c2b; min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 18px; }
      h1 { margin: 0; font-size: 24px; }
      .meta { margin: 0; color: #4f637b; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #dde3f0; padding: 12px 16px; text-align: right; font-size: 14px; }
      th { background: #f4f6fb; font-weight: 600; }
      footer { margin-top: auto; padding: 16px 32px; text-align: center; color: #4f637b; font-size: 13px; border-top: 1px solid #dde3f0; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>تقرير الحضور — ${escapeHtml(dayLabel)}</h1>
      <p class="meta">أرسل بواسطة لوحة المراقبة عند ${escapeHtml(timeLabel)}</p>
      <p class="meta">عدد السجلات المصدّرة: ${records.length}</p>
      ${tableMarkup}
    </main>
    <footer>${escapeHtml(COPYRIGHT_NOTICE)}</footer>
  </body>
</html>`;
    const blob = new Blob(["\ufeff" + html], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, `${buildAttendanceFilename(report)}.html`);
  }

  function buildAttendanceTableMarkup(records) {
    const rows = records
      .map(
        (record) => `
        <tr>
          <td>${escapeHtml(ATTENDANCE_STATUS_LABELS[record.status] || record.status)}</td>
          <td>${escapeHtml(record.name || "—")}</td>
          <td>${escapeHtml(record.id || "—")}</td>
          <td>${escapeHtml(record.grade || "—")}</td>
          <td>${escapeHtml(record.class || "—")}</td>
          <td>${escapeHtml(record.arrivalTime || "—")}</td>
        </tr>`
      )
      .join("");

    return `<table>
      <thead>
        <tr>
          <th>الحالة</th>
          <th>الاسم</th>
          <th>الرقم</th>
          <th>الصف</th>
          <th>الفصل</th>
          <th>وقت الوصول</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
  }

  function openPrintableAttendance(report, records, options = {}) {
    const tableMarkup = buildAttendanceTableMarkup(records);
    const dayLabel = report.dayLabel || formatDate(report.dayKey);
    const timeLabel = formatTime(report.generatedAt);
    const note = options.mode === "pdf"
      ? "للحصول على نسخة PDF اختر \"حفظ كملف PDF\" من مربع الطباعة."
      : "تأكد من إعدادات الهوامش والاتجاه قبل الطباعة.";
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(dayLabel)} — طباعة تقرير الحضور</title>
    <style>
      body { font-family: 'Tajawal', 'Cairo', sans-serif; margin: 0; background: #ffffff; color: #0f1c2b; }
      main { padding: 28px 32px; display: flex; flex-direction: column; gap: 16px; }
      h1 { margin: 0; font-size: 24px; }
      .meta { margin: 0; color: #4f637b; font-size: 14px; }
      .note { margin: 0; color: #c2410c; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #cbd5f5; padding: 12px 14px; text-align: right; font-size: 13px; }
      th { background: #eef2ff; font-weight: 600; }
      footer { margin-top: 12px; text-align: center; font-size: 12px; color: #4f637b; }
    </style>
  </head>
  <body>
    <main>
      <h1>تقرير الحضور — ${escapeHtml(dayLabel)}</h1>
      <p class="meta">أرسل عند ${escapeHtml(timeLabel)}</p>
      <p class="meta">عدد السجلات: ${records.length}</p>
      <p class="note">${escapeHtml(note)}</p>
      ${tableMarkup}
      <footer>${escapeHtml(COPYRIGHT_NOTICE)}</footer>
    </main>
  </body>
</html>`;
    const blob = new Blob(["\ufeff" + html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      showAttendanceStatus("لم يتم فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.", "warning");
      return;
    }
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (options.mode === "pdf") {
        printWindow.close();
      }
    };
    printWindow.onload = () => {
      if (options.mode === "pdf") {
        printWindow.print();
        setTimeout(cleanup, 600);
      } else {
        printWindow.print();
        setTimeout(() => {
          cleanup();
        }, 600);
      }
    };
  }

  function buildAttendanceFilename(report) {
    const daySegment = report.dayKey || "report";
    const timeSegment = report.generatedAt ? report.generatedAt.replace(/[:T]/g, "-").slice(0, 19) : "time";
    return `attendance-${daySegment}-${timeSegment}`;
  }

  function downloadBlob(blob, filename) {
    if (!(blob instanceof Blob)) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "export";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function escapeCsv(value) {
    const stringValue = value == null ? "" : String(value);
    if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
  }

  function toSafeInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function bindEvents() {
    elements.idInput?.addEventListener("input", handleStudentInput);
    elements.form?.addEventListener("submit", handleFormSubmit);
    elements.refreshToday?.addEventListener("click", () => {
      refreshToday().catch((error) => {
        console.error("فشل تحديث الطلبات لليوم", error);
      });
    });
    elements.accessForm?.addEventListener("submit", handleAccessSubmit);
    elements.accessSignOut?.addEventListener("click", handleAccessSignOut);

    elements.tabButtons?.forEach((button) => {
      button.addEventListener("click", () => {
        const targetTab = button.dataset.tabTrigger || button.dataset.tab;
        switchTab(targetTab);
      });
    });

    elements.attendance?.statusFilters?.addEventListener("click", handleStatusFilterClick);
    elements.attendance?.gradeFilter?.addEventListener("change", handleGradeFilterChange);
    elements.attendance?.classFilter?.addEventListener("change", handleClassFilterChange);
    elements.attendance?.searchInput?.addEventListener("input", handleSearchInput);
    elements.attendance?.reportSelect?.addEventListener("change", handleReportSelectChange);
    elements.attendance?.refreshButton?.addEventListener("click", handleRefreshReportsClick);
    elements.attendance?.exportButtons.forEach((button) => {
      button.addEventListener("click", handleAttendanceExport);
    });
  }

  function switchTab(tabId) {
    const target = tabId || "permissions";
    state.activeTab = target;
    elements.tabButtons?.forEach((button) => {
      const current = button.dataset.tabTrigger || button.dataset.tab;
      const isActive = current === target;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    elements.panels?.forEach((panel) => {
      const current = panel.dataset.tabPanel;
      if (current === target) {
        panel.classList.add("is-active");
        panel.hidden = false;
      } else {
        panel.classList.remove("is-active");
        panel.hidden = true;
      }
    });
  }

  function subscribeToUpdates() {
    if (settingsChannel) {
      settingsChannel.addEventListener("message", (event) => {
        if (event?.data?.type === "settings-updated" && event.data.payload) {
          state.settings = { ...state.settings, ...event.data.payload };
          applySettings(state.settings);
        }
      });
    }

    if (permissionChannel) {
      permissionChannel.addEventListener("message", (event) => {
        if (event?.data?.type === "permission-recorded") {
          refreshToday().catch((error) => {
            console.error("فشل مزامنة الطلبات عبر القناة", error);
          });
        }
      });
    }

    if (supervisionReportChannel) {
      supervisionReportChannel.addEventListener("message", (event) => {
        if (event?.data?.type === "supervision-report" && event.data.payload) {
          const message =
            typeof event.data.message === "string" && event.data.message.trim() !== ""
              ? event.data.message
              : "تم استلام تقرير إشراف جديد.";
          refreshAttendanceReports({ message, variant: "success" }).catch((error) => {
            console.error("فشل تحديث تقارير الإشراف من القناة", error);
          });
        }
      });
    }

    window.addEventListener("storage", (event) => {
      if (matchesSchoolKey(event.key, SETTINGS_KEY)) {
        loadSettings()
          .then(() => applySettings(state.settings))
          .catch((error) => console.error("تعذّر تحديث الإعدادات من التخزين", error));
      } else if (matchesSchoolKey(event.key, STUDENTS_KEY)) {
        loadStudents().catch((error) => console.error("تعذّر تحديث الطلاب", error));
      } else if (matchesSchoolKey(event.key, PERMISSIONS_KEY)) {
        refreshToday().catch((error) => console.error("تعذّر تحديث الطلبات", error));
      } else if (event.key === STORE_PREFERENCE_KEY) {
        // تحديث مؤشر الإشارة فقط.
        updateStoreIndicator();
      } else if (matchesSchoolKey(event.key, SUPERVISION_REPORTS_KEY)) {
        refreshAttendanceReports({ silent: true }).catch((error) => {
          console.error("تعذّر تحديث تقارير الإشراف من التخزين", error);
        });
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

  function handleStudentInput(event) {
    if (!isAccessGranted()) {
      if (event?.target) {
        event.target.value = "";
      }
      renderStudentPreview(null);
      return;
    }
    const value = String(event.target.value || "").trim();
    if (!value) {
      state.currentStudent = null;
      renderStudentPreview(null);
      return;
    }
    const student = state.students.find((item) => item.id === value);
    state.currentStudent = student || null;
    renderStudentPreview(student || null);
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    if (!isAccessGranted()) {
      showFormStatus("الوصول إلى بوابة الإشراف متاح للمشرفين المعتمدين فقط.", "error");
      showAccessGate();
      return;
    }
    const id = String(elements.idInput?.value || "").trim();
    if (!id) {
      showFormStatus("يرجى إدخال رقم الطالب.", "error");
      return;
    }

    const student = state.students.find((item) => item.id === id);
    if (!student) {
      showFormStatus("لا يوجد طالب بهذا الرقم.", "error");
      renderStudentPreview(null);
      return;
    }

    const reason = String(elements.reasonInput?.value || "").trim();
    const note = String(elements.noteInput?.value || "").trim();
    if (!reason) {
      showFormStatus("يرجى إدخال سبب الطلب.", "error");
      return;
    }

    showFormStatus("جاري الحفظ...", "info");

    const entry = {
      studentId: student.id,
      createdAt: new Date().toISOString(),
      reason,
      note,
      status: "approved"
    };

    try {
      let savedEntry = entry;
      if (typeof state.store?.addPermission === "function") {
        savedEntry = await state.store.addPermission(entry);
      } else {
        const map = readPermissionsFallback();
        const day = entry.createdAt.slice(0, 10);
        const list = map[day] ? [...map[day]] : [];
        const normalized = normalizePermission(entry);
        list.push(normalized);
        list.sort(sortByCreatedAt);
        map[day] = list;
        writePermissionsFallback(map);
        savedEntry = normalized;
      }

      showFormStatus("تم تسجيل الطلب بنجاح.", "success");
      if (permissionChannel) {
        permissionChannel.postMessage({ type: "permission-recorded", payload: savedEntry });
      }
      await refreshToday();
      resetForm();
    } catch (error) {
      console.error("فشل تسجيل الطلب", error);
      showFormStatus("حدث خطأ أثناء الحفظ. حاول مرة أخرى.", "error");
    }
  }

  function renderStudentPreview(student) {
    if (!elements.studentPreview) return;
    if (!student) {
      elements.studentPreview.hidden = true;
      elements.studentName.textContent = "—";
      elements.studentMeta.textContent = "—";
      return;
    }

    elements.studentPreview.hidden = false;
    elements.studentName.textContent = student.name || "بدون اسم";
    const metaParts = [];
    if (student.grade) metaParts.push(`الصف ${student.grade}`);
    if (student.class) metaParts.push(`الفصل ${student.class}`);
    elements.studentMeta.textContent = metaParts.length ? metaParts.join(" — ") : "لا توجد بيانات صف";
    elements.studentStatus.textContent = "سيتم تسجيل الطلب لهذا الطالب.";
  }

  function renderTodayPermissions() {
    if (!elements.permissionTable) return;
    elements.permissionTable.innerHTML = "";

    if (!state.todayPermissions || state.todayPermissions.length === 0) {
      const emptyRow = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "لا توجد طلبات مسجلة لهذا اليوم حتى الآن.";
      cell.style.textAlign = "center";
      emptyRow.appendChild(cell);
      elements.permissionTable.appendChild(emptyRow);
    } else {
      state.todayPermissions.forEach((entry) => {
        const student = state.students.find((item) => item.id === entry.studentId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(formatTime(entry.createdAt))}</td>
          <td>${escapeHtml(student?.name || "غير معروف")}</td>
          <td>${escapeHtml(entry.studentId)}</td>
          <td>${escapeHtml(entry.reason || "—")}</td>
          <td>${escapeHtml(entry.note || "—")}</td>
        `;
        elements.permissionTable.appendChild(tr);
      });
    }

    updatePermissionSummary();
  }

  function updatePermissionSummary() {
    if (!elements.permissionSummary) return;
    const count = state.todayPermissions ? state.todayPermissions.length : 0;
    elements.permissionSummary.textContent = count
      ? `تم تسجيل ${count} طلب${count !== 1 ? "ات" : ""} إشراف اليوم.`
      : "سجّل أول طلب إشراف اليوم لبدء المتابعة.";
  }

  function updateDayLabel() {
    if (!elements.dayLabel) return;
    elements.dayLabel.textContent = formatDate(state.todayKey);
  }

  function updateStoreIndicator() {
    if (!elements.storeIndicator || !elements.storeLabel) return;
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

  function applySettings(nextSettings) {
    const normalized = normalizeSettingsObject(nextSettings);
    state.settings = normalized;
    applyTheme(normalized.leaveTheme || normalized.uiTheme, normalized);
    updateAccentColor(state.settings.leaveAccentColor);
    updateMorningMessage(state.settings.leaveMorningMessage);
    updateAnnouncements(state.settings.leaveAnnouncementMessages);
    updateHero(state.settings.leaveHeroUrl, state.settings.leaveHeroName);
    updateGeneralTip(state.settings.leaveTip);
    updateSchoolName(state.settings.schoolName);
    if (accessInitialized) {
      enforceAccessSession({ skipFocus: true, silent: true });
    }
  }

  function applyTheme(themeName, customSource) {
    const normalized = normalizeTheme(themeName);
    const colors = normalizeCustomThemeColors(customSource || state.settings);
    if (typeof THEME_LIBRARY?.applyTheme === "function") {
      THEME_LIBRARY.applyTheme(normalized, { customColors: colors });
    } else {
      document.documentElement.setAttribute("data-theme", normalized);
    }
    applyCardDecorationsFromSettings(customSource || state.settings);
  }

  function updateGeneralTip(tip) {
    if (!elements.generalTip || !elements.generalTipText) return;
    const provided = typeof tip === "string" ? tip.trim() : "";
    if (provided) {
      elements.generalTipText.textContent = provided;
      elements.generalTip.hidden = false;
    } else {
      elements.generalTipText.textContent = "";
      elements.generalTip.hidden = true;
    }
  }

  function updateAccentColor(color) {
    const sanitized = sanitizeHexColor(color, DEFAULT_SETTINGS.leaveAccentColor);
    document.documentElement.style.setProperty("--leave-accent", sanitized);
    const rgb = hexToRgb(sanitized);
    if (rgb) {
      document.documentElement.style.setProperty("--leave-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
  }

  function updateMorningMessage(message) {
    if (!elements.morningCard || !elements.morningText) return;
    const text = typeof message === "string" ? message.trim() : "";
    elements.morningText.textContent = text;
    elements.morningCard.hidden = !text;
    updateMessagingVisibility();
  }

  function updateAnnouncements(list) {
    if (!elements.announcementCard || !elements.announcementList) return;
    const items = Array.isArray(list)
      ? list.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    elements.announcementList.innerHTML = "";
    if (items.length === 0) {
      elements.announcementCard.hidden = true;
      updateMessagingVisibility();
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      elements.announcementList.appendChild(li);
    });
    elements.announcementCard.hidden = false;
    updateMessagingVisibility();
  }

  function updateHero(source, name) {
    if (!elements.hero || !elements.heroImage) return;
    const hasSource = typeof source === "string" && source.trim() !== "";
    if (hasSource) {
      elements.heroImage.src = source;
      if (typeof name === "string" && name.trim() !== "") {
        elements.heroImage.alt = name.trim();
      } else {
        elements.heroImage.alt = "صورة ترحيبية لبوابة الإشراف";
      }
      elements.hero.hidden = false;
    } else {
      elements.heroImage.removeAttribute("src");
      elements.hero.hidden = true;
    }
  }

  function updateMessagingVisibility() {
    if (!elements.messaging) return;
    const hasMorning = Boolean(elements.morningCard && !elements.morningCard.hidden);
    const hasAnnouncements = Boolean(elements.announcementCard && !elements.announcementCard.hidden);
    elements.messaging.hidden = !(hasMorning || hasAnnouncements);
  }

  function updateSchoolName(name) {
    const clean = typeof name === "string" ? name.trim() : "";
    const hasName = clean !== "";
    if (!Array.isArray(elements.schoolName)) return;
    const fallback = "اسم المدرسة غير محدد";
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

  function hexToRgb(hex) {
    const normalized = typeof hex === "string" ? hex.replace(/^#/, "") : "";
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return null;
    }
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
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

  function normalizeTheme(value) {
    if (typeof THEME_LIBRARY?.sanitizeTheme === "function") {
      return THEME_LIBRARY.sanitizeTheme(value);
    }
    const theme = typeof value === "string" ? value.trim() : "";
    return AVAILABLE_THEMES.includes(theme) ? theme : DEFAULT_SETTINGS.uiTheme;
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
    merged.leaveGeneralSupervisorIds = normalizeIdList(merged.leaveGeneralSupervisorIds);
    merged.leaveClassSupervisorIds = normalizeIdList(merged.leaveClassSupervisorIds);
    merged.leaveAdminIds = normalizeIdList(merged.leaveAdminIds);
    merged.leaveTheme = normalizeTheme(merged.leaveTheme || DEFAULT_SETTINGS.leaveTheme);
    merged.leaveAccentColor = sanitizeHexColor(merged.leaveAccentColor, DEFAULT_SETTINGS.leaveAccentColor);
    merged.leaveMorningMessage = typeof merged.leaveMorningMessage === "string"
      ? merged.leaveMorningMessage.trim()
      : "";
    if (Array.isArray(merged.leaveAnnouncementMessages)) {
      merged.leaveAnnouncementMessages = merged.leaveAnnouncementMessages
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    } else if (typeof merged.leaveAnnouncementMessages === "string") {
      merged.leaveAnnouncementMessages = merged.leaveAnnouncementMessages
        .split(/\r?\n|,|;/)
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      merged.leaveAnnouncementMessages = [];
    }
    merged.leaveTip = typeof merged.leaveTip === "string" ? merged.leaveTip.trim() : "";
    merged.leaveHeroUrl = typeof merged.leaveHeroUrl === "string" ? merged.leaveHeroUrl.trim() : "";
    merged.leaveHeroName = typeof merged.leaveHeroName === "string" ? merged.leaveHeroName.trim() : "";

    const remoteSync = typeof window !== "undefined" ? window.HaderRemoteSync || null : null;
    if (remoteSync?.normalizeSettings) {
      const remoteAdjusted = remoteSync.normalizeSettings(merged);
      Object.assign(merged, remoteAdjusted);
    } else {
      merged.remoteSyncEnabled = toBoolean(merged.remoteSyncEnabled);
      merged.remoteSyncEndpoint = sanitizeOptionalString(merged.remoteSyncEndpoint);
      merged.remoteSyncAuthToken = sanitizeOptionalString(merged.remoteSyncAuthToken);
      merged.remoteSyncSchoolCode = sanitizeOptionalString(merged.remoteSyncSchoolCode);
      merged.remoteSyncMode = String(merged.remoteSyncMode || DEFAULT_SETTINGS.remoteSyncMode) === "countdown"
        ? "countdown"
        : "time";
      merged.remoteSyncTime = sanitizeTimeValue(merged.remoteSyncTime, DEFAULT_SETTINGS.remoteSyncTime);
      merged.remoteSyncCountdownMinutes = clampNumber(
        merged.remoteSyncCountdownMinutes,
        0,
        720,
        DEFAULT_SETTINGS.remoteSyncCountdownMinutes
      );
      merged.remoteSyncSupervisorsText = String(merged.remoteSyncSupervisorsText || "");
      merged.remoteSyncSupervisors = [];
    }
    return merged;
  }

  function normalizeIdList(value) {
    const items = [];
    if (Array.isArray(value)) {
      items.push(...value.map((item) => String(item || "").trim()));
    } else if (typeof value === "string") {
      items.push(
        ...value
          .split(/\r?\n|,|;/)
          .map((item) => item.trim())
      );
    }
    const filtered = items.filter(Boolean);
    const unique = Array.from(new Set([...MASTER_SUPERVISOR_IDENTIFIERS, ...filtered]));
    return unique;
  }

  function sanitizeTimeValue(value, fallback) {
    if (typeof window !== "undefined" && window.HaderRemoteSync?.sanitizeTimeString) {
      return window.HaderRemoteSync.sanitizeTimeString(value, fallback);
    }
    const raw = typeof value === "string" ? value.trim() : "";
    if (/^\d{2}:\d{2}$/.test(raw)) {
      return raw;
    }
    return typeof fallback === "string" && fallback ? fallback : DEFAULT_SETTINGS.remoteSyncTime;
  }

  function normalizeAccessRole(role) {
    return role && Object.prototype.hasOwnProperty.call(ACCESS_ROLES, role) ? role : null;
  }

  function isIdentifierAllowed(role, identifier) {
    const normalizedRole = normalizeAccessRole(role);
    const cleanId = String(identifier || "").trim();
    if (!normalizedRole || !cleanId) return false;
    if (MASTER_SUPERVISOR_IDENTIFIERS.includes(cleanId)) {
      return true;
    }
    const key = ACCESS_ROLES[normalizedRole].key;
    const list = Array.isArray(state.settings[key]) ? state.settings[key] : [];
    return list.includes(cleanId);
  }

  function readAccessSession() {
    try {
      const raw = sessionStorage.getItem(ACCESS_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const role = normalizeAccessRole(parsed.role);
      const identifier = typeof parsed.identifier === "string" ? parsed.identifier : "";
      if (!role || !identifier) return null;
      return { role, identifier };
    } catch (error) {
      console.warn("تعذّر قراءة جلسة بوابة الإشراف.", error);
      return null;
    }
  }

  function saveAccessSession(session) {
    try {
      sessionStorage.setItem(ACCESS_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn("تعذّر حفظ جلسة بوابة الإشراف.", error);
    }
  }

  function clearAccessSession() {
    try {
      sessionStorage.removeItem(ACCESS_SESSION_KEY);
    } catch (error) {
      console.warn("تعذّر مسح جلسة بوابة الإشراف.", error);
    }
  }

  function enforceAccessSession(options = {}) {
    const { skipFocus = false, silent = false } = options || {};
    const session = readAccessSession();
    if (session && isIdentifierAllowed(session.role, session.identifier)) {
      applyAccessGrant(session.role, session.identifier, {
        persist: false,
        skipFocus: skipFocus || !accessInitialized
      });
    } else {
      revokeAccess({ keepSession: false, silent });
    }
  }

  function applyAccessGrant(role, identifier, options = {}) {
    const normalizedRole = normalizeAccessRole(role);
    const cleanId = String(identifier || "").trim();
    if (!normalizedRole || !cleanId) {
      revokeAccess({ keepSession: false, silent: true });
      return;
    }
    state.access.role = normalizedRole;
    state.access.identifier = cleanId;
    updateAccessIndicator();
    hideAccessGate();
    showAccessError("");
    if (options.persist !== false) {
      saveAccessSession({ role: normalizedRole, identifier: cleanId, grantedAt: Date.now() });
    }
    if (!options.skipFocus) {
      ensureInputFocus();
    }
  }

  function revokeAccess(options = {}) {
    const { keepSession = false, silent = false } = options || {};
    state.access.role = null;
    state.access.identifier = "";
    updateAccessIndicator();
    if (!keepSession) {
      clearAccessSession();
    }
    if (!silent) {
      showAccessGate();
    } else {
      showAccessGate("");
    }
  }

  function updateAccessIndicator() {
    if (!elements.accessChip || !elements.accessChipRole) return;
    const role = state.access.role;
    if (role && ACCESS_ROLES[role]) {
      elements.accessChip.hidden = false;
      elements.accessChipRole.textContent = ACCESS_ROLES[role].label;
    } else {
      elements.accessChip.hidden = true;
      elements.accessChipRole.textContent = "—";
    }
  }

  function showAccessGate(message = "") {
    if (elements.accessGate) {
      elements.accessGate.hidden = false;
    }
    if (document.body) {
      document.body.dataset.leaveLocked = "true";
    }
    showAccessError(message);
    elements.accessForm?.reset();
    elements.accessRoleSelect?.focus();
  }

  function hideAccessGate() {
    if (elements.accessGate) {
      elements.accessGate.hidden = true;
    }
    if (document.body) {
      delete document.body.dataset.leaveLocked;
    }
  }

  function showAccessError(message, state = message ? "error" : "info") {
    if (!elements.accessError) return;
    elements.accessError.textContent = message || "";
    elements.accessError.dataset.state = state;
  }

  function handleAccessSubmit(event) {
    event.preventDefault();
    const role = normalizeAccessRole(elements.accessRoleSelect?.value);
    const identifier = String(elements.accessIdentifier?.value || "").trim();
    if (!role) {
      showAccessError("يرجى اختيار الجهة المصرّح لها.", "error");
      elements.accessRoleSelect?.focus();
      return;
    }
    if (!identifier) {
      showAccessError("يرجى إدخال المعرف المخصص.", "error");
      elements.accessIdentifier?.focus();
      return;
    }
    if (!isIdentifierAllowed(role, identifier)) {
      showAccessError("المعرف المدخل غير مصرح به لهذه الجهة.", "error");
      elements.accessIdentifier?.select?.();
      return;
    }
    applyAccessGrant(role, identifier);
    elements.accessForm?.reset();
  }

  function handleAccessSignOut() {
    revokeAccess();
  }

  function isAccessGranted() {
    return Boolean(state.access.role);
  }

  function sanitizeTheme(value) {
    return normalizeTheme(value);
  }

  function ensureInputFocus() {
    if (!isAccessGranted()) return;
    if (elements.idInput) {
      elements.idInput.focus();
      elements.idInput.select?.();
    }
  }

  function resetForm() {
    elements.form?.reset();
    state.currentStudent = null;
    renderStudentPreview(null);
    ensureInputFocus();
  }

  function showFormStatus(message, variant) {
    if (!elements.formStatus) return;
    elements.formStatus.textContent = message;
    elements.formStatus.dataset.state = variant || "info";
  }

  function formatTime(isoString) {
    if (!isoString) return "--:--";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "--:--";
    return date
      .toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .replace(/^24/, "00");
  }

  function formatDate(dayString) {
    if (!dayString) return "—";
    const [year, month, day] = dayString.split("-").map((part) => parseInt(part, 10));
    if (!year || !month || !day) return dayString;
    const date = new Date(Date.UTC(year, month - 1, day));
    try {
      return new Intl.DateTimeFormat("ar-SA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(date);
    } catch (error) {
      return dayString;
    }
  }

  function getDayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function normalizePermission(input) {
    if (!input || typeof input !== "object") return null;
    const studentId = "studentId" in input ? String(input.studentId).trim() : "";
    if (!studentId) return null;
    const reason = "reason" in input && input.reason != null ? String(input.reason).trim() : "";
    const note = "note" in input && input.note != null ? String(input.note).trim() : "";
    const status = "status" in input && input.status != null ? String(input.status).trim() : "approved";
    let createdAt = input.createdAt;
    let createdDate = createdAt ? new Date(createdAt) : new Date();
    if (Number.isNaN(createdDate.getTime())) {
      createdDate = new Date();
    }
    createdAt = createdDate.toISOString();
    return {
      studentId,
      createdAt,
      reason,
      note,
      status
    };
  }

  function sortByCreatedAt(a, b) {
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
