(function () {
  "use strict";

  const AVAILABLE_THEMES = Object.freeze(["light", "dark", "system"]);
  const LEGACY_THEME_MAP = Object.freeze({
    classic: "light",
    sunrise: "light",
    oasis: "light",
    forest: "light",
    midnight: "dark",
    custom: "light"
  });
  const DEFAULT_CUSTOM_COLORS = Object.freeze({
    background: "#0b1320",
    strong: "#2f80ed",
    muted: "#a7b2c7"
  });
  const STORAGE_KEY = "hader:theme";
  const CHANNEL_NAME = "hader-theme";
  const CARD_SHADOW_DEFAULT = "0 14px 35px rgba(15, 28, 43, 0.16)";
  const CARD_SHADOW_LIMITS = Object.freeze({ min: 0, max: 300 });
  const CARD_BORDER_WIDTH_LIMITS = Object.freeze({ min: 0, max: 12 });
  const WHITE = { r: 255, g: 255, b: 255 };
  const BLACK = { r: 0, g: 0, b: 0 };

  let state = readInitialState();
  let broadcast = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
  let prefersDarkMedia =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  if (prefersDarkMedia) {
    const handleSystemChange = () => {
      if (state.mode === "system") {
        applyTheme("system", { accent: state.accent, persist: false, skipStore: true });
      }
    };
    if (typeof prefersDarkMedia.addEventListener === "function") {
      prefersDarkMedia.addEventListener("change", handleSystemChange);
    } else if (typeof prefersDarkMedia.addListener === "function") {
      prefersDarkMedia.addListener(handleSystemChange);
    }
  }

  if (broadcast) {
    broadcast.addEventListener("message", (event) => {
      const payload = event?.data;
      if (!payload || typeof payload !== "object") return;
      if (payload.type !== "theme:update" || !payload.payload) return;
      const incoming = payload.payload;
      const mode = sanitizeTheme(incoming.mode);
      const accent = sanitizeColor(incoming.accent, state.accent);
      state = { mode, accent };
      applyTheme(mode, { accent, persist: false, skipStore: true });
    });
  }

  applyTheme(state.mode, { accent: state.accent, persist: false, skipStore: true });

  function readInitialState() {
    if (typeof localStorage === "undefined") {
      return { mode: "system", accent: DEFAULT_CUSTOM_COLORS.strong };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { mode: "system", accent: DEFAULT_CUSTOM_COLORS.strong };
      }
      const parsed = JSON.parse(raw);
      const mode = sanitizeTheme(parsed.mode);
      const accent = sanitizeColor(parsed.accent, DEFAULT_CUSTOM_COLORS.strong);
      return { mode, accent };
    } catch (error) {
      return { mode: "system", accent: DEFAULT_CUSTOM_COLORS.strong };
    }
  }

  function persistState(nextState) {
    state = { ...nextState };
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        /* تجاهل أي أخطاء في التخزين */
      }
    }
    if (broadcast) {
      try {
        broadcast.postMessage({ type: "theme:update", payload: state });
      } catch (error) {
        /* تجاهل أي أخطاء في البث */
      }
    }
  }

  function sanitizeTheme(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (AVAILABLE_THEMES.includes(raw)) {
      return raw;
    }
    if (LEGACY_THEME_MAP[raw]) {
      return LEGACY_THEME_MAP[raw];
    }
    return "system";
  }

  function sanitizeColor(value, fallback) {
    const base = typeof value === "string" ? value.trim() : "";
    if (base === "") {
      return fallback;
    }
    const normalized = base.startsWith("#") ? base.slice(1) : base;
    if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return `#${normalized.toLowerCase()}`;
    }
    return fallback;
  }

  function hexToRgb(hex) {
    const clean = sanitizeColor(hex, null);
    if (!clean) return null;
    const value = clean.slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return null;
    }
    return { r, g, b };
  }

  function rgbToHex(rgb) {
    if (!rgb) return DEFAULT_CUSTOM_COLORS.background;
    const toHex = (component) => {
      const clamped = Math.max(0, Math.min(255, Math.round(component)));
      const hex = clamped.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function mix(colorA, colorB, weight) {
    const amount = Math.max(0, Math.min(1, Number(weight)));
    return {
      r: colorA.r + (colorB.r - colorA.r) * amount,
      g: colorA.g + (colorB.g - colorA.g) * amount,
      b: colorA.b + (colorB.b - colorA.b) * amount
    };
  }

  function getLuminance(rgb) {
    if (!rgb) return 0;
    const transform = (channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const r = transform(rgb.r);
    const g = transform(rgb.g);
    const b = transform(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getReadableTextColor(rgb) {
    const luminance = getLuminance(rgb);
    return luminance > 0.55 ? "#041124" : "#ffffff";
  }

  function toRgbString(rgb) {
    return `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;
  }

  function toRgbaString(rgb, alpha) {
    const safeAlpha = Math.max(0, Math.min(1, alpha));
    return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${safeAlpha})`;
  }

  function resolveTheme(mode) {
    const normalized = sanitizeTheme(mode);
    if (normalized === "dark" || normalized === "light") {
      return normalized;
    }
    if (prefersDarkMedia) {
      return prefersDarkMedia.matches ? "dark" : "light";
    }
    return "light";
  }

  function dispatchThemeChange(detail) {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(new CustomEvent("hader:theme-change", { detail }));
    } catch (error) {
      /* تجاهل عدم دعم CustomEvent */
    }
  }

  function normalizeCustomColors(source) {
    const base = source && typeof source === "object" ? source : {};
    return {
      background: sanitizeColor(
        base.background || base.customThemeBackground || base.page || base.surface,
        DEFAULT_CUSTOM_COLORS.background
      ),
      strong: sanitizeColor(
        base.strong || base.accent || base.textStrong || base.customThemeTextStrong,
        DEFAULT_CUSTOM_COLORS.strong
      ),
      muted: sanitizeColor(
        base.muted || base.textMuted || base.customThemeTextMuted,
        DEFAULT_CUSTOM_COLORS.muted
      ),
      accent: sanitizeColor(
        base.accent || base.strong || base.textStrong || base.customThemeTextStrong,
        DEFAULT_CUSTOM_COLORS.strong
      )
    };
  }

  function applyTheme(mode, options) {
    const opts = options || {};
    const sanitizedMode = sanitizeTheme(mode ?? state.mode);
    const accentCandidate =
      opts.accent ??
      opts.customColors?.accent ??
      opts.customColors?.strong ??
      state.accent ??
      DEFAULT_CUSTOM_COLORS.strong;
    const accent = sanitizeColor(accentCandidate, state.accent ?? DEFAULT_CUSTOM_COLORS.strong);
    const root = typeof document !== "undefined" ? document.documentElement : null;
    const resolvedTheme = resolveTheme(sanitizedMode);

    if (root) {
      root.setAttribute("data-theme", resolvedTheme);
      root.dataset.themeMode = sanitizedMode;
      const accentRgb = hexToRgb(accent);
      if (accentRgb) {
        root.style.setProperty("--adm-accent", accent);
        root.style.setProperty("--adm-accent-rgb", toRgbString(accentRgb));
        const contrast = getReadableTextColor(accentRgb);
        root.style.setProperty("--adm-accent-contrast", contrast);
        root.style.setProperty("--btn-text", contrast);
        const accentMixBase = resolvedTheme === "dark" ? WHITE : BLACK;
        const accentMixRatio = resolvedTheme === "dark" ? 0.32 : 0.18;
        const accentSoft = mix(accentRgb, accentMixBase, accentMixRatio);
        root.style.setProperty("--brand-accent", rgbToHex(accentSoft));
        root.style.setProperty("--brand-accent-rgb", toRgbString(accentSoft));
        const overlayAlpha = resolvedTheme === "dark" ? 0.28 : 0.22;
        root.style.setProperty("--surface-overlay", toRgbaString(accentRgb, overlayAlpha));
        const overlayStrongAlpha = resolvedTheme === "dark" ? 0.36 : 0.3;
        root.style.setProperty("--surface-overlay-strong", toRgbaString(accentRgb, overlayStrongAlpha));
      }
    }

    state = { mode: sanitizedMode, accent };

    const shouldPersist = opts.persist !== false;
    if (shouldPersist && opts.skipStore !== true) {
      persistState(state);
    }

    if (opts.skipStore !== true) {
      dispatchThemeChange({ mode: sanitizedMode, accent, theme: resolvedTheme });
    }

    return sanitizedMode;
  }

  function clampNumber(value, limits, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const min = typeof limits?.min === "number" ? limits.min : Number.NEGATIVE_INFINITY;
    const max = typeof limits?.max === "number" ? limits.max : Number.POSITIVE_INFINITY;
    const clamped = Math.min(Math.max(numeric, min), max);
    return Number.isFinite(clamped) ? clamped : fallback;
  }

  function parseShadowColor(shadowString) {
    if (typeof shadowString !== "string" || shadowString.trim() === "") {
      return null;
    }
    const match = shadowString.match(/rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/i);
    if (!match) {
      return null;
    }
    const [rgbaExpression, r, g, b, a] = match;
    const prefixIndex = shadowString.indexOf(rgbaExpression);
    if (prefixIndex < 0) {
      return null;
    }
    const prefix = shadowString.slice(0, prefixIndex);
    const suffix = shadowString.slice(prefixIndex + rgbaExpression.length);
    return {
      prefix,
      suffix,
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: Number(a)
    };
  }

  function buildShadowWithAlpha(baseShadow, alphaMultiplier) {
    const parsed = parseShadowColor(baseShadow || CARD_SHADOW_DEFAULT);
    if (!parsed) {
      return baseShadow || CARD_SHADOW_DEFAULT;
    }
    const baseAlpha = Number.isFinite(parsed.a) ? parsed.a : 0.16;
    const normalizedMultiplier = Math.max(
      CARD_SHADOW_LIMITS.min,
      Math.min(CARD_SHADOW_LIMITS.max, alphaMultiplier ?? 100)
    );
    const appliedAlpha = Math.max(0, Math.min(1, (baseAlpha * normalizedMultiplier) / 100));
    const roundedAlpha = Math.round(appliedAlpha * 1000) / 1000;
    return `${parsed.prefix}rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${roundedAlpha})${parsed.suffix}`;
  }

  function sanitizeBorderWidth(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    if (numeric < CARD_BORDER_WIDTH_LIMITS.min || numeric > CARD_BORDER_WIDTH_LIMITS.max) {
      return null;
    }
    return Math.round(numeric * 100) / 100;
  }

  function normalizeCardDecorations(source, defaults = {}) {
    const base = source && typeof source === "object" ? source : {};
    const fallbackIntensity = Number.isFinite(defaults.shadowIntensity)
      ? defaults.shadowIntensity
      : CARD_SHADOW_LIMITS.max >= 100 && CARD_SHADOW_LIMITS.min <= 100
      ? 100
      : CARD_SHADOW_LIMITS.min;
    const intensity = clampNumber(
      base.shadowIntensity ?? base.uiCardShadowIntensity ?? fallbackIntensity,
      CARD_SHADOW_LIMITS,
      fallbackIntensity
    );
    const rawColor = base.borderColor ?? base.uiCardBorderColor ?? defaults.borderColor ?? null;
    const color = rawColor ? sanitizeColor(rawColor, null) : null;
    const borderWidth = sanitizeBorderWidth(
      base.borderWidth ?? base.uiCardBorderWidth ?? defaults.borderWidth ?? null
    );
    return {
      shadowIntensity: intensity,
      borderColor: color,
      borderWidth
    };
  }

  function applyCardDecorations(options) {
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (!root) return;
    const normalized = normalizeCardDecorations(options, {
      shadowIntensity: 100,
      borderColor: null,
      borderWidth: null
    });
    const computed = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(root) : null;
    const baseShadow = computed?.getPropertyValue("--shadow-soft")?.trim() || CARD_SHADOW_DEFAULT;
    const updatedShadow = buildShadowWithAlpha(baseShadow, normalized.shadowIntensity);
    if (normalized.shadowIntensity == null || Math.abs(normalized.shadowIntensity - 100) < 0.001) {
      root.style.removeProperty("--surface-card-shadow");
    } else {
      root.style.setProperty("--surface-card-shadow", updatedShadow);
    }
    if (normalized.borderColor) {
      root.style.setProperty("--surface-card-border-color", normalized.borderColor);
    } else {
      root.style.removeProperty("--surface-card-border-color");
    }
    if (normalized.borderWidth != null) {
      root.style.setProperty("--surface-card-border-width", `${normalized.borderWidth}px`);
    } else {
      root.style.removeProperty("--surface-card-border-width");
    }
  }

  function getState() {
    return { mode: state.mode, accent: state.accent, theme: resolveTheme(state.mode) };
  }

  function setThemeMode(mode, options = {}) {
    const sanitizedMode = sanitizeTheme(mode);
    const accent = options.accent ? sanitizeColor(options.accent, state.accent) : state.accent;
    return applyTheme(sanitizedMode, { accent, persist: true });
  }

  function setAccent(accentColor) {
    const accent = sanitizeColor(accentColor, state.accent ?? DEFAULT_CUSTOM_COLORS.strong);
    return applyTheme(state.mode, { accent, persist: true });
  }

  function setPreferences(preferences) {
    const next = preferences && typeof preferences === "object" ? preferences : {};
    const mode = sanitizeTheme(next.mode ?? state.mode);
    const accent = sanitizeColor(next.accent, state.accent ?? DEFAULT_CUSTOM_COLORS.strong);
    return applyTheme(mode, { accent, persist: true });
  }

  window.HaderTheme = Object.freeze({
    AVAILABLE_THEMES,
    DEFAULT_CUSTOM_COLORS,
    sanitizeTheme,
    sanitizeColor,
    normalizeCustomColors,
    applyTheme,
    normalizeCardDecorations,
    applyCardDecorations,
    CARD_SHADOW_LIMITS,
    CARD_BORDER_WIDTH_LIMITS,
    getState,
    setThemeMode,
    setAccent,
    setPreferences
  });
})();
