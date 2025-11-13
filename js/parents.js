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
  const FALLBACK_THEMES = Object.freeze(["classic", "sunrise", "oasis", "forest", "midnight", "custom"]);
  const AVAILABLE_THEMES = THEME_LIBRARY?.AVAILABLE_THEMES || FALLBACK_THEMES;
  const DEFAULT_CUSTOM_THEME =
    THEME_LIBRARY?.DEFAULT_CUSTOM_COLORS || Object.freeze({ background: "#f4f6fb", strong: "#0f1c2b", muted: "#4f637b" });
  const CARD_SHADOW_LIMITS = THEME_LIBRARY?.CARD_SHADOW_LIMITS || Object.freeze({ min: 0, max: 300 });
  const CARD_BORDER_WIDTH_LIMITS = THEME_LIBRARY?.CARD_BORDER_WIDTH_LIMITS || Object.freeze({ min: 0, max: 12 });

  const DEFAULT_SETTINGS = Object.freeze({
    uiTheme: "classic",
    schoolName: "",
    customThemeBackground: DEFAULT_CUSTOM_THEME.background,
    customThemeTextStrong: DEFAULT_CUSTOM_THEME.strong,
    customThemeTextMuted: DEFAULT_CUSTOM_THEME.muted,
    uiCardShadowIntensity: 100,
    uiCardBorderColor: null,
    uiCardBorderWidth: null,
    statusCardAutoHideMinutes: 3
  });
  const CHANNEL_NAME = "hader-settings";

  const schoolNameNodes = Array.from(document.querySelectorAll("[data-school-name]"));

  let settings = readSettings();
  applyTheme(settings.uiTheme);
  updateSchoolName(settings.schoolName);
  subscribeToUpdates();

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

  function normalizeTheme(theme) {
    if (typeof THEME_LIBRARY?.sanitizeTheme === "function") {
      return THEME_LIBRARY.sanitizeTheme(theme);
    }
    const value = typeof theme === "string" ? theme.trim() : "";
    return AVAILABLE_THEMES.includes(value) ? value : DEFAULT_SETTINGS.uiTheme;
  }

  function normalizeSettingsObject(input) {
    const source = input && typeof input === "object" ? input : {};
    const merged = { ...DEFAULT_SETTINGS, ...source };
    const colors = normalizeCustomThemeColors(merged);
    merged.customThemeBackground = colors.background;
    merged.customThemeTextStrong = colors.strong;
    merged.customThemeTextMuted = colors.muted;
    const theme = normalizeTheme(merged.uiTheme || merged.theme);
    merged.uiTheme = theme;
    merged.theme = theme;
    const decorations = normalizeCardDecorations(merged);
    merged.uiCardShadowIntensity = decorations.shadowIntensity;
    merged.uiCardBorderColor = decorations.borderColor;
    merged.uiCardBorderWidth = decorations.borderWidth;
    return merged;
  }

  function readSettings() {
    try {
      const raw = readSchoolItem("aa_settings");
      if (!raw) {
        return normalizeSettingsObject({});
      }
      const parsed = JSON.parse(raw);
      return normalizeSettingsObject(parsed);
    } catch (error) {
      console.warn("تعذّر قراءة إعدادات الواجهة.", error);
      return normalizeSettingsObject({});
    }
  }

  function sanitizeTheme(theme) {
    return normalizeTheme(theme);
  }

  function applyTheme(theme) {
    const normalized = normalizeTheme(theme);
    const colors = normalizeCustomThemeColors(settings);
    if (typeof THEME_LIBRARY?.applyTheme === "function") {
      THEME_LIBRARY.applyTheme(normalized, { customColors: colors });
    } else if (document?.documentElement) {
      document.documentElement.setAttribute("data-theme", normalized);
    }
    applyCardDecorationsFromSettings(settings);
  }

  function subscribeToUpdates() {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
    channel?.addEventListener("message", (event) => {
      if (event?.data?.type === "settings-updated" && event.data.payload) {
        settings = normalizeSettingsObject({ ...settings, ...event.data.payload });
        applyTheme(settings.uiTheme);
        updateSchoolName(settings.schoolName);
      }
    });

    window.addEventListener("storage", (event) => {
      if (matchesSchoolKey(event.key, "aa_settings") && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          settings = normalizeSettingsObject(parsed);
          applyTheme(settings.uiTheme);
          updateSchoolName(settings.schoolName);
        } catch (error) {
          console.warn("تعذّر مزامنة إعدادات الواجهة.", error);
        }
      }
    });
  }

  function updateSchoolName(name) {
    const clean = typeof name === "string" ? name.trim() : "";
    const hasName = clean !== "";
    const fallback = "اسم المدرسة غير محدد";
    schoolNameNodes.forEach((node) => {
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
})();
