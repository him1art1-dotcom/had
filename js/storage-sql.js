(function () {
  "use strict";

  const FALLBACK_THEMES = Object.freeze(["classic", "sunrise", "oasis", "forest", "midnight", "custom"]);
  const DEFAULT_CUSTOM_THEME = Object.freeze({ background: "#f4f6fb", strong: "#0f1c2b", muted: "#4f637b" });
  const ADMIN_SUPERVISOR_IDENTIFIER = "ADMIN_SUPER";
  const TECHNICAL_SUPERVISOR_IDENTIFIER = "ADMIN_TECH";
  const MASTER_SUPERVISOR_IDENTIFIERS = Object.freeze([
    ADMIN_SUPERVISOR_IDENTIFIER,
    TECHNICAL_SUPERVISOR_IDENTIFIER
  ]);

  function nsKey(base, schoolId) {
    return `${base}_${String(schoolId || "default")}`;
  }

  function buildSqlJsOptions(activeSchoolId) {
    const id = String(activeSchoolId || "default");
    return {
      wasmUrl: "sql-wasm.wasm",
      persistKey: `aa_sqljs_db_${id}`,
      queueKey: `aa_sqljs_queue_${id}`,
    };
  }

  function migrateOldKeysIfNeeded(activeSchoolId) {
    const oldDb = localStorage.getItem("aa_sqljs_db");
    const oldQ = localStorage.getItem("aa_sqljs_queue");
    const newDbKey = nsKey("aa_sqljs_db", activeSchoolId);
    const newQKey = nsKey("aa_sqljs_queue", activeSchoolId);

    if (oldDb && !localStorage.getItem(newDbKey)) {
      localStorage.setItem(newDbKey, oldDb);
    }
    if (oldQ && !localStorage.getItem(newQKey)) {
      localStorage.setItem(newQKey, oldQ);
    }

    // Keep old keys for now; we can remove after confirming migration is stable.
  }

  const SCALE_MODES = Object.freeze(["auto", "manual"]);
  const SCALE_PERCENT_LIMITS = Object.freeze({ min: 60, max: 160 });
  const CARD_SCALE_LIMITS = Object.freeze({ min: 60, max: 180 });
  const LIST_SCALE_LIMITS = Object.freeze({ min: 60, max: 180 });
  const STATUS_CARD_WIDTH_LIMITS = Object.freeze({ min: 60, max: 160 });
  const STATUS_CARD_HEIGHT_LIMITS = Object.freeze({ min: 60, max: 160 });
  const STATUS_CARD_FONT_LIMITS = Object.freeze({ min: 70, max: 150 });
  const STATUS_STATS_SCALE_LIMITS = Object.freeze({ min: 60, max: 160 });
  const STATUS_STATS_FONT_LIMITS = Object.freeze({ min: 70, max: 150 });
  const PORTAL_SCALE_LIMITS = Object.freeze({ min: 50, max: 200 });
  const ROTATION_VALUES = Object.freeze(["0deg", "90deg", "-90deg"]);
  const STATUS_AUTO_HIDE_LIMITS = Object.freeze({ min: 0, max: 30 });
  const CARD_SHADOW_LIMITS = window.HaderTheme?.CARD_SHADOW_LIMITS || Object.freeze({ min: 0, max: 300 });
  const CARD_BORDER_WIDTH_LIMITS = window.HaderTheme?.CARD_BORDER_WIDTH_LIMITS || Object.freeze({ min: 0, max: 12 });
  const SOUND_STATUS_CONFIG = Object.freeze([
    { settingKey: "Early" },
    { settingKey: "Late" },
    { settingKey: "Duplicate" },
    { settingKey: "Missing" }
  ]);
  const SCREENSAVER_SLOT_CONFIG = Object.freeze([
    { settingKey: "Slot1" },
    { settingKey: "Slot2" },
    { settingKey: "Slot3" }
  ]);
  const AUDIO_VOLUME_LIMITS = Object.freeze({ min: 0, max: 100 });
  const SCREENSAVER_IDLE_LIMITS = Object.freeze({ min: 0, max: 120 });
  const SCREENSAVER_DURATION_LIMITS = Object.freeze({ min: 5, max: 120 });

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
    portalAdTopUrl: "",
    portalAdTopName: "",
    portalAdTopLink: "",
    portalAdTopVisible: false,
    portalAdBottomUrl: "",
    portalAdBottomName: "",
    portalAdBottomLink: "",
    portalAdBottomVisible: false,
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

  // DEPRECATED: use buildSqlJsOptions(activeSchoolId) instead

  function uint8ToBase64(buffer) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function base64ToUint8(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  function toUint8Array(input) {
    if (input instanceof Uint8Array) {
      return input;
    }
    if (input instanceof ArrayBuffer) {
      return new Uint8Array(input);
    }
    if (ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new Error("تعذّر قراءة بيانات قاعدة البيانات المحددة.");
  }

  function hasSqliteSignature(bytes) {
    if (!bytes || bytes.length < 16) return false;
    const signature = "SQLite format 3\0";
    for (let index = 0; index < signature.length; index += 1) {
      if (bytes[index] !== signature.charCodeAt(index)) {
        return false;
      }
    }
    return true;
  }

  function readQueue(queueKey) {
    const raw = localStorage.getItem(queueKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("تعذّر قراءة قائمة الانتظار للعمليات المتأخرة.", error);
      return [];
    }
  }

  function writeQueue(queueKey, queue) {
    localStorage.setItem(queueKey, JSON.stringify(queue));
  }

  function clearQueue(queueKey) {
    localStorage.removeItem(queueKey);
  }

  function getRemoteSync() {
    return typeof window !== "undefined" ? window.HaderRemoteSync || null : null;
  }

  function parseTimeToSeconds(time) {
    if (typeof time !== "string" || time.trim() === "") {
      return 0;
    }
    const parts = time.trim().split(":").map((part) => parseInt(part, 10));
    const [hours = 0, minutes = 0, seconds = 0] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function getThresholdSeconds(settings) {
    const [startHours = 7, startMinutes = 0] = String(settings.schoolStart || "07:00")
      .split(":")
      .map((part) => parseInt(part, 10));
    const grace = Number.isFinite(settings.graceMinutes) ? settings.graceMinutes : 0;
    return startHours * 3600 + startMinutes * 60 + grace * 60;
  }

  function getDayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function normalizeStudent(row) {
    if (!row) return null;
    const id = "id" in row ? String(row.id).trim() : "";
    if (!id) return null;
    return {
      id,
      name: "name" in row ? String(row.name).trim() : "",
      grade: "grade" in row && row.grade != null ? String(row.grade).trim() : "",
      class: "class" in row && row.class != null ? String(row.class).trim() : ""
    };
  }

  function normalizeSettings(input) {
    const source = input && typeof input === "object" ? input : {};
    const merged = { ...DEFAULT_SETTINGS, ...source };

    merged.schoolStart = sanitizeTimeString(merged.schoolStart, DEFAULT_SETTINGS.schoolStart);
    merged.graceMinutes = clampNumber(merged.graceMinutes, 0, 180, DEFAULT_SETTINGS.graceMinutes);

    merged.morningMessage = sanitizeOptionalString(merged.morningMessage);
    merged.generalTip = sanitizeOptionalString(merged.generalTip);
    merged.schoolName = sanitizeOptionalString(merged.schoolName);
    merged.principalName = sanitizeOptionalString(merged.principalName);

    merged.phrasesEarly = normalizeStringList(merged.phrasesEarly, DEFAULT_SETTINGS.phrasesEarly);
    merged.phrasesLate = normalizeStringList(merged.phrasesLate, DEFAULT_SETTINGS.phrasesLate);

    merged.usePinForAdmin = toBoolean(merged.usePinForAdmin);
    merged.usePinForSupervisor = toBoolean(merged.usePinForSupervisor);

    merged.pinMaxAttempts = clampNumber(merged.pinMaxAttempts, 1, 10, DEFAULT_SETTINGS.pinMaxAttempts);
    merged.pinLockMinutes = clampNumber(merged.pinLockMinutes, 0, 180, DEFAULT_SETTINGS.pinLockMinutes);

    merged.kioskBannerUrl = sanitizeOptionalString(merged.kioskBannerUrl);
    merged.kioskBannerName = sanitizeOptionalString(merged.kioskBannerName);

    const colors = normalizeCustomThemeColors(merged);
    merged.customThemeBackground = colors.background;
    merged.customThemeTextStrong = colors.strong;
    merged.customThemeTextMuted = colors.muted;

    const normalizedTheme = sanitizeTheme(merged.uiTheme || merged.theme);
    merged.uiTheme = normalizedTheme;
    merged.theme = normalizedTheme;

    const decorations = normalizeCardDecorations(merged);
    merged.uiCardShadowIntensity = decorations.shadowIntensity;
    merged.uiCardBorderColor = decorations.borderColor;
    merged.uiCardBorderWidth = decorations.borderWidth;

    merged.kioskScaleMode = sanitizeScaleMode(merged.kioskScaleMode);
    merged.kioskScaleValue = clampNumber(
      merged.kioskScaleValue,
      SCALE_PERCENT_LIMITS.min,
      SCALE_PERCENT_LIMITS.max,
      DEFAULT_SETTINGS.kioskScaleValue
    );

    merged.portalCardScale = clampNumber(
      merged.portalCardScale,
      CARD_SCALE_LIMITS.min,
      CARD_SCALE_LIMITS.max,
      DEFAULT_SETTINGS.portalCardScale
    );
    merged.portalListScale = clampNumber(
      merged.portalListScale,
      LIST_SCALE_LIMITS.min,
      LIST_SCALE_LIMITS.max,
      DEFAULT_SETTINGS.portalListScale
    );
    merged.portalStatusCardWidth = clampNumber(
      merged.portalStatusCardWidth,
      STATUS_CARD_WIDTH_LIMITS.min,
      STATUS_CARD_WIDTH_LIMITS.max,
      DEFAULT_SETTINGS.portalStatusCardWidth
    );
    merged.portalStatusCardHeight = clampNumber(
      merged.portalStatusCardHeight,
      STATUS_CARD_HEIGHT_LIMITS.min,
      STATUS_CARD_HEIGHT_LIMITS.max,
      DEFAULT_SETTINGS.portalStatusCardHeight
    );
    merged.portalStatusCardFontScale = clampNumber(
      merged.portalStatusCardFontScale,
      STATUS_CARD_FONT_LIMITS.min,
      STATUS_CARD_FONT_LIMITS.max,
      DEFAULT_SETTINGS.portalStatusCardFontScale
    );
    merged.portalStatusStatsScale = clampNumber(
      merged.portalStatusStatsScale,
      STATUS_STATS_SCALE_LIMITS.min,
      STATUS_STATS_SCALE_LIMITS.max,
      DEFAULT_SETTINGS.portalStatusStatsScale
    );
    merged.portalStatusStatsFontScale = clampNumber(
      merged.portalStatusStatsFontScale,
      STATUS_STATS_FONT_LIMITS.min,
      STATUS_STATS_FONT_LIMITS.max,
      DEFAULT_SETTINGS.portalStatusStatsFontScale
    );
    merged.portalRotation = sanitizeRotation(merged.portalRotation);
    merged.portalAutoScale = toBoolean(merged.portalAutoScale);
    merged.portalScaleAdjust = clampNumber(
      merged.portalScaleAdjust,
      PORTAL_SCALE_LIMITS.min,
      PORTAL_SCALE_LIMITS.max,
      DEFAULT_SETTINGS.portalScaleAdjust
    );
    merged.portalAutoFullscreen = toBoolean(merged.portalAutoFullscreen);
    merged.portalAttendanceCounterVisible = toBoolean(
      merged.portalAttendanceCounterVisible ?? DEFAULT_SETTINGS.portalAttendanceCounterVisible
    );
    merged.portalAudioVolume = clampNumber(
      merged.portalAudioVolume,
      AUDIO_VOLUME_LIMITS.min,
      AUDIO_VOLUME_LIMITS.max,
      DEFAULT_SETTINGS.portalAudioVolume
    );
    SOUND_STATUS_CONFIG.forEach(({ settingKey }) => {
      const urlKey = `portalAudio${settingKey}Url`;
      const nameKey = `portalAudio${settingKey}Name`;
      merged[urlKey] = sanitizeOptionalString(merged[urlKey]);
      merged[nameKey] = sanitizeOptionalString(merged[nameKey]);
    });
    merged.portalScreensaverEnabled = toBoolean(merged.portalScreensaverEnabled);
    merged.portalScreensaverIdleMinutes = clampNumber(
      merged.portalScreensaverIdleMinutes,
      SCREENSAVER_IDLE_LIMITS.min,
      SCREENSAVER_IDLE_LIMITS.max,
      DEFAULT_SETTINGS.portalScreensaverIdleMinutes
    );
    merged.portalScreensaverStartTime = sanitizeTimeString(
      merged.portalScreensaverStartTime,
      DEFAULT_SETTINGS.portalScreensaverStartTime
    );
    merged.portalScreensaverEndTime = sanitizeTimeString(
      merged.portalScreensaverEndTime,
      DEFAULT_SETTINGS.portalScreensaverEndTime
    );
    SCREENSAVER_SLOT_CONFIG.forEach(({ settingKey }) => {
      const base = `portalScreensaver${settingKey}`;
      merged[`${base}Visible`] = toBoolean(merged[`${base}Visible`]);
      merged[`${base}Url`] = sanitizeOptionalString(merged[`${base}Url`]);
      merged[`${base}Name`] = sanitizeOptionalString(merged[`${base}Name`]);
      merged[`${base}Text`] = sanitizeOptionalString(merged[`${base}Text`]);
      merged[`${base}Duration`] = clampNumber(
        merged[`${base}Duration`],
        SCREENSAVER_DURATION_LIMITS.min,
        SCREENSAVER_DURATION_LIMITS.max,
        DEFAULT_SETTINGS[`${base}Duration`]
      );
    });

    merged.portalAdTopUrl = sanitizeOptionalString(merged.portalAdTopUrl);
    merged.portalAdTopName = sanitizeOptionalString(merged.portalAdTopName);
    merged.portalAdTopLink = sanitizeOptionalString(merged.portalAdTopLink);
    merged.portalAdTopVisible = toBoolean(merged.portalAdTopVisible);

    merged.portalAdBottomUrl = sanitizeOptionalString(merged.portalAdBottomUrl);
    merged.portalAdBottomName = sanitizeOptionalString(merged.portalAdBottomName);
    merged.portalAdBottomLink = sanitizeOptionalString(merged.portalAdBottomLink);
    merged.portalAdBottomVisible = toBoolean(merged.portalAdBottomVisible);

    merged.statusCardAutoHideMinutes = clampNumber(
      merged.statusCardAutoHideMinutes,
      STATUS_AUTO_HIDE_LIMITS.min,
      STATUS_AUTO_HIDE_LIMITS.max,
      DEFAULT_SETTINGS.statusCardAutoHideMinutes
    );

    merged.leaveGeneralSupervisorIds = normalizeIdList(merged.leaveGeneralSupervisorIds);
    merged.leaveClassSupervisorIds = normalizeIdList(merged.leaveClassSupervisorIds);
    merged.leaveAdminIds = normalizeIdList(merged.leaveAdminIds);

    const remoteSync = getRemoteSync();
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
      merged.remoteSyncTime = sanitizeTimeString(merged.remoteSyncTime, DEFAULT_SETTINGS.remoteSyncTime);
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

  function getThemeLibrary() {
    return typeof window !== "undefined" ? window.HaderTheme : null;
  }

  function sanitizeTheme(value) {
    const library = getThemeLibrary();
    if (typeof library?.sanitizeTheme === "function") {
      return library.sanitizeTheme(value);
    }
    const theme = typeof value === "string" ? value.trim() : "";
    const available = Array.isArray(library?.AVAILABLE_THEMES) ? library.AVAILABLE_THEMES : FALLBACK_THEMES;
    return available.includes(theme) ? theme : DEFAULT_SETTINGS.uiTheme;
  }

  function sanitizeHexColor(value, fallback) {
    const library = getThemeLibrary();
    if (typeof library?.sanitizeColor === "function") {
      return library.sanitizeColor(value, fallback);
    }
    const raw = typeof value === "string" ? value.trim() : "";
    if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
      return raw.startsWith("#") ? raw.toLowerCase() : `#${raw.toLowerCase()}`;
    }
    return fallback;
  }

  function normalizeCustomThemeColors(source) {
    const library = getThemeLibrary();
    if (typeof library?.normalizeCustomColors === "function") {
      return library.normalizeCustomColors({
        background: source?.background ?? source?.customThemeBackground,
        strong: source?.strong ?? source?.customThemeTextStrong,
        muted: source?.muted ?? source?.customThemeTextMuted
      });
    }
    const defaults = library?.DEFAULT_CUSTOM_COLORS || DEFAULT_CUSTOM_THEME;
    return {
      background: sanitizeHexColor(
        source?.background ?? source?.customThemeBackground,
        defaults.background
      ),
      strong: sanitizeHexColor(source?.strong ?? source?.customThemeTextStrong, defaults.strong),
      muted: sanitizeHexColor(source?.muted ?? source?.customThemeTextMuted, defaults.muted)
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
    const library = getThemeLibrary();
    const base = source && typeof source === "object" ? source : {};
    const defaults = {
      shadowIntensity: DEFAULT_SETTINGS.uiCardShadowIntensity,
      borderColor: DEFAULT_SETTINGS.uiCardBorderColor,
      borderWidth: DEFAULT_SETTINGS.uiCardBorderWidth
    };
    if (typeof library?.normalizeCardDecorations === "function") {
      return library.normalizeCardDecorations(
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

  function sanitizeScaleMode(value) {
    const mode = typeof value === "string" ? value.trim().toLowerCase() : "";
    return SCALE_MODES.includes(mode) ? mode : DEFAULT_SETTINGS.kioskScaleMode;
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const lower = typeof min === "number" ? min : Number.NEGATIVE_INFINITY;
    const upper = typeof max === "number" ? max : Number.POSITIVE_INFINITY;
    return Math.min(Math.max(numeric, lower), upper);
  }

  function sanitizeRotation(value) {
    const rotation = typeof value === "string" ? value.trim() : "";
    return ROTATION_VALUES.includes(rotation) ? rotation : DEFAULT_SETTINGS.portalRotation;
  }

  function sanitizeOptionalString(value, fallback = "") {
    if (typeof value !== "string") {
      return fallback;
    }
    return value.trim();
  }

  function sanitizeTimeString(value, fallback) {
    if (typeof value !== "string") {
      return fallback;
    }
    const trimmed = value.trim();
    if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
      return fallback;
    }
    return trimmed;
  }

  function normalizeStringList(value, fallback) {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeOptionalString(item)).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return Array.isArray(fallback) ? [...fallback] : [];
  }

  function toBoolean(value) {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
      }
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return true;
      }
    }
    return Boolean(value);
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

  function ensureSqlJs(options) {
    if (typeof initSqlJs !== "function") {
      return Promise.reject(new Error("مكتبة SQL.js غير محملة. تأكد من تضمين sql-wasm.js."));
    }
    const wasmPath = options && options.wasmUrl ? options.wasmUrl : "sql-wasm.wasm";
    return initSqlJs({ locateFile: () => wasmPath });
  }

  function deserializeSettings(rows) {
    const result = {};
    for (const { key, value } of rows) {
      if (typeof value !== "string") {
        result[key] = value;
        continue;
      }
      try {
        result[key] = JSON.parse(value);
      } catch (error) {
        result[key] = value;
      }
    }
    return result;
  }

  function serializeSettings(settings) {
    const entries = [];
    for (const [key, value] of Object.entries(settings)) {
      entries.push({ key, value: JSON.stringify(value) });
    }
    return entries;
  }

  function normalizePermissionEntry(input) {
    if (!input || typeof input !== "object") return null;
    const studentSource = input.studentId ?? input.student_id;
    const studentId = typeof studentSource === "undefined" ? "" : String(studentSource).trim();
    if (!studentId) return null;
    const reasonSource = input.reason ?? input.reasonText;
    const noteSource = input.note ?? input.notes;
    const statusSource = input.status ?? input.state;
    let createdRaw = input.createdAt ?? input.created_at ?? input.timestamp;
    let createdDate = createdRaw ? new Date(createdRaw) : new Date();
    if (Number.isNaN(createdDate.getTime())) {
      createdDate = new Date();
    }
    return {
      studentId,
      createdAt: createdDate.toISOString(),
      reason: typeof reasonSource === "string" ? reasonSource.trim() : reasonSource ? String(reasonSource).trim() : "",
      note: typeof noteSource === "string" ? noteSource.trim() : noteSource ? String(noteSource).trim() : "",
      status:
        typeof statusSource === "string" && statusSource.trim() !== ""
          ? statusSource.trim()
          : "approved"
    };
  }

  function normalizePermissionInput(input) {
    const normalized = normalizePermissionEntry(input);
    if (!normalized) {
      throw new Error("بيانات الاستئذان غير صالحة.");
    }
    return normalized;
  }

  function mapRowToPermission(row) {
    if (!row) return null;
    return normalizePermissionEntry({
      student_id: row.student_id,
      created_at: row.created_at,
      reason: row.reason,
      note: row.note,
      status: row.status
    });
  }

  function normalizeAttendanceMap(input) {
    if (!input || typeof input !== "object") return {};
    const result = {};
    Object.entries(input).forEach(([dayKey, records]) => {
      const day = String(dayKey || "").trim();
      if (!day) return;
      if (!records || typeof records !== "object") return;
      const bucket = {};
      Object.entries(records).forEach(([studentId, time]) => {
        const id = String(studentId || "").trim();
        const value = String(time || "").trim();
        if (!id || !value) return;
        bucket[id] = value;
      });
      result[day] = bucket;
    });
    return result;
  }

  function normalizePermissionsMap(input) {
    if (!input || typeof input !== "object") return {};
    const map = {};
    Object.entries(input).forEach(([dayKey, list]) => {
      const day = String(dayKey || "").trim();
      if (!day || !Array.isArray(list)) return;
      const entries = list
        .map(normalizePermissionEntry)
        .filter(Boolean)
        .map((entry) => ({ ...entry }));
      if (entries.length > 0) {
        map[day] = entries;
      }
    });
    return map;
  }

  function normalizeSnapshot(input) {
    const source = input && typeof input === "object" ? input : {};
    const students = Array.isArray(source.students) ? source.students.map(normalizeStudent).filter(Boolean) : [];
    const settings = normalizeSettings(source.settings);
    const attendance = normalizeAttendanceMap(source.attendance);
    const permissions = normalizePermissionsMap(source.permissions);
    return { students, settings, attendance, permissions };
  }

  window.HaderStores = window.HaderStores || {};
  window.HaderStores.buildSqlJsOptions = buildSqlJsOptions;
  window.HaderStores.migrateOldSqlJsKeys = migrateOldKeysIfNeeded;
  window.HaderStores.nsKey = nsKey;
  window.ensureSqlJs = ensureSqlJs;
  window.migrateOldKeysIfNeeded = migrateOldKeysIfNeeded;
  window.buildSqlJsOptions = buildSqlJsOptions;
  window.HaderStores.createSqlStore = function createSqlStore(customOptions = {}) {
    const baseOptions = buildSqlJsOptions(customOptions.activeSchoolId);
    const options = { ...baseOptions, ...customOptions };
    let SQL = null;
    let db = null;
    let dbReadyPromise = null;

    async function ensureDatabase() {
      if (db) return db;
      if (!dbReadyPromise) {
        dbReadyPromise = (async () => {
          SQL = await ensureSqlJs(options);
          const persisted = localStorage.getItem(options.persistKey);
          if (persisted) {
            try {
              const data = base64ToUint8(persisted);
              db = new SQL.Database(data);
            } catch (error) {
              console.warn("تعذّر تحميل قاعدة البيانات المحفوظة. سيتم إنشاء قاعدة جديدة.", error);
              db = new SQL.Database();
            }
          } else {
            db = new SQL.Database();
          }
          initializeSchema();
          return db;
        })();
      }
      return dbReadyPromise;
    }

    function initializeSchema() {
      if (!db) return;
      db.exec(`
        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          grade TEXT,
          class TEXT
        );
        CREATE TABLE IF NOT EXISTS attendance (
          day TEXT NOT NULL,
          student_id TEXT NOT NULL,
          time TEXT NOT NULL,
          PRIMARY KEY(day, student_id)
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          reason TEXT,
          note TEXT,
          status TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_permissions_day ON permissions(date(created_at));
        CREATE INDEX IF NOT EXISTS idx_permissions_student ON permissions(student_id);
      `);
    }

    function persistDatabase() {
      if (!db) return;
      const data = db.export();
      const base64 = uint8ToBase64(data);
      localStorage.setItem(options.persistKey, base64);
    }

    function enqueueOperation(operation) {
      const queue = readQueue(options.queueKey);
      queue.push(operation);
      writeQueue(options.queueKey, queue);
    }

    async function runWithQueueFallback(fn, operationDescriptor) {
      try {
        const result = await fn();
        persistDatabase();
        return result;
      } catch (error) {
        console.error("فشل تنفيذ العملية على SQL.js، سيتم حفظها في قائمة الانتظار.", error);
        enqueueOperation(operationDescriptor);
        throw error;
      }
    }

    async function flushQueue() {
      const queue = readQueue(options.queueKey);
      if (queue.length === 0) return;
      const remaining = [];
      for (const operation of queue) {
        try {
          await executeQueuedOperation(operation);
        } catch (error) {
          console.error("تعذّر تفريغ عملية من قائمة الانتظار.", error);
          remaining.push(operation);
        }
      }
      writeQueue(options.queueKey, remaining);
      if (remaining.length === 0) {
        persistDatabase();
      }
    }

    async function executeQueuedOperation(operation) {
      const dbInstance = await ensureDatabase();
      switch (operation.type) {
        case "setStudents":
          return setStudentsInternal(dbInstance, operation.payload || []);
        case "setSettings":
          return setSettingsInternal(dbInstance, operation.payload || {});
        case "setAttendance":
          return setAttendanceInternal(dbInstance, operation.payload);
        case "deleteAttendance":
          return deleteAttendanceInternal(dbInstance, operation.payload);
        case "addPermission":
          return addPermissionInternal(dbInstance, operation.payload);
        case "importSnapshot":
          return importSnapshotInternal(dbInstance, operation.payload || {});
        default:
          throw new Error(`نوع عملية غير مدعوم في قائمة الانتظار: ${operation.type}`);
      }
    }

    async function getStudents() {
      const dbInstance = await ensureDatabase();
      const stmt = dbInstance.prepare("SELECT id, name, grade, class FROM students ORDER BY name COLLATE NOCASE");
      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const normalized = normalizeStudent(row);
        if (normalized) results.push(normalized);
      }
      stmt.free();
      return results;
    }

    function setStudentsInternal(dbInstance, students) {
      if (!Array.isArray(students)) {
        throw new Error("قائمة الطلاب يجب أن تكون مصفوفة.");
      }
      const normalized = students.map(normalizeStudent).filter(Boolean);
      dbInstance.run("DELETE FROM students;");
      const insert = dbInstance.prepare("INSERT INTO students (id, name, grade, class) VALUES (?, ?, ?, ?)");
      try {
        dbInstance.run("BEGIN TRANSACTION");
        for (const student of normalized) {
          insert.run([student.id, student.name, student.grade || null, student.class || null]);
        }
        dbInstance.run("COMMIT");
      } catch (error) {
        dbInstance.run("ROLLBACK");
        throw error;
      } finally {
        insert.free();
      }
    }

    async function setStudents(students) {
      const dbInstance = await ensureDatabase();
      return runWithQueueFallback(
        async () => {
          setStudentsInternal(dbInstance, students);
        },
        { type: "setStudents", payload: students }
      );
    }

    async function getSettings() {
      const dbInstance = await ensureDatabase();
      const stmt = dbInstance.prepare("SELECT key, value FROM settings");
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      const parsed = deserializeSettings(rows);
      return normalizeSettings(parsed);
    }

    function setSettingsInternal(dbInstance, settings) {
      const normalized = normalizeSettings(settings);
      const entries = serializeSettings(normalized);
      const stmt = dbInstance.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );
      try {
        dbInstance.run("BEGIN TRANSACTION");
        for (const entry of entries) {
          stmt.run([entry.key, entry.value]);
        }
        dbInstance.run("COMMIT");
      } catch (error) {
        dbInstance.run("ROLLBACK");
        throw error;
      } finally {
        stmt.free();
      }
    }

    async function setSettings(settings) {
      const dbInstance = await ensureDatabase();
      return runWithQueueFallback(
        async () => {
          setSettingsInternal(dbInstance, settings);
        },
        { type: "setSettings", payload: settings }
      );
    }

    async function getAttendanceDay(day) {
      if (typeof day !== "string" || day.trim() === "") {
        throw new Error("اليوم مطلوب كقيمة نصية ISO.");
      }
      const dbInstance = await ensureDatabase();
      const stmt = dbInstance.prepare("SELECT student_id, time FROM attendance WHERE day = ?", [day]);
      const result = {};
      while (stmt.step()) {
        const row = stmt.getAsObject();
        result[row.student_id] = row.time;
      }
      stmt.free();
      return result;
    }

    async function getAttendanceRange(options = {}) {
      const { startDay, endDay } = options || {};
      const dbInstance = await ensureDatabase();
      const clauses = [];
      const params = [];
      if (startDay) {
        clauses.push("day >= ?");
        params.push(startDay);
      }
      if (endDay) {
        clauses.push("day <= ?");
        params.push(endDay);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const stmt = dbInstance.prepare(`SELECT day, student_id, time FROM attendance ${where} ORDER BY day ASC, time ASC`, params);
      const map = new Map();
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (!map.has(row.day)) {
          map.set(row.day, {});
        }
        const bucket = map.get(row.day);
        bucket[row.student_id] = row.time;
      }
      stmt.free();
      return Array.from(map.entries()).map(([day, records]) => ({ day, records }));
    }

    async function getPermissionsDay(day) {
      if (typeof day !== "string" || day.trim() === "") {
        throw new Error("اليوم مطلوب كقيمة نصية ISO.");
      }
      const dbInstance = await ensureDatabase();
      const stmt = dbInstance.prepare(
        "SELECT student_id, created_at, reason, note, status FROM permissions WHERE date(created_at) = ? ORDER BY created_at ASC",
        [day]
      );
      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const normalized = mapRowToPermission(row);
        if (normalized) {
          results.push(normalized);
        }
      }
      stmt.free();
      return results;
    }

    async function getPermissionsRange(options = {}) {
      const { startDay, endDay } = options || {};
      const dbInstance = await ensureDatabase();
      const clauses = [];
      const params = [];
      if (startDay) {
        clauses.push("date(created_at) >= ?");
        params.push(startDay);
      }
      if (endDay) {
        clauses.push("date(created_at) <= ?");
        params.push(endDay);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const stmt = dbInstance.prepare(
        `SELECT student_id, created_at, reason, note, status FROM permissions ${where} ORDER BY created_at ASC`,
        params
      );
      const buckets = new Map();
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const normalized = mapRowToPermission(row);
        if (!normalized) continue;
        const dayKey = normalized.createdAt.slice(0, 10);
        if (!buckets.has(dayKey)) {
          buckets.set(dayKey, []);
        }
        buckets.get(dayKey).push(normalized);
      }
      stmt.free();
      return Array.from(buckets.entries())
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([day, entries]) => ({ day, entries }));
    }

  function setAttendanceInternal(dbInstance, payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("العملية غير صالحة للحضور.");
    }
    const { day, id, time } = payload;
    if (!day || !id || !time) {
      throw new Error("اليوم، رقم الطالب، والوقت مطلوبة.");
    }
    dbInstance.run(
      "INSERT INTO attendance (day, student_id, time) VALUES (?, ?, ?) ON CONFLICT(day, student_id) DO UPDATE SET time = excluded.time",
      [day, id, time]
    );
  }

  function deleteAttendanceInternal(dbInstance, payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("العملية غير صالحة لحذف الحضور.");
    }
    const { day, id } = payload;
    if (!day || !id) {
      throw new Error("اليوم ورقم الطالب مطلوبان للحذف.");
    }
    dbInstance.run("DELETE FROM attendance WHERE day = ? AND student_id = ?", [day, id]);
  }

  function replaceAttendanceInternal(dbInstance, attendanceMap) {
    dbInstance.run("DELETE FROM attendance;");
    if (!attendanceMap || typeof attendanceMap !== "object") return;
    const stmt = dbInstance.prepare("INSERT INTO attendance (day, student_id, time) VALUES (?, ?, ?)");
    try {
      dbInstance.run("BEGIN TRANSACTION");
      Object.entries(attendanceMap).forEach(([day, records]) => {
        if (!records || typeof records !== "object") return;
        Object.entries(records).forEach(([studentId, time]) => {
          stmt.run([day, studentId, time]);
        });
      });
      dbInstance.run("COMMIT");
    } catch (error) {
      dbInstance.run("ROLLBACK");
      throw error;
    } finally {
      stmt.free();
    }
  }

    async function setAttendance(day, id, time) {
      const dbInstance = await ensureDatabase();
      return runWithQueueFallback(
        async () => {
          setAttendanceInternal(dbInstance, { day, id, time });
        },
        { type: "setAttendance", payload: { day, id, time } }
      );
    }

    async function deleteAttendance(day, id) {
      const dbInstance = await ensureDatabase();
      return runWithQueueFallback(
        async () => {
          deleteAttendanceInternal(dbInstance, { day, id });
        },
        { type: "deleteAttendance", payload: { day, id } }
      );
    }

  function addPermissionInternal(dbInstance, payload) {
    const normalized = normalizePermissionInput(payload);
    dbInstance.run("INSERT INTO permissions (student_id, created_at, reason, note, status) VALUES (?, ?, ?, ?, ?)", [
      normalized.studentId,
      normalized.createdAt,
      normalized.reason || null,
      normalized.note || null,
      normalized.status || null
    ]);
    return normalized;
  }

  function replacePermissionsInternal(dbInstance, permissionsMap) {
    dbInstance.run("DELETE FROM permissions;");
    if (!permissionsMap || typeof permissionsMap !== "object") return;
    const stmt = dbInstance.prepare("INSERT INTO permissions (student_id, created_at, reason, note, status) VALUES (?, ?, ?, ?, ?)");
    try {
      dbInstance.run("BEGIN TRANSACTION");
      Object.values(permissionsMap).forEach((list) => {
        if (!Array.isArray(list)) return;
        list
          .slice()
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
          .forEach((entry) => {
            const normalized = normalizePermissionEntry(entry);
            if (!normalized) return;
            stmt.run([
              normalized.studentId,
              normalized.createdAt,
              normalized.reason || null,
              normalized.note || null,
              normalized.status || null
            ]);
          });
      });
      dbInstance.run("COMMIT");
    } catch (error) {
      dbInstance.run("ROLLBACK");
      throw error;
    } finally {
      stmt.free();
    }
  }

  function importSnapshotInternal(dbInstance, snapshot) {
    const normalized = normalizeSnapshot(snapshot);
    setStudentsInternal(dbInstance, normalized.students);
    setSettingsInternal(dbInstance, normalized.settings);
    replaceAttendanceInternal(dbInstance, normalized.attendance);
    replacePermissionsInternal(dbInstance, normalized.permissions);
  }

    async function addPermission(entry) {
      const dbInstance = await ensureDatabase();
      const normalized = normalizePermissionInput(entry);
      return runWithQueueFallback(
        async () => {
          addPermissionInternal(dbInstance, normalized);
          return { ...normalized };
        },
        { type: "addPermission", payload: normalized }
      );
    }

    async function getLateAggregates(studentId) {
      if (!studentId) {
        return { daysLate: 0, totalLateMinutes: 0, todayLateMinutes: 0 };
      }
      const settings = await getSettings();
      const thresholdSeconds = getThresholdSeconds(settings);
      const dbInstance = await ensureDatabase();
      const stmt = dbInstance.prepare("SELECT day, time FROM attendance WHERE student_id = ?", [studentId]);
      let daysLate = 0;
      let totalLateMinutes = 0;
      let todayLateMinutes = 0;
      const todayKey = getDayKey(new Date());
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const diffSeconds = parseTimeToSeconds(row.time) - thresholdSeconds;
        if (diffSeconds > 0) {
          daysLate += 1;
          const minutesLate = Math.ceil(diffSeconds / 60);
          totalLateMinutes += minutesLate;
          if (row.day === todayKey) {
            todayLateMinutes = minutesLate;
          }
        }
      }
      stmt.free();
      return { daysLate, totalLateMinutes, todayLateMinutes };
    }

    function extractLegacySnapshot(dbInstance) {
      if (!dbInstance || typeof dbInstance.prepare !== "function") {
        return null;
      }

      function tableExists(name) {
        try {
          const stmt = dbInstance.prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
            [String(name)]
          );
          const exists = stmt.step();
          stmt.free();
          return exists;
        } catch (error) {
          console.warn("تعذّر فحص وجود الجدول في قاعدة البيانات المستوردة.", error);
          return false;
        }
      }

      function getTableColumns(name) {
        const columns = [];
        try {
          const stmt = dbInstance.prepare(`PRAGMA table_info(${JSON.stringify(String(name))});`);
          while (stmt.step()) {
            const info = stmt.getAsObject();
            if (info && info.name) {
              columns.push(String(info.name));
            }
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة مخطط الجدول legacy.", error);
        }
        return columns;
      }

      function padTwoDigits(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return "00";
        }
        const clamped = Math.max(0, Math.min(99, Math.floor(num)));
        return clamped.toString().padStart(2, "0");
      }

      function clampNumber(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return min;
        }
        return Math.min(max, Math.max(min, Math.round(num)));
      }

      function parseLegacyTimestamp(ts) {
        if (!ts) return null;
        const raw = String(ts).trim();
        if (!raw) return null;
        let day = "";
        let time = "";
        if (raw.includes("T")) {
          const [dayPart, rest = ""] = raw.split("T");
          day = String(dayPart || "").slice(0, 10);
          time = rest.slice(0, 8);
        }
        if (!day || time.length < 5) {
          const date = new Date(raw);
          if (!Number.isNaN(date.getTime())) {
            const iso = date.toISOString();
            day = iso.slice(0, 10);
            time = iso.slice(11, 19);
          }
        }
        if (!day) {
          return null;
        }
        if (!time) {
          time = "00:00:00";
        }
        return { day, time };
      }

      const hasStudents = tableExists("students");
      const hasSettings = tableExists("settings");
      const hasAttendance = tableExists("attendance");
      const hasPermissions = tableExists("permissions");

      const studentColumns = hasStudents ? getTableColumns("students") : [];
      const settingsColumns = hasSettings ? getTableColumns("settings") : [];
      const attendanceColumns = hasAttendance ? getTableColumns("attendance") : [];
      const permissionsColumns = hasPermissions ? getTableColumns("permissions") : [];

      const legacyStudents = studentColumns.includes("national_id") && studentColumns.includes("full_name");
      const legacySettings = settingsColumns.includes("assembly_hour") || settingsColumns.includes("assembly_minute");
      const legacyAttendance = attendanceColumns.includes("ts") || attendanceColumns.includes("late_minutes");

      if (!legacyStudents && !legacySettings && !legacyAttendance) {
        return null;
      }

      function readLegacyStudents() {
        if (!hasStudents) return [];
        const seen = new Map();
        try {
          const stmt = dbInstance.prepare("SELECT national_id, full_name, grade, class FROM students");
          while (stmt.step()) {
            const row = stmt.getAsObject();
            const idSource = row.national_id ?? row.id;
            const candidate = normalizeStudent({
              id: typeof idSource === "undefined" ? "" : String(idSource),
              name: row.full_name,
              grade: row.grade,
              class: row.class
            });
            if (!candidate || !candidate.id) continue;
            if (!seen.has(candidate.id)) {
              seen.set(candidate.id, candidate);
            }
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة جدول الطلاب legacy.", error);
        }
        return Array.from(seen.values());
      }

      function readCurrentStudents() {
        if (!hasStudents) return [];
        const results = [];
        try {
          const stmt = dbInstance.prepare("SELECT id, name, grade, class FROM students");
          while (stmt.step()) {
            const row = stmt.getAsObject();
            const normalized = normalizeStudent(row);
            if (normalized) {
              results.push(normalized);
            }
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة جدول الطلاب الحالي.", error);
        }
        return results;
      }

      function readLegacySettings() {
        if (!hasSettings) return {};
        let row = null;
        try {
          const stmt = dbInstance.prepare(
            "SELECT assembly_hour, assembly_minute, grace_minutes, school_name, principal_name FROM settings ORDER BY id LIMIT 1"
          );
          if (stmt.step()) {
            row = stmt.getAsObject();
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة إعدادات legacy.", error);
        }
        if (!row) {
          return {};
        }
        const settings = {};
        if (row.school_name) {
          settings.schoolName = String(row.school_name).trim();
        }
        if (row.principal_name) {
          settings.principalName = String(row.principal_name).trim();
        }
        const hasHour = row.assembly_hour != null && row.assembly_hour !== "";
        const hasMinute = row.assembly_minute != null && row.assembly_minute !== "";
        if (hasHour && hasMinute) {
          const hourValue = Number(row.assembly_hour);
          const minuteValue = Number(row.assembly_minute);
          if (Number.isFinite(hourValue) && Number.isFinite(minuteValue)) {
            const hour = clampNumber(hourValue, 0, 23);
            const minute = clampNumber(minuteValue, 0, 59);
            settings.schoolStart = `${padTwoDigits(hour)}:${padTwoDigits(minute)}`;
          }
        }
        if (row.grace_minutes != null && row.grace_minutes !== "") {
          const graceValue = Number(row.grace_minutes);
          if (Number.isFinite(graceValue)) {
            settings.graceMinutes = clampNumber(graceValue, 0, 180);
          }
        }
        return settings;
      }

      function readCurrentSettings() {
        if (!hasSettings) return {};
        const rows = [];
        try {
          const stmt = dbInstance.prepare("SELECT key, value FROM settings");
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة جدول الإعدادات الحالي.", error);
        }
        return deserializeSettings(rows);
      }

      function readLegacyAttendance() {
        if (!hasAttendance) return {};
        const attendance = {};
        try {
          const stmt = dbInstance.prepare("SELECT national_id, ts FROM attendance WHERE national_id IS NOT NULL AND ts IS NOT NULL");
          while (stmt.step()) {
            const row = stmt.getAsObject();
            const studentId = row.national_id != null ? String(row.national_id).trim() : "";
            const parsed = parseLegacyTimestamp(row.ts);
            if (!studentId || !parsed) continue;
            if (!attendance[parsed.day]) {
              attendance[parsed.day] = {};
            }
            const current = attendance[parsed.day][studentId];
            if (!current || String(current).localeCompare(parsed.time) > 0) {
              attendance[parsed.day][studentId] = parsed.time;
            }
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة سجلات الحضور legacy.", error);
        }
        return attendance;
      }

      function readCurrentAttendance() {
        if (!hasAttendance) return {};
        const attendance = {};
        try {
          const stmt = dbInstance.prepare("SELECT day, student_id, time FROM attendance");
          while (stmt.step()) {
            const row = stmt.getAsObject();
            const day = row.day ? String(row.day).slice(0, 10) : "";
            const studentId = row.student_id ? String(row.student_id).trim() : "";
            const time = row.time ? String(row.time).trim() : "";
            if (!day || !studentId || !time) continue;
            if (!attendance[day]) {
              attendance[day] = {};
            }
            attendance[day][studentId] = time;
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة سجلات الحضور الحالية.", error);
        }
        return attendance;
      }

      function readCurrentPermissions() {
        if (!hasPermissions) return {};
        const map = {};
        try {
          const stmt = dbInstance.prepare(
            "SELECT student_id, created_at, reason, note, status FROM permissions ORDER BY created_at ASC"
          );
          while (stmt.step()) {
            const entry = mapRowToPermission(stmt.getAsObject());
            if (!entry || !entry.createdAt) continue;
            const dayKey = entry.createdAt.slice(0, 10);
            if (!map[dayKey]) {
              map[dayKey] = [];
            }
            map[dayKey].push(entry);
          }
          stmt.free();
        } catch (error) {
          console.warn("تعذّر قراءة سجلات الاستئذان الحالية.", error);
        }
        return map;
      }

      const students = legacyStudents ? readLegacyStudents() : readCurrentStudents();
      const settings = legacySettings ? readLegacySettings() : readCurrentSettings();
      const attendance = legacyAttendance ? readLegacyAttendance() : readCurrentAttendance();
      const hasStructuredPermissions =
        permissionsColumns.includes("student_id") && permissionsColumns.includes("created_at");
      const permissions = hasStructuredPermissions ? readCurrentPermissions() : {};

      return { students, settings, attendance, permissions };
    }

    async function exportSnapshot() {
      const [students, settings, attendanceBuckets, permissionsBuckets] = await Promise.all([
        getStudents(),
        getSettings(),
        getAttendanceRange(),
        getPermissionsRange()
      ]);
      const attendance = {};
      attendanceBuckets.forEach((bucket) => {
        if (!bucket || !bucket.day || !bucket.records) return;
        attendance[bucket.day] = { ...bucket.records };
      });
      const permissions = {};
      permissionsBuckets.forEach((bucket) => {
        if (!bucket || !bucket.day || !Array.isArray(bucket.entries)) return;
        permissions[bucket.day] = bucket.entries.map((entry) => ({ ...entry }));
      });
      return {
        version: 1,
        generatedAt: new Date().toISOString(),
        storeType: "sql",
        students,
        settings,
        attendance,
        permissions
      };
    }

    async function importSnapshot(snapshot) {
      const dbInstance = await ensureDatabase();
      const normalized = normalizeSnapshot(snapshot);
      return runWithQueueFallback(
        async () => {
          importSnapshotInternal(dbInstance, normalized);
        },
        { type: "importSnapshot", payload: normalized }
      );
    }

    async function exportDatabaseBinary() {
      const dbInstance = await ensureDatabase();
      return dbInstance.export();
    }

    async function importDatabaseBinary(binaryInput) {
      const bytes = toUint8Array(binaryInput);
      if (!hasSqliteSignature(bytes)) {
        throw new Error("الملف المحدد ليس قاعدة بيانات SQLite صالحة.");
      }
      SQL = await ensureSqlJs(options);
      try {
        if (db && typeof db.close === "function") {
          db.close();
        }
        db = new SQL.Database(bytes);
      } catch (error) {
        throw new Error("تعذّر تحميل قاعدة البيانات المحددة.");
      }

      let legacySnapshot = null;
      try {
        legacySnapshot = extractLegacySnapshot(db);
      } catch (error) {
        console.warn("تعذّر تحليل قاعدة البيانات المستوردة. سيتم المتابعة بدون تحويل تلقائي.", error);
      }

      if (legacySnapshot) {
        try {
          if (db && typeof db.close === "function") {
            db.close();
          }
        } catch (closeError) {
          console.warn("تعذّر إغلاق نسخة قاعدة البيانات القديمة بعد التحويل.", closeError);
        }
        db = new SQL.Database();
        initializeSchema();
        try {
          importSnapshotInternal(db, legacySnapshot);
          console.info("تم تحويل قاعدة البيانات legacy إلى البنية الحالية وتحديثها بنجاح.");
        } catch (migrationError) {
          throw new Error("تعذّر تحويل قاعدة البيانات legacy إلى البنية الحالية.");
        }
      } else {
        initializeSchema();
      }

      persistDatabase();
      clearQueue(options.queueKey);
      dbReadyPromise = Promise.resolve(db);
      return {
        students: await getStudents(),
        settings: await getSettings()
      };
    }

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        flushQueue().catch((error) => {
          console.error("فشل تفريغ قائمة الانتظار بعد العودة أونلاين.", error);
        });
      });
    }

    return {
      getStudents,
      setStudents,
      getSettings,
      setSettings,
      getAttendanceDay,
      getAttendanceRange,
      setAttendance,
      deleteAttendance,
      getPermissionsDay,
      getPermissionsRange,
      addPermission,
      getLateAggregates,
      flushQueue,
      exportSnapshot,
      importSnapshot,
      exportDatabaseBinary,
      importDatabaseBinary
    };
  };

  if (typeof window !== "undefined" && window.HaderBackendFactory?.registerBackend) {
    try {
      window.HaderBackendFactory.registerBackend("sqljs", {
        async create() {
          return window.HaderStores.createSqlStore();
        }
      });
    } catch (error) {
      console.warn("تعذّر تسجيل مزود SQL.js في المصنع المركزي.", error);
    }
  }
})();
