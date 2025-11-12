(function () {
  "use strict";

  const AVAILABLE_THEMES = Object.freeze(["classic", "sunrise", "oasis", "forest", "midnight", "custom"]);
  const DEFAULT_CUSTOM_COLORS = Object.freeze({
    background: "#f4f6fb",
    strong: "#0f1c2b",
    muted: "#4f637b"
  });

  const WHITE = { r: 255, g: 255, b: 255 };
  const BLACK = { r: 0, g: 0, b: 0 };
  const CUSTOM_PROPERTY_KEYS = [
    "--custom-color-scheme",
    "--custom-surface-page",
    "--custom-surface-card",
    "--custom-surface-overlay",
    "--custom-border-soft",
    "--custom-brand-primary",
    "--custom-brand-primary-rgb",
    "--custom-brand-primary-contrast",
    "--custom-brand-accent",
    "--custom-brand-accent-rgb",
    "--custom-text-strong",
    "--custom-text-muted",
    "--custom-text-inverse",
    "--custom-shadow-soft",
    "--custom-hero-overlay-strong",
    "--custom-hero-overlay-soft",
    "--custom-hero-glow-start",
    "--custom-hero-glow-end"
  ];

  const CARD_SHADOW_DEFAULT = "0 14px 35px rgba(15, 28, 43, 0.16)";
  const CARD_SHADOW_LIMITS = Object.freeze({ min: 0, max: 300 });
  const CARD_BORDER_WIDTH_LIMITS = Object.freeze({ min: 0, max: 12 });

  function sanitizeTheme(value) {
    const theme = typeof value === "string" ? value.trim() : "";
    return AVAILABLE_THEMES.includes(theme) ? theme : "classic";
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

  function normalizeCustomColors(source) {
    const fallback = DEFAULT_CUSTOM_COLORS;
    if (!source || typeof source !== "object") {
      return { ...fallback };
    }
    return {
      background: sanitizeColor(
        source.background || source.customThemeBackground || source.page || source.surface,
        fallback.background
      ),
      strong: sanitizeColor(
        source.strong || source.textStrong || source.customThemeTextStrong,
        fallback.strong
      ),
      muted: sanitizeColor(
        source.muted || source.textMuted || source.customThemeTextMuted,
        fallback.muted
      )
    };
  }

  function buildPalette(colors) {
    const normalized = normalizeCustomColors(colors);
    const backgroundRgb = hexToRgb(normalized.background) || hexToRgb(DEFAULT_CUSTOM_COLORS.background);
    const strongRgb = hexToRgb(normalized.strong) || hexToRgb(DEFAULT_CUSTOM_COLORS.strong);
    const mutedRgb = hexToRgb(normalized.muted) || hexToRgb(DEFAULT_CUSTOM_COLORS.muted);

    const isDarkBackground = getLuminance(backgroundRgb) < 0.45;
    const cardMix = isDarkBackground ? 0.24 : 0.9;
    const borderMix = isDarkBackground ? 0.35 : 0.16;

    const cardRgb = mix(backgroundRgb, WHITE, cardMix);
    const borderRgb = isDarkBackground ? mix(backgroundRgb, WHITE, borderMix) : mix(backgroundRgb, BLACK, borderMix);

    const brandPrimaryRgb = strongRgb;
    const brandAccentRgb = isDarkBackground
      ? mix(brandPrimaryRgb, WHITE, 0.35)
      : mix(brandPrimaryRgb, backgroundRgb, 0.35);

    const overlayAlpha = isDarkBackground ? 0.62 : 0.72;
    const shadowAlpha = isDarkBackground ? 0.42 : 0.18;
    const glowEndBase = mix(brandPrimaryRgb, brandAccentRgb, 0.5);

    const brandContrastHex = getReadableTextColor(brandPrimaryRgb);

    return {
      "--custom-color-scheme": isDarkBackground ? "dark" : "light",
      "--custom-surface-page": rgbToHex(backgroundRgb),
      "--custom-surface-card": rgbToHex(cardRgb),
      "--custom-surface-overlay": toRgbaString(brandPrimaryRgb, overlayAlpha),
      "--custom-border-soft": rgbToHex(borderRgb),
      "--custom-brand-primary": rgbToHex(brandPrimaryRgb),
      "--custom-brand-primary-rgb": toRgbString(brandPrimaryRgb),
      "--custom-brand-primary-contrast": brandContrastHex,
      "--custom-brand-accent": rgbToHex(brandAccentRgb),
      "--custom-brand-accent-rgb": toRgbString(brandAccentRgb),
      "--custom-text-strong": rgbToHex(strongRgb),
      "--custom-text-muted": rgbToHex(mutedRgb),
      "--custom-text-inverse": brandContrastHex,
      "--custom-shadow-soft": `0 14px 35px rgba(${toRgbString(brandPrimaryRgb)}, ${shadowAlpha})`,
      "--custom-hero-overlay-strong": toRgbaString(brandPrimaryRgb, isDarkBackground ? 0.78 : 0.92),
      "--custom-hero-overlay-soft": toRgbaString(brandPrimaryRgb, isDarkBackground ? 0.58 : 0.72),
      "--custom-hero-glow-start": toRgbaString(brandPrimaryRgb, isDarkBackground ? 0.62 : 0.8),
      "--custom-hero-glow-end": toRgbaString(glowEndBase, isDarkBackground ? 0.48 : 0.62)
    };
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
    const normalizedMultiplier = Math.max(CARD_SHADOW_LIMITS.min, Math.min(CARD_SHADOW_LIMITS.max, alphaMultiplier ?? 100));
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
    const normalized = normalizeCardDecorations(options, { shadowIntensity: 100, borderColor: null, borderWidth: null });
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

  function setCustomProperties(root, palette) {
    if (!root || !palette) return;
    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  function clearCustomProperties(root) {
    if (!root) return;
    CUSTOM_PROPERTY_KEYS.forEach((key) => {
      root.style.removeProperty(key);
    });
  }

  function applyTheme(themeName, options) {
    const normalized = sanitizeTheme(themeName);
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (!root) {
      return normalized;
    }
    if (normalized === "custom") {
      const palette = buildPalette(options?.customColors || {});
      setCustomProperties(root, palette);
      root.dataset.theme = "custom";
    } else {
      clearCustomProperties(root);
      root.dataset.theme = normalized;
    }
    return normalized;
  }

  window.HaderTheme = Object.freeze({
    AVAILABLE_THEMES,
    DEFAULT_CUSTOM_COLORS,
    sanitizeTheme,
    sanitizeColor,
    normalizeCustomColors,
    applyTheme,
    buildPalette,
    clearCustomProperties,
    normalizeCardDecorations,
    applyCardDecorations,
    CARD_SHADOW_LIMITS,
    CARD_BORDER_WIDTH_LIMITS
  });
})();
