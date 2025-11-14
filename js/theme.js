;(function () {
  const THEME_KEY = 'hader:themeMode'; // 'system' | 'light' | 'dark'
  const ACCENT_LIGHT_KEY = 'hader:accentLight';
  const ACCENT_DARK_KEY = 'hader:accentDark';

  let channel = null;
  if (typeof window.BroadcastChannel === 'function') {
    try {
      channel = new window.BroadcastChannel('hader-theme');
    } catch (error) {
      channel = null;
      console.warn('تعذّر إنشاء BroadcastChannel لمزامنة الثيم.', error);
    }
  }

  const root = document.documentElement;

  function prefersDark() {
    return (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || 'system';
  }

  function getStoredAccents() {
    const light = localStorage.getItem(ACCENT_LIGHT_KEY) || '#2563eb';
    const dark = localStorage.getItem(ACCENT_DARK_KEY) || '#2f80ed';
    return { light, dark };
  }

  function applyAccentForMode(mode) {
    const { light, dark } = getStoredAccents();
    if (mode === 'light') {
      root.style.setProperty('--adm-accent-light', light);
      root.style.setProperty('--adm-accent', light);
    } else {
      root.style.setProperty('--adm-accent-dark', dark);
      root.style.setProperty('--adm-accent', dark);
    }
  }

  function applyTheme(themeMode) {
    let mode = themeMode;
    if (mode === 'system') {
      mode = prefersDark() ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', mode);
    applyAccentForMode(mode);
  }

  function broadcast(message) {
    if (!channel) return;
    try {
      channel.postMessage(message);
    } catch (error) {
      console.warn('تعذّر إرسال رسالة BroadcastChannel.', error);
    }
  }

  function saveThemeMode(mode) {
    localStorage.setItem(THEME_KEY, mode);
    broadcast({ type: 'themeMode', payload: mode });
  }

  function saveAccentLight(color) {
    localStorage.setItem(ACCENT_LIGHT_KEY, color);
    broadcast({ type: 'accentLight', payload: color });
  }

  function saveAccentDark(color) {
    localStorage.setItem(ACCENT_DARK_KEY, color);
    broadcast({ type: 'accentDark', payload: color });
  }

  function init() {
    const mode = getStoredTheme();
    const { light, dark } = getStoredAccents();
    root.style.setProperty('--adm-accent-light', light);
    root.style.setProperty('--adm-accent-dark', dark);
    applyTheme(mode);
  }

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', () => {
        if (getStoredTheme() === 'system') {
          applyTheme('system');
        }
      });
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(() => {
        if (getStoredTheme() === 'system') {
          applyTheme('system');
        }
      });
    }
  }

  if (channel) {
    const handler = (event) => {
      const msg = event.data || {};
      if (msg.type === 'themeMode') {
        applyTheme(getStoredTheme());
      }
      if (msg.type === 'accentLight' || msg.type === 'accentDark') {
        const mode = root.getAttribute('data-theme') || 'dark';
        applyAccentForMode(mode);
      }
    };

    if (typeof channel.addEventListener === 'function') {
      channel.addEventListener('message', handler);
    } else {
      channel.onmessage = handler;
    }
  }

  window.HaderTheme = {
    load: init,
    setTheme(mode) {
      saveThemeMode(mode);
      applyTheme(mode);
    },
    setAccentLight(color) {
      saveAccentLight(color);
      if ((root.getAttribute('data-theme') || '') === 'light') {
        applyAccentForMode('light');
      }
    },
    setAccentDark(color) {
      saveAccentDark(color);
      if ((root.getAttribute('data-theme') || '') !== 'light') {
        applyAccentForMode('dark');
      }
    },
    get themeMode() {
      return getStoredTheme();
    },
    get accents() {
      return getStoredAccents();
    }
  };

  init();
})();
