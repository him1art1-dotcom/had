(function () {
  "use strict";

  const SETTINGS_KEY = "aa_settings";
  const STUDENTS_KEY = "aa_students";
  const ATTENDANCE_KEY = "aa_attendance";
  const PERMISSIONS_KEY = "aa_permissions";

  const DEFAULT_SCHOOL_ID = "default";
  const nsKeyHelper =
    (typeof window !== "undefined" && (window.HaderStores?.nsKey || window.nsKey)) ||
    ((base, schoolId) => `${base}_${String(schoolId || DEFAULT_SCHOOL_ID)}`);

  function normalizeSchoolId(value) {
    if (value == null) {
      return DEFAULT_SCHOOL_ID;
    }
    const text = String(value).trim();
    return text === "" ? DEFAULT_SCHOOL_ID : text;
  }

  function readInitialSchoolId() {
    if (typeof window === "undefined") {
      return DEFAULT_SCHOOL_ID;
    }
    const stored = window.SCHOOL_ID || localStorage.getItem("hader:school_id");
    return normalizeSchoolId(stored);
  }

  let activeSchoolId = readInitialSchoolId();

  function updateActiveSchoolId(candidate) {
    if (candidate == null) {
      activeSchoolId = readInitialSchoolId();
    } else {
      activeSchoolId = normalizeSchoolId(candidate);
    }
    return activeSchoolId;
  }

  function currentSchoolId() {
    return activeSchoolId;
  }

  function namespacedKey(base, schoolId) {
    return nsKeyHelper(base, schoolId);
  }

  function currentKey(base) {
    return namespacedKey(base, currentSchoolId());
  }

  function readNamespacedItem(base) {
    const key = currentKey(base);
    const value = localStorage.getItem(key);
    if (value != null) {
      return value;
    }
    return localStorage.getItem(base);
  }

  function writeNamespacedItem(base, value) {
    const key = currentKey(base);
    localStorage.setItem(key, value);
  }

  const FALLBACK_THEMES = Object.freeze(["classic", "sunrise", "oasis", "forest", "midnight", "custom"]);
  const DEFAULT_CUSTOM_THEME = Object.freeze({ background: "#f4f6fb", strong: "#0f1c2b", muted: "#4f637b" });
  const ADMIN_SUPERVISOR_IDENTIFIER = "ADMIN_SUPER";
  const TECHNICAL_SUPERVISOR_IDENTIFIER = "ADMIN_TECH";
  const MASTER_SUPERVISOR_IDENTIFIERS = Object.freeze([
    ADMIN_SUPERVISOR_IDENTIFIER,
    TECHNICAL_SUPERVISOR_IDENTIFIER
  ]);

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

  function parseJson(key, fallback) {
    const raw = readNamespacedItem(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      console.warn(`تعذّر تحليل بيانات ${key}.`, error);
      return fallback;
    }
  }

  function getRemoteSync() {
    return typeof window !== "undefined" ? window.HaderRemoteSync || null : null;
  }

  function writeJson(key, value) {
    writeNamespacedItem(key, JSON.stringify(value));
  }

  function normalizeStudent(input) {
    if (!input || typeof input !== "object") return null;
    const id = "id" in input ? String(input.id).trim() : "";
    if (!id) return null;
    return {
      id,
      name: "name" in input ? String(input.name).trim() : "",
      grade: "grade" in input && input.grade != null ? String(input.grade).trim() : "",
      class: "class" in input && input.class != null ? String(input.class).trim() : ""
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

  function normalizePermissionEntry(input) {
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
    return { studentId, createdAt, reason, note, status };
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

  function readPermissionsMap() {
    const raw = parseJson(PERMISSIONS_KEY, {});
    if (!raw || typeof raw !== "object") return {};
    const map = {};
    Object.entries(raw).forEach(([day, list]) => {
      if (!Array.isArray(list)) return;
      list
        .map(normalizePermissionEntry)
        .filter(Boolean)
        .forEach((entry) => {
          const key = entry.createdAt.slice(0, 10) || day;
          if (!map[key]) {
            map[key] = [];
          }
          map[key].push(entry);
        });
    });
    Object.values(map).forEach((bucket) => bucket.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
    return map;
  }

  function writePermissionsMap(map) {
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
    writeJson(PERMISSIONS_KEY, payload);
  }

  function collectPermissionsRange(options = {}) {
    const map = readPermissionsMap();
    const { startDay, endDay } = options || {};
    return Object.keys(map)
      .filter((day) => {
        if (startDay && day < startDay) return false;
        if (endDay && day > endDay) return false;
        return true;
      })
      .sort()
      .map((day) => ({
        day,
        entries: map[day].map((entry) => ({ ...entry }))
      }));
  }

  async function calculateLateAggregates(studentId) {
    const settings = await store.getSettings();
    const attendance = parseJson(ATTENDANCE_KEY, {});
    const thresholdSeconds = getThresholdSeconds(settings);
    let daysLate = 0;
    let totalLateMinutes = 0;
    let todayLateMinutes = 0;
    const todayKey = getDayKey(new Date());

    for (const [day, records] of Object.entries(attendance)) {
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

  async function collectAttendanceRange(options = {}) {
    const attendance = parseJson(ATTENDANCE_KEY, {});
    const days = Object.keys(attendance).sort();
    const { startDay, endDay } = options || {};
    return days
      .filter((day) => {
        if (startDay && day < startDay) return false;
        if (endDay && day > endDay) return false;
        return true;
      })
      .map((day) => ({
        day,
        records: attendance[day] && typeof attendance[day] === "object" ? { ...attendance[day] } : {}
      }));
  }

  const store = {
    async getStudents() {
      const data = parseJson(STUDENTS_KEY, []);
      if (!Array.isArray(data)) return [];
      return data
        .map(normalizeStudent)
        .filter(Boolean);
    },
    async setStudents(list) {
      if (!Array.isArray(list)) {
        throw new Error("قائمة الطلاب يجب أن تكون مصفوفة.");
      }
      const normalized = list
        .map(normalizeStudent)
        .filter(Boolean);
      writeJson(STUDENTS_KEY, normalized);
    },
    async getSettings() {
      const raw = parseJson(SETTINGS_KEY, null);
      return normalizeSettings(raw);
    },
    async setSettings(settings) {
      const normalized = normalizeSettings(settings);
      writeJson(SETTINGS_KEY, normalized);
    },
    async getAttendanceDay(day) {
      if (typeof day !== "string" || day.trim() === "") {
        throw new Error("اليوم مطلوب كقيمة نصية ISO.");
      }
      const allAttendance = parseJson(ATTENDANCE_KEY, {});
      const dayRecords = allAttendance[day];
      if (!dayRecords || typeof dayRecords !== "object") {
        return {};
      }
      return { ...dayRecords };
    },
    async setAttendance(day, id, time) {
      if (!day || !id || !time) {
        throw new Error("اليوم، رقم الطالب، والوقت مطلوبة.");
      }
      const allAttendance = parseJson(ATTENDANCE_KEY, {});
      const dayRecords = allAttendance[day] && typeof allAttendance[day] === "object" ? { ...allAttendance[day] } : {};
      dayRecords[id] = time;
      allAttendance[day] = dayRecords;
      writeJson(ATTENDANCE_KEY, allAttendance);
    },
    async deleteAttendance(day, id) {
      if (!day || !id) {
        throw new Error("اليوم ورقم الطالب مطلوبان للحذف.");
      }
      const allAttendance = parseJson(ATTENDANCE_KEY, {});
      if (!allAttendance[day] || typeof allAttendance[day] !== "object") {
        return;
      }
      const dayRecords = { ...allAttendance[day] };
      if (dayRecords[id]) {
        delete dayRecords[id];
        if (Object.keys(dayRecords).length === 0) {
          delete allAttendance[day];
        } else {
          allAttendance[day] = dayRecords;
        }
        writeJson(ATTENDANCE_KEY, allAttendance);
      }
    },
    async getLateAggregates(studentId) {
      if (!studentId) {
        return { daysLate: 0, totalLateMinutes: 0, todayLateMinutes: 0 };
      }
      return calculateLateAggregates(studentId);
    },
    async getAttendanceRange(options) {
      return collectAttendanceRange(options);
    },
    async getPermissionsDay(day) {
      if (typeof day !== "string" || day.trim() === "") {
        throw new Error("اليوم مطلوب كقيمة نصية ISO.");
      }
      const map = readPermissionsMap();
      const list = map[day] || [];
      return list.map((entry) => ({ ...entry }));
    },
    async addPermission(entry) {
      const normalized = normalizePermissionEntry(entry);
      if (!normalized) {
        throw new Error("بيانات الاستئذان غير صالحة.");
      }
      const map = readPermissionsMap();
      const day = normalized.createdAt.slice(0, 10);
      const bucket = map[day] ? [...map[day]] : [];
      bucket.push(normalized);
      bucket.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      map[day] = bucket;
      writePermissionsMap(map);
      return { ...normalized };
    },
    async getPermissionsRange(options) {
      return collectPermissionsRange(options);
    },
    async flushQueue() {
      return;
    },
    async exportSnapshot() {
      const [students, settings] = await Promise.all([store.getStudents(), store.getSettings()]);
      const attendanceRaw = parseJson(ATTENDANCE_KEY, {});
      const attendance = {};
      Object.entries(attendanceRaw || {}).forEach(([day, records]) => {
        if (!records || typeof records !== "object") return;
        attendance[day] = { ...records };
      });
      const permissions = readPermissionsMap();
      const permissionsCopy = {};
      Object.entries(permissions).forEach(([day, list]) => {
        permissionsCopy[day] = list.map((entry) => ({ ...entry }));
      });
      return {
        version: 1,
        generatedAt: new Date().toISOString(),
        storeType: "local",
        students,
        settings,
        attendance,
        permissions: permissionsCopy
      };
    },
    async importSnapshot(snapshot) {
      const normalized = normalizeSnapshot(snapshot);
      writeJson(STUDENTS_KEY, normalized.students);
      writeJson(SETTINGS_KEY, normalizeSettings(normalized.settings));
      writeJson(ATTENDANCE_KEY, normalized.attendance);
      writePermissionsMap(normalized.permissions);
    },
    setActiveSchoolId(nextId) {
      updateActiveSchoolId(nextId);
    },
    getActiveSchoolId() {
      return currentSchoolId();
    }
  };

  window.HaderStores = window.HaderStores || {};
  if (!window.HaderStores.nsKey) {
    window.HaderStores.nsKey = nsKeyHelper;
  }
  window.HaderStores.createLocalStore = function createLocalStore(options = {}) {
    updateActiveSchoolId(options.activeSchoolId);
    return store;
  };

  if (typeof window !== "undefined" && window.HaderBackendFactory?.registerBackend) {
    try {
      window.HaderBackendFactory.registerBackend("localstorage", {
        create(context = {}) {
          return window.HaderStores.createLocalStore({ activeSchoolId: context.schoolId });
        }
      });
    } catch (error) {
      console.warn("تعذّر تسجيل مزود LocalStorage في المصنع المركزي.", error);
    }
  }
})();
