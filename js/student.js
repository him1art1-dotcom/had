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
  const FALLBACK_THEMES = Object.freeze(["classic", "sunrise", "oasis", "forest", "midnight", "custom"]);
  const AVAILABLE_THEMES = THEME_LIBRARY?.AVAILABLE_THEMES || FALLBACK_THEMES;
  const ADMIN_SUPERVISOR_IDENTIFIER = "ADMIN_SUPER";
  const TECHNICAL_SUPERVISOR_IDENTIFIER = "ADMIN_TECH";
  const MASTER_SUPERVISOR_IDENTIFIERS = Object.freeze([
    ADMIN_SUPERVISOR_IDENTIFIER,
    TECHNICAL_SUPERVISOR_IDENTIFIER
  ]);
  const DEFAULT_CUSTOM_THEME =
    THEME_LIBRARY?.DEFAULT_CUSTOM_COLORS || Object.freeze({ background: "#f4f6fb", strong: "#0f1c2b", muted: "#4f637b" });
  const CARD_SHADOW_LIMITS = THEME_LIBRARY?.CARD_SHADOW_LIMITS || Object.freeze({ min: 0, max: 300 });
  const CARD_BORDER_WIDTH_LIMITS = THEME_LIBRARY?.CARD_BORDER_WIDTH_LIMITS || Object.freeze({ min: 0, max: 12 });

  const SETTINGS_KEY = "aa_settings";
  const STUDENTS_KEY = "aa_students";
  const ATTENDANCE_KEY = "aa_attendance";
  const PERMISSIONS_KEY = "aa_permissions";
  const CHANNEL_NAME = "attendance-sync";
  const SETTINGS_CHANNEL_NAME = "hader-settings";
  const REMOTE_SYNC = window.HaderRemoteSync || null;
  const REMOTE_SYNC_CHANNEL_NAME = REMOTE_SYNC?.CHANNEL_NAME || "hader-remote-sync";
  const SCHOOL_LOCK_MESSAGE = "راجع الدعم الفني";
  const PERMISSION_CHANNEL_NAME = "permission-sync";

  const DEFAULT_SETTINGS = Object.freeze({
    schoolStart: "07:00",
    graceMinutes: 10,
    theme: "classic",
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
    uiTheme: "classic",
    customThemeBackground: DEFAULT_CUSTOM_THEME.background,
    customThemeTextStrong: DEFAULT_CUSTOM_THEME.strong,
    customThemeTextMuted: DEFAULT_CUSTOM_THEME.muted,
    uiCardShadowIntensity: 100,
    uiCardBorderColor: null,
    uiCardBorderWidth: null,
    statusCardAutoHideMinutes: 3,
    kioskScaleMode: "auto",
    kioskScaleValue: 100,
    portalCardScale: 100,
    portalListScale: 100,
    portalStatusCardWidth: 100,
    portalStatusCardHeight: 100,
    portalStatusCardFontScale: 100,
    portalStatusStatsScale: 100,
    portalStatusStatsFontScale: 100,
    portalAttendanceCounterVisible: true,
    portalAudioVolume: 80,
    portalAudioEarlyUrl: "",
    portalAudioEarlyName: "",
    portalAudioLateUrl: "",
    portalAudioLateName: "",
    portalAudioDuplicateUrl: "",
    portalAudioDuplicateName: "",
    portalAudioMissingUrl: "",
    portalAudioMissingName: "",
    portalScreensaverEnabled: false,
    portalScreensaverIdleMinutes: 5,
    portalScreensaverStartTime: "00:00",
    portalScreensaverEndTime: "23:59",
    portalScreensaverSlot1Visible: false,
    portalScreensaverSlot1Url: "",
    portalScreensaverSlot1Name: "",
    portalScreensaverSlot1Text: "",
    portalScreensaverSlot1Duration: 20,
    portalScreensaverSlot2Visible: false,
    portalScreensaverSlot2Url: "",
    portalScreensaverSlot2Name: "",
    portalScreensaverSlot2Text: "",
    portalScreensaverSlot2Duration: 20,
    portalScreensaverSlot3Visible: false,
    portalScreensaverSlot3Url: "",
    portalScreensaverSlot3Name: "",
    portalScreensaverSlot3Text: "",
    portalScreensaverSlot3Duration: 20,
    portalRotation: "0deg",
    portalAutoScale: true,
    portalScaleAdjust: 100,
    portalAutoFullscreen: false,
    portalFontScale: 100,
    portalOffsetX: 0,
    portalOffsetY: 0,
    portalAdTopUrl: "",
    portalAdTopName: "",
    portalAdTopLink: "",
    portalAdTopVisible: false,
    portalAdBottomUrl: "",
    portalAdBottomName: "",
    portalAdBottomLink: "",
    portalAdBottomVisible: false,
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

  const SCALE_MODES = Object.freeze(["auto", "manual"]);
  const SCALE_PERCENT_LIMITS = Object.freeze({ min: 60, max: 160 });
  const SCALE_RATIO_LIMITS = Object.freeze({
    min: SCALE_PERCENT_LIMITS.min / 100,
    max: SCALE_PERCENT_LIMITS.max / 100
  });
  const BASE_VIEWPORT = Object.freeze({ width: 1200, height: 850 });
  const CARD_SCALE_LIMITS = Object.freeze({ min: 60, max: 180 });
  const LIST_SCALE_LIMITS = Object.freeze({ min: 60, max: 180 });
  const STATUS_CARD_WIDTH_LIMITS = Object.freeze({ min: 60, max: 160 });
  const STATUS_CARD_HEIGHT_LIMITS = Object.freeze({ min: 60, max: 160 });
  const STATUS_CARD_FONT_LIMITS = Object.freeze({ min: 70, max: 150 });
  const STATUS_STATS_SCALE_LIMITS = Object.freeze({ min: 60, max: 160 });
  const STATUS_STATS_FONT_LIMITS = Object.freeze({ min: 70, max: 150 });
  const PORTAL_SCALE_LIMITS = Object.freeze({ min: 50, max: 200 });
  const FONT_SCALE_LIMITS = Object.freeze({ min: 70, max: 150 });
  const PORTAL_OFFSET_LIMITS = Object.freeze({
    x: { min: -720, max: 720 },
    y: { min: -480, max: 480 }
  });
  const ROTATION_VALUES = Object.freeze(["0deg", "90deg", "-90deg"]);
  const ROTATION_LABELS = Object.freeze({
    "0deg": "العرض الأفقي",
    "90deg": "طولي — يمين",
    "-90deg": "طولي — يسار"
  });
  const CURSOR_HIDE_TIMEOUT = 5000;
  const STATUS_AUTO_HIDE_LIMITS = Object.freeze({ min: 0, max: 30 });
  const SOUND_STATUS_CONFIG = Object.freeze([
    { key: "early", settingKey: "Early" },
    { key: "late", settingKey: "Late" },
    { key: "duplicate", settingKey: "Duplicate" },
    { key: "missing", settingKey: "Missing" }
  ]);
  const SOUND_STATUS_MAP = Object.freeze({
    early: "early",
    late: "late",
    duplicate: "duplicate",
    "not-found": "missing"
  });
  const SCREENSAVER_SLOT_CONFIG = Object.freeze([
    { key: "slot1", settingKey: "Slot1" },
    { key: "slot2", settingKey: "Slot2" },
    { key: "slot3", settingKey: "Slot3" }
  ]);
  const AUDIO_VOLUME_LIMITS = Object.freeze({ min: 0, max: 100 });
  const SCREENSAVER_IDLE_LIMITS = Object.freeze({ min: 0, max: 120 });
  const SCREENSAVER_DURATION_LIMITS = Object.freeze({ min: 5, max: 120 });
  const SCREENSAVER_RECHECK_DELAY = 60000;

  const DEFAULT_CONTENT = Object.freeze({
    morningMessage: "صباح الهمّة والنشاط 🌞",
    earlyPhrase: "بداية مشرقة! 👏",
    latePhrase: "شد حيلك.. الجاي أحسن 💪"
  });

  const STATUS_LABELS = Object.freeze({
    "not-found": "غير مسجل",
    duplicate: "مكرّر",
    early: "مبكر",
    late: "متأخر"
  });

  const elements = {
    bannerWrapper: document.querySelector("[data-banner-wrapper]"),
    banner: document.querySelector("[data-banner]"),
    morningMessage: document.querySelector("[data-morning-message]"),
    clock: document.querySelector("[data-clock]"),
    input: document.querySelector("[data-id-input]"),
    statusCard: document.querySelector("[data-status-card]"),
    statusBadge: document.querySelector("[data-status-badge]"),
    statusName: document.querySelector("[data-student-name]"),
    statusMeta: document.querySelector("[data-student-meta]"),
    arrivalBlock: document.querySelector("[data-arrival-block]"),
    arrivalTime: document.querySelector("[data-arrival-time]"),
    statusMessage: document.querySelector("[data-status-message]"),
    lateStats: document.querySelector("[data-late-stats]"),
    lateDays: document.querySelector("[data-late-days]"),
    lateToday: document.querySelector("[data-late-today]"),
    lateTotal: document.querySelector("[data-late-total]"),
    attendanceCounter: document.querySelector("[data-attendance-counter]"),
    attendanceCurrent: document.querySelector("[data-attendance-current]"),
    attendanceTotal: document.querySelector("[data-attendance-total]"),
    generalTip: document.querySelector("[data-general-tip]"),
    generalTipText: document.querySelector("[data-general-tip-text]"),
    schoolName: Array.from(document.querySelectorAll("[data-school-name]")),
    scaleRoot: document.querySelector("[data-scale-root]"),
    portalRoot: document.querySelector("[data-portal-root]"),
    portalStage: document.querySelector("[data-portal-stage]"),
    portalCanvas: document.querySelector("[data-portal-canvas]"),
    lockOverlay: document.querySelector("[data-school-lock]"),
    lockDialog: document.querySelector("[data-school-lock-dialog]"),
    lockMessage: document.querySelector("[data-school-lock-message]"),
    rotationToggle: document.querySelector("[data-rotation-toggle]"),
    ads: {
      top: {
        slot: document.querySelector('[data-ad-slot="top"]'),
        link: document.querySelector('[data-ad-link="top"]'),
        image: document.querySelector('[data-ad-image="top"]')
      },
      bottom: {
        slot: document.querySelector('[data-ad-slot="bottom"]'),
        link: document.querySelector('[data-ad-link="bottom"]'),
        image: document.querySelector('[data-ad-image="bottom"]')
      }
    },
    screensaver: (() => {
      const root = document.querySelector('[data-screensaver]');
      if (!root) return null;
      return {
        root,
        image: root.querySelector('[data-screensaver-image]'),
        video: root.querySelector('[data-screensaver-video]'),
        text: root.querySelector('[data-screensaver-text]')
      };
    })(),
    controls: (() => {
      const root = document.querySelector("[data-portal-controls]");
      if (!root) return null;
      return {
        root,
        toggle: root.querySelector("[data-controls-toggle]"),
        panel: root.querySelector("[data-controls-panel]"),
        fontRange: root.querySelector("[data-font-range]"),
        fontValue: root.querySelector("[data-font-value]"),
        cardRange: root.querySelector("[data-card-range]"),
        cardValue: root.querySelector("[data-card-value]"),
        dragToggle: root.querySelector("[data-drag-toggle]"),
        positionX: root.querySelector("[data-position-x]"),
        positionY: root.querySelector("[data-position-y]"),
        positionReset: root.querySelector("[data-position-reset]")
      };
    })()
  };

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

  function applySchoolLock(meta) {
    const effectiveMeta = meta || schoolMeta || null;
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

  function refreshSchoolMeta() {
    schoolMeta = readCurrentSchoolMeta();
    applySchoolLock(schoolMeta);
    return schoolMeta;
  }

  let settings = readSettings();
  let students = readStudents();
  let attendance = readAttendance();
  let schoolMeta = readCurrentSchoolMeta();
  let currentScale = 1;
  let clockTimerId = null;
  let soundVolume = DEFAULT_SETTINGS.portalAudioVolume / 100;
  const soundPlayers = new Map();
  let screensaverConfig = {
    enabled: false,
    idleMs: 0,
    startMinutes: 0,
    endMinutes: 1440,
    slides: []
  };
  let screensaverIdleTimer = null;
  let screensaverSlideTimer = null;
  let screensaverActive = false;
  let screensaverIndex = 0;
  let statusHideTimer = null;
  let currentPortalScale = 1;
  let cursorHideTimer = null;
  let fullscreenListenerArmed = false;
  let isDragModeEnabled = false;
  let dragSession = null;
  let currentPortalOffset = { x: 0, y: 0 };
  const tabId = createTabId();
  let remoteManager = null;

  const attendanceChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
  const settingsChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SETTINGS_CHANNEL_NAME) : null;
  const permissionChannel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(PERMISSION_CHANNEL_NAME) : null;
  const remoteSyncChannel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(REMOTE_SYNC_CHANNEL_NAME) : null;

  applySchoolLock(schoolMeta);
  applyThemePreference(settings.uiTheme);
  applySettings(settings);
  hideStatusCard();
  startClock();
  ensureInputFocus();
  bindInput();
  bindRotationToggle();
  bindPortalControls();
  elements.screensaver?.root?.addEventListener("click", () => registerInteraction());
  setupPointerAutoHide();
  subscribeToUpdates();

  remoteManager = REMOTE_SYNC?.createManager
    ? REMOTE_SYNC.createManager({
        getSettings: () => settings,
        getStudents: () => students,
        getAttendance: () => attendance,
        applyLeaveRequests: handleIncomingLeaveRequests
      })
    : null;

  remoteManager?.start();
  remoteSyncChannel?.postMessage({ type: "state-request" });

  async function handleIncomingLeaveRequests(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      return [];
    }

    const map = readPermissionsMap();
    const ackSet = new Set();
    const ackList = [];
    const pushAck = (id) => {
      const token = typeof id === "string" ? id.trim() : String(id ?? "").trim();
      if (!token || ackSet.has(token)) return;
      ackSet.add(token);
      ackList.push(token);
    };

    let changed = false;
    const addedEntries = [];

    requests.forEach((request) => {
      const normalized = normalizeRemoteLeaveRequest(request);
      if (!normalized) {
        return;
      }

      const { entry, ackId } = normalized;
      if (ackId) {
        pushAck(ackId);
      }

      if (!entry) {
        return;
      }

      const day = entry.createdAt.slice(0, 10);
      if (!map[day]) {
        map[day] = [];
      }
      const exists = map[day].some((existing) => existing.studentId === entry.studentId && existing.createdAt === entry.createdAt);
      if (exists) {
        return;
      }

      map[day].push(entry);
      map[day].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      addedEntries.push(entry);
      changed = true;
    });

    if (changed) {
      writePermissionsMap(map);
      addedEntries.forEach((entry) => {
        permissionChannel?.postMessage({ type: "permission-recorded", payload: entry });
      });
    }

    return ackList;
  }

  function normalizeRemoteLeaveRequest(input) {
    if (!input || typeof input !== "object") {
      return null;
    }

    const ackCandidates = [input.id, input.requestId, input.uuid, input.reference, input.key];
    let ackId = null;
    for (let index = 0; index < ackCandidates.length; index += 1) {
      const candidate = ackCandidates[index];
      if (typeof candidate === "string" && candidate.trim() !== "") {
        ackId = candidate.trim();
        break;
      }
    }

    const base = {
      studentId:
        input.studentId || input.id || input.student?.id || (typeof input.student === "string" ? input.student : ""),
      createdAt: input.createdAt || input.timestamp || input.requestedAt || input.submittedAt || null,
      reason: input.reason || input.cause || "",
      note: input.note || input.notes || input.comment || "",
      status: input.status || (input.approved ? "approved" : "pending")
    };

    const entry = normalizePermissionEntryShape(base);
    if (!entry) {
      return ackId ? { entry: null, ackId } : null;
    }

    const submittedBy = input.submittedBy || input.supervisor?.name || "";
    const submittedContact = input.submittedContact || input.supervisor?.contact || input.contact || "";
    const supervisorId = input.supervisor?.id || input.supervisorId || "";
    const extraParts = [];
    if (submittedBy) {
      extraParts.push(`مرسل الطلب: ${submittedBy}`);
    }
    if (supervisorId) {
      extraParts.push(`هوية الإشراف: ${supervisorId}`);
    }
    if (submittedContact) {
      extraParts.push(`تواصل: ${submittedContact}`);
    }
    const extraNote = extraParts.filter(Boolean).join(" | ");
    if (extraNote) {
      entry.note = entry.note ? `${entry.note} — ${extraNote}` : extraNote;
    }

    if (!ackId) {
      ackId = `${entry.studentId}-${entry.createdAt}`;
    }

    return { entry, ackId };
  }

  function normalizePermissionEntryShape(input) {
    if (!input || typeof input !== "object") {
      return null;
    }
    const studentId = "studentId" in input ? String(input.studentId || "").trim() : "";
    if (!studentId) {
      return null;
    }
    const reasonRaw = "reason" in input && input.reason != null ? String(input.reason).trim() : "";
    const reason = reasonRaw || "طلب استئذان من البوابة السحابية";
    const note = "note" in input && input.note != null ? String(input.note).trim() : "";
    const status = "status" in input && input.status != null ? String(input.status).trim() : "pending";
    let created = input.createdAt || input.timestamp || new Date().toISOString();
    const date = new Date(created);
    if (Number.isNaN(date.getTime())) {
      created = new Date().toISOString();
    } else {
      created = date.toISOString();
    }
    return { studentId, createdAt: created, reason, note, status };
  }

  function readPermissionsMap() {
    try {
      const raw = readSchoolItem(PERMISSIONS_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      const map = {};
      Object.entries(parsed).forEach(([day, list]) => {
        if (!Array.isArray(list)) return;
        const entries = list
          .map((entry) => normalizePermissionEntryShape(entry))
          .filter(Boolean);
        if (entries.length > 0) {
          map[String(day)] = entries;
        }
      });
      return map;
    } catch (error) {
      console.warn("تعذّر قراءة سجل الاستئذانات من LocalStorage.", error);
      return {};
    }
  }

  function writePermissionsMap(map) {
    const payload = {};
    Object.entries(map || {}).forEach(([day, list]) => {
      if (!Array.isArray(list) || list.length === 0) return;
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

  function createTabId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function togglePortalControlsPanel(force) {
    const controls = elements.controls;
    if (!controls || !controls.panel || !controls.toggle) return;
    const isOpen = !controls.panel.hidden;
    const shouldOpen = typeof force === "boolean" ? force : !isOpen;
    if (shouldOpen === isOpen) {
      controls.toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      return;
    }
    controls.panel.hidden = !shouldOpen;
    controls.toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  function handleFontScaleInput(event) {
    const value = clampFontScalePercent(event?.target?.value);
    applyFontScale(value);
    updateControlSummary(value, "font");
  }

  function handleFontScaleCommit(event) {
    const value = clampFontScalePercent(event?.target?.value);
    persistSettings({ portalFontScale: value });
  }

  function handleCardScaleInput(event) {
    const value = clampCardScalePercent(event?.target?.value);
    applyCardScale(value);
    updateControlSummary(value, "card");
  }

  function handleCardScaleCommit(event) {
    const value = clampCardScalePercent(event?.target?.value);
    persistSettings({ portalCardScale: value });
  }

  function handleDragToggle() {
    setDragMode(!isDragModeEnabled);
  }

  function setDragMode(enabled) {
    const next = Boolean(enabled);
    isDragModeEnabled = next;
    if (document.body) {
      document.body.classList.toggle("is-portal-drag-mode", next);
    }
    const controls = elements.controls;
    if (controls?.dragToggle) {
      controls.dragToggle.setAttribute("aria-pressed", String(next));
    }
    if (!next && dragSession) {
      endPortalDrag(true);
    }
  }

  function handlePositionReset() {
    if (dragSession) {
      endPortalDrag(false);
    }
    persistSettings({ portalOffsetX: 0, portalOffsetY: 0 });
  }

  function handlePortalDragStart(event) {
    if (!isDragModeEnabled || !elements.portalCanvas) return;
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    event.preventDefault();
    const pointerId = event.pointerId;
    dragSession = {
      id: pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: currentPortalOffset.x,
      baseY: currentPortalOffset.y,
      lastX: currentPortalOffset.x,
      lastY: currentPortalOffset.y
    };
    try {
      elements.portalCanvas.setPointerCapture(pointerId);
    } catch (error) {
      /* ignore pointer capture issues */
    }
    if (document.body) {
      document.body.classList.add("is-portal-dragging");
    }
  }

  function handlePortalDragMove(event) {
    if (!dragSession || event.pointerId !== dragSession.id) return;
    const deltaX = event.clientX - dragSession.startX;
    const deltaY = event.clientY - dragSession.startY;
    const nextX = clampPortalOffset(dragSession.baseX + deltaX, "x");
    const nextY = clampPortalOffset(dragSession.baseY + deltaY, "y");
    dragSession.lastX = nextX;
    dragSession.lastY = nextY;
    applyPortalOffset(nextX, nextY);
  }

  function handlePortalDragEnd(event) {
    if (!dragSession || event.pointerId !== dragSession.id) return;
    event.preventDefault();
    endPortalDrag(true);
  }

  function handlePortalDragCancel(event) {
    if (!dragSession || event.pointerId !== dragSession.id) return;
    endPortalDrag(true);
  }

  function endPortalDrag(commit) {
    if (!dragSession) return;
    const { id, lastX, lastY, baseX, baseY } = dragSession;
    if (elements.portalCanvas && typeof elements.portalCanvas.releasePointerCapture === "function") {
      try {
        elements.portalCanvas.releasePointerCapture(id);
      } catch (error) {
        /* ignore */
      }
    }
    if (document.body) {
      document.body.classList.remove("is-portal-dragging");
    }
    const nextX = Number.isFinite(lastX) ? lastX : baseX;
    const nextY = Number.isFinite(lastY) ? lastY : baseY;
    dragSession = null;
    if (commit) {
      persistSettings({ portalOffsetX: nextX, portalOffsetY: nextY });
    } else {
      applyPortalOffset(currentPortalOffset.x, currentPortalOffset.y);
    }
  }

  function updatePortalControlsUI(currentSettings) {
    const controls = elements.controls;
    if (!controls) return;
    const fontValue = clampFontScalePercent(currentSettings?.portalFontScale);
    updateControlSummary(fontValue, "font");
    const cardValue = clampCardScalePercent(currentSettings?.portalCardScale);
    updateControlSummary(cardValue, "card");
    const offsetX = clampPortalOffset(currentSettings?.portalOffsetX, "x");
    const offsetY = clampPortalOffset(currentSettings?.portalOffsetY, "y");
    updatePortalPositionDisplay(offsetX, offsetY);
    if (controls.panel && controls.toggle) {
      controls.toggle.setAttribute("aria-expanded", controls.panel.hidden ? "false" : "true");
    }
    if (controls.dragToggle) {
      controls.dragToggle.setAttribute("aria-pressed", String(isDragModeEnabled));
    }
  }

  function updateControlSummary(value, type) {
    const controls = elements.controls;
    if (!controls) return;
    const rangeNode = type === "font" ? controls.fontRange : controls.cardRange;
    const valueNode = type === "font" ? controls.fontValue : controls.cardValue;
    if (rangeNode) {
      rangeNode.value = String(value);
    }
    if (valueNode) {
      valueNode.textContent = `${value}%`;
    }
  }

  function updatePortalPositionDisplay(x, y) {
    const controls = elements.controls;
    if (!controls) return;
    if (controls.positionX) {
      controls.positionX.textContent = Number.isFinite(x) ? String(Math.round(x)) : "0";
    }
    if (controls.positionY) {
      controls.positionY.textContent = Number.isFinite(y) ? String(Math.round(y)) : "0";
    }
  }

  function readSettings() {
    const raw = readSchoolItem(SETTINGS_KEY);
    if (!raw) {
      return normalizeSettingsObject({});
    }
    try {
      const parsed = JSON.parse(raw);
      return normalizeSettingsObject(parsed);
    } catch (error) {
      console.warn("تعذّر قراءة الإعدادات. سيتم استخدام القيم الافتراضية.", error);
      return normalizeSettingsObject({});
    }
  }

  function readStudents() {
    const raw = readSchoolItem(STUDENTS_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (error) {
      console.warn("تعذّر قراءة قائمة الطلاب.", error);
      return [];
    }
  }

  function readAttendance() {
    const raw = readSchoolItem(ATTENDANCE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (error) {
      console.warn("تعذّر قراءة سجلات الحضور.", error);
      return {};
    }
  }

  function applySettings(nextSettings) {
    settings = mergeSettings(nextSettings);
    applyThemePreference(settings.uiTheme);
    updateBanner(settings.kioskBannerUrl);
    updateMorningMessage(settings.morningMessage);
    updateGeneralTip(settings.generalTip);
    updateSchoolName(settings.schoolName);
    updateAds(settings);
    configureSounds(settings);
    configureScreensaver(settings);
    applyCardScale(settings.portalCardScale);
    applyListScale(settings.portalListScale);
    applyFontScale(settings.portalFontScale);
    applyStatusCardTuning(settings);
    applyScaleSettings(settings);
    applyPortalRotation(settings);
    applyPortalOffset(settings.portalOffsetX, settings.portalOffsetY);
    prepareFullscreen(settings);
    updateRotationToggleState(settings.portalRotation);
    updatePortalControlsUI(settings);
    updateAttendanceCounterVisibility(settings.portalAttendanceCounterVisible);
    updateAttendanceCounter();
    if (elements.statusCard) {
      if (elements.statusCard.hidden) {
        clearStatusHideTimer();
      } else if (clampAutoHideMinutes(settings.statusCardAutoHideMinutes) > 0) {
        scheduleStatusHide();
      } else {
        clearStatusHideTimer();
      }
    }
    remoteManager?.refresh?.();
  }

  function updateAttendanceCounterVisibility(isEnabled) {
    if (!elements.attendanceCounter) return;
    const visible = Boolean(isEnabled);
    elements.attendanceCounter.hidden = !visible;
    if (visible) {
      updateAttendanceCounter();
    }
  }

  function updateAttendanceCounter() {
    if (!elements.attendanceCounter || elements.attendanceCounter.hidden) {
      return;
    }
    const todayRecords = getTodayAttendanceRecords();
    const presentCount = Object.keys(todayRecords).length;
    const totalCount = Array.isArray(students)
      ? students.filter((student) => student && String(student.id || "").trim() !== "").length
      : 0;
    if (elements.attendanceCurrent) {
      elements.attendanceCurrent.textContent = presentCount.toString();
    }
    if (elements.attendanceTotal) {
      elements.attendanceTotal.textContent = totalCount.toString();
    }
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
    return {
      background: sanitizeHexColor(
        source?.background ?? source?.customThemeBackground,
        DEFAULT_CUSTOM_THEME.background
      ),
      strong: sanitizeHexColor(source?.strong ?? source?.customThemeTextStrong, DEFAULT_CUSTOM_THEME.strong),
      muted: sanitizeHexColor(source?.muted ?? source?.customThemeTextMuted, DEFAULT_CUSTOM_THEME.muted)
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
    const decorations = normalizeCardDecorations(source || settings);
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

  function normalizeSettingsObject(input) {
    const base = input && typeof input === "object" ? input : {};
    const merged = { ...DEFAULT_SETTINGS, ...base };
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
    merged.kioskScaleMode = sanitizeScaleMode(merged.kioskScaleMode);
    merged.kioskScaleValue = clampScalePercent(merged.kioskScaleValue);
    merged.portalCardScale = clampCardScalePercent(merged.portalCardScale);
    merged.portalListScale = clampListScalePercent(merged.portalListScale);
    merged.portalScaleAdjust = clampPortalScalePercent(merged.portalScaleAdjust);
    merged.portalFontScale = clampFontScalePercent(merged.portalFontScale);
    merged.portalStatusCardWidth = clampStatusCardWidthPercent(merged.portalStatusCardWidth);
    merged.portalStatusCardHeight = clampStatusCardHeightPercent(merged.portalStatusCardHeight);
    merged.portalStatusCardFontScale = clampStatusCardFontPercent(merged.portalStatusCardFontScale);
    merged.portalStatusStatsScale = clampStatusStatsScalePercent(merged.portalStatusStatsScale);
    merged.portalStatusStatsFontScale = clampStatusStatsFontPercent(merged.portalStatusStatsFontScale);
    merged.portalOffsetX = clampPortalOffset(merged.portalOffsetX, "x");
    merged.portalOffsetY = clampPortalOffset(merged.portalOffsetY, "y");
    merged.portalRotation = sanitizeRotation(merged.portalRotation);
    merged.portalAutoScale = toBoolean(merged.portalAutoScale);
    merged.portalAutoFullscreen = toBoolean(merged.portalAutoFullscreen);
    merged.portalAttendanceCounterVisible = toBoolean(merged.portalAttendanceCounterVisible);
    merged.portalAudioVolume = clampAudioVolume(merged.portalAudioVolume);
    SOUND_STATUS_CONFIG.forEach(({ settingKey }) => {
      const urlKey = `portalAudio${settingKey}Url`;
      const nameKey = `portalAudio${settingKey}Name`;
      merged[urlKey] = sanitizeMediaUrl(merged[urlKey]);
      merged[nameKey] = sanitizeOptionalString(merged[nameKey]);
    });
    merged.portalScreensaverEnabled = toBoolean(merged.portalScreensaverEnabled);
    merged.portalScreensaverIdleMinutes = clampScreensaverIdleMinutes(merged.portalScreensaverIdleMinutes);
    merged.portalScreensaverStartTime = sanitizeTimeValue(
      merged.portalScreensaverStartTime,
      DEFAULT_SETTINGS.portalScreensaverStartTime
    );
    merged.portalScreensaverEndTime = sanitizeTimeValue(
      merged.portalScreensaverEndTime,
      DEFAULT_SETTINGS.portalScreensaverEndTime
    );
    SCREENSAVER_SLOT_CONFIG.forEach(({ settingKey }) => {
      const base = `portalScreensaver${settingKey}`;
      const fallbackDuration = DEFAULT_SETTINGS[`${base}Duration`];
      merged[`${base}Visible`] = toBoolean(merged[`${base}Visible`]);
      merged[`${base}Url`] = sanitizeMediaUrl(merged[`${base}Url`]);
      merged[`${base}Name`] = sanitizeOptionalString(merged[`${base}Name`]);
      merged[`${base}Text`] = sanitizeOptionalString(merged[`${base}Text`]);
      merged[`${base}Duration`] = clampScreensaverDuration(
        merged[`${base}Duration`],
        fallbackDuration
      );
    });
    merged.portalAdTopVisible = toBoolean(merged.portalAdTopVisible);
    merged.portalAdBottomVisible = toBoolean(merged.portalAdBottomVisible);
    merged.portalAdTopUrl = sanitizeMediaUrl(merged.portalAdTopUrl);
    merged.portalAdBottomUrl = sanitizeMediaUrl(merged.portalAdBottomUrl);
    merged.portalAdTopName = sanitizeOptionalString(merged.portalAdTopName);
    merged.portalAdBottomName = sanitizeOptionalString(merged.portalAdBottomName);
    merged.portalAdTopLink = sanitizeOptionalString(merged.portalAdTopLink);
    merged.portalAdBottomLink = sanitizeOptionalString(merged.portalAdBottomLink);
    merged.statusCardAutoHideMinutes = clampAutoHideMinutes(merged.statusCardAutoHideMinutes);
    merged.leaveGeneralSupervisorIds = normalizeIdList(merged.leaveGeneralSupervisorIds);
    merged.leaveClassSupervisorIds = normalizeIdList(merged.leaveClassSupervisorIds);
    merged.leaveAdminIds = normalizeIdList(merged.leaveAdminIds);
    if (REMOTE_SYNC?.normalizeSettings) {
      const remoteAdjusted = REMOTE_SYNC.normalizeSettings(merged);
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

  function updateBanner(url) {
    if (!elements.bannerWrapper || !elements.banner) return;
    const cleanUrl = typeof url === "string" ? url.trim() : "";
    if (cleanUrl) {
      elements.bannerWrapper.hidden = false;
      elements.banner.src = cleanUrl;
    } else {
      elements.bannerWrapper.hidden = true;
      elements.banner.removeAttribute("src");
    }
  }

  function updateMorningMessage(message) {
    if (!elements.morningMessage) return;
    const content = typeof message === "string" && message.trim() !== "" ? message : DEFAULT_CONTENT.morningMessage;
    elements.morningMessage.textContent = content;
  }

  function updateGeneralTip(tip) {
    if (!elements.generalTip || !elements.generalTipText) return;
    const content = typeof tip === "string" && tip.trim() !== "" ? tip : DEFAULT_SETTINGS.generalTip;
    elements.generalTipText.textContent = content;
    elements.generalTip.hidden = !content;
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

  function updateAds(currentSettings) {
    updateAdSlot("top", {
      visible: toBoolean(currentSettings.portalAdTopVisible),
      url: currentSettings.portalAdTopUrl,
      link: sanitizeOptionalString(currentSettings.portalAdTopLink)
    });
    updateAdSlot("bottom", {
      visible: toBoolean(currentSettings.portalAdBottomVisible),
      url: currentSettings.portalAdBottomUrl,
      link: sanitizeOptionalString(currentSettings.portalAdBottomLink)
    });
  }

  function updateAdSlot(position, config) {
    const ad = elements.ads?.[position];
    if (!ad || !ad.slot || !ad.link || !ad.image) {
      return;
    }
    const url = sanitizeMediaUrl(config?.url);
    const visible = Boolean(config?.visible && url);
    ad.slot.hidden = !visible;
    if (!visible) {
      ad.image.removeAttribute("src");
      ad.link.removeAttribute("href");
      ad.link.setAttribute("aria-hidden", "true");
      ad.link.tabIndex = -1;
      return;
    }
    ad.image.src = url;
    const link = sanitizeOptionalString(config?.link);
    if (link) {
      ad.link.href = link;
      ad.link.removeAttribute("aria-hidden");
      ad.link.tabIndex = 0;
    } else {
      ad.link.removeAttribute("href");
      ad.link.setAttribute("aria-hidden", "true");
      ad.link.tabIndex = -1;
    }
  }

  function configureSounds(currentSettings) {
    const volumePercent = clampAudioVolume(currentSettings?.portalAudioVolume);
    soundVolume = volumePercent / 100;
    SOUND_STATUS_CONFIG.forEach(({ key, settingKey }) => {
      const url = sanitizeMediaUrl(currentSettings?.[`portalAudio${settingKey}Url`]);
      let player = soundPlayers.get(key);
      if (url) {
        if (!player) {
          player = new Audio();
          player.preload = "auto";
          player.crossOrigin = "anonymous";
          soundPlayers.set(key, player);
        }
        if (player.src !== url) {
          try {
            player.src = url;
            player.load();
          } catch (error) {
            // ignore load issues; playback will retry on demand
          }
        }
        player.volume = soundVolume;
      } else if (player) {
        try {
          player.pause();
        } catch (error) {
          // noop
        }
        player.removeAttribute("src");
        soundPlayers.delete(key);
      }
    });
  }

  function playStatusSound(statusKey) {
    const mapped = SOUND_STATUS_MAP[statusKey];
    if (!mapped) return;
    const player = soundPlayers.get(mapped);
    if (!player || !player.src) return;
    try {
      player.currentTime = 0;
      player.volume = soundVolume;
      const result = player.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch (error) {
      // ignore playback failures (user gesture requirements, etc.)
    }
  }

  function configureScreensaver(currentSettings) {
    const idleMinutes = clampScreensaverIdleMinutes(currentSettings?.portalScreensaverIdleMinutes);
    const slides = collectScreensaverSlides(currentSettings);
    screensaverConfig = {
      enabled: Boolean(currentSettings?.portalScreensaverEnabled) && slides.length > 0 && idleMinutes > 0,
      idleMs: idleMinutes * 60 * 1000,
      startMinutes: timeStringToMinutes(currentSettings?.portalScreensaverStartTime),
      endMinutes: timeStringToMinutes(currentSettings?.portalScreensaverEndTime),
      slides
    };
    stopScreensaver();
    resetScreensaverTimer();
  }

  function collectScreensaverSlides(currentSettings) {
    if (!currentSettings) return [];
    const slides = [];
    SCREENSAVER_SLOT_CONFIG.forEach(({ key, settingKey }) => {
      const visible = toBoolean(currentSettings[`portalScreensaver${settingKey}Visible`]);
      const url = sanitizeMediaUrl(currentSettings[`portalScreensaver${settingKey}Url`]);
      if (!visible || !url) {
        return;
      }
      const text = sanitizeOptionalString(currentSettings[`portalScreensaver${settingKey}Text`]);
      const fallback = DEFAULT_SETTINGS[`portalScreensaver${settingKey}Duration`];
      const durationSeconds = clampScreensaverDuration(
        currentSettings[`portalScreensaver${settingKey}Duration`],
        fallback
      );
      slides.push({
        key,
        url,
        text,
        duration: durationSeconds,
        type: detectMediaType(url)
      });
    });
    return slides;
  }

  function resetScreensaverTimer() {
    if (screensaverIdleTimer) {
      clearTimeout(screensaverIdleTimer);
      screensaverIdleTimer = null;
    }
    if (!screensaverConfig.enabled) {
      return;
    }
    if (!isWithinScreensaverSchedule(new Date())) {
      screensaverIdleTimer = window.setTimeout(maybeActivateScreensaver, SCREENSAVER_RECHECK_DELAY);
      return;
    }
    screensaverIdleTimer = window.setTimeout(maybeActivateScreensaver, screensaverConfig.idleMs);
  }

  function maybeActivateScreensaver() {
    screensaverIdleTimer = null;
    if (!screensaverConfig.enabled) return;
    if (!screensaverConfig.slides.length) return;
    if (!isWithinScreensaverSchedule(new Date())) {
      screensaverIdleTimer = window.setTimeout(maybeActivateScreensaver, SCREENSAVER_RECHECK_DELAY);
      return;
    }
    startScreensaver();
  }

  function startScreensaver() {
    if (screensaverActive) return;
    const slides = screensaverConfig.slides;
    if (!screensaverConfig.enabled || !slides.length) {
      return;
    }
    const root = elements.screensaver?.root;
    if (!root) return;
    screensaverActive = true;
    screensaverIndex = 0;
    root.dataset.visible = "true";
    root.removeAttribute("hidden");
    root.setAttribute("aria-hidden", "false");
    applyScreensaverSlide(slides[screensaverIndex]);
    scheduleNextScreensaverSlide();
  }

  function stopScreensaver() {
    if (screensaverSlideTimer) {
      clearTimeout(screensaverSlideTimer);
      screensaverSlideTimer = null;
    }
    if (!screensaverActive) {
      const root = elements.screensaver?.root;
      if (root) {
        root.dataset.visible = "false";
        root.setAttribute("hidden", "");
        root.setAttribute("aria-hidden", "true");
      }
      return;
    }
    screensaverActive = false;
    const root = elements.screensaver?.root;
    if (root) {
      root.dataset.visible = "false";
      root.setAttribute("aria-hidden", "true");
      const target = root;
      window.setTimeout(() => {
        if (!screensaverActive) {
          target.setAttribute("hidden", "");
        }
      }, 200);
    }
    if (elements.screensaver?.video) {
      const video = elements.screensaver.video;
      video.pause();
      video.removeAttribute("src");
      if (typeof video.load === "function") {
        video.load();
      }
      video.setAttribute("hidden", "true");
    }
    if (elements.screensaver?.image) {
      elements.screensaver.image.removeAttribute("src");
      elements.screensaver.image.setAttribute("hidden", "true");
    }
    if (elements.screensaver?.text) {
      elements.screensaver.text.textContent = "";
      elements.screensaver.text.setAttribute("hidden", "true");
    }
  }

  function scheduleNextScreensaverSlide() {
    if (!screensaverActive) return;
    if (!screensaverConfig.slides.length) {
      stopScreensaver();
      return;
    }
    const slide = screensaverConfig.slides[screensaverIndex];
    const duration = Math.max(5, Number(slide?.duration) || 20) * 1000;
    screensaverSlideTimer = window.setTimeout(() => {
      if (!screensaverActive) return;
      if (!isWithinScreensaverSchedule(new Date())) {
        stopScreensaver();
        resetScreensaverTimer();
        return;
      }
      screensaverIndex = (screensaverIndex + 1) % screensaverConfig.slides.length;
      applyScreensaverSlide(screensaverConfig.slides[screensaverIndex]);
      scheduleNextScreensaverSlide();
    }, duration);
  }

  function applyScreensaverSlide(slide) {
    const root = elements.screensaver?.root;
    if (!root || !slide) return;
    const image = elements.screensaver?.image;
    const video = elements.screensaver?.video;
    const textNode = elements.screensaver?.text;
    let previousVideoSrc = "";
    if (video) {
      previousVideoSrc = video.getAttribute("src") || "";
      video.pause();
      video.removeAttribute("src");
      if (typeof video.load === "function") {
        video.load();
      }
      video.setAttribute("hidden", "true");
    }
    if (image) {
      image.removeAttribute("src");
      image.setAttribute("hidden", "true");
    }
    if (slide.type === "video" && video) {
      video.removeAttribute("hidden");
      if (previousVideoSrc !== slide.url) {
        video.src = slide.url;
        if (typeof video.load === "function") {
          video.load();
        }
      } else {
        video.src = slide.url;
      }
      video.currentTime = 0;
      video.muted = true;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } else if (image) {
      image.removeAttribute("hidden");
      image.src = slide.url;
    }
    if (textNode) {
      if (slide.text) {
        textNode.textContent = slide.text;
        textNode.removeAttribute("hidden");
      } else {
        textNode.textContent = "";
        textNode.setAttribute("hidden", "true");
      }
    }
  }

  function registerInteraction() {
    stopScreensaver();
    resetScreensaverTimer();
  }

  function isWithinScreensaverSchedule(now) {
    if (!screensaverConfig.enabled) return false;
    const minutes = timeStringToMinutes(
      `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    );
    const { startMinutes, endMinutes } = screensaverConfig;
    if (startMinutes === endMinutes) {
      return true;
    }
    if (startMinutes < endMinutes) {
      return minutes >= startMinutes && minutes < endMinutes;
    }
    return minutes >= startMinutes || minutes < endMinutes;
  }

  function timeStringToMinutes(value) {
    if (typeof value !== "string") {
      return 0;
    }
    const [hours = "0", minutes = "0"] = value.split(":");
    const h = Number.parseInt(hours, 10);
    const m = Number.parseInt(minutes, 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return 0;
    }
    const total = h * 60 + m;
    return ((total % 1440) + 1440) % 1440;
  }

  function clampAudioVolume(value) {
    return clampNumberWithin(
      value,
      AUDIO_VOLUME_LIMITS.min,
      AUDIO_VOLUME_LIMITS.max,
      DEFAULT_SETTINGS.portalAudioVolume
    );
  }

  function clampScreensaverIdleMinutes(value) {
    return clampNumberWithin(
      value,
      SCREENSAVER_IDLE_LIMITS.min,
      SCREENSAVER_IDLE_LIMITS.max,
      DEFAULT_SETTINGS.portalScreensaverIdleMinutes
    );
  }

  function clampScreensaverDuration(value, fallback) {
    const numericFallback = Number(fallback);
    const safeFallback = Number.isFinite(numericFallback)
      ? numericFallback
      : DEFAULT_SETTINGS.portalScreensaverSlot1Duration;
    return clampNumberWithin(
      value,
      SCREENSAVER_DURATION_LIMITS.min,
      SCREENSAVER_DURATION_LIMITS.max,
      safeFallback
    );
  }

  function applyCardScale(percent) {
    const ratio = clampCardScalePercent(percent) / 100;
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty("--portal-card-scale", ratio.toFixed(3));
  }

  function applyListScale(percent) {
    const ratio = clampListScalePercent(percent) / 100;
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty("--portal-list-scale", ratio.toFixed(3));
  }

  function applyFontScale(percent) {
    const ratio = clampFontScalePercent(percent) / 100;
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty("--portal-font-scale", ratio.toFixed(3));
  }

  function applyStatusCardTuning(currentSettings) {
    const root = document.documentElement;
    if (!root) return;
    const widthRatio = clampStatusCardWidthPercent(currentSettings?.portalStatusCardWidth) / 100;
    const heightRatio = clampStatusCardHeightPercent(currentSettings?.portalStatusCardHeight) / 100;
    const cardFontRatio = clampStatusCardFontPercent(currentSettings?.portalStatusCardFontScale) / 100;
    const statsScaleRatio = clampStatusStatsScalePercent(currentSettings?.portalStatusStatsScale) / 100;
    const statsFontRatio = clampStatusStatsFontPercent(currentSettings?.portalStatusStatsFontScale) / 100;
    root.style.setProperty("--portal-status-card-width-scale", widthRatio.toFixed(3));
    root.style.setProperty("--portal-status-card-height-scale", heightRatio.toFixed(3));
    root.style.setProperty("--portal-status-card-font-scale", cardFontRatio.toFixed(3));
    root.style.setProperty("--portal-status-stats-scale", statsScaleRatio.toFixed(3));
    root.style.setProperty("--portal-status-stats-font-scale", statsFontRatio.toFixed(3));
  }

  function applyPortalOffset(x, y) {
    const root = document.documentElement;
    if (!root) return;
    const clampedX = clampPortalOffset(x, "x");
    const clampedY = clampPortalOffset(y, "y");
    root.style.setProperty("--portal-offset-x", `${clampedX}px`);
    root.style.setProperty("--portal-offset-y", `${clampedY}px`);
    currentPortalOffset = { x: clampedX, y: clampedY };
    updatePortalPositionDisplay(clampedX, clampedY);
  }

  function normalizeTheme(input) {
    if (typeof THEME_LIBRARY?.sanitizeTheme === "function") {
      return THEME_LIBRARY.sanitizeTheme(input);
    }
    const theme = typeof input === "string" ? input.trim() : "";
    return AVAILABLE_THEMES.includes(theme) ? theme : DEFAULT_SETTINGS.uiTheme;
  }

  function mergeSettings(input) {
    const source = input && typeof input === "object" ? input : {};
    return normalizeSettingsObject({ ...settings, ...source });
  }

  function sanitizeScaleMode(value) {
    const mode = typeof value === "string" ? value.trim().toLowerCase() : "";
    return SCALE_MODES.includes(mode) ? mode : DEFAULT_SETTINGS.kioskScaleMode;
  }

  function clampScalePercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_SETTINGS.kioskScaleValue;
    }
    return Math.min(Math.max(numeric, SCALE_PERCENT_LIMITS.min), SCALE_PERCENT_LIMITS.max);
  }

  function clampPercentValue(value, limits, fallback) {
    const numeric = Number(value);
    const safeFallback = Number(fallback);
    if (!Number.isFinite(numeric)) {
      return safeFallback;
    }
    const min = limits?.min ?? 0;
    const max = limits?.max ?? 100;
    return Math.min(Math.max(numeric, min), max);
  }

  function clampAutoHideMinutes(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_SETTINGS.statusCardAutoHideMinutes;
    }
    const rounded = Math.round(numeric);
    const min = STATUS_AUTO_HIDE_LIMITS?.min ?? 0;
    const max = STATUS_AUTO_HIDE_LIMITS?.max ?? 30;
    const clamped = Math.min(Math.max(rounded, min), max);
    return Number.isFinite(clamped) ? clamped : DEFAULT_SETTINGS.statusCardAutoHideMinutes;
  }

  function clampCardScalePercent(value) {
    return clampPercentValue(value, CARD_SCALE_LIMITS, DEFAULT_SETTINGS.portalCardScale);
  }

  function clampListScalePercent(value) {
    return clampPercentValue(value, LIST_SCALE_LIMITS, DEFAULT_SETTINGS.portalListScale);
  }

  function clampFontScalePercent(value) {
    return clampPercentValue(value, FONT_SCALE_LIMITS, DEFAULT_SETTINGS.portalFontScale);
  }

  function clampStatusCardWidthPercent(value) {
    return clampPercentValue(value, STATUS_CARD_WIDTH_LIMITS, DEFAULT_SETTINGS.portalStatusCardWidth);
  }

  function clampStatusCardHeightPercent(value) {
    return clampPercentValue(value, STATUS_CARD_HEIGHT_LIMITS, DEFAULT_SETTINGS.portalStatusCardHeight);
  }

  function clampStatusCardFontPercent(value) {
    return clampPercentValue(value, STATUS_CARD_FONT_LIMITS, DEFAULT_SETTINGS.portalStatusCardFontScale);
  }

  function clampStatusStatsScalePercent(value) {
    return clampPercentValue(value, STATUS_STATS_SCALE_LIMITS, DEFAULT_SETTINGS.portalStatusStatsScale);
  }

  function clampStatusStatsFontPercent(value) {
    return clampPercentValue(value, STATUS_STATS_FONT_LIMITS, DEFAULT_SETTINGS.portalStatusStatsFontScale);
  }

  function clampPortalOffset(value, axis) {
    const numeric = Number(value);
    const fallback = axis === "y" ? DEFAULT_SETTINGS.portalOffsetY : DEFAULT_SETTINGS.portalOffsetX;
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const limits = PORTAL_OFFSET_LIMITS?.[axis];
    if (!limits) {
      return Math.round(numeric);
    }
    const min = Number(limits.min ?? -1000);
    const max = Number(limits.max ?? 1000);
    return Math.min(Math.max(Math.round(numeric), min), max);
  }

  function clampPortalScalePercent(value) {
    return clampPercentValue(value, PORTAL_SCALE_LIMITS, DEFAULT_SETTINGS.portalScaleAdjust);
  }

  function sanitizeTimeValue(value, fallback) {
    if (REMOTE_SYNC?.sanitizeTimeString) {
      return REMOTE_SYNC.sanitizeTimeString(value, fallback);
    }
    const raw = typeof value === "string" ? value.trim() : "";
    if (/^\d{2}:\d{2}$/.test(raw)) {
      return raw;
    }
    return typeof fallback === "string" && fallback ? fallback : DEFAULT_SETTINGS.remoteSyncTime;
  }

  function sanitizeRotation(value) {
    const rotation = typeof value === "string" ? value.trim() : "";
    return ROTATION_VALUES.includes(rotation) ? rotation : DEFAULT_SETTINGS.portalRotation;
  }

  function toBoolean(value) {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "yes";
    }
    return Boolean(value);
  }

  function sanitizeOptionalString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeIdList(value) {
    const items = [];
    if (Array.isArray(value)) {
      items.push(...value.map((item) => String(item || "").trim()));
    } else if (typeof value === "string") {
      items.push(
        ...String(value)
          .split(/\r?\n|,|;/)
          .map((item) => item.trim())
      );
    }
    const filtered = items.filter(Boolean);
    const unique = Array.from(new Set([...MASTER_SUPERVISOR_IDENTIFIERS, ...filtered]));
    return unique;
  }

  function sanitizeMediaUrl(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function detectMediaType(source) {
    if (typeof source !== "string") {
      return "image";
    }
    const trimmed = source.trim();
    if (trimmed === "") {
      return "image";
    }
    if (/^data:video\//i.test(trimmed)) {
      return "video";
    }
    if (/\.(mp4|webm|ogv|ogg|mov)(\?|#|$)/i.test(trimmed)) {
      return "video";
    }
    return "image";
  }

  function clampScaleRatio(value) {
    if (!Number.isFinite(value)) return 1;
    return Math.min(Math.max(value, SCALE_RATIO_LIMITS.min), SCALE_RATIO_LIMITS.max);
  }

  function calculateScale(currentSettings) {
    const mode = sanitizeScaleMode(currentSettings?.kioskScaleMode);
    if (mode === "manual") {
      const percent = clampScalePercent(currentSettings?.kioskScaleValue);
      return clampScaleRatio(percent / 100);
    }
    return computeAutoScale();
  }

  function applyPortalRotation(currentSettings) {
    const rotation = sanitizeRotation(currentSettings?.portalRotation);
    const root = document.documentElement;
    if (root) {
      root.style.setProperty("--portal-rotation", rotation);
    }
    const scale = computePortalScale(rotation, currentSettings);
    if (Math.abs(scale - currentPortalScale) > 0.001) {
      currentPortalScale = scale;
      if (root) {
        root.style.setProperty("--portal-scale", scale.toFixed(3));
      }
    }
    if (elements.portalRoot) {
      if (rotation === "0deg") {
        delete elements.portalRoot.dataset.rotation;
      } else {
        elements.portalRoot.dataset.rotation = rotation;
      }
    }
  }

  function computePortalScale(rotation, currentSettings) {
    const adjustRatio = clampPortalScalePercent(currentSettings?.portalScaleAdjust) / 100;
    const angle = parseRotation(rotation);
    let autoRatio = 1;
    if (Math.abs(angle) === 90 && toBoolean(currentSettings?.portalAutoScale) !== false) {
      const viewportWidth = window.innerWidth || BASE_VIEWPORT.width;
      const viewportHeight = window.innerHeight || BASE_VIEWPORT.height;
      const contentWidth = BASE_VIEWPORT.width * currentScale;
      const contentHeight = BASE_VIEWPORT.height * currentScale;
      if (contentWidth > 0 && contentHeight > 0) {
        const widthRatio = viewportWidth / contentHeight;
        const heightRatio = viewportHeight / contentWidth;
        autoRatio = Math.min(widthRatio, heightRatio);
      }
    }
    return clampScaleRatio(autoRatio * adjustRatio);
  }

  function parseRotation(value) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  function updateRotationToggleState(rotation) {
    const button = elements.rotationToggle;
    if (!button) return;
    const clean = sanitizeRotation(rotation);
    button.dataset.rotation = clean;
    const label = ROTATION_LABELS[clean] || ROTATION_LABELS[DEFAULT_SETTINGS.portalRotation];
    button.setAttribute("aria-label", `تغيير اتجاه العرض — الحالي: ${label}`);
    button.setAttribute("title", label);
  }

  function bindRotationToggle() {
    if (!elements.rotationToggle) return;
    elements.rotationToggle.addEventListener("click", handleRotationToggle);
  }

  function bindPortalControls() {
    const controls = elements.controls;
    if (!controls) return;
    if (controls.toggle && controls.panel) {
      controls.toggle.addEventListener("click", () => togglePortalControlsPanel());
    }
    if (controls.fontRange) {
      controls.fontRange.addEventListener("input", handleFontScaleInput);
      controls.fontRange.addEventListener("change", handleFontScaleCommit);
    }
    if (controls.cardRange) {
      controls.cardRange.addEventListener("input", handleCardScaleInput);
      controls.cardRange.addEventListener("change", handleCardScaleCommit);
    }
    if (controls.dragToggle) {
      controls.dragToggle.addEventListener("click", handleDragToggle);
    }
    if (controls.positionReset) {
      controls.positionReset.addEventListener("click", handlePositionReset);
    }
    if (elements.portalCanvas) {
      elements.portalCanvas.addEventListener("pointerdown", handlePortalDragStart);
      elements.portalCanvas.addEventListener("pointermove", handlePortalDragMove);
      elements.portalCanvas.addEventListener("pointerup", handlePortalDragEnd);
      elements.portalCanvas.addEventListener("pointercancel", handlePortalDragCancel);
    }
    setDragMode(isDragModeEnabled);
  }

  function handleRotationToggle() {
    const nextRotation = getNextRotation(settings.portalRotation);
    persistSettings({ portalRotation: nextRotation });
  }

  function getNextRotation(current) {
    const normalized = sanitizeRotation(current);
    const index = ROTATION_VALUES.indexOf(normalized);
    if (index === -1) {
      return ROTATION_VALUES[0];
    }
    const nextIndex = (index + 1) % ROTATION_VALUES.length;
    return ROTATION_VALUES[nextIndex];
  }

  function persistSettings(patch) {
    const next = mergeSettings({ ...settings, ...patch });
    try {
      writeSchoolItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("تعذّر حفظ الإعدادات محليًا.", error);
    }
    applySettings(next);
    if (settingsChannel) {
      settingsChannel.postMessage({ type: "settings-updated", payload: next, sourceId: tabId });
    }
  }

  function setupPointerAutoHide() {
    if (!document.body) return;
    showCursor();
    const handleActivity = () => {
      showCursor();
      scheduleCursorHide();
      registerInteraction();
    };
    ["mousemove", "mousedown", "touchstart", "keydown"].forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    scheduleCursorHide();
  }

  function scheduleCursorHide() {
    if (!document.body) return;
    if (cursorHideTimer) {
      clearTimeout(cursorHideTimer);
    }
    cursorHideTimer = window.setTimeout(() => {
      document.body?.classList.add("is-cursor-hidden");
    }, CURSOR_HIDE_TIMEOUT);
  }

  function showCursor() {
    if (!document.body) return;
    document.body.classList.remove("is-cursor-hidden");
    if (cursorHideTimer) {
      clearTimeout(cursorHideTimer);
      cursorHideTimer = null;
    }
  }

  function prepareFullscreen(currentSettings) {
    if (!toBoolean(currentSettings?.portalAutoFullscreen)) {
      fullscreenListenerArmed = false;
      return;
    }
    if (fullscreenListenerArmed || !document || !document.fullscreenEnabled) {
      return;
    }
    const requestFullscreen = () => {
      const target = elements.portalStage || document.documentElement;
      if (!target || typeof target.requestFullscreen !== "function") {
        return;
      }
      target.requestFullscreen().catch(() => {
        fullscreenListenerArmed = false;
      });
    };
    const handler = () => {
      requestFullscreen();
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    fullscreenListenerArmed = true;
  }

  function computeAutoScale() {
    if (typeof window === "undefined") {
      return 1;
    }
    const viewportWidth = window.innerWidth || BASE_VIEWPORT.width;
    const viewportHeight = window.innerHeight || BASE_VIEWPORT.height;
    const widthRatio = viewportWidth / BASE_VIEWPORT.width;
    const heightRatio = viewportHeight / BASE_VIEWPORT.height;
    const raw = Math.min(widthRatio, heightRatio);
    const target = raw < 1 ? 1 : raw;
    return clampScaleRatio(target);
  }

  function applyScaleSettings(currentSettings) {
    const scale = calculateScale(currentSettings);
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }
    if (document.body) {
      document.body.dataset.kioskScaleMode = sanitizeScaleMode(currentSettings?.kioskScaleMode);
    }
    if (Math.abs(scale - currentScale) >= 0.001) {
      currentScale = scale;
      const inverse = 1 / scale;
      const root = document.documentElement;
      if (root) {
        root.style.setProperty("--kiosk-scale", scale.toFixed(3));
        root.style.setProperty("--kiosk-scale-inverse", inverse.toFixed(3));
      }
    }
    applyPortalRotation(currentSettings);
  }

  function handleViewportChange() {
    if (sanitizeScaleMode(settings.kioskScaleMode) === "auto") {
      applyScaleSettings(settings);
    } else {
      applyPortalRotation(settings);
    }
  }

  function applyThemePreference(theme) {
    const normalized = normalizeTheme(theme);
    const colors = normalizeCustomThemeColors(settings);
    if (typeof THEME_LIBRARY?.applyTheme === "function") {
      THEME_LIBRARY.applyTheme(normalized, { customColors: colors });
    } else if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.theme = normalized;
    }
    applyCardDecorationsFromSettings(settings);
  }

  function startClock() {
    if (clockTimerId) {
      window.clearTimeout(clockTimerId);
      clockTimerId = null;
    }

    const tick = () => {
      updateClock();
      clockTimerId = window.setTimeout(tick, 1000);
    };

    tick();
  }

  function updateClock() {
    if (!elements.clock) return;
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    elements.clock.textContent = `${hours}:${minutes}:${seconds}`;
  }

  function ensureInputFocus() {
    if (!elements.input) return;
    elements.input.focus();
    elements.input.addEventListener("blur", () => {
      setTimeout(() => {
        elements.input?.focus();
      }, 10);
    });
    window.addEventListener("focus", () => {
      setTimeout(() => elements.input?.focus(), 50);
    });
  }

  function bindInput() {
    if (!elements.input) return;
    elements.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        registerInteraction();
        processEntry(elements.input.value);
        elements.input.value = "";
      }
    });
    elements.input.addEventListener("input", () => registerInteraction());
  }

  function processEntry(rawValue) {
    const id = typeof rawValue === "string" ? rawValue.trim() : "";
    registerInteraction();
    if (!id) {
      return;
    }

    const now = new Date();
    const dayKey = getDayKey(now);
    attendance = readAttendance();
    const dayRecords = { ...(attendance[dayKey] ?? {}) };

    const student = findStudentById(id);
    if (!student) {
      const message = "لم يتم العثور على الطالب في قائمة المدرسة. يرجى مراجعة الإدارة.";
      const arrivalTime = formatTime(now);
      renderStatus({
        status: "not-found",
        message,
        arrivalTime,
        dayKey
      });
      broadcastAttendance({
        status: "not-found",
        id,
        arrivalTime,
        message,
        dayKey
      });
      return;
    }

    const existingTime = dayRecords[id];
    if (existingTime) {
      const aggregates = calculateLateAggregates(id, settings);
      const payload = {
        status: "duplicate",
        student,
        arrivalTime: existingTime,
        message: `تم تسجيل حضور ${student.name} اليوم عند ${existingTime}.`,
        dayKey,
        aggregates,
        id
      };
      renderStatus(payload);
      broadcastAttendance(payload);
      return;
    }

    const arrivalTime = formatTime(now);
    dayRecords[id] = arrivalTime;
    attendance[dayKey] = dayRecords;
    persistAttendance(attendance);
    updateAttendanceCounter();

    const timeliness = determineTimeliness(arrivalTime, settings);
    const status = timeliness <= 0 ? "early" : "late";
    const message = status === "early"
      ? pickPhrase(settings.phrasesEarly, DEFAULT_CONTENT.earlyPhrase)
      : pickPhrase(settings.phrasesLate, DEFAULT_CONTENT.latePhrase);
    const aggregates = calculateLateAggregates(id, settings);

    const payload = {
      status,
      student,
      arrivalTime,
      message,
      dayKey,
      aggregates,
      id
    };

    renderStatus(payload);
    broadcastAttendance(payload);
  }

  function renderStatus(payload) {
    if (!elements.statusCard || !elements.statusMessage) return;
    const { status, student, arrivalTime, message, aggregates } = payload;
    const badgeLabel = STATUS_LABELS[status] ?? "—";

    elements.statusCard.hidden = false;
    elements.statusCard.dataset.state = status;
    elements.statusMessage.textContent = message ?? "";

    clearStatusHideTimer();

    if (elements.statusBadge) {
      elements.statusBadge.textContent = badgeLabel;
    }

    if (status === "not-found") {
      if (elements.statusName) elements.statusName.textContent = "";
      if (elements.statusMeta) elements.statusMeta.textContent = "";
      if (elements.arrivalBlock) elements.arrivalBlock.style.display = "none";
    } else {
      if (elements.statusName) {
        elements.statusName.textContent = student?.name ?? "—";
      }
      if (elements.statusMeta) {
        elements.statusMeta.textContent = buildMeta(student);
      }
      if (elements.arrivalBlock) {
        elements.arrivalBlock.style.display = "flex";
      }
      if (elements.arrivalTime) {
        elements.arrivalTime.textContent = arrivalTime ?? "--:--:--";
      }
    }

    if (elements.lateStats) {
      if (status !== "not-found" && aggregates && typeof aggregates === "object") {
        elements.lateStats.hidden = false;
        if (elements.lateDays) elements.lateDays.textContent = formatAggregateValue(aggregates.daysLate);
        if (elements.lateToday) elements.lateToday.textContent = formatAggregateValue(aggregates.todayLateMinutes);
        if (elements.lateTotal) elements.lateTotal.textContent = formatAggregateValue(aggregates.totalLateMinutes);
      } else {
        elements.lateStats.hidden = true;
      }
    }

    playStatusSound(status);
    scheduleStatusHide();
  }

  function buildMeta(student) {
    if (!student) return "";
    const pieces = [`الرقم: ${student.id}`];
    const grade = student.grade && String(student.grade).trim() !== "" ? `الصف ${student.grade}` : "";
    const klass = student.class && String(student.class).trim() !== "" ? `الفصل ${student.class}` : "";
    const gradeClass = [grade, klass].filter(Boolean).join(" / ");
    if (gradeClass) {
      pieces.push(gradeClass);
    }
    return pieces.join(" • ");
  }

  function determineTimeliness(arrivalTime, currentSettings) {
    const thresholdSeconds = getThresholdSeconds(currentSettings);
    const arrivalSeconds = parseTimeToSeconds(arrivalTime);
    return arrivalSeconds - thresholdSeconds;
  }

  function calculateLateAggregates(studentId, currentSettings) {
    const allRecords = attendance;
    const thresholdSeconds = getThresholdSeconds(currentSettings);
    let daysLate = 0;
    let totalLateMinutes = 0;
    let todayLateMinutes = 0;
    const todayKey = getDayKey(new Date());

    for (const [day, records] of Object.entries(allRecords)) {
      if (!records || typeof records !== "object") continue;
      const time = records[studentId];
      if (!time) continue;
      const diffSeconds = parseTimeToSeconds(time) - thresholdSeconds;
      if (diffSeconds > 0) {
        daysLate += 1;
        const minutesLate = Math.ceil(diffSeconds / 60);
        totalLateMinutes += minutesLate;
        if (day === todayKey) {
          todayLateMinutes = minutesLate;
        }
      }
    }

    return { daysLate, totalLateMinutes, todayLateMinutes };
  }

  function formatAggregateValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "0";
    }
    return numeric.toString();
  }

  function pickPhrase(list, fallback) {
    if (!Array.isArray(list) || list.length === 0) {
      return fallback;
    }
    const filtered = list
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item !== "");
    if (filtered.length === 0) return fallback;
    const index = Math.floor(Math.random() * filtered.length);
    return filtered[index];
  }

  function persistAttendance(nextAttendance) {
    writeSchoolItem(ATTENDANCE_KEY, JSON.stringify(nextAttendance));
  }

  function findStudentById(id) {
    return students.find((student) => String(student.id).trim() === id);
  }

  function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  function getDayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function getTodayAttendanceRecords() {
    const todayKey = getDayKey(new Date());
    const record = attendance?.[todayKey];
    if (!record || typeof record !== "object") {
      return {};
    }
    return record;
  }

  function parseTimeToSeconds(time) {
    if (typeof time !== "string" || time.trim() === "") {
      return 0;
    }
    const parts = time.trim().split(":").map((part) => parseInt(part, 10));
    const [hours = 0, minutes = 0, seconds = 0] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function getThresholdSeconds(currentSettings) {
    const base = typeof currentSettings.schoolStart === "string" ? currentSettings.schoolStart : DEFAULT_SETTINGS.schoolStart;
    const [hoursStr = "07", minutesStr = "00"] = base.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const grace = Number(currentSettings.graceMinutes ?? DEFAULT_SETTINGS.graceMinutes) || 0;
    return (hours * 60 + minutes + grace) * 60;
  }

  function broadcastAttendance(payload) {
    if (!attendanceChannel) return;
    attendanceChannel.postMessage({
      type: "attendance-recorded",
      payload,
      sourceId: tabId
    });
  }

  function subscribeToUpdates() {
    if (settingsChannel) {
      settingsChannel.addEventListener("message", (event) => {
        if (!event?.data || event.data.sourceId === tabId) {
          return;
        }
        if (event.data.type === "settings-updated" && event.data.payload) {
          applySettings({ ...settings, ...event.data.payload });
        }
      });
    }

    if (attendanceChannel) {
      attendanceChannel.addEventListener("message", (event) => {
        if (!event?.data || event.data.sourceId === tabId) return;
        if (event.data.type === "attendance-recorded" && event.data.payload) {
          const incoming = event.data.payload;
          if (incoming.student) {
            const known = findStudentById(String(incoming.student.id ?? incoming.id));
            if (!known && incoming.student?.id) {
              students = readStudents();
            }
          }
          attendance = readAttendance();
          if (incoming.status !== "not-found" && !incoming.aggregates) {
            const studentId = String(incoming.id ?? incoming.student?.id ?? "").trim();
            if (studentId) {
              incoming.aggregates = calculateLateAggregates(studentId, settings);
            }
          }
          renderStatus(incoming);
          updateAttendanceCounter();
        }
      });
    }

    window.addEventListener("storage", (event) => {
      if (matchesSchoolKey(event.key, SETTINGS_KEY) && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          applySettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch (error) {
          console.warn("تعذّر مزامنة الإعدادات من التخزين.", error);
        }
      }
      if (matchesSchoolKey(event.key, STUDENTS_KEY) && event.newValue) {
        students = readStudents();
        updateAttendanceCounter();
      }
      if (matchesSchoolKey(event.key, ATTENDANCE_KEY) && event.newValue) {
        attendance = readAttendance();
        updateAttendanceCounter();
      }
      if (event.key && event.key.endsWith(":meta")) {
        refreshSchoolMeta();
      } else if (event.key && event.key.endsWith(":local_ready")) {
        refreshSchoolMeta();
      }
    });
    window.addEventListener("hader:school-meta", (event) => {
      const detail = event?.detail || {};
      const currentSchool =
        ACTIVE_SCHOOL_ID || localStorage.getItem("hader:school_id") || "school_1";
      if (!detail.schoolId || detail.schoolId === currentSchool) {
        schoolMeta = detail.meta || readCurrentSchoolMeta();
        applySchoolLock(schoolMeta);
      }
    });

    window.addEventListener("resize", handleViewportChange);
  }

  function clearStatusHideTimer() {
    if (statusHideTimer !== null) {
      clearTimeout(statusHideTimer);
      statusHideTimer = null;
    }
  }

  function scheduleStatusHide() {
    clearStatusHideTimer();
    const hideMinutes = clampAutoHideMinutes(settings.statusCardAutoHideMinutes);
    if (!Number.isFinite(hideMinutes) || hideMinutes <= 0) {
      return;
    }
    statusHideTimer = setTimeout(() => {
      statusHideTimer = null;
      hideStatusCard();
    }, hideMinutes * 60 * 1000);
  }

  function hideStatusCard() {
    clearStatusHideTimer();
    if (!elements.statusCard) return;
    elements.statusCard.hidden = true;
    if (elements.statusCard.dataset) {
      delete elements.statusCard.dataset.state;
    } else {
      elements.statusCard.removeAttribute("data-state");
    }
    if (elements.statusBadge) {
      elements.statusBadge.textContent = "—";
    }
    if (elements.statusName) {
      elements.statusName.textContent = "";
    }
    if (elements.statusMeta) {
      elements.statusMeta.textContent = "";
    }
    if (elements.arrivalBlock) {
      elements.arrivalBlock.style.display = "none";
    }
    if (elements.arrivalTime) {
      elements.arrivalTime.textContent = "--:--:--";
    }
    if (elements.statusMessage) {
      elements.statusMessage.textContent = "";
    }
    if (elements.lateStats) {
      elements.lateStats.hidden = true;
    }
    if (elements.lateDays) {
      elements.lateDays.textContent = "0";
    }
    if (elements.lateToday) {
      elements.lateToday.textContent = "0";
    }
    if (elements.lateTotal) {
      elements.lateTotal.textContent = "0";
    }
  }
})();
