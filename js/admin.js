import {
  dl_fetchAttendance,
  dl_fetchStudents,
  dl_fetchTopLatecomers,
  dl_fetchClassCompliance,
  dl_fetchSensitivePeriods,
  DL_GRADE_OPTIONS,
  DL_CLASS_OPTIONS,
  DL_STATUS_OPTIONS
} from './data-layer.js';

(function () {
  'use strict';

  if (typeof window.__unsaved === 'undefined') {
    window.__unsaved = false;
  }

  window.addEventListener('beforeunload', (event) => {
    if (window.__unsaved) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  function ensureAriaLiveRegion() {
    if (document.querySelector('[data-aria-live]')) {
      return;
    }
    const live = document.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.dataset.ariaLive = '1';
    live.style.position = 'fixed';
    live.style.left = '-9999px';
    document.body.appendChild(live);
  }

  function announce(message) {
    const region = document.querySelector('[data-aria-live]');
    if (region) {
      region.textContent = message || '';
    }
  }

  let __focusTrapCleanup = null;
  let __focusTrapRestore = null;
  let __toastTimer = null;

  function showToast(message, type = 'success', duration = 2000) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    if (__toastTimer) {
      clearTimeout(__toastTimer);
      __toastTimer = null;
    }

    toast.className = `toast ${type}`;
    toast.textContent = message;

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    __toastTimer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  let __lastThemeWarningAccent = null;
  window.addEventListener('hader:theme-low-contrast', (event) => {
    const accent = typeof event?.detail?.accent === 'string' ? event.detail.accent.toLowerCase() : null;
    if (accent && accent === __lastThemeWarningAccent) {
      event.preventDefault();
      return;
    }
    __lastThemeWarningAccent = accent;
    showToast('ملاحظة: قد يكون التباين منخفض. جرّب لونًا أغمق.', 'warning', 3200);
    event.preventDefault();
  });

  function showLoading(v = true) {
    const overlay = document.getElementById('loading');
    if (!overlay) {
      return;
    }
    overlay.classList.toggle('show', Boolean(v));
  }

  function markUnsaved() {
    window.__unsaved = true;
  }

  function clearUnsaved() {
    window.__unsaved = false;
  }

  // إدارة حالة نافذة معلومات الاتصال في بطاقة حالة التخزين
  const connectionPopoverState = {
    popover: null,
    button: null,
    closeButton: null,
    hideTimer: null,
    outsideHandler: null,
    escapeHandler: null
  };

  const diagnosticContext = {
    container: null,
    button: null
  };

  // فتح نافذة حالة الاتصال مع تفعيل طبقة الضباب
  function openConnectionInfo() {
    const { popover, button } = connectionPopoverState;
    if (!popover || popover.classList.contains('is-visible')) {
      return;
    }

    if (connectionPopoverState.hideTimer) {
      clearTimeout(connectionPopoverState.hideTimer);
      connectionPopoverState.hideTimer = null;
    }

    popover.hidden = false;
    requestAnimationFrame(() => {
      popover.classList.add('is-visible');
    });

    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('is-active');
    }

    const closeButton = connectionPopoverState.closeButton || popover.querySelector('[data-connection-close]');
    if (closeButton && typeof closeButton.focus === 'function') {
      closeButton.focus({ preventScroll: true });
    }

    connectionPopoverState.outsideHandler = (event) => {
      const target = event.target;
      if (!popover.contains(target) && target !== button) {
        closeConnectionInfo();
      }
    };

    connectionPopoverState.escapeHandler = (event) => {
      if (event.key === 'Escape') {
        closeConnectionInfo();
      }
    };

    window.addEventListener('pointerdown', connectionPopoverState.outsideHandler, true);
    window.addEventListener('keydown', connectionPopoverState.escapeHandler);
  }

  // إغلاق نافذة حالة الاتصال وإزالة المستمعات الجانبية
  function closeConnectionInfo() {
    const { popover, button, outsideHandler, escapeHandler } = connectionPopoverState;
    if (!popover || !popover.classList.contains('is-visible')) {
      return;
    }

    popover.classList.remove('is-visible');
    connectionPopoverState.hideTimer = window.setTimeout(() => {
      popover.hidden = true;
      connectionPopoverState.hideTimer = null;
    }, 180);

    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('is-active');
      button.focus({ preventScroll: true });
    }

    if (outsideHandler) {
      window.removeEventListener('pointerdown', outsideHandler, true);
      connectionPopoverState.outsideHandler = null;
    }

    if (escapeHandler) {
      window.removeEventListener('keydown', escapeHandler);
      connectionPopoverState.escapeHandler = null;
    }
  }

  window.openConnectionInfo = openConnectionInfo;
  window.closeConnectionInfo = closeConnectionInfo;

  // تهيئة بطاقة الاتصال وإعداد أزرار المساعدة
  function initConnectionHelpCard() {
    const popover = document.querySelector('[data-connection-popover]');
    const button = document.querySelector('[data-connection-help]');
    const closeButton = document.querySelector('[data-connection-close]');

    if (!popover || !button) {
      return;
    }

    connectionPopoverState.popover = popover;
    connectionPopoverState.button = button;
    connectionPopoverState.closeButton = closeButton || null;

    const handleToggle = (event) => {
      event.preventDefault();
      if (popover.classList.contains('is-visible')) {
        closeConnectionInfo();
      } else {
        openConnectionInfo();
      }
    };

    button.addEventListener('click', handleToggle);

    if (closeButton) {
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        closeConnectionInfo();
      });
    }

    popover.addEventListener('click', (event) => {
      if (event.target === popover) {
        closeConnectionInfo();
      }
    });
  }

  function renderEmpty(container, msg = 'لا توجد بيانات حالياً.') {
    if (!container) {
      return;
    }

    if (container.tagName === 'TABLE') {
      const tbody = container.querySelector('tbody');
      const columns = container.querySelector('thead tr')?.children.length || 1;
      if (tbody) {
        tbody.innerHTML = '';
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columns || 999;
        td.innerHTML = `<div class="empty">${msg}</div>`;
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      return;
    }

    container.innerHTML = `<div class="empty">${msg}</div>`;
  }

  function showSkeletonRows(tbody, n = 8) {
    if (!tbody) {
      return;
    }

    tbody.innerHTML = '';
    for (let i = 0; i < n; i += 1) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td colspan="999"><div class="skeleton"><div class="skel-row"></div></div></td>';
      tbody.appendChild(tr);
    }
  }

  function maskSaPhone(input) {
    if (!input) {
      return;
    }

    const digitsOnly = input.value.replace(/[^\d]/g, '');
    let nextValue = digitsOnly;
    if (!nextValue.startsWith('966')) {
      nextValue = `966${nextValue}`;
    }

    input.value = nextValue;
  }

  function validateStudent({ name, grade, class: className, classroom, guardianPhone }) {
    const errors = {};
    const safeName = (name || '').trim();
    const safeGrade = (grade || '').trim();
    const safeClass = ((classroom !== undefined ? classroom : className) || '').trim();
    const digits = (guardianPhone || '').replace(/[^\d]/g, '');

    if (!safeName) {
      errors.name = 'يرجى إدخال اسم الطالب.';
    }

    if (!safeGrade) {
      errors.grade = 'يرجى اختيار الصف.';
    }

    if (!safeClass) {
      errors.class = 'يرجى اختيار الفصل.';
    }

    if (!digits) {
      errors.guardianPhone = 'يرجى إدخال رقم ولي الأمر.';
    } else if (!/^966\d{9}$/.test(digits)) {
      errors.guardianPhone = 'يرجى إدخال رقم ولي الأمر بشكل صحيح.';
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors
    };
  }

  function makeTableSortable(thead, rowsGetter, onUpdate) {
    if (!thead || typeof rowsGetter !== 'function' || typeof onUpdate !== 'function') {
      return null;
    }

    if (thead.sortableControls) {
      return thead.sortableControls;
    }

    const sortHeaders = Array.from(thead.querySelectorAll('th[data-sort-key]'));
    if (!sortHeaders.length) {
      return null;
    }

    let state = {
      key: null,
      direction: 'asc'
    };

    const updateHeaderIndicators = () => {
      sortHeaders.forEach((th) => {
        const key = th.dataset.sortKey || '';
        const isActive = key && state.key === key;
        const direction = isActive ? state.direction : '';
        th.dataset.sortDirection = direction;
        th.setAttribute('aria-sort', isActive ? (direction === 'desc' ? 'descending' : 'ascending') : 'none');
      });
    };

    const coerceValue = (value) => {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'number') {
        return value;
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      const stringValue = String(value).trim();
      if (!stringValue) {
        return '';
      }
      const numericValue = Number(stringValue);
      if (!Number.isNaN(numericValue) && /^-?\d+(\.\d+)?$/.test(stringValue)) {
        return numericValue;
      }
      return stringValue;
    };

    const sortRows = (rows, key, direction) => {
      if (!key) {
        return rows;
      }

      const sorted = rows.slice();
      sorted.sort((a, b) => {
        const aRaw = a && Object.prototype.hasOwnProperty.call(a, key) ? a[key] : '';
        const bRaw = b && Object.prototype.hasOwnProperty.call(b, key) ? b[key] : '';
        const aValue = coerceValue(aRaw);
        const bValue = coerceValue(bRaw);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'desc' ? bValue - aValue : aValue - bValue;
        }

        const aString = String(aValue);
        const bString = String(bValue);
        const comparison = aString.localeCompare(bString, 'ar', { sensitivity: 'base', numeric: true });
        return direction === 'desc' ? -comparison : comparison;
      });
      return sorted;
    };

    const runSort = (key, direction, reason) => {
      const baseRows = rowsGetter();
      const rows = Array.isArray(baseRows) ? baseRows.slice() : [];
      const safeKey = key || null;
      const safeDirection = direction === 'desc' ? 'desc' : 'asc';
      state = {
        key: safeKey,
        direction: safeDirection
      };
      const output = safeKey ? sortRows(rows, safeKey, safeDirection) : rows;
      updateHeaderIndicators();
      onUpdate(output, { ...state }, reason || 'refresh');
    };

    sortHeaders.forEach((th) => {
      const key = th.dataset.sortKey;
      if (!key) {
        return;
      }
      const label = th.textContent || '';
      th.textContent = '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'th-sort';
      button.setAttribute('aria-label', `فرز حسب ${label}`);
      button.innerHTML = `<span>${label}</span>`;
      button.addEventListener('click', () => {
        let nextDirection = 'asc';
        if (state.key === key) {
          nextDirection = state.direction === 'asc' ? 'desc' : 'asc';
        }
        runSort(key, nextDirection, 'user');
      });
      th.appendChild(button);
      th.setAttribute('aria-sort', 'none');
    });

    updateHeaderIndicators();

    const api = {
      refresh() {
        runSort(state.key, state.direction, 'refresh');
      },
      clear() {
        state = { key: null, direction: 'asc' };
        runSort(state.key, state.direction, 'refresh');
      },
      state() {
        return { ...state };
      }
    };

    thead.sortableControls = api;
    return api;
  }

  function buildPaginator(container, options = {}) {
    if (!container) {
      return null;
    }

    if (container.paginator) {
      return container.paginator;
    }

    const state = {
      page: Math.max(1, Number.parseInt(options.page, 10) || 1),
      perPage: Math.max(1, Number.parseInt(options.perPage, 10) || 20),
      total: Math.max(0, Number.parseInt(options.total, 10) || 0)
    };
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

    container.innerHTML = '';
    container.classList.add('table-pagination');

    const info = document.createElement('div');
    info.className = 'table-pagination__info';

    const actions = document.createElement('div');
    actions.className = 'table-pagination__actions';

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'btn';
    prevButton.textContent = 'السابق';

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'btn';
    nextButton.textContent = 'التالي';

    actions.append(prevButton, nextButton);
    container.append(info, actions);

    const totalPages = () => (state.total > 0 ? Math.ceil(state.total / state.perPage) : 1);

    const clampPage = (page) => {
      const pages = totalPages();
      if (pages <= 0) {
        return 1;
      }
      return Math.min(Math.max(1, page || 1), pages);
    };

    const render = () => {
      state.page = clampPage(state.page);
      const pages = totalPages();
      info.textContent = `الصفحة ${state.page} من ${pages}`;
      const isDisabled = pages <= 1;
      prevButton.disabled = isDisabled || state.page <= 1;
      nextButton.disabled = isDisabled || state.page >= pages;
    };

    const emit = () => {
      onChange({
        page: state.page,
        perPage: state.perPage,
        total: state.total,
        totalPages: totalPages()
      });
    };

    prevButton.addEventListener('click', () => {
      if (state.page <= 1) {
        return;
      }
      state.page -= 1;
      render();
      emit();
    });

    nextButton.addEventListener('click', () => {
      const pages = totalPages();
      if (state.page >= pages) {
        return;
      }
      state.page += 1;
      render();
      emit();
    });

    render();

    const api = {
      update(newOptions = {}) {
        if (Object.prototype.hasOwnProperty.call(newOptions, 'perPage')) {
          const parsedPerPage = Number.parseInt(newOptions.perPage, 10);
          if (!Number.isNaN(parsedPerPage) && parsedPerPage > 0) {
            state.perPage = parsedPerPage;
          }
        }
        if (Object.prototype.hasOwnProperty.call(newOptions, 'total')) {
          const parsedTotal = Number.parseInt(newOptions.total, 10);
          if (!Number.isNaN(parsedTotal) && parsedTotal >= 0) {
            state.total = parsedTotal;
          }
        }
        if (Object.prototype.hasOwnProperty.call(newOptions, 'page')) {
          const parsedPage = Number.parseInt(newOptions.page, 10);
          if (!Number.isNaN(parsedPage) && parsedPage >= 1) {
            state.page = parsedPage;
          }
        }
        render();
        return {
          page: state.page,
          perPage: state.perPage,
          total: state.total,
          totalPages: totalPages()
        };
      },
      state() {
        return {
          page: state.page,
          perPage: state.perPage,
          total: state.total,
          totalPages: totalPages()
        };
      }
    };

    container.paginator = api;
    return api;
  }

  function debounce(fn, delay = 250) {
    let timer = null;
    return function debounced(...args) {
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = null;
        fn.apply(this, args);
      }, delay);
    };
  }

  function scrollSubtabIntoView(button) {
    if (button && typeof button.scrollIntoView === 'function') {
      button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  let _sparkPrev = null;

  function drawBarsSmooth(canvas, values) {
    if (!canvas || !Array.isArray(values) || values.length === 0) {
      return;
    }

    if (!canvas.width) {
      const estimatedWidth = Math.round(canvas.getBoundingClientRect().width) || 320;
      canvas.width = Math.max(160, estimatedWidth);
    }

    if (!canvas.height) {
      const preferredHeight = Number.parseInt(canvas.dataset.height || '', 10) || 120;
      canvas.height = Math.max(80, preferredHeight);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const max = Math.max(1, ...values.map((value) => Number(value) || 0));
    const padding = 8;
    const barWidth = (width - padding * 2) / values.length;
    const previousValues = Array.isArray(_sparkPrev) && _sparkPrev.length === values.length
      ? _sparkPrev
      : values.map(() => 0);
    const steps = 20;
    let step = 0;

    function frame() {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.lineWidth = 1;

      for (let grid = 1; grid <= 4; grid += 1) {
        const y = padding + ((height - padding * 2) * grid) / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      for (let index = 0; index < values.length; index += 1) {
        const target = Number(values[index]) || 0;
        const previous = Number(previousValues[index]) || 0;
        const interpolated = previous + ((target - previous) * step) / steps;
        const barHeight = (height - padding * 2) * (interpolated / max || 0);
        const x = padding + index * barWidth + 2;
        const y = height - padding - barHeight;
        ctx.fillStyle = 'rgba(47,128,237,.75)';
        ctx.fillRect(x, y, Math.max(2, barWidth - 4), barHeight);
      }

      if (step < steps) {
        step += 1;
        requestAnimationFrame(frame);
      } else {
        _sparkPrev = values.slice();
      }
    }

    frame();
  }

  function resizeSparkCanvas(canvas, preferredHeight = 120) {
    if (!canvas) {
      return;
    }

    let width = Math.round(canvas.getBoundingClientRect().width);
    if (!width || Number.isNaN(width)) {
      const parent = canvas.parentElement;
      width = parent ? Math.round(parent.clientWidth || parent.offsetWidth || 0) : 0;
    }

    if (!width || Number.isNaN(width) || width < 160) {
      width = 320;
    }

    let height = Number.parseInt(canvas.dataset.height || '', 10);
    if (!Number.isFinite(height) || height <= 0) {
      height = preferredHeight;
    }

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
  }

  function generateSparkSeries(length = 12, base = 48, variance = 18) {
    const series = [];
    let current = base + Math.random() * variance;

    for (let index = 0; index < length; index += 1) {
      const delta = (Math.random() - 0.5) * variance;
      current = Math.max(0, current + delta);
      series.push(Math.round(current));
    }

    return series;
  }

  function parseSeriesFromDataset(source) {
    if (typeof source !== 'string' || !source.trim()) {
      return null;
    }

    const values = source
      .split(',')
      .map((value) => Number.parseFloat(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0);

    return values.length ? values : null;
  }

  function computeSeriesStats(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return { max: 0, min: 0, avg: 0, total: 0 };
    }

    const numeric = values.map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));
    const total = numeric.reduce((sum, value) => sum + value, 0);
    const max = Math.max(...numeric);
    const min = Math.min(...numeric);
    const avg = numeric.length > 0 ? total / numeric.length : 0;

    return { max, min, avg, total };
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return '0';
    }

    try {
      return value.toLocaleString('ar-EG');
    } catch (error) {
      return String(Math.round(value));
    }
  }

  function trapFocus(modalEl) {
    if (!modalEl) {
      return;
    }

    releaseFocus();

    const focusable = modalEl.querySelectorAll(
      'a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    const first = focusable.length > 0 ? focusable[0] : modalEl;
    const last = focusable.length > 0 ? focusable[focusable.length - 1] : first;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function onKey(event) {
      if (event.key !== 'Tab') {
        return;
      }
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          if (last && typeof last.focus === 'function') {
            last.focus();
          }
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        if (first && typeof first.focus === 'function') {
          first.focus();
        }
      }
    }

    modalEl.addEventListener('keydown', onKey);
    __focusTrapCleanup = () => {
      modalEl.removeEventListener('keydown', onKey);
    };
    __focusTrapRestore = previous;

    if (first && typeof first.focus === 'function') {
      first.focus();
    } else if (typeof modalEl.focus === 'function') {
      modalEl.focus();
    }
  }

  function releaseFocus() {
    if (__focusTrapCleanup) {
      __focusTrapCleanup();
      __focusTrapCleanup = null;
    }

    if (__focusTrapRestore && typeof __focusTrapRestore.focus === 'function') {
      try {
        __focusTrapRestore.focus();
      } catch (error) {
        console.warn('تعذّر إعادة التركيز إلى العنصر السابق.', error);
      }
    }

    __focusTrapRestore = null;
  }

  function showModal(modalEl) {
    if (!modalEl) {
      return;
    }

    document.body.appendChild(modalEl);

    requestAnimationFrame(() => {
      ensureAriaLiveRegion();
      if (typeof modalEl.showModal === 'function') {
        modalEl.showModal();
      } else {
        modalEl.setAttribute('open', 'open');
      }
      trapFocus(modalEl);
      announce('تم فتح نافذة.');
    });
  }

  function closeModal(modalEl) {
    if (!modalEl) {
      return;
    }

    releaseFocus();
    announce('تم إغلاق النافذة.');

    if (typeof modalEl.close === 'function' && modalEl.open) {
      try {
        modalEl.close();
      } catch (error) {
        console.warn('تعذّر إغلاق عنصر <dialog> برمجيًا.', error);
      }
    }

    if (modalEl.parentElement) {
      modalEl.remove();
    }
  }

  function showShortcutsModal() {
    const existing = document.querySelector('dialog[data-role="shortcuts-modal"]');
    if (existing) {
      if (!existing.open) {
        showModal(existing);
      }
      return;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'modal shortcuts-modal';
    dialog.dataset.role = 'shortcuts-modal';

    const header = document.createElement('div');
    header.className = 'modal__header';
    const heading = document.createElement('h3');
    heading.textContent = 'اختصارات لوحة المفاتيح';
    header.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'modal__body';
    const list = document.createElement('ul');
    list.style.lineHeight = '1.8';
    list.innerHTML = [
      '<li><b>Ctrl + ← / →</b> التنقّل بين التبويبات الفرعية</li>',
      '<li><b>Esc</b> إغلاق أي نافذة</li>',
      '<li><b>F</b> تركيز البحث الحالي (إن وجد)</li>',
      '<li><b>?</b> عرض هذه القائمة</li>'
    ].join('');
    body.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    footer.style.textAlign = 'end';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn';
    closeButton.dataset.action = 'close';
    closeButton.textContent = 'إغلاق';
    footer.appendChild(closeButton);

    dialog.append(header, body, footer);

    closeButton.addEventListener('click', () => {
      dialog.close();
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      dialog.close();
    });

    dialog.addEventListener('close', () => {
      closeModal(dialog);
    });

    showModal(dialog);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      showShortcutsModal();
    }
  });

  const SUBTAB_CONFIG = {
    overview: ["نظرة سريعة", "الأسبوعي/الشهري", "الأبطال", "الفصول المميّزة"],
    students: ["قائمة الطلاب", "إضافة/تحرير", "استيراد وتدقيق", "سجل التعديلات"],
    settings: [
      "هوية المدرسة",
      "التوقيت والضوابط",
      "مشاركة المشرفين (سحابي)",
      "المظهر",
      "مظهر الحضور (الكشك)",
      "نمط البطاقات",
      "مقاييس الواجهة",
      "الدوران والعرض",
      "رسائل الواجهة",
      "أصوات الحالات",
      "شاشة التوقف"
    ],
    attendance: ["سجل اليوم", "استعلامات جاهزة", "تصدير"],
    reports: ["مولّد التقارير", "قوالب محفوظة"],
    backup: ["أخذ نسخة", "استرجاع نسخة"],
    help: ["أدوات تشخيص النظام", "تحت التطوير"],
    about: ["تحت التطوير"],
    'smart-tools': ["تحت التطوير"]
  };

  const SUBTAB_BUILDERS = {
    overview: {
      "نظرة سريعة": buildOverviewQuickSubtab,
      "الأسبوعي/الشهري": buildOverviewPeriodSubtab
    },
    students: {
      "قائمة الطلاب": buildStudentsListSubtab,
      "إضافة/تحرير": buildStudentsManageSubtab,
      "استيراد وتدقيق": buildStudentsImportSubtab,
      "سجل التعديلات": buildStudentsHistorySubtab
    },
    settings: {
      "هوية المدرسة": buildSettingsIdentitySubtab,
      "التوقيت والضوابط": buildSettingsTimingSubtab,
      "مشاركة المشرفين (سحابي)": buildSettingsRemoteSubtab,
      "المظهر": buildSettingsAppearanceSubtab,
      "مظهر الحضور (الكشك)": buildSettingsKioskAppearanceSubtab,
      "نمط البطاقات": buildSettingsCardStyleSubtab,
      "مقاييس الواجهة": buildSettingsScaleSubtab,
      "الدوران والعرض": buildSettingsDisplaySubtab
    },
    attendance: {
      "سجل اليوم": buildAttendanceDailyLogSubtab,
      "استعلامات جاهزة": buildAttendanceQueriesSubtab,
      "تصدير": buildAttendanceExportSubtab
    },
    reports: {
      "مولّد التقارير": buildReportsGeneratorSubtab,
      "قوالب محفوظة": buildReportsTemplatesSubtab
    },
    backup: {
      "أخذ نسخة": buildBackupExportSubtab,
      "استرجاع نسخة": buildBackupImportSubtab
    },
    help: {
      "أدوات تشخيص النظام": buildHelpDiagnosticsSubtab,
      "تحت التطوير": buildHelpWipSubtab
    },
    about: {
      "تحت التطوير": buildAboutWipSubtab
    },
    'smart-tools': {
      "تحت التطوير": buildSmartToolsWipSubtab
    }
  };

  const ATTENDANCE_GRADE_OPTIONS = DL_GRADE_OPTIONS;
  const ATTENDANCE_CLASS_OPTIONS = DL_CLASS_OPTIONS;
  const ATTENDANCE_STATUS_OPTIONS = DL_STATUS_OPTIONS;

  const REPORT_TYPE_OPTIONS = [
    { value: 'daily', label: 'يومي' },
    { value: 'weekly', label: 'أسبوعي' },
    { value: 'monthly', label: 'شهري' },
    { value: 'term', label: 'فصل دراسي' }
  ];

  const THEME_DEFAULT_ACCENT = '#2f80ed';
  const THEME_MODES = new Set(['system', 'light', 'dark']);

  function normalizeThemeMode(value) {
    if (typeof value !== 'string') {
      return 'system';
    }
    const mode = value.trim().toLowerCase();
    return THEME_MODES.has(mode) ? mode : 'system';
  }

  function normalizeAccentValue(value) {
    if (typeof value !== 'string') {
      return THEME_DEFAULT_ACCENT;
    }
    const accent = value.trim();
    if (/^#([0-9a-f]{6})$/i.test(accent)) {
      return accent;
    }
    if (/^#([0-9a-f]{3})$/i.test(accent)) {
      const [, short] = accent.match(/^#([0-9a-f]{3})$/i) || [];
      if (short) {
        const [r, g, b] = short.split('');
        return `#${r}${r}${g}${g}${b}${b}`;
      }
    }
    return THEME_DEFAULT_ACCENT;
  }

  const STUDENT_TABLE_COLUMNS = [
    { key: 'name', label: 'الاسم' },
    { key: 'grade', label: 'الصف' },
    { key: 'classroom', label: 'الفصل' },
    { key: 'guardian', label: 'ولي الأمر' },
    { key: 'updatedAt', label: 'آخر تحديث' }
  ];

  const ATTENDANCE_TABLE_COLUMNS = [
    { key: 'name', label: 'الطالب' },
    { key: 'grade', label: 'الصف' },
    { key: 'classroom', label: 'الفصل' },
    { key: 'status', label: 'الحالة' },
    { key: 'time', label: 'الوقت' }
  ];

  const STORAGE_KEYS = {
    activeTab: 'adminActiveTab',
    subtabPrefix: 'adminSubtab:'
  };

  const STUDENT_CHANGES_STORAGE_KEY = 'adminStudents:changes';
  const WIP_SUGGESTIONS_STORAGE_KEY = 'adminWip:suggestions';
  const ERROR_LOG_EVENT = 'adminLogs:errorsUpdated';
  const ERROR_LOG_STORAGE_KEY = 'adminLogs:errors';

  const state = {
    tabButtons: [],
    panels: [],
    subtabRegistry: new Map(),
    activeTabId: null,
    activeSubtabs: new Map(),
    reportsGeneratorRefs: null
  };

  let uniqueIdCounter = 0;

  function dispatchErrorLogUpdate(entries) {
    const payload = Array.isArray(entries) ? entries.slice() : [];
    window.dispatchEvent(
      new CustomEvent(ERROR_LOG_EVENT, {
        detail: payload
      })
    );
  }

  (function initGlobalErrorCapture() {
    function pushError(entry) {
      const current = readJSON(ERROR_LOG_STORAGE_KEY, []);
      const list = Array.isArray(current) ? current.slice() : [];
      list.push({ ts: Date.now(), ...entry });
      while (list.length > 50) {
        list.shift();
      }
      writeJSON(ERROR_LOG_STORAGE_KEY, list);
      dispatchErrorLogUpdate(getErrorLogEntries());
    }

    window.addEventListener('error', (event) => {
      if (!event) {
        return;
      }
      pushError({
        type: 'error',
        message: event.message || 'حدث خطأ غير معروف.',
        stack: event.error?.stack || ''
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (!event) {
        return;
      }
      const reason = event.reason;
      const message =
        typeof reason === 'string'
          ? reason
          : typeof reason?.message === 'string'
          ? reason.message
          : 'تم رفض وعد بدون معالج.';
      pushError({
        type: 'promise',
        message,
        stack: reason?.stack || ''
      });
    });
  })();

  function resolveActiveSchoolSlug() {
    const fromWindow = typeof window.HADER_ACTIVE_SLUG === 'string' ? window.HADER_ACTIVE_SLUG.trim() : '';
    if (fromWindow) {
      return fromWindow;
    }

    const fromDataset = typeof document?.body?.dataset?.schoolSlug === 'string'
      ? document.body.dataset.schoolSlug.trim()
      : '';
    if (fromDataset) {
      return fromDataset;
    }

    const host = window.location?.hostname || '';
    const parts = host.split('.').filter(Boolean);
    let slug = parts.length > 2 ? parts[0] : parts[0] || '';
    if (slug === 'www' || slug === 'localhost' || /^\d+$/.test(slug)) {
      slug = '';
    }
    return slug || 'default';
  }

  function resolveDefaultSchoolName() {
    const configs = window.HADER_SCHOOL_CONFIGS || {};
    const slug = resolveActiveSchoolSlug();
    const config = (slug && configs[slug]) || configs.default || {};
    const candidates = [
      config?.displayName,
      config?.name,
      config?.schoolName,
      config?.label,
      config?.title
    ];

    const chosen = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
    if (chosen) {
      return chosen.trim();
    }

    if (slug && slug !== 'default') {
      return slug;
    }

    return 'المدرسة الافتراضية';
  }

  function initAdminIdentity() {
    const identity = document.querySelector('.admin-identity');
    if (!identity) {
      return;
    }

    const schoolNameElement = identity.querySelector('[data-school-name]');
    if (schoolNameElement) {
      const currentName = (schoolNameElement.textContent || '').trim();
      const needsFallback =
        !currentName ||
        schoolNameElement.dataset.empty === 'true' ||
        currentName === 'اسم المدرسة غير محدد';

      if (needsFallback) {
        schoolNameElement.textContent = resolveDefaultSchoolName();
      }

      schoolNameElement.removeAttribute('data-empty');
    }

    const principalElement = identity.querySelector('[data-principal-name]');
    if (principalElement) {
      const principalName = (principalElement.textContent || '').trim();
      principalElement.hidden = principalName === '';
    }

    identity.removeAttribute('data-empty');
  }

  function initSessionActions() {
    const container = document.querySelector('.admin-header__session-actions');
    if (!container) {
      return;
    }

    let button = container.querySelector('[data-action="switch-school"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost';
      button.dataset.action = 'switch-school';
      button.textContent = 'تبديل المدرسة';
      button.addEventListener('click', handleSwitchSchoolClick);
      container.prepend(button);
    }
  }

  function handleSwitchSchoolClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    openSwitchSchoolModal();
  }

  function openSwitchSchoolModal() {
    const existing = document.querySelector('dialog[data-role="switch-school-modal"]');
    if (existing) {
      return;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'modal switch-school-modal';
    dialog.dataset.role = 'switch-school-modal';

    const header = document.createElement('div');
    header.className = 'modal__header';
    const heading = document.createElement('h3');
    heading.textContent = 'اختيار المدرسة';
    header.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'modal__body';
    const description = document.createElement('p');
    description.className = 'modal__description';
    description.textContent = 'الميزة قيد التطوير. اختر معرّف المدرسة من القائمة أدناه.';
    body.appendChild(description);

    const configs = window.HADER_SCHOOL_CONFIGS || {};
    const configKeys = Object.keys(configs);
    const uniqueSlugs = Array.from(new Set(configKeys.length > 0 ? configKeys : ['default']));
    const currentSlug = resolveActiveSchoolSlug();
    if (currentSlug && !uniqueSlugs.includes(currentSlug)) {
      uniqueSlugs.push(currentSlug);
    }

    if (uniqueSlugs.length > 0) {
      const list = document.createElement('ul');
      list.className = 'info-list';
      uniqueSlugs.forEach((slug) => {
        const normalized = typeof slug === 'string' && slug.trim() !== '' ? slug.trim() : 'default';
        const item = document.createElement('li');
        item.textContent =
          normalized === currentSlug ? `${normalized} (الحالي)` : normalized;
        list.appendChild(item);
      });
      body.appendChild(list);
    }

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn';
    closeButton.textContent = 'إغلاق';
    footer.appendChild(closeButton);

    dialog.append(header, body, footer);

    closeButton.addEventListener('click', () => {
      dialog.close();
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      dialog.close();
    });

    dialog.addEventListener('close', () => {
      closeModal(dialog);
    });

    showModal(dialog);
  }

  function init() {
    initAdminIdentity();
    initSessionActions();
    initConnectionHelpCard();
    state.tabButtons = Array.from(document.querySelectorAll('.admin-tabs__list .tab[data-tab]'));
    state.panels = Array.from(document.querySelectorAll('.tab-panel[data-panel]'));
    setupSettingsUnsavedTracking();

    if (state.tabButtons.length === 0 || state.panels.length === 0) {
      return;
    }

    state.tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activateTab(button.dataset.tab);
      });

      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateTab(button.dataset.tab);
        }
      });
    });

    state.panels.forEach((panel) => {
      const panelId = panel.dataset.panel;
      if (panelId) {
        initSubtabs(panelId);
      }
    });

    const storedTab = readActiveTabPreference();
    const fallbackTab = state.tabButtons[0]?.dataset?.tab || null;
    const initialTab = storedTab && findTabButton(storedTab) ? storedTab : fallbackTab;

    if (initialTab) {
      activateTab(initialTab);
    }

    document.addEventListener('keydown', handleGlobalShortcuts);
  }

  function initSubtabs(panelId) {
    if (!panelId) {
      return;
    }

    const panel = findPanel(panelId);
    if (!panel) {
      return;
    }

    const labels = Array.isArray(SUBTAB_CONFIG[panelId]) ? SUBTAB_CONFIG[panelId] : [];
    const tablist = panel.querySelector(".subtabs[role='tablist']");
    const defaultPanel = panel.querySelector(".subpanel[role='tabpanel'][data-panel='default']");

    if (!tablist || !defaultPanel) {
      state.subtabRegistry.set(panelId, new Map());
      return;
    }

    const existingPanels = panel.querySelectorAll(".subpanel[role='tabpanel']");
    existingPanels.forEach((node) => {
      if (node !== defaultPanel) {
        node.remove();
      }
    });

    tablist.innerHTML = '';
    tablist.setAttribute('aria-orientation', 'horizontal');

    const registry = new Map();
    state.subtabRegistry.set(panelId, registry);

    if (labels.length === 0) {
      defaultPanel.hidden = true;
      defaultPanel.innerHTML = '';
      return;
    }

    const template = defaultPanel.cloneNode(false);
    template.hidden = true;
    template.innerHTML = '';
    template.dataset.panel = '';

    let previousPanel = defaultPanel;

    labels.forEach((rawLabel, index) => {
      const label = normalizeLabel(rawLabel, index);
      const idSuffix = createSubtabId(panelId, label, index);
      const buttonId = `subtab-${idSuffix}`;
      const subpanelId = `subpanel-${idSuffix}`;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'subtab';
      button.setAttribute('role', 'tab');
      button.id = buttonId;
      button.dataset.subtab = label;
      button.setAttribute('aria-controls', subpanelId);
      button.setAttribute('aria-selected', 'false');
      button.tabIndex = -1;
      button.textContent = label;

      const builder = resolveSubtabBuilder(panelId, label);

      button.addEventListener('click', () => {
        ensureSubtabBuilt(panelId, label, builder);
        activateSubtab(panelId, label);
      });

      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          ensureSubtabBuilt(panelId, label, builder);
          activateSubtab(panelId, label);
        }
      });

      tablist.appendChild(button);

      const subpanel = index === 0 ? defaultPanel : template.cloneNode(false);
      if (index === 0) {
        subpanel.innerHTML = '';
      } else {
        previousPanel.insertAdjacentElement('afterend', subpanel);
      }

      subpanel.classList.add('subpanel');
      subpanel.setAttribute('role', 'tabpanel');
      subpanel.dataset.panel = label;
      subpanel.id = subpanelId;
      subpanel.setAttribute('aria-labelledby', buttonId);
      subpanel.hidden = true;

      registry.set(label, {
        id: label,
        button,
        panel: subpanel,
        builder,
        built: false
      });

      previousPanel = subpanel;
    });

    const storedSubtab = readSubtabPreference(panelId);
    const initialSubtab = storedSubtab && registry.has(storedSubtab)
      ? storedSubtab
      : registry.keys().next().value;

    if (initialSubtab) {
      ensureSubtabBuilt(panelId, initialSubtab, registry.get(initialSubtab)?.builder);
      activateSubtab(panelId, initialSubtab);
    }
  }

  function activateTab(tabId) {
    if (!tabId) {
      return;
    }

    const targetButton = findTabButton(tabId);
    const targetPanel = findPanel(tabId);

    if (!targetButton || !targetPanel) {
      return;
    }

    state.tabButtons.forEach((button) => {
      const isActive = button === targetButton;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    state.panels.forEach((panel) => {
      panel.hidden = panel !== targetPanel;
    });

    state.activeTabId = tabId;
    writeActiveTabPreference(tabId);

    const registry = state.subtabRegistry.get(tabId);
    if (!registry || registry.size === 0) {
      return;
    }

    const storedSubtab = readSubtabPreference(tabId);
    const firstSubtab = registry.keys().next().value;
    const targetSubtab = storedSubtab && registry.has(storedSubtab) ? storedSubtab : firstSubtab;

    if (targetSubtab) {
      ensureSubtabBuilt(tabId, targetSubtab, registry.get(targetSubtab)?.builder);
      activateSubtab(tabId, targetSubtab);
    }
  }

  function activateSubtab(panelId, subId) {
    if (!panelId || !subId) {
      return;
    }

    const registry = state.subtabRegistry.get(panelId);
    if (!registry) {
      return;
    }

    const entry = registry.get(subId);
    if (!entry) {
      return;
    }

    ensureSubtabBuilt(panelId, subId, entry.builder);

    registry.forEach((item, key) => {
      const isActive = key === subId;
      if (item.button) {
        item.button.setAttribute('aria-selected', String(isActive));
        item.button.tabIndex = isActive ? 0 : -1;
        if (isActive) {
          scrollSubtabIntoView(item.button);
        }
      }
      if (item.panel) {
        item.panel.hidden = !isActive;
      }
    });

    state.activeSubtabs.set(panelId, subId);
    writeSubtabPreference(panelId, subId);
  }

  function ensureSubtabBuilt(panelId, subId, builder) {
    if (!panelId || !subId) {
      return null;
    }

    const registry = state.subtabRegistry.get(panelId);
    if (!registry) {
      return null;
    }

    const entry = registry.get(subId);
    if (!entry) {
      return null;
    }

    if (typeof builder === 'function') {
      entry.builder = builder;
    }

    if (!entry.panel) {
      return null;
    }

    const panel = findPanel(panelId);

    if (!entry.built && typeof entry.builder === 'function') {
      entry.builder(panel, entry.panel, subId);
      entry.built = true;
    }

    return entry.panel;
  }


  function handleGlobalShortcuts(event) {
    if (event.defaultPrevented) {
      return;
    }

    if (event.key === 'Escape') {
      if (closeOpenDialogs()) {
        event.preventDefault();
      }
      return;
    }

    if (!event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    const panelId = state.activeTabId;
    if (!panelId) {
      return;
    }

    const registry = state.subtabRegistry.get(panelId);
    if (!registry || registry.size === 0) {
      return;
    }

    const ids = Array.from(registry.keys());
    const currentId = state.activeSubtabs.get(panelId) || ids[0];
    let currentIndex = ids.indexOf(currentId);
    if (currentIndex === -1) {
      currentIndex = 0;
    }

    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) {
      nextIndex = ids.length - 1;
    } else if (nextIndex >= ids.length) {
      nextIndex = 0;
    }

    const nextId = ids[nextIndex];
    if (!nextId || nextId === currentId) {
      return;
    }

    event.preventDefault();
    ensureSubtabBuilt(panelId, nextId, registry.get(nextId)?.builder);
    activateSubtab(panelId, nextId);
    const button = registry.get(nextId)?.button;
    if (button && typeof button.focus === 'function') {
      button.focus();
    }
  }

  function closeOpenDialogs() {
    const dialogs = Array.from(document.querySelectorAll('dialog[open]'));
    let closed = false;
    dialogs.forEach((dialog) => {
      if (typeof dialog.close === 'function') {
        dialog.close();
        closed = true;
      }
    });
    return closed;
  }

  function resolveSubtabBuilder(panelId, label) {
    const panelBuilders = SUBTAB_BUILDERS[panelId];
    const customBuilder = panelBuilders && panelBuilders[label];

    if (typeof customBuilder === 'function') {
      return customBuilder;
    }

    return (panel, target) => {
      buildPlaceholder(panel, target, label);
    };
  }

  function buildPlaceholder(panel, container, label) {
    if (!container) {
      return;
    }
    const safeLabel = escapeHtml(label);
    container.innerHTML = `
      <div class="cards-grid">
        <div class="card">قيد الإعداد: ${safeLabel}</div>
      </div>
    `;
  }


  function resolveFallbackValue(fallback) {
    if (typeof fallback === 'function') {
      return fallback();
    }
    if (Array.isArray(fallback)) {
      return fallback.slice();
    }
    if (fallback && typeof fallback === 'object') {
      return { ...fallback };
    }
    return fallback;
  }

  function getCssVar(name, fallback = '') {
    if (!name) {
      return fallback;
    }
    const root = document.documentElement;
    if (!root) {
      return fallback;
    }
    const styles = getComputedStyle(root);
    if (!styles) {
      return fallback;
    }
    const value = styles.getPropertyValue(name);
    if (!value) {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  function hexToRgb(hex) {
    if (typeof hex !== 'string') {
      return null;
    }

    let value = hex.trim();
    if (!value) {
      return null;
    }

    if (value.startsWith('#')) {
      value = value.slice(1);
    }

    if (value.length === 3) {
      value = value
        .split('')
        .map((ch) => ch + ch)
        .join('');
    }

    if (value.length !== 6) {
      return null;
    }

    const matches = value.match(/^[0-9a-f]{6}$/i);
    if (!matches) {
      return null;
    }

    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    if ([r, g, b].some((component) => Number.isNaN(component))) {
      return null;
    }

    return `${r}, ${g}, ${b}`;
  }

  function clampNumber(value, min, max) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return value;
    }
    let result = value;
    if (typeof min === 'number' && result < min) {
      result = min;
    }
    if (typeof max === 'number' && result > max) {
      result = max;
    }
    return result;
  }

  function uniqueId(prefix = 'uid') {
    uniqueIdCounter += 1;
    return `${prefix}-${uniqueIdCounter}`;
  }

  function setSelectValue(select, value) {
    if (!select) {
      return;
    }

    if (value === null || typeof value === 'undefined') {
      select.value = '';
      return;
    }

    const stringValue = String(value);
    const hasOption = Array.from(select.options || []).some((option) => option.value === stringValue);
    if (!hasOption && stringValue) {
      const option = document.createElement('option');
      option.value = stringValue;
      option.textContent = stringValue;
      select.appendChild(option);
    }
    select.value = stringValue;
  }

  function readJSON(key, fallback) {
    const fallbackValue = resolveFallbackValue(fallback);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallbackValue;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('تعذّر قراءة البيانات المخزنة.', error);
      return fallbackValue;
    }
  }

  function writeJSON(key, value) {
    try {
      if (typeof value === 'undefined') {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      console.warn('تعذّر حفظ البيانات في التخزين المحلي.', error);
      return false;
    }
  }

  function bindSaveRestore(sectionKey, options = {}) {
    const {
      saveButton,
      restoreButton,
      readValues,
      applyValues,
      fallback,
      statusElement,
      setStatus
    } = options;

    const updateStatus = typeof setStatus === 'function'
      ? setStatus
      : (message, state) => {
          if (!statusElement) {
            return;
          }
          statusElement.textContent = message || '';
          if (state) {
            statusElement.dataset.state = state;
          } else {
            statusElement.removeAttribute('data-state');
          }
        };

    if (saveButton && !saveButton.dataset.bound) {
      saveButton.addEventListener('click', () => {
        if (typeof readValues !== 'function') {
          return;
        }
        const payload = readValues();
        const success = writeJSON(sectionKey, payload);
        if (success) {
          clearUnsaved();
        } else {
          markUnsaved();
        }
        updateStatus(
          success ? 'تم حفظ الإعدادات بنجاح.' : 'تعذّر حفظ الإعدادات، تحقق من مساحة التخزين.',
          success ? 'success' : 'error'
        );
      });
      saveButton.dataset.bound = '1';
    }

    if (restoreButton && !restoreButton.dataset.bound) {
      restoreButton.addEventListener('click', () => {
        let payload = resolveFallbackValue(fallback);
        let hadValue = false;
        try {
          const raw = localStorage.getItem(sectionKey);
          if (raw) {
            payload = JSON.parse(raw);
            hadValue = true;
          }
        } catch (error) {
          console.warn('تعذّر استرجاع البيانات من التخزين المحلي.', error);
        }
        if (typeof applyValues === 'function') {
          applyValues(payload, hadValue);
        }
        clearUnsaved();
        updateStatus(
          hadValue ? 'تم استرجاع الإعدادات المخزنة.' : 'لا توجد بيانات محفوظة بعد.',
          hadValue ? 'info' : 'warning'
        );
      });
      restoreButton.dataset.bound = '1';
    }

    return {
      updateStatus
    };
  }


  function setupSettingsUnsavedTracking() {
    const panel = findPanel('settings');
    if (!panel || panel.dataset.unsavedTracking === '1') {
      return;
    }

    const handleDirty = (event) => {
      const target = event.target;
      if (!target) {
        return;
      }
      if (target.closest('[data-ignore-unsaved]')) {
        return;
      }
      if (
        target.matches('input, select, textarea, [contenteditable="true"]') &&
        !(target.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(target.type))
      ) {
        markUnsaved();
      }
    };

    panel.addEventListener('input', handleDirty, true);
    panel.addEventListener('change', handleDirty, true);
    panel.dataset.unsavedTracking = '1';
  }


  function buildOverviewQuickSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid overview-subtab-grid overview-subtab-grid--quick';

      const card = document.createElement('div');
      card.className = 'card overview-card overview-card--spark';
      card.innerHTML = `
        <header class="overview-card__header">
          <h3>مؤشر الحضور خلال الساعات الأولى</h3>
          <p class="form-hint">متابعة سريعة لنشاط تسجيل الحضور منذ بداية اليوم الدراسي.</p>
        </header>
        <canvas class="spark-canvas" data-role="quick-spark" data-height="136"></canvas>
        <div class="spark-meta" data-role="quick-meta">
          <div class="spark-meta__item">
            <span>المتوسط</span>
            <strong data-role="quick-avg">—</strong>
          </div>
          <div class="spark-meta__item">
            <span>الأعلى</span>
            <strong data-role="quick-max">—</strong>
          </div>
          <div class="spark-meta__item">
            <span>الأدنى</span>
            <strong data-role="quick-min">—</strong>
          </div>
        </div>
        <div class="form-actions" style="justify-content:flex-end; gap:8px;">
          <button type="button" class="btn" data-action="quick-refresh">تحديث البيانات</button>
        </div>
      `;

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const canvas = subpanel.querySelector('[data-role="quick-spark"]');
    if (!canvas) {
      return;
    }

    const avgElement = subpanel.querySelector('[data-role="quick-avg"]');
    const maxElement = subpanel.querySelector('[data-role="quick-max"]');
    const minElement = subpanel.querySelector('[data-role="quick-min"]');
    const refreshButton = subpanel.querySelector('[data-action="quick-refresh"]');

    const seriesFromDataset = () => parseSeriesFromDataset(canvas.dataset.series);

    const updateMeta = (values) => {
      const stats = computeSeriesStats(values);
      if (avgElement) {
        avgElement.textContent = formatNumber(Math.round(stats.avg));
      }
      if (maxElement) {
        maxElement.textContent = formatNumber(stats.max);
      }
      if (minElement) {
        minElement.textContent = formatNumber(stats.min);
      }
    };

    const render = (values) => {
      if (!Array.isArray(values) || values.length === 0) {
        return;
      }

      resizeSparkCanvas(canvas, 136);
      drawBarsSmooth(canvas, values);
      canvas.dataset.series = values.join(',');
      updateMeta(values);
    };

    let currentSeries = seriesFromDataset();
    if (!currentSeries) {
      currentSeries = generateSparkSeries(12, 52, 22);
    }

    render(currentSeries);

    if (refreshButton && !refreshButton.dataset.bound) {
      refreshButton.addEventListener('click', () => {
        currentSeries = generateSparkSeries(12, 52, 24);
        render(currentSeries);
        showToast('تم تحديث نظرة اليوم السريعة.', 'success');
      });
      refreshButton.dataset.bound = '1';
    }
  }


  function buildOverviewPeriodSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid overview-subtab-grid overview-subtab-grid--period';

      const card = document.createElement('div');
      card.className = 'card overview-card overview-card--spark';
      card.innerHTML = `
        <header class="overview-card__header">
          <h3>الاتجاه الأسبوعي / الشهري</h3>
          <p class="form-hint">مقارنة مرئية بين أداء الحضور خلال الأسبوع والشهر الحاليين.</p>
        </header>
        <div class="button-group" data-role="period-switcher">
          <button type="button" class="btn primary" data-period="weekly">الأسبوع الحالي</button>
          <button type="button" class="btn" data-period="monthly">الشهر الحالي</button>
        </div>
        <canvas class="spark-canvas" data-role="period-spark" data-height="160"></canvas>
        <div class="spark-meta" data-role="period-meta">
          <div class="spark-meta__item">
            <span>المتوسط</span>
            <strong data-role="period-avg">—</strong>
          </div>
          <div class="spark-meta__item">
            <span>الأعلى</span>
            <strong data-role="period-max">—</strong>
          </div>
          <div class="spark-meta__item">
            <span>الإجمالي</span>
            <strong data-role="period-total">—</strong>
          </div>
        </div>
        <div class="form-actions" style="justify-content:flex-end; gap:8px;">
          <button type="button" class="btn" data-action="period-refresh">تحديث البيانات</button>
        </div>
      `;

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const canvas = subpanel.querySelector('[data-role="period-spark"]');
    const switchButtons = Array.from(subpanel.querySelectorAll('[data-period]'));
    const avgElement = subpanel.querySelector('[data-role="period-avg"]');
    const maxElement = subpanel.querySelector('[data-role="period-max"]');
    const totalElement = subpanel.querySelector('[data-role="period-total"]');
    const refreshButton = subpanel.querySelector('[data-action="period-refresh"]');

    if (!canvas || switchButtons.length === 0) {
      return;
    }

    const ensureSeries = (key) => {
      const attr = canvas.dataset[`${key}Series`];
      const parsed = parseSeriesFromDataset(attr);
      if (parsed && parsed.length > 0) {
        return parsed;
      }

      const length = key === 'weekly' ? 7 : 12;
      const base = key === 'weekly' ? 54 : 60;
      const variance = key === 'weekly' ? 18 : 26;
      const generated = generateSparkSeries(length, base, variance);
      canvas.dataset[`${key}Series`] = generated.join(',');
      return generated;
    };

    const updateMeta = (values) => {
      const stats = computeSeriesStats(values);
      if (avgElement) {
        avgElement.textContent = formatNumber(Math.round(stats.avg));
      }
      if (maxElement) {
        maxElement.textContent = formatNumber(stats.max);
      }
      if (totalElement) {
        totalElement.textContent = formatNumber(stats.total);
      }
    };

    let activeKey = canvas.dataset.activeSeries || 'weekly';

    const render = (key) => {
      activeKey = key;
      canvas.dataset.activeSeries = key;

      switchButtons.forEach((button) => {
        const isActive = button.dataset.period === key;
        button.classList.toggle('primary', isActive);
      });

      const series = ensureSeries(key);
      resizeSparkCanvas(canvas, 160);
      drawBarsSmooth(canvas, series);
      updateMeta(series);
    };

    render(activeKey);

    switchButtons.forEach((button) => {
      if (button.dataset.bound) {
        return;
      }
      button.addEventListener('click', () => {
        const key = button.dataset.period || 'weekly';
        render(key);
      });
      button.dataset.bound = '1';
    });

    if (refreshButton && !refreshButton.dataset.bound) {
      refreshButton.addEventListener('click', () => {
        const length = activeKey === 'weekly' ? 7 : 12;
        const base = activeKey === 'weekly' ? 54 : 60;
        const variance = activeKey === 'weekly' ? 18 : 26;
        const updated = generateSparkSeries(length, base, variance);
        canvas.dataset[`${activeKey}Series`] = updated.join(',');
        render(activeKey);
        showToast('تم تحديث بيانات الاتجاه الحالي.', 'success');
      });
      refreshButton.dataset.bound = '1';
    }
  }


  function buildStudentsListSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card students-card students-card--list';

      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';

      const searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.className = 'input toolbar__search';
      searchInput.placeholder = 'بحث بالاسم أو ولي الأمر';
      searchInput.setAttribute('aria-label', 'بحث بالاسم أو ولي الأمر');
      searchInput.dataset.role = 'students-search';

      const actions = document.createElement('div');
      actions.className = 'toolbar__actions';

      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'btn';
      refreshButton.textContent = 'تحديث';
      refreshButton.dataset.action = 'students-refresh';

      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.className = 'btn primary';
      exportButton.textContent = 'تصدير CSV';
      exportButton.dataset.action = 'students-export';

      actions.append(refreshButton, exportButton);
      toolbar.append(searchInput, actions);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-wrap students-table';

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      STUDENT_TABLE_COLUMNS.forEach((column) => {
        const th = document.createElement('th');
        th.textContent = column.label;
        if (column.key === 'name') {
          th.dataset.sortKey = 'name';
        } else if (column.key === 'grade') {
          th.dataset.sortKey = 'grade';
        } else if (column.key === 'classroom') {
          th.dataset.sortKey = 'class';
        } else if (column.key === 'updatedAt') {
          th.dataset.sortKey = 'updatedAt';
        }
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      const tbody = document.createElement('tbody');
      tbody.dataset.studentTable = '1';
      table.append(thead, tbody);
      tableWrap.appendChild(table);

      const pagination = document.createElement('div');
      pagination.dataset.role = 'students-pagination';

      card.append(toolbar, tableWrap, pagination);
      grid.appendChild(card);
      subpanel.appendChild(grid);

      subpanel.dataset._built = '1';
    }

    const searchInput = subpanel.querySelector('[data-role="students-search"]');
    const refreshButton = subpanel.querySelector('[data-action="students-refresh"]');
    const exportButton = subpanel.querySelector('[data-action="students-export"]');
    const tableBody = subpanel.querySelector('.students-table tbody');
    const table = subpanel.querySelector('.students-table table');
    const thead = table ? table.querySelector('thead') : null;
    const paginatorContainer = subpanel.querySelector('[data-role="students-pagination"]');

    if (!tableBody || !searchInput) {
      return;
    }

    const PER_PAGE = 20;
    let cachedRows = [];
    let filteredRows = [];
    let displayRows = [];
    let lastEmptyMessage = 'لا توجد بيانات لعرضها حالياً.';
    let currentPage = 1;

    let renderPage = () => {};

    const paginator = paginatorContainer
      ? buildPaginator(paginatorContainer, {
        page: 1,
        perPage: PER_PAGE,
        total: 0,
        onChange: ({ page }) => {
          currentPage = page;
          renderPage();
        }
      })
      : null;

    const sorter = thead
      ? makeTableSortable(thead, () => filteredRows.slice(), (rows, sortState, reason) => {
        displayRows = Array.isArray(rows) ? rows.slice() : [];
        if (reason === 'user') {
          currentPage = 1;
        }
        if (!sortState || !sortState.key) {
          // When no active sort, fall back to the filtered order.
          displayRows = filteredRows.slice();
        }
        renderPage();
      })
      : null;

    renderPage = () => {
      const rows = Array.isArray(displayRows) && displayRows.length
        ? displayRows
        : filteredRows.slice();
      const totalItems = rows.length;

      if (!totalItems) {
        tableBody.innerHTML = '';
        renderEmpty(tableBody.parentElement, lastEmptyMessage);
        if (paginator) {
          paginator.update({ total: 0, page: 1 });
        }
        return;
      }

      const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      const start = (currentPage - 1) * PER_PAGE;
      const pageRows = rows.slice(start, start + PER_PAGE);

      renderTableRows(tableBody, pageRows, STUDENT_TABLE_COLUMNS);
      if (paginator) {
        const updated = paginator.update({ total: totalItems, page: currentPage });
        currentPage = updated.page;
      }
    };

    const applyFilters = () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        filteredRows = cachedRows.slice();
        lastEmptyMessage = 'لا توجد بيانات لعرضها حالياً.';
      } else {
        filteredRows = cachedRows.filter((row) => {
          const haystack = [row.name, row.guardian]
            .map((value) => String(value || '').toLowerCase())
            .join(' ');
          return haystack.includes(query);
        });
        lastEmptyMessage = 'لا توجد نتائج مطابقة لبحثك حالياً.';
      }
      displayRows = filteredRows.slice();
      currentPage = 1;
      if (sorter) {
        sorter.refresh();
      } else {
        renderPage();
      }
    };

    const refresh = async () => {
      showSkeletonRows(tableBody);
      displayRows = [];
      if (paginator) {
        paginator.update({ total: 0, page: 1 });
      }
      try {
        const rows = await dl_fetchStudents();
        cachedRows = Array.isArray(rows)
          ? rows.map((row) => ({
            ...row,
            class: row.classroom,
            updatedAt: formatDateTime(row.updatedAt)
          }))
          : [];
      } catch (error) {
        console.error('تعذّر تحميل قائمة الطلاب.', error);
        cachedRows = [];
        filteredRows = [];
        displayRows = [];
        lastEmptyMessage = 'تعذّر تحميل قائمة الطلاب حالياً.';
        tableBody.innerHTML = '';
        renderEmpty(tableBody.parentElement, lastEmptyMessage);
        if (paginator) {
          paginator.update({ total: 0, page: 1 });
        }
        showToast('تعذّر تحميل قائمة الطلاب حالياً.', 'error');
        return;
      }
      applyFilters();
    };

    if (!searchInput.dataset.bound) {
      const debouncedApply = debounce(applyFilters, 250);
      searchInput.addEventListener('input', debouncedApply);
      searchInput.dataset.bound = '1';
    }

    if (refreshButton && !refreshButton.dataset.bound) {
      refreshButton.addEventListener('click', refresh);
      refreshButton.dataset.bound = '1';
    }

    if (exportButton && !exportButton.dataset.bound) {
      exportButton.addEventListener('click', () => {
        if (!displayRows.length) {
          showToast('لا توجد بيانات للتصدير حالياً.', 'error');
          return;
        }
        try {
          exportToCSV(displayRows, STUDENT_TABLE_COLUMNS, createTimestampedFilename('students', 'csv'));
        } catch (error) {
          console.error('تعذّر تصدير قائمة الطلاب.', error);
          showToast('تعذّر تصدير قائمة الطلاب حالياً.', 'error');
        }
      });
      exportButton.dataset.bound = '1';
    }

    if (!subpanel.dataset._initialized) {
      refresh();
      subpanel.dataset._initialized = '1';
    } else {
      applyFilters();
    }
  }


  function buildStudentsManageSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card students-card students-card--manage';
      card.innerHTML = `
        <h3>إدارة الطلاب</h3>
        <p class="form-hint">أضف أو حدّث بيانات الطلاب بسرعة، وستبقى التعديلات محفوظة محليًا حتى اعتمادها.</p>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="student-add">إضافة طالب</button>
        </div>
        <p class="form-hint" data-role="student-manage-status"></p>
        <div class="students-changes" data-role="students-changes">
          <h4>آخر التعديلات</h4>
          <ul class="info-list" data-role="students-changes-list"></ul>
          <p class="form-hint" data-role="students-changes-empty">لم تُسجّل تعديلات بعد.</p>
        </div>
      `;

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const addButton = subpanel.querySelector('[data-action="student-add"]');
    const statusElement = subpanel.querySelector('[data-role="student-manage-status"]');
    const listElement = subpanel.querySelector('[data-role="students-changes-list"]');
    const emptyElement = subpanel.querySelector('[data-role="students-changes-empty"]');

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const renderChanges = () => {
      const changes = readStudentChanges();
      if (!listElement) {
        return;
      }
      listElement.innerHTML = '';
      const recent = changes.slice(0, 6);
      if (recent.length === 0) {
        if (emptyElement) {
          emptyElement.hidden = false;
        }
        return;
      }
      if (emptyElement) {
        emptyElement.hidden = true;
      }
      recent.forEach((entry) => {
        const item = document.createElement('li');
        item.innerHTML = `
          <strong>${escapeHtml(entry.name || 'بدون اسم')}</strong>
          <span>الصف: ${escapeHtml(entry.grade || '—')} · الفصل: ${escapeHtml(entry.classroom || '—')}</span>
          <span>آخر تعديل: ${escapeHtml(formatDateTime(entry.timestamp))}</span>
        `;
        listElement.appendChild(item);
      });
    };

    const handleSubmit = (payload) => {
      const change = {
        id: uniqueId('student-change'),
        type: 'إضافة',
        name: payload.name,
        grade: payload.grade,
        classroom: payload.classroom,
        guardian: payload.guardian,
        phone: payload.phone,
        performer: 'مشرف النظام',
        timestamp: new Date().toISOString()
      };

      const current = readStudentChanges();
      current.unshift(change);
      const trimmed = current.slice(0, 40);
      const success = writeJSON(STUDENT_CHANGES_STORAGE_KEY, trimmed);
      if (success) {
        updateStatus('تم حفظ بيانات الطالب مؤقتًا.', 'success');
        renderChanges();
        notifyStudentChangesUpdated();
      } else {
        updateStatus('تعذّر حفظ التعديل في التخزين المحلي.', 'error');
      }
    };

    if (addButton && !addButton.dataset.bound) {
      addButton.addEventListener('click', () => {
        openStudentFormModal({
          title: 'إضافة طالب',
          onSubmit: (values) => {
            handleSubmit(values);
          }
        });
      });
      addButton.dataset.bound = '1';
    }

    if (!subpanel.dataset._listeners) {
      window.addEventListener('adminStudentsChangesUpdated', renderChanges);
      subpanel.dataset._listeners = '1';
    }

    renderChanges();
  }


  function buildStudentsImportSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card students-card students-card--import';
      card.innerHTML = `
        <h3>استيراد وتدقيق</h3>
        <p class="form-hint">قم برفع ملف CSV لمراجعته قبل الدمج داخل النظام.</p>
        <div class="field-grid">
          <label class="field">
            <span>ملف CSV للطلاب</span>
            <input type="file" class="input" accept=".csv" data-role="students-import-file" />
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" data-action="students-import-preview">معاينة</button>
        </div>
        <div class="table-wrap students-import-table">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الصف</th>
                <th>الفصل</th>
                <th>ولي الأمر</th>
                <th>مطابقة/مكرّر؟</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="students-import-merge">دمج المقترحات</button>
        </div>
        <p class="form-hint" data-role="students-import-status"></p>
      `;

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const fileInput = subpanel.querySelector('[data-role="students-import-file"]');
    const previewButton = subpanel.querySelector('[data-action="students-import-preview"]');
    const mergeButton = subpanel.querySelector('[data-action="students-import-merge"]');
    const statusElement = subpanel.querySelector('[data-role="students-import-status"]');
    const tableBody = subpanel.querySelector('.students-import-table tbody');

    let previewRows = [];

    const setStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const renderPreview = () => {
      if (!tableBody) {
        return;
      }
      const columns = [
        { key: 'name', label: 'الاسم' },
        { key: 'grade', label: 'الصف' },
        { key: 'classroom', label: 'الفصل' },
        { key: 'guardian', label: 'ولي الأمر' },
        { key: 'duplicateLabel', label: 'مطابقة/مكرّر؟' }
      ];
      const rows = previewRows.map((row) => ({
        ...row,
        duplicateLabel: row.duplicate ? 'مكرّر' : 'جديد'
      }));
      renderTableRows(tableBody, rows, columns);
    };

    const buildPreviewRows = async () => {
      if (tableBody) {
        showSkeletonRows(tableBody);
      }
      try {
        const base = await dl_fetchStudents();
        const sample = Array.isArray(base)
          ? base.slice(0, 10).map((row, index) => ({
            name: row.name,
            grade: row.grade,
            classroom: row.classroom,
            guardian: row.guardian,
            index
          }))
          : [];
        previewRows = detectDuplicates(sample);
        renderPreview();
        return true;
      } catch (error) {
        console.error('تعذّر إنشاء معاينة الاستيراد.', error);
        previewRows = [];
        renderPreview();
        showToast('تعذّر إنشاء المعاينة حالياً.', 'error');
        return false;
      }
    };

    if (previewButton && !previewButton.dataset.bound) {
      previewButton.addEventListener('click', async () => {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          setStatus('اختر ملف CSV أولاً لإجراء المعاينة.', 'warning');
          return;
        }
        setStatus('جاري إنشاء المعاينة…', 'loading');
        const ok = await buildPreviewRows();
        setStatus(ok ? 'تم توليد المعاينة المبدئية للملف.' : 'تعذّر إنشاء المعاينة.', ok ? 'info' : 'error');
      });
      previewButton.dataset.bound = '1';
    }

    if (mergeButton && !mergeButton.dataset.bound) {
      mergeButton.addEventListener('click', async () => {
        if (!previewRows.length) {
          setStatus('لا توجد بيانات جاهزة للدمج حالياً.', 'warning');
          return;
        }
        setStatus('جاري دمج المقترحات…', 'loading');
        showLoading(true);
        try {
          await new Promise((resolve) => window.setTimeout(resolve, 600));
          setStatus('تم دمج المقترحات بنجاح (Placeholder).', 'success');
        } catch (error) {
          console.error('تعذّر دمج بيانات CSV.', error);
          setStatus('تعذّر إتمام عملية الدمج حالياً.', 'error');
        } finally {
          showLoading(false);
        }
      });
      mergeButton.dataset.bound = '1';
    }

    if (fileInput && !fileInput.dataset.bound) {
      fileInput.addEventListener('change', () => {
        if (statusElement) {
          statusElement.textContent = '';
          statusElement.removeAttribute('data-state');
        }
        previewRows = [];
        renderPreview();
      });
      fileInput.dataset.bound = '1';
    }

    renderPreview();
  }


  function buildStudentsHistorySubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card students-card students-card--history';
      card.innerHTML = `
        <h3>سجل التعديلات</h3>
        <p class="form-hint">يعرض هذا السجل أحدث التغييرات التي تمت على بيانات الطلاب من خلال هذه الواجهة.</p>
        <div class="table-wrap students-history-table">
          <table>
            <thead>
              <tr>
                <th>العملية</th>
                <th>الوقت</th>
                <th>المنفّذ</th>
                <th>تفاصيل</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" data-action="students-history-clear">تنظيف السجل</button>
        </div>
        <p class="form-hint" data-role="students-history-status"></p>
      `;

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const tableBody = subpanel.querySelector('.students-history-table tbody');
    const clearButton = subpanel.querySelector('[data-action="students-history-clear"]');
    const statusElement = subpanel.querySelector('[data-role="students-history-status"]');

    const setStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const renderHistory = () => {
      if (!tableBody) {
        return;
      }
      const columns = [
        { key: 'action', label: 'العملية' },
        { key: 'time', label: 'الوقت' },
        { key: 'actor', label: 'المنفّذ' },
        { key: 'details', label: 'تفاصيل' }
      ];
      const rows = readStudentChanges().map((entry) => ({
        action: entry.type || 'تعديل',
        time: formatDateTime(entry.timestamp),
        actor: entry.performer || 'غير محدد',
        details: entry.name
          ? `${entry.name} · ${entry.grade || '—'} / ${entry.classroom || '—'}`
          : '—'
      }));
      renderTableRows(tableBody, rows, columns);
    };

    if (clearButton && !clearButton.dataset.bound) {
      clearButton.addEventListener('click', () => {
        writeJSON(STUDENT_CHANGES_STORAGE_KEY, []);
        setStatus('تم تنظيف سجل التعديلات.', 'info');
        renderHistory();
        notifyStudentChangesUpdated();
      });
      clearButton.dataset.bound = '1';
    }

    if (!subpanel.dataset._historyListeners) {
      window.addEventListener('adminStudentsChangesUpdated', renderHistory);
      subpanel.dataset._historyListeners = '1';
    }

    renderHistory();
  }


  function readStudentChanges() {
    const fallback = () => [];
    const value = readJSON(STUDENT_CHANGES_STORAGE_KEY, fallback);
    return Array.isArray(value) ? value : fallback();
  }


  function notifyStudentChangesUpdated() {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
      return;
    }
    window.dispatchEvent(new CustomEvent('adminStudentsChangesUpdated'));
  }


  function openStudentFormModal(options = {}) {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal student-modal';

    const form = document.createElement('form');
    form.method = 'dialog';

    const header = document.createElement('div');
    header.className = 'modal__header';
    const heading = document.createElement('h3');
    heading.textContent = options.title || 'إدارة الطالب';
    header.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'modal__body';

    const grid = document.createElement('div');
    grid.className = 'form-grid';

    const nameField = document.createElement('label');
    nameField.className = 'field';
    nameField.innerHTML = `
      <span>اسم الطالب</span>
      <input type="text" class="input" name="student-name" required placeholder="اسم الطالب" autocomplete="off" />
    `;
    const nameError = document.createElement('p');
    nameError.className = 'field-error';
    nameField.appendChild(nameError);
    const nameInput = nameField.querySelector('input');

    const gradeField = document.createElement('label');
    gradeField.className = 'field';
    const gradeSelect = document.createElement('select');
    gradeSelect.className = 'select';
    gradeSelect.name = 'student-grade';
    const gradePlaceholder = document.createElement('option');
    gradePlaceholder.value = '';
    gradePlaceholder.textContent = 'اختر الصف';
    gradeSelect.appendChild(gradePlaceholder);
    ATTENDANCE_GRADE_OPTIONS.forEach((grade) => {
      const option = document.createElement('option');
      option.value = grade;
      option.textContent = grade;
      gradeSelect.appendChild(option);
    });
    gradeField.innerHTML = '<span>الصف</span>';
    gradeField.appendChild(gradeSelect);
    const gradeError = document.createElement('p');
    gradeError.className = 'field-error';
    gradeField.appendChild(gradeError);

    const classField = document.createElement('label');
    classField.className = 'field';
    const classSelect = document.createElement('select');
    classSelect.className = 'select';
    classSelect.name = 'student-class';
    const classPlaceholder = document.createElement('option');
    classPlaceholder.value = '';
    classPlaceholder.textContent = 'اختر الفصل';
    classSelect.appendChild(classPlaceholder);
    ATTENDANCE_CLASS_OPTIONS.forEach((classroom) => {
      const option = document.createElement('option');
      option.value = classroom;
      option.textContent = classroom;
      classSelect.appendChild(option);
    });
    classField.innerHTML = '<span>الفصل</span>';
    classField.appendChild(classSelect);
    const classError = document.createElement('p');
    classError.className = 'field-error';
    classField.appendChild(classError);

    const guardianField = document.createElement('label');
    guardianField.className = 'field';
    guardianField.innerHTML = `
      <span>ولي الأمر</span>
      <input type="text" class="input" name="student-guardian" placeholder="اسم ولي الأمر" autocomplete="off" />
    `;
    const guardianInput = guardianField.querySelector('input');

    const phoneField = document.createElement('label');
    phoneField.className = 'field';
    phoneField.innerHTML = `
      <span>هاتف ولي الأمر</span>
      <input type="tel" class="input num" name="student-phone" placeholder="05xxxxxxxx" autocomplete="tel" />
    `;
    const phoneError = document.createElement('p');
    phoneError.className = 'field-error';
    phoneField.appendChild(phoneError);
    const phoneInput = phoneField.querySelector('input');

    grid.append(nameField, gradeField, classField, guardianField, phoneField);
    body.appendChild(grid);

    const footer = document.createElement('div');
    footer.className = 'modal__footer';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn';
    cancelButton.textContent = 'إلغاء';

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'btn primary';
    saveButton.textContent = 'حفظ';

    footer.append(cancelButton, saveButton);

    form.append(header, body, footer);
    dialog.appendChild(form);

    cancelButton.addEventListener('click', () => {
      dialog.close('cancel');
    });

    const errorElements = {
      name: nameError,
      grade: gradeError,
      class: classError,
      guardianPhone: phoneError
    };

    const fieldControls = {
      name: nameInput,
      grade: gradeSelect,
      class: classSelect,
      guardianPhone: phoneInput
    };

    const clearFieldErrors = () => {
      Object.values(errorElements).forEach((el) => {
        if (el) {
          el.textContent = '';
        }
      });
      Object.values(fieldControls).forEach((control) => {
        if (control) {
          control.removeAttribute('aria-invalid');
        }
      });
    };

    const applyFieldErrors = (errors) => {
      Object.entries(errors).forEach(([key, message]) => {
        const errorElement = errorElements[key];
        const control = fieldControls[key];
        if (errorElement) {
          errorElement.textContent = message;
        }
        if (control) {
          control.setAttribute('aria-invalid', 'true');
        }
      });
    };

    const clearErrorOnInteraction = (key, control, eventName) => {
      if (!control) {
        return;
      }
      control.addEventListener(eventName, () => {
        const errorElement = errorElements[key];
        if (errorElement) {
          errorElement.textContent = '';
        }
        control.removeAttribute('aria-invalid');
      });
    };

    clearErrorOnInteraction('name', nameInput, 'input');
    clearErrorOnInteraction('grade', gradeSelect, 'change');
    clearErrorOnInteraction('class', classSelect, 'change');

    if (phoneInput) {
      phoneInput.addEventListener('input', function onPhoneInput() {
        maskSaPhone(this);
        const errorElement = errorElements.guardianPhone;
        if (errorElement) {
          errorElement.textContent = '';
        }
        this.removeAttribute('aria-invalid');
      });
    }

    const initialValues = options.initialValues || options.initialValue || options.student || options.values || {};
    if (initialValues && typeof initialValues === 'object') {
      if (initialValues.name && nameInput) {
        nameInput.value = String(initialValues.name);
      }
      if (initialValues.grade && gradeSelect) {
        gradeSelect.value = String(initialValues.grade);
      }
      if ((initialValues.classroom || initialValues.class) && classSelect) {
        classSelect.value = String(initialValues.classroom || initialValues.class);
      }
      if (initialValues.guardian && guardianInput) {
        guardianInput.value = String(initialValues.guardian);
      }
      if (initialValues.phone && phoneInput) {
        phoneInput.value = String(initialValues.phone);
        maskSaPhone(phoneInput);
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearFieldErrors();
      if (phoneInput) {
        maskSaPhone(phoneInput);
      }

      const payload = {
        name: nameInput ? nameInput.value.trim() : '',
        grade: gradeSelect.value,
        classroom: classSelect.value,
        guardian: guardianInput ? guardianInput.value.trim() : '',
        phone: phoneInput ? phoneInput.value.trim() : ''
      };

      const validation = validateStudent({
        name: payload.name,
        grade: payload.grade,
        class: payload.classroom,
        guardianPhone: payload.phone
      });

      if (!validation.ok) {
        applyFieldErrors(validation.errors);
        const firstErrorKey = Object.keys(validation.errors)[0];
        if (firstErrorKey && fieldControls[firstErrorKey] && typeof fieldControls[firstErrorKey].focus === 'function') {
          fieldControls[firstErrorKey].focus();
        }
        return;
      }

      if (typeof options.onSubmit === 'function') {
        options.onSubmit(payload);
      }
      dialog.close('submit');
    });

    dialog.addEventListener('close', () => {
      closeModal(dialog);
    });

    showModal(dialog);

    requestAnimationFrame(() => {
      const firstField = form.querySelector('[name="student-name"]');
      if (firstField && typeof firstField.focus === 'function') {
        firstField.focus();
      }
    });
  }


  function formatDateTime(value) {
    if (!value) {
      return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    const datePart = date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const timePart = date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${datePart} ${timePart}`;
  }

  function detectDuplicates(rows) {
    if (!Array.isArray(rows)) {
      return [];
    }
    const seen = new Map();
    return rows.map((row) => {
      const key = `${(row.name || '').toLowerCase()}::${(row.grade || '').toLowerCase()}::${(row.classroom || '').toLowerCase()}`;
      const count = seen.get(key) || 0;
      seen.set(key, count + 1);
      return {
        ...row,
        duplicate: count > 0
      };
    });
  }


  function buildSettingsIdentitySubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const identityCard = document.createElement('div');
      identityCard.className = 'card settings-card settings-card--identity';
      identityCard.innerHTML = `
        <h3>بيانات الهوية</h3>
        <p class="form-hint">تظهر هذه البيانات في الترويسة وواجهات العرض داخل النظام.</p>
        <div class="field-grid">
          <label class="field">
            <span>اسم المدرسة</span>
            <input type="text" class="input" data-role="identity-name" placeholder="اسم المدرسة" autocomplete="off" />
          </label>
          <label class="field">
            <span>شعار المدرسة</span>
            <input type="file" class="input" data-role="identity-logo" accept="image/*" />
          </label>
        </div>
        <figure class="logo-preview settings-identity__preview" data-role="identity-preview-wrapper">
          <img data-role="school-logo-preview" alt="معاينة شعار المدرسة" loading="lazy" hidden />
          <figcaption data-role="identity-preview-hint">سيتم عرض الشعار بعد اختياره.</figcaption>
        </figure>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="identity-save">حفظ</button>
          <button type="button" class="btn" data-action="identity-restore">استرجاع</button>
        </div>
        <p class="form-hint" data-role="identity-status"></p>
      `;

      const guidanceCard = document.createElement('div');
      guidanceCard.className = 'card settings-card settings-card--identity-hint';
      guidanceCard.innerHTML = `
        <h3>إرشادات رفع الشعار</h3>
        <ul class="info-list">
          <li>يفضل استخدام صورة بصيغة PNG أو SVG بخلفية شفافة.</li>
          <li>سيتم حفظ الشعار محليًا في المتصفح لإعادة استخدامه بسرعة.</li>
          <li>حافظ على أبعاد متوازنة (مثلاً 400×400 بكسل) لضمان وضوح المعاينة.</li>
        </ul>
      `;

      grid.append(identityCard, guidanceCard);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const storageKey = 'adminSettings:identity';
    const fallback = () => ({ name: '', logoDataURL: '' });

    const nameInput = subpanel.querySelector('[data-role="identity-name"]');
    const logoInput = subpanel.querySelector('[data-role="identity-logo"]');
    const previewImage = subpanel.querySelector('[data-role="school-logo-preview"]');
    const previewHint = subpanel.querySelector('[data-role="identity-preview-hint"]');
    const statusElement = subpanel.querySelector('[data-role="identity-status"]');
    const saveButton = subpanel.querySelector('[data-action="identity-save"]');
    const restoreButton = subpanel.querySelector('[data-action="identity-restore"]');

    let currentLogoData = '';

    const applyIdentity = (data) => {
      const payload = data && typeof data === 'object' ? data : fallback();
      if (nameInput) {
        nameInput.value = payload.name || '';
      }
      currentLogoData = payload.logoDataURL || '';
      if (logoInput) {
        logoInput.value = '';
      }
      updatePreview(currentLogoData);
    };

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const updatePreview = (dataURL) => {
      if (previewImage) {
        if (dataURL) {
          previewImage.src = dataURL;
          previewImage.hidden = false;
        } else {
          previewImage.removeAttribute('src');
          previewImage.hidden = true;
        }
      }
      if (previewHint) {
        previewHint.hidden = Boolean(dataURL);
      }
    };

    applyIdentity(readJSON(storageKey, fallback));

    if (logoInput && !logoInput.dataset.bound) {
      logoInput.addEventListener('change', () => {
        const file = logoInput.files && logoInput.files[0];
        if (!file) {
          currentLogoData = '';
          updatePreview(currentLogoData);
          const success = writeJSON(storageKey, {
            name: nameInput ? nameInput.value.trim() : '',
            logoDataURL: currentLogoData
          });
          if (success) {
            clearUnsaved();
          } else {
            markUnsaved();
          }
          updateStatus('تم مسح اختيار الشعار الحالي.', 'info');
          return;
        }
        if (!/^image\//i.test(file.type)) {
          logoInput.value = '';
          updateStatus('يرجى اختيار ملف صورة صالح.', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          currentLogoData = typeof reader.result === 'string' ? reader.result : '';
          updatePreview(currentLogoData);
          const payload = {
            name: nameInput ? nameInput.value.trim() : '',
            logoDataURL: currentLogoData
          };
          const success = writeJSON(storageKey, payload);
          if (success) {
            clearUnsaved();
          } else {
            markUnsaved();
          }
          updateStatus(
            success ? 'تم تحديث الشعار وحفظه محليًا.' : 'تعذّر حفظ الشعار في التخزين المحلي.',
            success ? 'success' : 'error'
          );
        });
        reader.addEventListener('error', () => {
          updateStatus('تعذّر قراءة ملف الشعار المختار.', 'error');
        });
        reader.readAsDataURL(file);
      });
      logoInput.dataset.bound = '1';
    }

    bindSaveRestore(storageKey, {
      saveButton,
      restoreButton,
      readValues: () => ({
        name: nameInput ? nameInput.value.trim() : '',
        logoDataURL: currentLogoData
      }),
      applyValues: (payload) => {
        applyIdentity(payload);
      },
      fallback,
      setStatus: updateStatus
    });
  }


  function buildSettingsTimingSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const timingCard = document.createElement('div');
      timingCard.className = 'card settings-card settings-card--timing';
      timingCard.innerHTML = `
        <h3>التوقيت والضوابط</h3>
        <p class="form-hint">حدد بداية اليوم الدراسي والمهلات الزمنية لتقييم حالات الطلاب.</p>
        <div class="field-grid">
          <label class="field">
            <span>وقت الطابور</span>
            <input type="time" class="input num" data-role="timing-assembly" />
          </label>
          <label class="field">
            <span>دقائق السماح</span>
            <input type="number" class="input num" data-role="timing-grace" min="0" step="1" placeholder="0" />
          </label>
          <label class="field">
            <span>عتبة التأخير بالدقائق</span>
            <input type="number" class="input num" data-role="timing-late" min="0" step="1" placeholder="0" />
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="timing-save">حفظ</button>
          <button type="button" class="btn" data-action="timing-restore">استرجاع</button>
        </div>
        <p class="form-hint" data-role="timing-status"></p>
      `;

      grid.appendChild(timingCard);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const storageKey = 'adminSettings:timing';
    const fallback = () => ({
      assemblyTime: '',
      graceMinutes: '',
      lateThreshold: ''
    });

    const assemblyInput = subpanel.querySelector('[data-role="timing-assembly"]');
    const graceInput = subpanel.querySelector('[data-role="timing-grace"]');
    const lateInput = subpanel.querySelector('[data-role="timing-late"]');
    const statusElement = subpanel.querySelector('[data-role="timing-status"]');
    const saveButton = subpanel.querySelector('[data-action="timing-save"]');
    const restoreButton = subpanel.querySelector('[data-action="timing-restore"]');

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const applyTiming = (data) => {
      const payload = data && typeof data === 'object' ? data : fallback();
      if (assemblyInput) {
        assemblyInput.value = payload.assemblyTime || '';
      }
      if (graceInput) {
        graceInput.value = payload.graceMinutes !== undefined && payload.graceMinutes !== null && payload.graceMinutes !== ''
          ? payload.graceMinutes
          : '';
      }
      if (lateInput) {
        lateInput.value = payload.lateThreshold !== undefined && payload.lateThreshold !== null && payload.lateThreshold !== ''
          ? payload.lateThreshold
          : '';
      }
    };

    applyTiming(readJSON(storageKey, fallback));

    bindSaveRestore(storageKey, {
      saveButton,
      restoreButton,
      readValues: () => {
        const graceValue = graceInput ? parseInt(graceInput.value, 10) : NaN;
        const lateValue = lateInput ? parseInt(lateInput.value, 10) : NaN;
        return {
          assemblyTime: assemblyInput ? assemblyInput.value : '',
          graceMinutes: Number.isFinite(graceValue) ? graceValue : '',
          lateThreshold: Number.isFinite(lateValue) ? lateValue : ''
        };
      },
      applyValues: (payload) => {
        applyTiming(payload);
      },
      fallback,
      setStatus: updateStatus
    });
  }


  function buildSettingsRemoteSubtab(panel, subpanel) {
    buildWipCard(
      subpanel,
      'settings-remote-supervisors',
      'مشاركة المشرفين عبر السحابة',
      'سيتم لاحقًا ربط هذه الواجهة مع Supabase لإدارة مشرفين متعددين وربط أكثر من مدرسة عن بُعد.'
    );
  }


  function buildThemeControls(subpanelEl) {
    const noop = () => {};
    const result = { update: noop };

    if (!subpanelEl) {
      return result;
    }

    subpanelEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'cards-grid';
    wrap.innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 8px;">سمة الواجهة</h3>
      <p class="muted">يمكنك التحكم في النمط الفاتح والداكن، وسيتم تطبيقه على جميع الواجهات.</p>

      <div class="form-row" style="margin-top:10px;">
        <label>وضع السمة</label>
        <select class="input" data-role="theme-mode">
          <option value="system">اتّباع إعداد النظام</option>
          <option value="light">فاتح</option>
          <option value="dark">داكن</option>
        </select>
      </div>

      <div class="form-row" style="margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px;">
        <div>
          <label>اللون الأساسي (الوضع الفاتح)</label>
          <input class="input" type="color" data-role="accent-light" value="#2563eb">
        </div>
        <div>
          <label>اللون الأساسي (الوضع الداكن)</label>
          <input class="input" type="color" data-role="accent-dark" value="#2f80ed">
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
        <button class="btn" data-role="reset-theme">إرجاع الافتراضي</button>
      </div>
    </div>
  `;

    subpanelEl.appendChild(wrap);

    const DEFAULT_LIGHT = '#2563eb';
    const DEFAULT_DARK = '#2f80ed';

    const runtime = window.HaderTheme || null;
    const modeSel = wrap.querySelector('[data-role="theme-mode"]');
    const lightInp = wrap.querySelector('[data-role="accent-light"]');
    const darkInp = wrap.querySelector('[data-role="accent-dark"]');
    const resetBtn = wrap.querySelector('[data-role="reset-theme"]');

    const applyFromRuntime = () => {
      const currentRuntime = window.HaderTheme || runtime;
      const effectiveMode = currentRuntime && currentRuntime.themeMode ? currentRuntime.themeMode : 'system';
      const accents = currentRuntime && currentRuntime.accents ? currentRuntime.accents : { light: DEFAULT_LIGHT, dark: DEFAULT_DARK };

      if (modeSel) {
        modeSel.value = effectiveMode;
      }
      if (lightInp) {
        lightInp.value = accents.light || DEFAULT_LIGHT;
      }
      if (darkInp) {
        darkInp.value = accents.dark || DEFAULT_DARK;
      }
    };

    applyFromRuntime();

    result.update = applyFromRuntime;

    if (!runtime) {
      console.warn('HaderTheme runtime is unavailable. Theme controls will use defaults.');
    }

    const handleExternalChange = () => {
      applyFromRuntime();
    };

    window.addEventListener('storage', (event) => {
      if (!event || !event.key) {
        return;
      }
      if (event.key === 'hader:themeMode' || event.key === 'hader:accentLight' || event.key === 'hader:accentDark') {
        handleExternalChange();
      }
    });

    if (typeof window.BroadcastChannel === 'function') {
      try {
        const syncChannel = new window.BroadcastChannel('hader-theme');
        const channelHandler = () => {
          handleExternalChange();
        };
        if (typeof syncChannel.addEventListener === 'function') {
          syncChannel.addEventListener('message', channelHandler);
        } else {
          syncChannel.onmessage = channelHandler;
        }
      } catch (error) {
        console.warn('تعذّر الاشتراك في قناة الثيم للمزامنة.', error);
      }
    }

    if (modeSel) {
      modeSel.addEventListener('change', () => {
        if (!window.HaderTheme) {
          showToast('تعذّر تغيير السمة: وحدة الثيم غير متاحة.', 'error');
          applyFromRuntime();
          return;
        }
        window.HaderTheme.setTheme(modeSel.value);
        applyFromRuntime();
      });
    }

    if (lightInp) {
      lightInp.addEventListener('input', () => {
        if (!window.HaderTheme) {
          showToast('لا يمكن تحديث لون السمة الفاتحة حاليًا.', 'error');
          applyFromRuntime();
          return;
        }
        window.HaderTheme.setAccentLight(lightInp.value);
        applyFromRuntime();
      });
    }

    if (darkInp) {
      darkInp.addEventListener('input', () => {
        if (!window.HaderTheme) {
          showToast('لا يمكن تحديث لون السمة الداكنة حاليًا.', 'error');
          applyFromRuntime();
          return;
        }
        window.HaderTheme.setAccentDark(darkInp.value);
        applyFromRuntime();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!window.HaderTheme) {
          showToast('لا يمكن إعادة ضبط السمة في الوقت الحالي.', 'error');
          return;
        }
        window.HaderTheme.setTheme('system');
        window.HaderTheme.setAccentLight(DEFAULT_LIGHT);
        window.HaderTheme.setAccentDark(DEFAULT_DARK);
        applyFromRuntime();
        showToast('تمت إعادة تعيين السمة للألوان الافتراضية.', 'success');
      });
    }

    return result;
  }

  function buildSettingsAppearanceSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const controls = buildThemeControls(subpanel);
      subpanel._themeControls = controls;
      subpanel.dataset._built = '1';
    }

    if (subpanel._themeControls && typeof subpanel._themeControls.update === 'function') {
      subpanel._themeControls.update();
    }
  }

  function buildSettingsKioskAppearanceSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const bannerCard = document.createElement('div');
      bannerCard.className = 'card settings-card settings-card--kiosk-banner';
      bannerCard.innerHTML = `
        <h3>بانر الكشك</h3>
        <p class="form-hint">سيتم استخدام الصورة في واجهة الكشك لتخصيص الهوية البصرية.</p>
        <label class="field">
          <span>تحميل بانر جديد</span>
          <input type="file" class="input" data-role="kiosk-banner-input" accept="image/*" />
        </label>
        <figure class="logo-preview kiosk-banner-preview">
          <img data-role="kiosk-banner-preview" alt="معاينة بانر الكشك" loading="lazy" hidden />
          <figcaption data-role="kiosk-banner-hint">سيتم عرض البانر بعد اختياره.</figcaption>
        </figure>
      `;

      const colorsCard = document.createElement('div');
      colorsCard.className = 'card settings-card settings-card--kiosk-colors';
      colorsCard.innerHTML = `
        <h3>الألوان الأساسية للكشك</h3>
        <p class="form-hint">اختر الألوان المستخدمة في الترويسة والخلفية لعرض الكشك.</p>
        <div class="field-grid">
          <label class="field">
            <span>اللون الأساسي</span>
            <input type="color" class="input" data-role="kiosk-color-primary" />
          </label>
          <label class="field">
            <span>لون السطح</span>
            <input type="color" class="input" data-role="kiosk-color-surface" />
          </label>
        </div>
        <div class="kiosk-preview" data-role="kiosk-preview">
          <div class="kiosk-preview__banner" data-role="kiosk-preview-banner"></div>
          <div class="kiosk-preview__content">
            <div class="kiosk-preview__meta">
              <div class="kiosk-preview__title">معاينة الكشك</div>
              <div class="kiosk-preview__subtitle">الألوان المختارة تظهر هنا مباشرة.</div>
            </div>
            <span class="kiosk-preview__badge">حضور</span>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="kiosk-save">حفظ</button>
          <button type="button" class="btn" data-action="kiosk-restore">استرجاع</button>
        </div>
        <p class="form-hint" data-role="kiosk-status"></p>
      `;

      grid.append(bannerCard, colorsCard);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const storageKey = 'adminSettings:kioskUI';
    const defaultPrimary = getCssVar('--kiosk-primary', '#38bdf8') || '#38bdf8';
    const defaultSurface = getCssVar('--kiosk-surface', '#0b1728') || '#0b1728';
    const fallback = () => ({
      bannerDataURL: '',
      primary: defaultPrimary,
      surface: defaultSurface
    });

    const bannerInput = subpanel.querySelector('[data-role="kiosk-banner-input"]');
    const bannerImage = subpanel.querySelector('[data-role="kiosk-banner-preview"]');
    const bannerHint = subpanel.querySelector('[data-role="kiosk-banner-hint"]');
    const primaryInput = subpanel.querySelector('[data-role="kiosk-color-primary"]');
    const surfaceInput = subpanel.querySelector('[data-role="kiosk-color-surface"]');
    const preview = subpanel.querySelector('[data-role="kiosk-preview"]');
    const previewBanner = subpanel.querySelector('[data-role="kiosk-preview-banner"]');
    const statusElement = subpanel.querySelector('[data-role="kiosk-status"]');
    const saveButton = subpanel.querySelector('[data-action="kiosk-save"]');
    const restoreButton = subpanel.querySelector('[data-action="kiosk-restore"]');

    let currentBannerData = '';

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const applyBanner = (dataURL) => {
      currentBannerData = dataURL || '';
      if (bannerImage) {
        if (currentBannerData) {
          bannerImage.src = currentBannerData;
          bannerImage.hidden = false;
        } else {
          bannerImage.removeAttribute('src');
          bannerImage.hidden = true;
        }
      }
      if (bannerHint) {
        bannerHint.hidden = Boolean(currentBannerData);
      }
      if (previewBanner) {
        if (currentBannerData) {
          previewBanner.style.backgroundImage = `url(${currentBannerData})`;
          previewBanner.style.backgroundSize = 'cover';
          previewBanner.style.backgroundPosition = 'center';
        } else {
          previewBanner.style.backgroundImage = '';
          previewBanner.style.backgroundSize = '';
          previewBanner.style.backgroundPosition = '';
        }
      }
    };

    const applyColors = (primary, surface) => {
      const primaryColor = primary || defaultPrimary;
      const surfaceColor = surface || defaultSurface;
      const rootStyle = document.documentElement.style;
      if (rootStyle) {
        if (primaryColor) {
          rootStyle.setProperty('--kiosk-primary', primaryColor);
        } else {
          rootStyle.removeProperty('--kiosk-primary');
        }
        if (surfaceColor) {
          rootStyle.setProperty('--kiosk-surface', surfaceColor);
        } else {
          rootStyle.removeProperty('--kiosk-surface');
        }
      }
      if (preview) {
        preview.style.setProperty('--kiosk-primary', primaryColor);
        preview.style.setProperty('--kiosk-surface', surfaceColor);
      }
    };

    const applyKiosk = (data) => {
      const payload = data && typeof data === 'object' ? data : fallback();
      if (primaryInput) {
        primaryInput.value = payload.primary || defaultPrimary;
      }
      if (surfaceInput) {
        surfaceInput.value = payload.surface || defaultSurface;
      }
      applyBanner(payload.bannerDataURL || '');
      if (bannerInput) {
        bannerInput.value = '';
      }
      applyColors(payload.primary, payload.surface);
    };

    applyKiosk(readJSON(storageKey, fallback));

    if (bannerInput && !bannerInput.dataset.bound) {
      bannerInput.addEventListener('change', () => {
        const file = bannerInput.files && bannerInput.files[0];
        if (!file) {
          applyBanner('');
          updateStatus('تم مسح البانر الحالي.', 'info');
          return;
        }
        if (!/^image\//i.test(file.type)) {
          bannerInput.value = '';
          updateStatus('يرجى اختيار ملف صورة صالح للبانر.', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          applyBanner(result);
          updateStatus('تم تحديث معاينة البانر.', 'success');
        });
        reader.addEventListener('error', () => {
          updateStatus('تعذّر قراءة ملف البانر المختار.', 'error');
        });
        reader.readAsDataURL(file);
      });
      bannerInput.dataset.bound = '1';
    }

    const handleColorInput = () => {
      const primaryColor = primaryInput ? primaryInput.value : defaultPrimary;
      const surfaceColor = surfaceInput ? surfaceInput.value : defaultSurface;
      applyColors(primaryColor, surfaceColor);
      updateStatus('تم تطبيق المعاينة المحدثة للألوان.', 'info');
    };

    if (primaryInput && !primaryInput.dataset.bound) {
      primaryInput.addEventListener('input', handleColorInput);
      primaryInput.dataset.bound = '1';
    }

    if (surfaceInput && !surfaceInput.dataset.bound) {
      surfaceInput.addEventListener('input', handleColorInput);
      surfaceInput.dataset.bound = '1';
    }

    bindSaveRestore(storageKey, {
      saveButton,
      restoreButton,
      readValues: () => ({
        bannerDataURL: currentBannerData,
        primary: primaryInput ? primaryInput.value : defaultPrimary,
        surface: surfaceInput ? surfaceInput.value : defaultSurface
      }),
      applyValues: (payload) => {
        applyKiosk(payload);
      },
      fallback,
      setStatus: updateStatus
    });
  }


  function buildSettingsCardStyleSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const editorCard = document.createElement('div');
      editorCard.className = 'card settings-card settings-card--card-style';
      editorCard.innerHTML = `
        <h3>نمط البطاقات</h3>
        <p class="form-hint">تحكم في ألوان وحواف البطاقات حتى تعكس هوية المدرسة الرقمية.</p>
        <div class="field-grid card-style-fields">
          <label class="field">
            <span>اللون المميز <span class="range-value" data-role="card-accent-value"></span></span>
            <input type="color" class="input" data-role="card-accent" />
          </label>
          <label class="field">
            <span>خلفية البطاقة <span class="range-value" data-role="card-background-value"></span></span>
            <input type="color" class="input" data-role="card-background" />
          </label>
          <label class="field card-style-field--range">
            <span>نصف القطر <span class="range-value" data-role="card-radius-value"></span></span>
            <input type="range" class="input" data-role="card-radius" min="6" max="20" step="1" />
          </label>
          <label class="field card-style-field--range">
            <span>مستوى الظل <span class="range-value" data-role="card-shadow-value"></span></span>
            <input type="range" class="input" data-role="card-shadow" min="0" max="3" step="1" />
          </label>
        </div>
        <div class="form-actions card-style-actions">
          <button type="button" class="btn" data-action="card-preview">معاينة</button>
          <button type="button" class="btn primary" data-action="card-save">حفظ</button>
          <button type="button" class="btn" data-action="card-restore">استرجاع</button>
        </div>
        <p class="form-hint" data-role="card-status"></p>
      `;

      const previewCard = document.createElement('div');
      previewCard.className = 'card card-style-preview';
      previewCard.dataset.role = 'card-style-preview';
      previewCard.innerHTML = `
        <h3>معاينة البطاقة</h3>
        <p class="card-style-preview__text">يتم تحديث هذه المعاينة وفق الإعدادات الحالية قبل حفظها.</p>
        <div class="card-style-preview__body">
          <span class="card-style-preview__chip">شعار المدرسة</span>
          <p class="card-style-preview__hint">يمكن أن تحتوي البطاقة على ملخص حضور أو تعليمات سريعة.</p>
          <button type="button" class="btn primary card-style-preview__button" data-role="card-preview-button" disabled aria-disabled="true">زر نموذجي</button>
        </div>
      `;

      grid.append(editorCard, previewCard);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const storageKey = 'adminSettings:cardStyle';
    const fallback = () => {
      const defaultAccent = getCssVar('--adm-accent', '#2f80ed') || '#2f80ed';
      const defaultBackground = getCssVar('--adm-card-bg', '#0f1a2f') || '#0f1a2f';
      const radiusRaw = parseFloat(getCssVar('--adm-radius', '14'));
      const shadowRaw = parseFloat(getCssVar('--adm-shadow-level', '1'));
      return {
        accent: defaultAccent,
        cardBackground: defaultBackground,
        radius: Number.isFinite(radiusRaw) ? clampNumber(radiusRaw, 6, 20) : 14,
        shadowLevel: Number.isFinite(shadowRaw) ? clampNumber(shadowRaw, 0, 3) : 1
      };
    };

    const accentInput = subpanel.querySelector('[data-role="card-accent"]');
    const backgroundInput = subpanel.querySelector('[data-role="card-background"]');
    const radiusInput = subpanel.querySelector('[data-role="card-radius"]');
    const shadowInput = subpanel.querySelector('[data-role="card-shadow"]');
    const previewButton = subpanel.querySelector('[data-action="card-preview"]');
    const saveButton = subpanel.querySelector('[data-action="card-save"]');
    const restoreButton = subpanel.querySelector('[data-action="card-restore"]');
    const statusElement = subpanel.querySelector('[data-role="card-status"]');
    const accentValue = subpanel.querySelector('[data-role="card-accent-value"]');
    const backgroundValue = subpanel.querySelector('[data-role="card-background-value"]');
    const radiusValue = subpanel.querySelector('[data-role="card-radius-value"]');
    const shadowValue = subpanel.querySelector('[data-role="card-shadow-value"]');
    const previewCard = subpanel.querySelector('[data-role="card-style-preview"]');

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const normaliseValues = (data) => {
      const defaults = fallback();
      const accent = typeof data?.accent === 'string' && data.accent ? data.accent : defaults.accent;
      const cardBackground = typeof data?.cardBackground === 'string' && data.cardBackground
        ? data.cardBackground
        : defaults.cardBackground;
      let radius = parseFloat(data?.radius);
      radius = Number.isFinite(radius) ? clampNumber(radius, 6, 20) : defaults.radius;
      let shadowLevel = parseFloat(data?.shadowLevel);
      shadowLevel = Number.isFinite(shadowLevel) ? clampNumber(shadowLevel, 0, 3) : defaults.shadowLevel;
      return { accent, cardBackground, radius, shadowLevel };
    };

    const setRootTheme = (values) => {
      const rootStyle = document.documentElement ? document.documentElement.style : null;
      if (!rootStyle) {
        return;
      }
      const defaults = fallback();
      const accent = values.accent || defaults.accent;
      const accentRgb = hexToRgb(accent) || '47, 128, 237';
      const cardBg = values.cardBackground || defaults.cardBackground;
      const radius = Number.isFinite(values.radius) ? values.radius : defaults.radius;
      const shadowLevel = Number.isFinite(values.shadowLevel) ? values.shadowLevel : defaults.shadowLevel;
      rootStyle.setProperty('--adm-accent', accent);
      rootStyle.setProperty('--adm-accent-rgb', accentRgb);
      rootStyle.setProperty('--adm-card-bg', cardBg);
      rootStyle.setProperty('--adm-radius', `${radius}px`);
      rootStyle.setProperty('--adm-shadow-level', String(shadowLevel));
    };

    const updatePreview = (values) => {
      if (!previewCard) {
        return;
      }
      const defaults = fallback();
      const accent = values.accent || defaults.accent;
      const accentRgb = hexToRgb(accent) || '47, 128, 237';
      const cardBg = values.cardBackground || defaults.cardBackground;
      const radius = Number.isFinite(values.radius) ? values.radius : defaults.radius;
      const shadowLevel = Number.isFinite(values.shadowLevel) ? values.shadowLevel : defaults.shadowLevel;
      previewCard.style.setProperty('--card-preview-accent', accent);
      previewCard.style.setProperty('--card-preview-accent-rgb', accentRgb);
      previewCard.style.setProperty('--card-preview-bg', cardBg);
      previewCard.style.setProperty('--card-preview-radius', `${radius}px`);
      previewCard.style.setProperty('--card-preview-shadow', String(shadowLevel));
    };

    const updateIndicators = (values) => {
      if (accentValue) {
        accentValue.textContent = values.accent ? values.accent.toUpperCase() : '';
      }
      if (backgroundValue) {
        backgroundValue.textContent = values.cardBackground ? values.cardBackground.toUpperCase() : '';
      }
      if (radiusValue) {
        radiusValue.textContent = `${Math.round(values.radius)}px`;
      }
      if (shadowValue) {
        shadowValue.textContent = values.shadowLevel === 0
          ? 'بدون ظل'
          : `المستوى ${values.shadowLevel}`;
      }
    };

    const applyCardValues = (payload, options = {}) => {
      const values = normaliseValues(payload);
      if (options.updateInputs !== false) {
        if (accentInput) {
          accentInput.value = values.accent;
        }
        if (backgroundInput) {
          backgroundInput.value = values.cardBackground;
        }
        if (radiusInput) {
          radiusInput.value = String(values.radius);
        }
        if (shadowInput) {
          shadowInput.value = String(values.shadowLevel);
        }
      }
      if (options.applyRoot !== false) {
        setRootTheme(values);
      }
      updateIndicators(values);
      updatePreview(values);
      return values;
    };

    const collectFormValues = () => normaliseValues({
      accent: accentInput ? accentInput.value : undefined,
      cardBackground: backgroundInput ? backgroundInput.value : undefined,
      radius: radiusInput ? parseFloat(radiusInput.value) : undefined,
      shadowLevel: shadowInput ? parseFloat(shadowInput.value) : undefined
    });

    applyCardValues(readJSON(storageKey, fallback));

    const handleLiveInput = () => {
      applyCardValues(collectFormValues(), { updateInputs: false, applyRoot: false });
    };

    [accentInput, backgroundInput].forEach((input) => {
      if (input && !input.dataset.bound) {
        input.addEventListener('input', handleLiveInput);
        input.dataset.bound = '1';
      }
    });

    [radiusInput, shadowInput].forEach((input) => {
      if (input && !input.dataset.bound) {
        input.addEventListener('input', handleLiveInput);
        input.dataset.bound = '1';
      }
    });

    if (previewButton && !previewButton.dataset.bound) {
      previewButton.addEventListener('click', () => {
        const values = applyCardValues(collectFormValues(), { updateInputs: false });
        updateStatus('تم تطبيق المعاينة الحالية على الواجهة.', 'info');
        return values;
      });
      previewButton.dataset.bound = '1';
    }

    bindSaveRestore(storageKey, {
      saveButton,
      restoreButton,
      readValues: () => applyCardValues(collectFormValues(), { updateInputs: false }),
      applyValues: (payload) => {
        applyCardValues(payload);
      },
      fallback,
      setStatus: updateStatus
    });
  }


  function buildSettingsScaleSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const scaleCard = document.createElement('div');
      scaleCard.className = 'card settings-card settings-card--scale';
      scaleCard.innerHTML = `
        <h3>مقاييس الواجهة</h3>
        <p class="form-hint">عدّل الأحجام لتتلاءم الواجهة مع مختلف الشاشات ومستويات القراءة.</p>
        <div class="field-grid scale-fields">
          <label class="field">
            <span>حجم الخط الأساسي <span class="range-value" data-role="scale-font-value"></span></span>
            <input type="range" class="input" data-role="scale-font" min="14" max="20" step="1" />
          </label>
          <label class="field">
            <span>كثافة الجداول <span class="range-value" data-role="scale-density-value"></span></span>
            <input type="range" class="input" data-role="scale-density" min="0" max="2" step="1" />
          </label>
          <label class="field">
            <span>حجم البطاقة <span class="range-value" data-role="scale-card-value"></span></span>
            <input type="range" class="input" data-role="scale-card" min="1" max="3" step="0.25" />
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="scale-save">حفظ</button>
          <button type="button" class="btn" data-action="scale-restore">استرجاع</button>
        </div>
        <p class="form-hint" data-role="scale-status"></p>
      `;

      const previewCard = document.createElement('div');
      previewCard.className = 'card scale-preview';
      previewCard.dataset.role = 'scale-preview';
      previewCard.innerHTML = `
        <h3>معاينة مباشرة</h3>
        <p class="scale-preview__text">تعكس هذه المعاينة تأثير القيم الحالية على النصوص وتخطيط البطاقات والجداول.</p>
        <div class="scale-preview__grid">
          <div class="scale-preview__tile">
            <h4>بطاقة مصغرة</h4>
            <p>إحصائية مختصرة تظهر هنا.</p>
            <button type="button" class="btn" disabled aria-disabled="true">زر عادي</button>
          </div>
          <div class="scale-preview__tile">
            <h4>بطاقة أخرى</h4>
            <p>مؤشر أداء أو رسالة تنبيه.</p>
            <button type="button" class="btn primary" disabled aria-disabled="true">زر مميز</button>
          </div>
        </div>
        <div class="table-wrap scale-preview__table">
          <table>
            <thead>
              <tr><th>البند</th><th>القيمة</th><th>الملاحظة</th></tr>
            </thead>
            <tbody>
              <tr><td>الحضور</td><td>98%</td><td>مستقر</td></tr>
              <tr><td>التأخير</td><td>12</td><td>قيد المتابعة</td></tr>
            </tbody>
          </table>
        </div>
      `;

      grid.append(scaleCard, previewCard);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const storageKey = 'adminSettings:scale';
    const fallback = () => {
      const fontRaw = parseFloat(getCssVar('--adm-font-size', '16'));
      const densityRaw = parseFloat(getCssVar('--adm-table-density', '1'));
      const scaleRaw = parseFloat(getCssVar('--adm-card-scale', '1'));
      return {
        fontSize: Number.isFinite(fontRaw) ? clampNumber(fontRaw, 14, 20) : 16,
        tableDensity: Number.isFinite(densityRaw) ? clampNumber(densityRaw, 0, 2) : 1,
        cardScale: Number.isFinite(scaleRaw) ? clampNumber(scaleRaw, 1, 3) : 1
      };
    };

    const fontInput = subpanel.querySelector('[data-role="scale-font"]');
    const densityInput = subpanel.querySelector('[data-role="scale-density"]');
    const cardInput = subpanel.querySelector('[data-role="scale-card"]');
    const saveButton = subpanel.querySelector('[data-action="scale-save"]');
    const restoreButton = subpanel.querySelector('[data-action="scale-restore"]');
    const statusElement = subpanel.querySelector('[data-role="scale-status"]');
    const fontValue = subpanel.querySelector('[data-role="scale-font-value"]');
    const densityValue = subpanel.querySelector('[data-role="scale-density-value"]');
    const cardValue = subpanel.querySelector('[data-role="scale-card-value"]');
    const previewCard = subpanel.querySelector('[data-role="scale-preview"]');

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const normaliseValues = (data) => {
      const defaults = fallback();
      let fontSize = parseFloat(data?.fontSize);
      fontSize = Number.isFinite(fontSize) ? clampNumber(fontSize, 14, 20) : defaults.fontSize;
      let tableDensity = parseFloat(data?.tableDensity);
      tableDensity = Number.isFinite(tableDensity) ? clampNumber(tableDensity, 0, 2) : defaults.tableDensity;
      let cardScale = parseFloat(data?.cardScale);
      cardScale = Number.isFinite(cardScale) ? clampNumber(cardScale, 1, 3) : defaults.cardScale;
      return { fontSize, tableDensity, cardScale };
    };

    const setRootScale = (values) => {
      const rootStyle = document.documentElement ? document.documentElement.style : null;
      if (!rootStyle) {
        return;
      }
      rootStyle.setProperty('--adm-font-size', `${values.fontSize}px`);
      rootStyle.setProperty('--adm-table-density', String(values.tableDensity));
      rootStyle.setProperty('--adm-card-scale', String(values.cardScale));
    };

    const updateIndicators = (values) => {
      if (fontValue) {
        fontValue.textContent = `${Math.round(values.fontSize)}px`;
      }
      if (densityValue) {
        densityValue.textContent = values.tableDensity === 0
          ? 'واسعة'
          : values.tableDensity === 1
            ? 'متوازنة'
            : 'مضغوطة';
      }
      if (cardValue) {
        cardValue.textContent = values.cardScale.toFixed(2);
      }
    };

    const updatePreview = (values) => {
      if (!previewCard) {
        return;
      }
      previewCard.style.setProperty('--scale-preview-font', `${values.fontSize}px`);
      previewCard.style.setProperty('--scale-preview-card', String(values.cardScale));
    };

    const applyScaleValues = (payload, options = {}) => {
      const values = normaliseValues(payload);
      if (options.updateInputs !== false) {
        if (fontInput) {
          fontInput.value = String(values.fontSize);
        }
        if (densityInput) {
          densityInput.value = String(values.tableDensity);
        }
        if (cardInput) {
          cardInput.value = String(values.cardScale);
        }
      }
      setRootScale(values);
      updateIndicators(values);
      updatePreview(values);
      return values;
    };

    const collectFormValues = () => normaliseValues({
      fontSize: fontInput ? parseFloat(fontInput.value) : undefined,
      tableDensity: densityInput ? parseFloat(densityInput.value) : undefined,
      cardScale: cardInput ? parseFloat(cardInput.value) : undefined
    });

    applyScaleValues(readJSON(storageKey, fallback));

    const handleInput = (event) => {
      const values = collectFormValues();
      if (event && event.target === densityInput) {
        const densityValue = parseFloat(densityInput.value);
        if (Number.isFinite(densityValue) && document.documentElement) {
          document.documentElement.style.setProperty('--adm-table-density', String(densityValue));
        }
      }
      applyScaleValues(values, { updateInputs: false });
    };

    [fontInput, densityInput, cardInput].forEach((input) => {
      if (input && !input.dataset.bound) {
        input.addEventListener('input', handleInput);
        input.dataset.bound = '1';
      }
    });

    bindSaveRestore(storageKey, {
      saveButton,
      restoreButton,
      readValues: () => applyScaleValues(collectFormValues(), { updateInputs: false }),
      applyValues: (payload) => {
        applyScaleValues(payload);
      },
      fallback,
      setStatus: updateStatus
    });
  }


  function buildSettingsDisplaySubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const displayCard = document.createElement('div');
      displayCard.className = 'card settings-card settings-card--display';
      displayCard.innerHTML = `
        <h3>الدوران والعرض</h3>
        <p class="form-hint">حدد اتجاه العرض وخيارات التحجيم الذكي لتجهيز الكشك أو الشاشات الصفية.</p>
        <div class="field-grid display-fields">
          <label class="field">
            <span>الاتجاه</span>
            <select class="select" data-role="display-orientation">
              <option value="landscape">أفقي</option>
              <option value="portrait">طولي</option>
            </select>
          </label>
          <label class="field checkbox-field">
            <span>التحجيم التلقائي</span>
            <span class="checkbox-field__control">
              <input type="checkbox" data-role="display-autoscale" />
              <span>اضبط عناصر الواجهة تلقائياً وفق أبعاد الشاشة.</span>
            </span>
          </label>
        </div>
        <div class="actions-row display-actions">
          <button type="button" class="btn" data-action="display-fullscreen">تفعيل ملء الشاشة</button>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="display-save">حفظ</button>
          <button type="button" class="btn" data-action="display-restore">استرجاع</button>
        </div>
        <p class="form-hint" data-role="display-status"></p>
      `;

      const previewCard = document.createElement('div');
      previewCard.className = 'card display-preview';
      previewCard.dataset.role = 'display-preview';
      previewCard.innerHTML = `
        <h3>معاينة الاتجاه</h3>
        <p class="display-preview__text">توضح هذه المعاينة توزيع الواجهة بحسب الاتجاه والحجم المختار.</p>
        <div class="display-preview__meta">
          <span class="badge" data-role="display-orientation-label">عرض أفقي</span>
          <span class="badge muted" data-role="display-autoscale-label">التحجيم التلقائي مفعل</span>
        </div>
        <div class="display-preview__stage" data-role="display-stage">
          <div class="display-preview__device">
            <div class="display-preview__screen">واجهة الإدارة</div>
          </div>
        </div>
        <p class="display-preview__note">قد تمنع بعض المتصفحات وضع ملء الشاشة إلا بعد تفاعل مباشر من المستخدم.</p>
      `;

      grid.append(displayCard, previewCard);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const storageKey = 'adminSettings:display';
    const fallback = () => {
      const root = document.documentElement;
      const storedOrientation = root?.getAttribute('data-display-orientation');
      const storedAutoscale = root?.getAttribute('data-display-autoscale');
      return {
        orientation: storedOrientation === 'portrait' ? 'portrait' : 'landscape',
        autoScale: storedAutoscale === null ? true : storedAutoscale === 'true'
      };
    };

    const orientationSelect = subpanel.querySelector('[data-role="display-orientation"]');
    const autoScaleInput = subpanel.querySelector('[data-role="display-autoscale"]');
    const fullscreenButton = subpanel.querySelector('[data-action="display-fullscreen"]');
    const saveButton = subpanel.querySelector('[data-action="display-save"]');
    const restoreButton = subpanel.querySelector('[data-action="display-restore"]');
    const statusElement = subpanel.querySelector('[data-role="display-status"]');
    const orientationLabel = subpanel.querySelector('[data-role="display-orientation-label"]');
    const autoscaleLabel = subpanel.querySelector('[data-role="display-autoscale-label"]');
    const previewCard = subpanel.querySelector('[data-role="display-preview"]');

    const updateStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const normaliseValues = (data) => {
      const defaults = fallback();
      const orientation = data?.orientation === 'portrait' ? 'portrait' : 'landscape';
      const autoScale = Boolean(data?.autoScale ?? defaults.autoScale);
      return { orientation, autoScale };
    };

    const setRootDisplay = (values) => {
      const root = document.documentElement;
      if (!root) {
        return;
      }
      root.setAttribute('data-display-orientation', values.orientation);
      if (values.autoScale) {
        root.setAttribute('data-display-autoscale', 'true');
      } else {
        root.removeAttribute('data-display-autoscale');
      }
    };

    const updatePreview = (values) => {
      if (previewCard) {
        previewCard.dataset.orientation = values.orientation;
        previewCard.dataset.autoscale = values.autoScale ? 'on' : 'off';
      }
      if (orientationLabel) {
        orientationLabel.textContent = values.orientation === 'portrait' ? 'عرض طولي' : 'عرض أفقي';
      }
      if (autoscaleLabel) {
        autoscaleLabel.textContent = values.autoScale
          ? 'التحجيم التلقائي مفعل'
          : 'التحجيم التلقائي متوقف';
      }
    };

    const applyDisplayValues = (payload, options = {}) => {
      const values = normaliseValues(payload);
      if (options.updateInputs !== false) {
        if (orientationSelect) {
          orientationSelect.value = values.orientation;
        }
        if (autoScaleInput) {
          autoScaleInput.checked = values.autoScale;
        }
      }
      setRootDisplay(values);
      updatePreview(values);
      return values;
    };

    const collectFormValues = () => normaliseValues({
      orientation: orientationSelect ? orientationSelect.value : undefined,
      autoScale: autoScaleInput ? autoScaleInput.checked : undefined
    });

    applyDisplayValues(readJSON(storageKey, fallback));

    if (orientationSelect && !orientationSelect.dataset.bound) {
      orientationSelect.addEventListener('change', () => {
        applyDisplayValues(collectFormValues(), { updateInputs: false });
      });
      orientationSelect.dataset.bound = '1';
    }

    if (autoScaleInput && !autoScaleInput.dataset.bound) {
      autoScaleInput.addEventListener('change', () => {
        applyDisplayValues(collectFormValues(), { updateInputs: false });
      });
      autoScaleInput.dataset.bound = '1';
    }

    if (fullscreenButton && !fullscreenButton.dataset.bound) {
      const syncFullscreenState = () => {
        if (!fullscreenButton) {
          return;
        }
        const active = Boolean(document.fullscreenElement);
        fullscreenButton.textContent = active ? 'إيقاف ملء الشاشة' : 'تفعيل ملء الشاشة';
      };

      fullscreenButton.addEventListener('click', async () => {
        if (!document.fullscreenEnabled) {
          updateStatus('وضع ملء الشاشة غير مدعوم في هذا المتصفح.', 'warning');
          return;
        }
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
            updateStatus('تم إيقاف وضع ملء الشاشة.', 'info');
          } else {
            await document.documentElement.requestFullscreen();
            updateStatus('تم تفعيل وضع ملء الشاشة.', 'success');
          }
        } catch (error) {
          updateStatus('تعذّر التبديل لوضع ملء الشاشة. قد يمنع المتصفح هذا الإجراء.', 'error');
        }
        syncFullscreenState();
      });

      document.addEventListener('fullscreenchange', syncFullscreenState);
      syncFullscreenState();
      fullscreenButton.dataset.bound = '1';
    }

    bindSaveRestore(storageKey, {
      saveButton,
      restoreButton,
      readValues: () => applyDisplayValues(collectFormValues(), { updateInputs: false }),
      applyValues: (payload) => {
        applyDisplayValues(payload);
      },
      fallback,
      setStatus: updateStatus
    });
  }


  function buildAttendanceDailyLogSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card attendance-card attendance-card--log';

      const header = document.createElement('div');
      header.className = 'card__header';

      const heading = document.createElement('h3');
      heading.textContent = 'سجل اليوم';
      const hint = document.createElement('p');
      hint.className = 'form-hint';
      hint.textContent = 'استخدم الفلاتر لاستعراض سجلات الحضور خلال اليوم الدراسي.';
      header.append(heading, hint);
      card.appendChild(header);

      const controls = createAttendanceFilterControls('attendance-log');
      card.appendChild(controls.element);

      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'btn primary';
      refreshButton.dataset.action = 'attendance-refresh';
      refreshButton.textContent = 'تحديث';

      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'btn';
      resetButton.dataset.action = 'attendance-reset';
      resetButton.textContent = 'تصفير الفلاتر';

      controls.actions.append(refreshButton, resetButton);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-wrap attendance-table';

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ATTENDANCE_TABLE_COLUMNS.forEach((column) => {
        const th = document.createElement('th');
        th.textContent = column.label;
        if (column.key === 'name') {
          th.dataset.sortKey = 'name';
        } else if (column.key === 'grade') {
          th.dataset.sortKey = 'grade';
        } else if (column.key === 'classroom') {
          th.dataset.sortKey = 'class';
        } else if (column.key === 'status') {
          th.dataset.sortKey = 'status';
        } else if (column.key === 'time') {
          th.dataset.sortKey = 'time';
        }
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      const tbody = document.createElement('tbody');
      tbody.dataset.attendanceTable = '1';
      table.append(thead, tbody);
      tableWrap.appendChild(table);

      const pagination = document.createElement('div');
      pagination.dataset.role = 'attendance-pagination';

      card.append(tableWrap, pagination);
      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const controls = subpanel.querySelector('.filters-bar')?.attendanceControls;
    const refreshButton = subpanel.querySelector('[data-action="attendance-refresh"]');
    const resetButton = subpanel.querySelector('[data-action="attendance-reset"]');
    const tableBody = subpanel.querySelector('.attendance-table tbody');
    const table = subpanel.querySelector('.attendance-table table');
    const thead = table ? table.querySelector('thead') : null;
    const paginatorContainer = subpanel.querySelector('[data-role="attendance-pagination"]');

    if (!controls || !tableBody) {
      return;
    }

    const PER_PAGE = 20;
    let loadedRows = [];
    let displayRows = [];
    let currentPage = 1;
    const emptyMessage = 'لا توجد سجلات مطابقة للمعايير الحالية.';

    let renderPage = () => {};

    const paginator = paginatorContainer
      ? buildPaginator(paginatorContainer, {
        page: 1,
        perPage: PER_PAGE,
        total: 0,
        onChange: ({ page }) => {
          currentPage = page;
          renderPage();
        }
      })
      : null;

    const sorter = thead
      ? makeTableSortable(thead, () => loadedRows.slice(), (rows, sortState, reason) => {
        displayRows = Array.isArray(rows) ? rows.slice() : [];
        if (!sortState || !sortState.key) {
          displayRows = loadedRows.slice();
        }
        if (reason === 'user') {
          currentPage = 1;
        }
        renderPage();
      })
      : null;

    renderPage = () => {
      const rows = Array.isArray(displayRows) && displayRows.length
        ? displayRows
        : loadedRows.slice();
      const totalItems = rows.length;

      if (!totalItems) {
        tableBody.innerHTML = '';
        renderEmpty(tableBody.parentElement, emptyMessage);
        if (paginator) {
          paginator.update({ total: 0, page: 1 });
        }
        return;
      }

      const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      const start = (currentPage - 1) * PER_PAGE;
      const pageRows = rows.slice(start, start + PER_PAGE);

      renderTableRows(tableBody, pageRows, ATTENDANCE_TABLE_COLUMNS);
      if (paginator) {
        const updated = paginator.update({ total: totalItems, page: currentPage });
        currentPage = updated.page;
      }
    };

    const updateTable = async () => {
      showSkeletonRows(tableBody);
      displayRows = [];
      currentPage = 1;
      if (paginator) {
        paginator.update({ total: 0, page: 1 });
      }
      try {
        const rows = await dl_fetchAttendance(controls.readValues());
        loadedRows = Array.isArray(rows)
          ? rows.map((row) => ({
            ...row,
            class: row.classroom
          }))
          : [];
      } catch (error) {
        console.error('تعذّر تحميل سجل الحضور.', error);
        loadedRows = [];
        displayRows = [];
        tableBody.innerHTML = '';
        renderEmpty(tableBody.parentElement, 'تعذّر تحميل بيانات الحضور.');
        if (paginator) {
          paginator.update({ total: 0, page: 1 });
        }
        showToast('تعذّر تحميل بيانات الحضور.', 'error');
        return;
      }

      if (sorter) {
        sorter.refresh();
      } else {
        renderPage();
      }
    };

    if (refreshButton && !refreshButton.dataset.bound) {
      refreshButton.addEventListener('click', updateTable);
      refreshButton.dataset.bound = '1';
    }

    if (resetButton && !resetButton.dataset.bound) {
      resetButton.addEventListener('click', () => {
        controls.reset();
        updateTable();
      });
      resetButton.dataset.bound = '1';
    }

    updateTable();
  }


  function buildAttendanceQueriesSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (subpanel.dataset._built) {
      return;
    }

    subpanel.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    const queries = [
      {
        id: 'latecomers',
        title: 'أعلى 10 متأخرين',
        description: 'أبرز الطلاب الذين تكرر تأخرهم خلال الفترة الأخيرة.',
        columns: [
          { key: 'rank', label: '#' },
          { key: 'name', label: 'الطالب' },
          { key: 'grade', label: 'الصف' },
          { key: 'classroom', label: 'الفصل' },
          { key: 'count', label: 'عدد مرات التأخير' }
        ],
        fetch: dl_fetchTopLatecomers
      },
      {
        id: 'class-compliance',
        title: 'معدل التزام الفصول',
        description: 'نسب الانضباط في الحضور لكل فصل مع توجيهات سريعة.',
        columns: [
          { key: 'classGroup', label: 'الفصل' },
          { key: 'compliance', label: 'نسبة الالتزام' },
          { key: 'lateRate', label: 'معدل التأخير' },
          { key: 'note', label: 'ملاحظة' }
        ],
        fetch: dl_fetchClassCompliance
      },
      {
        id: 'sensitive-periods',
        title: 'الحصص الحسّاسة',
        description: 'الفترات التي ترتفع فيها حالات التأخر أو الغياب وتستدعي مراقبة إضافية.',
        columns: [
          { key: 'period', label: 'الفترة' },
          { key: 'window', label: 'النطاق الزمني' },
          { key: 'lateCount', label: 'حالات التأخر' },
          { key: 'recommendation', label: 'توصية' }
        ],
        fetch: dl_fetchSensitivePeriods
      }
    ];

    queries.forEach((query) => {
      const card = document.createElement('div');
      card.className = 'card query-card';
      card.dataset.query = query.id;
      card.setAttribute('role', 'button');
      card.tabIndex = 0;

      const title = document.createElement('h3');
      title.textContent = query.title;

      const hint = document.createElement('p');
      hint.className = 'query-card__hint';
      hint.textContent = query.description;

      const cta = document.createElement('span');
      cta.className = 'query-card__cta';
      cta.textContent = 'عرض المختصر';

      card.append(title, hint, cta);

      const openModal = async () => {
        if (card.dataset.loading === '1') {
          return;
        }
        card.dataset.loading = '1';
        card.setAttribute('aria-busy', 'true');
        try {
          const rows = await query.fetch();
          openAttendanceModal({
            title: query.title,
            description: query.description,
            columns: query.columns,
            rows: Array.isArray(rows) ? rows : []
          });
        } catch (error) {
          console.error('تعذّر تحميل نتائج الاستعلام.', error);
          showToast('تعذّر تحميل نتائج الاستعلام.', 'error');
        } finally {
          delete card.dataset.loading;
          card.removeAttribute('aria-busy');
        }
      };

      card.addEventListener('click', openModal);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal();
        }
      });

      grid.appendChild(card);
    });

    subpanel.appendChild(grid);
    subpanel.dataset._built = '1';
  }


  function buildAttendanceExportSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card attendance-card attendance-card--export';

      const heading = document.createElement('h3');
      heading.textContent = 'تصدير السجلات';
      const hint = document.createElement('p');
      hint.className = 'form-hint';
      hint.textContent = 'اختر معايير التصدير ثم حدد الصيغة المناسبة للحصول على الملف.';
      card.append(heading, hint);

      const controls = createAttendanceFilterControls('attendance-export');
      card.appendChild(controls.element);

      const csvButton = document.createElement('button');
      csvButton.type = 'button';
      csvButton.className = 'btn primary';
      csvButton.dataset.action = 'attendance-export-csv';
      csvButton.textContent = 'تصدير CSV';

      const jsonButton = document.createElement('button');
      jsonButton.type = 'button';
      jsonButton.className = 'btn';
      jsonButton.dataset.action = 'attendance-export-json';
      jsonButton.textContent = 'تصدير JSON';

      controls.actions.append(csvButton, jsonButton);

      const status = document.createElement('p');
      status.className = 'form-hint attendance-export__status';
      status.dataset.role = 'export-status';
      card.appendChild(status);

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const controls = subpanel.querySelector('.filters-bar')?.attendanceControls;
    const csvButton = subpanel.querySelector('[data-action="attendance-export-csv"]');
    const jsonButton = subpanel.querySelector('[data-action="attendance-export-json"]');
    const status = subpanel.querySelector('[data-role="export-status"]');

    if (!controls || !csvButton || !jsonButton) {
      return;
    }

    const updateStatus = (message, state) => {
      if (!status) {
        return;
      }
      status.textContent = message || '';
      if (state) {
        status.dataset.state = state;
      } else {
        status.removeAttribute('data-state');
      }
    };

    const handleExport = async (format) => {
      updateStatus('جاري تجهيز البيانات…', 'loading');
      try {
        const rows = await dl_fetchAttendance(controls.readValues());
        if (!Array.isArray(rows) || rows.length === 0) {
          updateStatus('لا توجد بيانات مطابقة للتصدير حالياً.', 'warning');
          return;
        }

        const filename = createTimestampedFilename('attendance', format);
        if (format === 'csv') {
          exportToCSV(rows, ATTENDANCE_TABLE_COLUMNS, filename);
        } else {
          exportToJSON(rows, ATTENDANCE_TABLE_COLUMNS, filename);
        }
        updateStatus('تم تنزيل الملف بنجاح.', 'success');
      } catch (error) {
        console.warn('تعذّر تنفيذ عملية التصدير.', error);
        updateStatus('تعذّر توليد الملف، يرجى المحاولة مجدداً.', 'error');
      }
    };

    if (!csvButton.dataset.bound) {
      csvButton.addEventListener('click', () => handleExport('csv'));
      csvButton.dataset.bound = '1';
    }

    if (!jsonButton.dataset.bound) {
      jsonButton.addEventListener('click', () => handleExport('json'));
      jsonButton.dataset.bound = '1';
    }
  }


  function buildReportsGeneratorSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card reports-card reports-card--generator';
      card.innerHTML = `
        <h3>مولّد التقارير</h3>
        <p class="form-hint">حدد نوع التقرير والمعايير التالية لتوليد الملف المطلوب.</p>
        <div class="field-grid">
          <label class="field">
            <span>نوع التقرير</span>
            <select class="select" data-role="report-type"></select>
          </label>
          <label class="field">
            <span>التاريخ (من)</span>
            <input type="date" class="input" data-role="report-from" />
          </label>
          <label class="field">
            <span>التاريخ (إلى)</span>
            <input type="date" class="input" data-role="report-to" />
          </label>
          <label class="field">
            <span>الصف</span>
            <select class="select" data-role="report-grade"></select>
          </label>
          <label class="field">
            <span>الفصل</span>
            <select class="select" data-role="report-class"></select>
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="report-generate-csv">توليد CSV</button>
          <button type="button" class="btn" data-action="report-generate-pdf">توليد PDF</button>
          <button type="button" class="btn" data-action="report-print">طباعة</button>
        </div>
        <p class="form-hint" data-role="report-status"></p>
      `;

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const typeSelect = subpanel.querySelector('[data-role="report-type"]');
    const fromInput = subpanel.querySelector('[data-role="report-from"]');
    const toInput = subpanel.querySelector('[data-role="report-to"]');
    const gradeSelect = subpanel.querySelector('[data-role="report-grade"]');
    const classSelect = subpanel.querySelector('[data-role="report-class"]');
    const csvButton = subpanel.querySelector('[data-action="report-generate-csv"]');
    const pdfButton = subpanel.querySelector('[data-action="report-generate-pdf"]');
    const printButton = subpanel.querySelector('[data-action="report-print"]');
    const statusElement = subpanel.querySelector('[data-role="report-status"]');

    if (!typeSelect || !csvButton || !pdfButton) {
      return;
    }

    if (!typeSelect.dataset.populated) {
      REPORT_TYPE_OPTIONS.forEach((option) => {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        typeSelect.appendChild(node);
      });
      typeSelect.dataset.populated = '1';
    }

    if (gradeSelect && !gradeSelect.dataset.populated) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'كل الصفوف';
      gradeSelect.appendChild(placeholder);
      ATTENDANCE_GRADE_OPTIONS.forEach((grade) => {
        const option = document.createElement('option');
        option.value = grade;
        option.textContent = grade;
        gradeSelect.appendChild(option);
      });
      gradeSelect.dataset.populated = '1';
    }

    if (classSelect && !classSelect.dataset.populated) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'جميع الفصول';
      classSelect.appendChild(placeholder);
      ATTENDANCE_CLASS_OPTIONS.forEach((classroom) => {
        const option = document.createElement('option');
        option.value = classroom;
        option.textContent = classroom;
        classSelect.appendChild(option);
      });
      classSelect.dataset.populated = '1';
    }

    const setStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const readParams = () => ({
      type: typeSelect.value || REPORT_TYPE_OPTIONS[0]?.value || 'daily',
      from: fromInput ? fromInput.value : '',
      to: toInput ? toInput.value : '',
      grade: gradeSelect ? gradeSelect.value : '',
      classroom: classSelect ? classSelect.value : ''
    });

    const ensureRangeValid = (params) => {
      if (params.from && params.to && params.from > params.to) {
        setStatus('يرجى التحقق من نطاق التواريخ المدخل.', 'warning');
        return false;
      }
      return true;
    };

    if (!csvButton.dataset.bound) {
      csvButton.addEventListener('click', async () => {
        const params = readParams();
        if (!ensureRangeValid(params)) {
          return;
        }

        setStatus('جاري توليد التقرير…', 'loading');
        showLoading(true);
        try {
          const rows = await dl_fetchAttendance({
            grade: params.grade,
            classroom: params.classroom,
            startDate: params.from,
            endDate: params.to,
            reportType: params.type
          });

          if (!Array.isArray(rows) || rows.length === 0) {
            setStatus('لا توجد بيانات مطابقة للمعايير الحالية.', 'warning');
            return;
          }

          const filename = createTimestampedFilename('attendance-report', 'csv');
          exportToCSV(rows, ATTENDANCE_TABLE_COLUMNS, filename);
          setStatus('تم توليد ملف CSV بنجاح.', 'success');
        } catch (error) {
          console.warn('تعذّر توليد تقرير CSV.', error);
          setStatus('حدث خطأ أثناء إنشاء الملف، يرجى المحاولة مرة أخرى.', 'error');
        } finally {
          showLoading(false);
        }
      });
      csvButton.dataset.bound = '1';
    }

    if (!pdfButton.dataset.bound) {
      pdfButton.addEventListener('click', () => {
        openInfoModal({
          title: 'توليد تقرير PDF',
          message: 'سيتم التفعيل لاحقاً.'
        });
      });
      pdfButton.dataset.bound = '1';
    }

    if (printButton && !printButton.dataset.bound) {
      printButton.addEventListener('click', () => {
        window.print();
        setStatus('جارٍ تجهيز نسخة للطباعة عبر المتصفح.', 'info');
      });
      printButton.dataset.bound = '1';
    }

    state.reportsGeneratorRefs = {
      typeSelect,
      fromInput,
      toInput,
      gradeSelect,
      classSelect,
      setStatus,
      readParams
    };
  }


  function buildReportsTemplatesSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const card = document.createElement('div');
      card.className = 'card reports-card reports-card--templates';
      card.innerHTML = `
        <h3>القوالب المحفوظة</h3>
        <p class="form-hint">احفظ إعداداتك المفضلة أو استرجعها لتسريع إعداد التقارير.</p>
        <div class="field-grid">
          <label class="field">
            <span>اسم القالب</span>
            <input type="text" class="input" data-role="template-name" placeholder="اسم القالب" autocomplete="off" />
          </label>
          <label class="field">
            <span>نوع التقرير</span>
            <select class="select" data-role="template-type"></select>
          </label>
          <label class="field">
            <span>التاريخ (من)</span>
            <input type="date" class="input" data-role="template-from" />
          </label>
          <label class="field">
            <span>التاريخ (إلى)</span>
            <input type="date" class="input" data-role="template-to" />
          </label>
          <label class="field">
            <span>الصف</span>
            <select class="select" data-role="template-grade"></select>
          </label>
          <label class="field">
            <span>الفصل</span>
            <select class="select" data-role="template-class"></select>
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="template-save">حفظ قالب</button>
          <button type="button" class="btn" data-action="template-load">تحميل قالب</button>
          <button type="button" class="btn" data-action="template-delete">حذف قالب</button>
        </div>
        <div class="field template-select">
          <span>القوالب المتاحة</span>
          <select class="select" data-role="templates-select"></select>
        </div>
        <div class="template-preview" data-role="template-preview"></div>
        <p class="form-hint" data-role="templates-status"></p>
      `;

      grid.appendChild(card);
      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    const storageKey = 'adminReports:templates';
    const fallback = () => [];

    const nameInput = subpanel.querySelector('[data-role="template-name"]');
    const typeSelect = subpanel.querySelector('[data-role="template-type"]');
    const fromInput = subpanel.querySelector('[data-role="template-from"]');
    const toInput = subpanel.querySelector('[data-role="template-to"]');
    const gradeSelect = subpanel.querySelector('[data-role="template-grade"]');
    const classSelect = subpanel.querySelector('[data-role="template-class"]');
    const saveButton = subpanel.querySelector('[data-action="template-save"]');
    const loadButton = subpanel.querySelector('[data-action="template-load"]');
    const deleteButton = subpanel.querySelector('[data-action="template-delete"]');
    const listSelect = subpanel.querySelector('[data-role="templates-select"]');
    const statusElement = subpanel.querySelector('[data-role="templates-status"]');
    const preview = subpanel.querySelector('[data-role="template-preview"]');

    if (!nameInput || !typeSelect || !saveButton || !loadButton || !deleteButton || !listSelect) {
      return;
    }

    if (!typeSelect.dataset.populated) {
      REPORT_TYPE_OPTIONS.forEach((option) => {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        typeSelect.appendChild(node);
      });
      typeSelect.dataset.populated = '1';
    }

    if (gradeSelect && !gradeSelect.dataset.populated) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'كل الصفوف';
      gradeSelect.appendChild(placeholder);
      ATTENDANCE_GRADE_OPTIONS.forEach((grade) => {
        const option = document.createElement('option');
        option.value = grade;
        option.textContent = grade;
        gradeSelect.appendChild(option);
      });
      gradeSelect.dataset.populated = '1';
    }

    if (classSelect && !classSelect.dataset.populated) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'جميع الفصول';
      classSelect.appendChild(placeholder);
      ATTENDANCE_CLASS_OPTIONS.forEach((classroom) => {
        const option = document.createElement('option');
        option.value = classroom;
        option.textContent = classroom;
        classSelect.appendChild(option);
      });
      classSelect.dataset.populated = '1';
    }

    const setStatus = (message, state) => {
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message || '';
      if (state) {
        statusElement.dataset.state = state;
      } else {
        statusElement.removeAttribute('data-state');
      }
    };

    const updatePreview = (template) => {
      if (!preview) {
        return;
      }
      if (!template) {
        preview.textContent = 'اختر قالباً من القائمة أعلاه لعرض تفاصيله.';
        return;
      }

      const lines = [
        `النوع: ${REPORT_TYPE_OPTIONS.find((item) => item.value === template.type)?.label || '—'}`,
        `الفترة: ${template.from || '—'} → ${template.to || '—'}`,
        `الصف: ${template.grade || 'جميع الصفوف'}`,
        `الفصل: ${template.classroom || 'جميع الفصول'}`
      ];
      preview.textContent = lines.join(' · ');
    };

    const readTemplates = () => {
      const value = readJSON(storageKey, fallback);
      return Array.isArray(value) ? value : fallback();
    };

    const writeTemplates = (list) => Array.isArray(list) && writeJSON(storageKey, list);

    const refreshTemplatesSelect = (selectedName) => {
      const templates = readTemplates();
      listSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = templates.length ? 'اختر قالباً' : 'لا توجد قوالب محفوظة';
      placeholder.disabled = templates.length > 0;
      placeholder.selected = !selectedName;
      listSelect.appendChild(placeholder);
      listSelect.disabled = templates.length === 0;
      templates.forEach((template) => {
        const option = document.createElement('option');
        option.value = template.name;
        option.textContent = template.name;
        if (selectedName && template.name === selectedName) {
          option.selected = true;
        }
        listSelect.appendChild(option);
      });
    };

    const findTemplate = (name) => {
      if (!name) {
        return null;
      }
      const templates = readTemplates();
      return templates.find((item) => item && item.name === name) || null;
    };

    const setFormValues = (template) => {
      if (!template) {
        return;
      }
      nameInput.value = template.name || '';
      const typeValue = REPORT_TYPE_OPTIONS.some((item) => item.value === template.type)
        ? template.type
        : REPORT_TYPE_OPTIONS[0]?.value;
      if (typeValue) {
        typeSelect.value = typeValue;
      }
      if (fromInput) {
        fromInput.value = template.from || '';
      }
      if (toInput) {
        toInput.value = template.to || '';
      }
      if (gradeSelect) {
        setSelectValue(gradeSelect, template.grade || '');
      }
      if (classSelect) {
        setSelectValue(classSelect, template.classroom || '');
      }
      updatePreview(template);
    };

    const readFormValues = () => ({
      name: nameInput.value.trim(),
      type: typeSelect.value || REPORT_TYPE_OPTIONS[0]?.value || 'daily',
      from: fromInput ? fromInput.value : '',
      to: toInput ? toInput.value : '',
      grade: gradeSelect ? gradeSelect.value : '',
      classroom: classSelect ? classSelect.value : ''
    });

    const ensureRangeValid = (payload) => {
      if (payload.from && payload.to && payload.from > payload.to) {
        setStatus('نطاق التواريخ غير صحيح، يرجى التحقق منه.', 'warning');
        return false;
      }
      return true;
    };

    const handleSave = () => {
      const payload = readFormValues();
      if (!payload.name) {
        setStatus('يرجى إدخال اسم واضح للقالب.', 'warning');
        return;
      }
      if (!ensureRangeValid(payload)) {
        return;
      }

      const templates = readTemplates();
      const existingIndex = templates.findIndex((item) => item && item.name === payload.name);
      const entry = {
        name: payload.name,
        type: payload.type,
        from: payload.from,
        to: payload.to,
        grade: payload.grade,
        classroom: payload.classroom
      };

      if (existingIndex >= 0) {
        templates[existingIndex] = entry;
      } else {
        templates.push(entry);
      }

      if (writeTemplates(templates)) {
        refreshTemplatesSelect(entry.name);
        listSelect.value = entry.name;
        setFormValues(entry);
        setStatus('تم حفظ القالب بنجاح.', 'success');
      } else {
        setStatus('تعذّر حفظ القالب في التخزين المحلي.', 'error');
      }
    };

    const handleLoad = () => {
      const selectedName = listSelect.value || nameInput.value.trim();
      if (!selectedName) {
        setStatus('اختر اسماً من القائمة أو أدخله لتحميل القالب.', 'warning');
        return;
      }

      const template = findTemplate(selectedName);
      if (!template) {
        setStatus('لم يتم العثور على قالب بالاسم المحدد.', 'warning');
        return;
      }

      setFormValues(template);
      refreshTemplatesSelect(template.name);

      const applied = applyReportTemplate(template);
      if (applied) {
        setStatus(`تم تحميل القالب "${template.name}" على مولّد التقارير.`, 'info');
      } else {
        setStatus('تم تجهيز القالب. افتح مولّد التقارير لتطبيقه يدوياً.', 'info');
      }
    };

    const handleDelete = () => {
      const targetName = listSelect.value || nameInput.value.trim();
      if (!targetName) {
        setStatus('حدد القالب الذي تود حذفه أولاً.', 'warning');
        return;
      }

      const templates = readTemplates();
      const next = templates.filter((item) => item && item.name !== targetName);
      if (next.length === templates.length) {
        setStatus('لم يتم العثور على القالب المطلوب للحذف.', 'warning');
        return;
      }

      if (writeTemplates(next)) {
        if (nameInput.value.trim() === targetName) {
          nameInput.value = '';
        }
        listSelect.value = '';
        refreshTemplatesSelect('');
        updatePreview(null);
        setStatus('تم حذف القالب بنجاح.', 'success');
      } else {
        setStatus('تعذّر حذف القالب من التخزين المحلي.', 'error');
      }
    };

    const handleSelectChange = () => {
      const template = findTemplate(listSelect.value);
      if (template) {
        setFormValues(template);
      }
    };

    if (!saveButton.dataset.bound) {
      saveButton.addEventListener('click', handleSave);
      saveButton.dataset.bound = '1';
    }

    if (!loadButton.dataset.bound) {
      loadButton.addEventListener('click', handleLoad);
      loadButton.dataset.bound = '1';
    }

    if (!deleteButton.dataset.bound) {
      deleteButton.addEventListener('click', handleDelete);
      deleteButton.dataset.bound = '1';
    }

    if (!listSelect.dataset.bound) {
      listSelect.addEventListener('change', handleSelectChange);
      listSelect.dataset.bound = '1';
    }

    refreshTemplatesSelect(listSelect.value);
    updatePreview(null);
  }


  function applyReportTemplate(template) {
    if (!template || typeof template !== 'object') {
      return false;
    }

    const refs = state.reportsGeneratorRefs;
    if (!refs) {
      return false;
    }

    if (refs.typeSelect) {
      const typeValue = REPORT_TYPE_OPTIONS.some((item) => item.value === template.type)
        ? template.type
        : REPORT_TYPE_OPTIONS[0]?.value || 'daily';
      refs.typeSelect.value = typeValue;
    }

    if (refs.fromInput) {
      refs.fromInput.value = template.from || '';
    }

    if (refs.toInput) {
      refs.toInput.value = template.to || '';
    }

    if (refs.gradeSelect) {
      setSelectValue(refs.gradeSelect, template.grade || '');
    }

    if (refs.classSelect) {
      setSelectValue(refs.classSelect, template.classroom || '');
    }

    if (typeof refs.setStatus === 'function') {
      const name = template.name ? `"${template.name}"` : 'المحدد';
      refs.setStatus(`تم تطبيق القالب ${name} على الإعدادات الحالية.`, 'info');
    }

    return true;
  }


  function createAttendanceFilterControls(idPrefix) {
    const container = document.createElement('div');
    container.className = 'filters-bar';

    const dateGroup = document.createElement('div');
    dateGroup.className = 'filter-group filter-group--date';
    const dateLabel = document.createElement('span');
    dateLabel.className = 'filter-group__label';
    dateLabel.textContent = 'التاريخ';
    dateGroup.appendChild(dateLabel);

    const radiosWrapper = document.createElement('div');
    radiosWrapper.className = 'filter-group__radios';

    const radioName = uniqueId(`${idPrefix || 'attendance'}-date`);
    const radioOptions = [
      { value: 'today', label: 'اليوم', checked: true },
      { value: 'yesterday', label: 'الأمس', checked: false },
      { value: 'range', label: 'نطاق زمني', checked: false }
    ];
    radioOptions.forEach((option) => {
      const chip = document.createElement('label');
      chip.className = 'filter-chip';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = radioName;
      input.value = option.value;
      input.checked = option.checked;
      const caption = document.createElement('span');
      caption.textContent = option.label;
      chip.append(input, caption);
      radiosWrapper.appendChild(chip);
    });
    dateGroup.appendChild(radiosWrapper);

    const rangeWrapper = document.createElement('div');
    rangeWrapper.className = 'filter-group__range';
    rangeWrapper.dataset.role = 'date-range';
    const rangeStart = document.createElement('input');
    rangeStart.type = 'date';
    rangeStart.className = 'input';
    rangeStart.dataset.role = 'date-start';
    const rangeEnd = document.createElement('input');
    rangeEnd.type = 'date';
    rangeEnd.className = 'input';
    rangeEnd.dataset.role = 'date-end';
    rangeWrapper.append(rangeStart, rangeEnd);
    dateGroup.appendChild(rangeWrapper);

    container.appendChild(dateGroup);

    const gradeGroup = document.createElement('div');
    gradeGroup.className = 'filter-group';
    const gradeLabel = document.createElement('label');
    gradeLabel.className = 'field';
    const gradeTitle = document.createElement('span');
    gradeTitle.textContent = 'الصف';
    const gradeSelect = document.createElement('select');
    gradeSelect.className = 'select';
    gradeSelect.dataset.role = 'filter-grade';
    const gradeAll = document.createElement('option');
    gradeAll.value = '';
    gradeAll.textContent = 'جميع الصفوف';
    gradeSelect.appendChild(gradeAll);
    ATTENDANCE_GRADE_OPTIONS.forEach((grade) => {
      const option = document.createElement('option');
      option.value = grade;
      option.textContent = grade;
      gradeSelect.appendChild(option);
    });
    gradeLabel.append(gradeTitle, gradeSelect);
    gradeGroup.appendChild(gradeLabel);
    container.appendChild(gradeGroup);

    const classGroup = document.createElement('div');
    classGroup.className = 'filter-group';
    const classLabel = document.createElement('label');
    classLabel.className = 'field';
    const classTitle = document.createElement('span');
    classTitle.textContent = 'الفصل';
    const classSelect = document.createElement('select');
    classSelect.className = 'select';
    classSelect.dataset.role = 'filter-class';
    const classAll = document.createElement('option');
    classAll.value = '';
    classAll.textContent = 'جميع الفصول';
    classSelect.appendChild(classAll);
    ATTENDANCE_CLASS_OPTIONS.forEach((classroom) => {
      const option = document.createElement('option');
      option.value = classroom;
      option.textContent = classroom;
      classSelect.appendChild(option);
    });
    classLabel.append(classTitle, classSelect);
    classGroup.appendChild(classLabel);
    container.appendChild(classGroup);

    const statusGroup = document.createElement('div');
    statusGroup.className = 'filter-group';
    const statusLabel = document.createElement('label');
    statusLabel.className = 'field';
    const statusTitle = document.createElement('span');
    statusTitle.textContent = 'الحالة';
    const statusSelect = document.createElement('select');
    statusSelect.className = 'select';
    statusSelect.dataset.role = 'filter-status';
    const statusAll = document.createElement('option');
    statusAll.value = '';
    statusAll.textContent = 'جميع الحالات';
    statusSelect.appendChild(statusAll);
    ATTENDANCE_STATUS_OPTIONS.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      statusSelect.appendChild(option);
    });
    statusLabel.append(statusTitle, statusSelect);
    statusGroup.appendChild(statusLabel);
    container.appendChild(statusGroup);

    const actions = document.createElement('div');
    actions.className = 'filters-actions';
    container.appendChild(actions);

    const getSelectedDateType = () => {
      const selected = container.querySelector(`input[name="${radioName}"]:checked`);
      return selected ? selected.value : 'today';
    };

    const updateRangeVisibility = () => {
      const isRange = getSelectedDateType() === 'range';
      rangeWrapper.hidden = !isRange;
      if (!isRange) {
        rangeStart.value = '';
        rangeEnd.value = '';
      }
    };

    Array.from(container.querySelectorAll(`input[name="${radioName}"]`)).forEach((input) => {
      input.addEventListener('change', updateRangeVisibility);
    });

    updateRangeVisibility();

    const readValues = () => ({
      dateType: getSelectedDateType(),
      startDate: rangeStart.value || '',
      endDate: rangeEnd.value || '',
      grade: gradeSelect.value || '',
      classroom: classSelect.value || '',
      status: statusSelect.value || ''
    });

    const reset = () => {
      const radios = Array.from(container.querySelectorAll(`input[name="${radioName}"]`));
      radios.forEach((input, index) => {
        input.checked = index === 0;
      });
      gradeSelect.value = '';
      classSelect.value = '';
      statusSelect.value = '';
      rangeStart.value = '';
      rangeEnd.value = '';
      updateRangeVisibility();
    };

    const api = {
      element: container,
      actions,
      readValues,
      reset
    };

    container.attendanceControls = api;

    return api;
  }


  function renderTableRows(tbody, rows, columns) {
    if (!tbody) {
      return;
    }

    tbody.innerHTML = '';

    if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(columns)) {
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach((column) => {
        const td = document.createElement('td');
        let value = '';
        if (row && Object.prototype.hasOwnProperty.call(row, column.key)) {
          value = row[column.key];
        }
        td.textContent = value === 0 || value ? String(value) : '—';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }


  function openAttendanceModal(options) {
    if (!options || !Array.isArray(options.columns)) {
      return;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'modal attendance-modal';

    const header = document.createElement('div');
    header.className = 'modal__header';
    const heading = document.createElement('h3');
    heading.textContent = options.title || 'عرض البيانات';
    header.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'modal__body';

    if (options.description) {
      const description = document.createElement('p');
      description.className = 'modal__description';
      description.textContent = options.description;
      body.appendChild(description);
    }

    if (Array.isArray(options.rows) && options.rows.length > 0) {
      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-wrap';
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      options.columns.forEach((column) => {
        const th = document.createElement('th');
        th.textContent = column.label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      const tbody = document.createElement('tbody');
      table.append(thead, tbody);
      renderTableRows(tbody, options.rows, options.columns);
      tableWrap.appendChild(table);
      body.appendChild(tableWrap);
    } else {
      const empty = document.createElement('p');
      empty.className = 'modal__empty';
      empty.textContent = 'لا توجد بيانات متاحة حالياً.';
      body.appendChild(empty);
    }

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn';
    closeButton.textContent = 'إغلاق';
    footer.appendChild(closeButton);

    dialog.append(header, body, footer);

    closeButton.addEventListener('click', () => {
      dialog.close();
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      dialog.close();
    });

    dialog.addEventListener('close', () => {
      closeModal(dialog);
    });

    showModal(dialog);
  }


  function openInfoModal(options = {}) {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal info-modal';

    const header = document.createElement('div');
    header.className = 'modal__header';
    const heading = document.createElement('h3');
    heading.textContent = options.title || 'تنبيه';
    header.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'modal__body';
    if (options.message) {
      const message = document.createElement('p');
      message.className = 'modal__description';
      message.textContent = options.message;
      body.appendChild(message);
    }

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn primary';
    closeButton.textContent = options.closeLabel || 'إغلاق';
    footer.appendChild(closeButton);

    dialog.append(header, body, footer);

    closeButton.addEventListener('click', () => {
      dialog.close();
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      dialog.close();
    });

    dialog.addEventListener('close', () => {
      closeModal(dialog);
    });

    showModal(dialog);
  }




  function exportToCSV(rows, columns, filename) {
    if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(columns) || columns.length === 0) {
      throw new Error('لا توجد بيانات للتصدير.');
    }

    const header = columns.map((column) => column.label).join(',');
    const lines = rows.map((row) => columns.map((column) => {
      const value = row && Object.prototype.hasOwnProperty.call(row, column.key)
        ? row[column.key]
        : '';
      const safe = value === null || typeof value === 'undefined' ? '' : String(value);
      return '"' + safe.replace(/"/g, '""') + '"';
    }).join(','));
    const content = [header, ...lines].join('\r\n');
    downloadBlob(content, filename, 'text/csv;charset=utf-8;');
  }


  function exportToJSON(rows, columns, filename) {
    if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(columns) || columns.length === 0) {
      throw new Error('لا توجد بيانات للتصدير.');
    }

    const payload = rows.map((row) => {
      const entry = {};
      columns.forEach((column) => {
        const value = row && Object.prototype.hasOwnProperty.call(row, column.key)
          ? row[column.key]
          : '';
        entry[column.label] = value === null || typeof value === 'undefined' ? '' : value;
      });
      return entry;
    });

    downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8;');
  }


  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'export.dat';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 0);
  }




  function createTimestampedFilename(base, extension) {
    const stamp = new Date().toISOString().slice(0, 10);
    const safeBase = base || 'export';
    const safeExtension = extension || 'dat';
    return `${safeBase}-${stamp}.${safeExtension}`;
  }


  function buildBackupExportSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    const placeholder = panel.querySelector('[data-backup-placeholder]');
    if (placeholder) {
      placeholder.hidden = true;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const exportBox = panel.querySelector('[data-backup="export"]');
      const sqliteBox = panel.querySelector('[data-backup="sqlite"]');

      if (exportBox) {
        grid.appendChild(exportBox);
      }

      if (sqliteBox) {
        grid.appendChild(sqliteBox);
      }

      if (!grid.childElementCount) {
        if (placeholder) {
          placeholder.hidden = false;
        }
        buildPlaceholder(panel, subpanel, 'أخذ نسخة');
        return;
      }

      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    bindBackupExport(subpanel);
    bindDatabaseActions(subpanel);
  }

  function buildBackupImportSubtab(panel, subpanel) {
    if (!panel || !subpanel) {
      return;
    }

    const placeholder = panel.querySelector('[data-backup-placeholder]');
    if (placeholder) {
      placeholder.hidden = true;
    }

    if (!subpanel.dataset._built) {
      subpanel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      const importBox = panel.querySelector('[data-backup="import"]');

      if (importBox) {
        grid.appendChild(importBox);
      }

      if (!grid.childElementCount) {
        if (placeholder) {
          placeholder.hidden = false;
        }
        buildPlaceholder(panel, subpanel, 'استرجاع نسخة');
        return;
      }

      subpanel.appendChild(grid);
      subpanel.dataset._built = '1';
    }

    bindBackupImport(subpanel);
  }

  function bindBackupExport(scope) {
    if (!scope) {
      return;
    }

    const exportBtn = scope.querySelector('[data-action="backup-export"]');
    if (exportBtn && !exportBtn.dataset.bound) {
      exportBtn.addEventListener('click', handleBackupExport);
      exportBtn.dataset.bound = '1';
    }
  }

  function bindBackupImport(scope) {
    if (!scope) {
      return;
    }

    const fileInput = scope.querySelector('input[type="file"][data-role="backup-file"]');
    const importBtn = scope.querySelector('[data-action="backup-import"]');
    const status = scope.querySelector('[data-backup-status]');

    if (fileInput && !fileInput.dataset.bound) {
      fileInput.addEventListener('change', () => {
        if (!status) {
          return;
        }
        if (fileInput.files && fileInput.files[0]) {
          status.textContent = `تم اختيار الملف: ${fileInput.files[0].name}`;
          status.dataset.state = 'info';
        } else {
          status.textContent = '';
          status.removeAttribute('data-state');
        }
      });
      fileInput.dataset.bound = '1';
    }

    if (importBtn && !importBtn.dataset.bound) {
      importBtn.addEventListener('click', () => {
        handleBackupImport(fileInput, status);
      });
      importBtn.dataset.bound = '1';
    }
  }

  function bindDatabaseActions(scope) {
    if (!scope) {
      return;
    }

    const exportBtn = scope.querySelector('[data-action="database-export"]');
    if (exportBtn && !exportBtn.dataset.bound) {
      exportBtn.addEventListener('click', handleDatabaseExport);
      exportBtn.dataset.bound = '1';
    }

    const importInput = scope.querySelector('input[type="file"][data-action="database-import"]');
    if (importInput && !importInput.dataset.bound) {
      importInput.addEventListener('change', () => {
        handleDatabaseImport(importInput);
      });
      importInput.dataset.bound = '1';
    }
  }

  function handleBackupExport() {
    showToast('سيتم تنزيل النسخة الاحتياطية (Placeholder).', 'success');
  }

  function handleBackupImport(fileInput, status) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      showToast('اختر ملف النسخة أولاً.', 'error');
      if (status) {
        status.textContent = 'الرجاء اختيار ملف نسخة احتياطية.';
        status.dataset.state = 'warning';
      }
      return;
    }

    const fileName = fileInput.files[0].name;
    if (status) {
      status.textContent = 'جاري التحقق من الملف…';
      status.dataset.state = 'loading';
    }

    showLoading(true);

    setTimeout(() => {
      if (status) {
        status.textContent = `تم استيراد النسخة (${fileName}) بنجاح (Placeholder).`;
        status.dataset.state = 'success';
      }
      showToast('تم استيراد النسخة (Placeholder).', 'success');
      showLoading(false);
    }, 600);
  }

  function handleDatabaseExport() {
    showToast('سيتم تنزيل ملف قاعدة البيانات (Placeholder).', 'success');
  }

  function handleDatabaseImport(input) {
    if (!input || !input.files || input.files.length === 0) {
      showToast('اختر ملف قاعدة البيانات أولاً.', 'error');
      return;
    }

    const fileName = input.files[0].name;
    showToast(`تم تلقي ملف قاعدة البيانات (${fileName}) (Placeholder).`, 'success');
  }


  function formatErrorLogType(type) {
    if (type === 'promise') {
      return 'وعد غير معالج';
    }
    return 'خطأ';
  }

  function getErrorLogEntries(limit = 50) {
    const stored = readJSON(ERROR_LOG_STORAGE_KEY, []);
    if (!Array.isArray(stored)) {
      return [];
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
    const recent = safeLimit > 0 ? stored.slice(-safeLimit) : stored.slice();
    recent.sort((a, b) => {
      const aTs = typeof a?.ts === 'number' ? a.ts : 0;
      const bTs = typeof b?.ts === 'number' ? b.ts : 0;
      return bTs - aTs;
    });
    return recent;
  }

  function renderErrorLogRows(tbody, entries) {
    if (!tbody) {
      return;
    }

    tbody.innerHTML = '';
    const rows = Array.isArray(entries) ? entries.slice() : [];

    rows.sort((a, b) => {
      const aTs = typeof a?.ts === 'number' ? a.ts : 0;
      const bTs = typeof b?.ts === 'number' ? b.ts : 0;
      return bTs - aTs;
    });

    if (rows.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="3" class="muted">لا توجد أخطاء مسجّلة.</td>';
      tbody.appendChild(emptyRow);
      return;
    }

    rows.slice(0, 50).forEach((entry) => {
      const row = document.createElement('tr');

      const timeCell = document.createElement('td');
      timeCell.textContent = formatDateTime(entry?.ts);
      row.appendChild(timeCell);

      const messageCell = document.createElement('td');
      const typeLabel = document.createElement('strong');
      typeLabel.textContent = formatErrorLogType(entry?.type);
      const messageBody = document.createElement('div');
      messageBody.className = 'muted';
      messageBody.textContent = entry?.message ? String(entry.message) : '—';
      messageCell.appendChild(typeLabel);
      messageCell.appendChild(document.createElement('br'));
      messageCell.appendChild(messageBody);
      row.appendChild(messageCell);

      const detailsCell = document.createElement('td');
      const stack = entry?.stack ? String(entry.stack) : '';
      if (stack) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'عرض التفاصيل';
        const pre = document.createElement('pre');
        pre.dir = 'ltr';
        pre.textContent = stack;
        details.append(summary, pre);
        detailsCell.appendChild(details);
      } else {
        detailsCell.textContent = '—';
      }
      row.appendChild(detailsCell);

      tbody.appendChild(row);
    });
  }

  async function copyTextToClipboard(text) {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('تعذّر النسخ عبر Clipboard API.', error);
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.top = '0';
    textarea.style.insetInlineStart = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let succeeded = false;
    try {
      succeeded = document.execCommand('copy');
    } catch (error) {
      console.warn('تعذّر النسخ عبر execCommand.', error);
      succeeded = false;
    }

    textarea.remove();
    return succeeded;
  }

  function openErrorLogModal() {
    const existing = document.querySelector('dialog[data-role="error-log-modal"]');
    if (existing) {
      const tbodyExisting = existing.querySelector('[data-role="error-log-body"]');
      renderErrorLogRows(tbodyExisting, getErrorLogEntries());
      showModal(existing);
      return;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'modal error-log-modal';
    dialog.dataset.role = 'error-log-modal';

    const header = document.createElement('div');
    header.className = 'modal__header';
    const heading = document.createElement('h3');
    heading.textContent = 'سجل الأخطاء';
    header.appendChild(heading);

    const body = document.createElement('div');
    body.className = 'modal__body';
    const description = document.createElement('p');
    description.className = 'muted';
    description.textContent = 'يتم حفظ آخر ٥٠ خطأ محليًا للمساعدة في تتبّع المشكلات.';
    body.appendChild(description);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['الوقت', 'النوع / الرسالة', 'التفاصيل'].forEach((label) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    tbody.dataset.role = 'error-log-body';
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    footer.style.display = 'flex';
    footer.style.flexWrap = 'wrap';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';

    const actionsStart = document.createElement('div');
    actionsStart.style.display = 'flex';
    actionsStart.style.gap = '8px';

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'btn';
    copyButton.dataset.action = 'copy-error-log';
    copyButton.textContent = 'نسخ';

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'btn';
    clearButton.dataset.action = 'clear-error-log';
    clearButton.textContent = 'مسح';

    actionsStart.append(copyButton, clearButton);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn';
    closeButton.dataset.action = 'close';
    closeButton.textContent = 'إغلاق';

    footer.append(actionsStart, closeButton);

    dialog.append(header, body, footer);

    const updateTable = () => {
      renderErrorLogRows(tbody, getErrorLogEntries());
    };

    const handleLogUpdate = () => {
      updateTable();
    };

    window.addEventListener(ERROR_LOG_EVENT, handleLogUpdate);

    copyButton.addEventListener('click', async () => {
      const payload = JSON.stringify(getErrorLogEntries(), null, 2);
      const copied = await copyTextToClipboard(payload);
      if (copied) {
        showToast('تم نسخ سجل الأخطاء.', 'success');
      } else {
        showToast('تعذّر نسخ سجل الأخطاء تلقائيًا.', 'error');
      }
    });

    clearButton.addEventListener('click', () => {
      writeJSON(ERROR_LOG_STORAGE_KEY, []);
      dispatchErrorLogUpdate([]);
      showToast('تم مسح سجل الأخطاء.', 'success');
    });

    closeButton.addEventListener('click', () => {
      dialog.close('close');
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      dialog.close('cancel');
    });

    dialog.addEventListener('close', () => {
      window.removeEventListener(ERROR_LOG_EVENT, handleLogUpdate);
      closeModal(dialog);
    });

    updateTable();
    showModal(dialog);
  }

  // دالة عرض النتائج داخل بطاقة التشخيص الذكي بشكل منظم
  function renderDiagnosticResults(resultsArray) {
    const container = diagnosticContext.container;
    if (!container) {
      return;
    }

    container.classList.remove('muted');
    container.innerHTML = '';

    const results = Array.isArray(resultsArray) ? resultsArray.slice() : [];
    if (results.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'لم يتم العثور على نتائج بعد.';
      container.appendChild(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'diagnostic-results-list';

    const statusMap = {
      ok: { label: '✔ ناجح', className: 'diagnostic-status-ok' },
      warning: { label: '⚠ تحذير', className: 'diagnostic-status-warning' },
      error: { label: '✖ خطأ', className: 'diagnostic-status-error' }
    };

    results.forEach((item) => {
      const normalizedStatus = typeof item?.status === 'string' ? item.status : 'warning';
      const statusMeta = statusMap[normalizedStatus] || statusMap.warning;
      const title = typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : 'عنصر غير معروف';
      const description = typeof item?.description === 'string' ? item.description.trim() : '';
      const suggestion = typeof item?.suggestion === 'string' ? item.suggestion.trim() : '';
      const debug = typeof item?.debug === 'string' ? item.debug.trim() : '';

      const entry = document.createElement('li');
      entry.className = 'diagnostic-result';

      const header = document.createElement('div');
      header.className = 'diagnostic-result__header';

      const titleEl = document.createElement('span');
      titleEl.className = 'diagnostic-result__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);

      const statusEl = document.createElement('span');
      statusEl.className = `diagnostic-status ${statusMeta.className}`;
      statusEl.textContent = statusMeta.label;
      header.appendChild(statusEl);

      entry.appendChild(header);

      if (description) {
        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'diagnostic-result__description';
        descriptionEl.textContent = description;
        entry.appendChild(descriptionEl);
      }

      if (suggestion) {
        const suggestionEl = document.createElement('p');
        suggestionEl.className = 'diagnostic-result__suggestion';
        suggestionEl.innerHTML = `<strong>اقتراح:</strong> ${escapeHtml(suggestion)}`;
        entry.appendChild(suggestionEl);
      }

      if (debug) {
        const debugEl = document.createElement('p');
        debugEl.className = 'diagnostic-result__debug muted';
        debugEl.textContent = `معلومة تقنية: ${debug}`;
        entry.appendChild(debugEl);
      }

      list.appendChild(entry);
    });

    container.appendChild(list);
  }

  // التحقق من حالة الاتصال بالإنترنت
  function checkOnlineStatus() {
    const online = typeof navigator?.onLine === 'boolean' ? navigator.onLine : true;
    return {
      title: 'الاتصال بالإنترنت',
      status: online ? 'ok' : 'error',
      description: online ? 'الاتصال يعمل بشكل طبيعي.' : 'الجهاز غير متصل بالإنترنت حالياً.',
      suggestion: online ? '' : 'تحقق من الراوتر أو شبكة المدرسة ثم أعد المحاولة.'
    };
  }

  // التحقق من إمكانية الكتابة على LocalStorage
  function checkLocalStorage() {
    const testKey = 'hader:diagnostic:test';
    try {
      localStorage.setItem(testKey, String(Date.now()));
      localStorage.removeItem(testKey);
      return {
        title: 'التخزين المحلي',
        status: 'ok',
        description: 'يمكن للتطبيق القراءة والكتابة على التخزين المحلي.',
        suggestion: ''
      };
    } catch (error) {
      return {
        title: 'التخزين المحلي',
        status: 'error',
        description: 'تعذّر الوصول إلى LocalStorage.',
        suggestion: 'قم بتعطيل التصفح الخفي أو السماح بالتخزين المحلي للمتصفح الحالي.',
        debug: error && error.message ? error.message : ''
      };
    }
  }

  // محاولة الوصول إلى إعدادات Supabase للتأكد من جاهزية التكامل
  async function checkApiAvailability() {
    const supabaseUrl = typeof window.SB_URL === 'string' ? window.SB_URL.trim() : '';
    const supabaseKey = typeof window.SB_ANON === 'string' ? window.SB_ANON.trim() : '';

    if (!supabaseUrl || /<project-ref>/i.test(supabaseUrl)) {
      return {
        title: 'تكامل Supabase',
        status: 'warning',
        description: 'لم يتم ضبط عنوان مشروع Supabase بعد.',
        suggestion: 'حدّد SB_URL في ملف env.js لضمان جاهزية التكامل.'
      };
    }

    if (!supabaseKey || /<public-anon-key>/i.test(supabaseKey)) {
      return {
        title: 'تكامل Supabase',
        status: 'warning',
        description: 'مفتاح Supabase العام غير مهيأ أو يستخدم القيمة الافتراضية.',
        suggestion: 'قم بتحديث SB_ANON بمفتاح مشروعك الحقيقي.'
      };
    }

    const normalizedUrl = supabaseUrl.replace(/\/+$/, '');
    let controller = null;
    let timeoutHandle = null;

    try {
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        timeoutHandle = window.setTimeout(() => controller.abort(), 4500);
      }

      const response = await fetch(`${normalizedUrl}/auth/v1/settings`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        signal: controller ? controller.signal : undefined,
        cache: 'no-store'
      });

      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      if (response.ok) {
        return {
          title: 'تكامل Supabase',
          status: 'ok',
          description: 'تم الوصول إلى واجهة Supabase بنجاح.',
          suggestion: 'لا يلزم إجراء إضافي حالياً.'
        };
      }

      return {
        title: 'تكامل Supabase',
        status: 'error',
        description: `استجابة غير متوقعة من Supabase (رمز ${response.status}).`,
        suggestion: 'تحقق من صلاحية المفتاح وحدود CORS في إعدادات المشروع.'
      };
    } catch (error) {
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      return {
        title: 'تكامل Supabase',
        status: 'error',
        description: 'تعذّر الاتصال بخادم Supabase.',
        suggestion: 'راجع اتصال الإنترنت وبيانات SB_URL و SB_ANON.',
        debug: error && error.message ? error.message : ''
      };
    }
  }

  // فحص الأخطاء المخزّنة في سجل المتصفح
  function checkConsoleErrors() {
    const recentErrors = getErrorLogEntries(3);
    if (!recentErrors.length) {
      return {
        title: 'أخطاء المتصفح',
        status: 'ok',
        description: 'لا توجد أخطاء مسجّلة حالياً.',
        suggestion: ''
      };
    }

    return {
      title: 'أخطاء المتصفح',
      status: 'warning',
      description: `تم رصد ${recentErrors.length} خطأ مؤخرًا.`,
      suggestion: 'افتح سجل الأخطاء وشارك التفاصيل مع فريق الدعم.',
      debug: 'TODO: ربط التقاط الأخطاء مباشرة من وحدة التحكم.'
    };
  }

  // تشغيل جميع فحوصات التشخيص وتجميع النتائج
  async function runDiagnostics() {
    if (diagnosticContext.button?.disabled) {
      return;
    }

    const button = diagnosticContext.button;
    const container = diagnosticContext.container;
    const defaultLabel = button ? button.dataset.defaultLabel || button.textContent : '';

    if (button) {
      button.disabled = true;
      button.dataset.state = 'loading';
      button.textContent = 'جاري التشخيص…';
    }

    if (container) {
      container.classList.remove('muted');
      container.innerHTML = '<p class="diagnostic-progress">جاري تحليل النظام...</p>';
    }

    const results = [];
    results.push(checkOnlineStatus());
    results.push(checkLocalStorage());
    results.push(await checkApiAvailability());
    results.push(checkConsoleErrors());

    renderDiagnosticResults(results);

    if (button) {
      button.disabled = false;
      button.dataset.state = 'idle';
      button.textContent = defaultLabel || 'تشخيص الآن';
    }
  }

  // إنشاء بطاقة التشخيص الذكي ومزامنة عناصر التحكم الخاصة بها
  function createSmartDiagnosticCard() {
    const card = document.createElement('div');
    card.className = 'card smart-diagnostic-card';
    card.innerHTML = `
      <h3>تشخيص النظام</h3>
      <p class="muted">يفحص هذا المساعد إعدادات حاضر ويقترح حلولاً تلقائياً للمشكلات الشائعة.</p>
      <div class="form-actions" style="margin-top:12px; justify-content:flex-end;">
        <button type="button" class="btn primary" data-action="run-diagnostics">تشخيص الآن</button>
      </div>
      <div id="diagnostic-results" class="diagnostic-results muted">اضغط على «تشخيص الآن» لبدء الفحص.</div>
    `;

    const button = card.querySelector('[data-action="run-diagnostics"]');
    const container = card.querySelector('#diagnostic-results');

    if (container) {
      diagnosticContext.container = container;
    }

    if (button) {
      button.dataset.defaultLabel = button.textContent;
      diagnosticContext.button = button;
      button.addEventListener('click', () => {
        runDiagnostics();
      });
    }

    return card;
  }

  function createErrorLogCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>السجل والدعم</h3>
      <p class="muted">يمكنك مراجعة سجل الأخطاء الأخيرة أو نسخه لإرساله لفريق الدعم.</p>
      <div class="form-actions" style="margin-top:12px; justify-content:flex-end;">
        <button type="button" class="btn" data-action="open-error-log">عرض سجل الأخطاء</button>
      </div>
    `;

    const openButton = card.querySelector('[data-action="open-error-log"]');
    if (openButton) {
      openButton.addEventListener('click', () => {
        openErrorLogModal();
      });
    }

    return card;
  }

  function buildWipCard(subpanel, areaKey, titleText, bodyText) {
    if (!subpanel || subpanel.dataset._wipBuilt || subpanel.dataset._built) {
      return;
    }

    const safeTitle = escapeHtml(titleText || 'ميزة قيد التطوير');
    const safeBody = escapeHtml(bodyText || 'سيتم توفير تفاصيل إضافية قريبًا.');
    const wrap = document.createElement('div');
    wrap.className = 'wip-card';
    wrap.innerHTML = `
      <div class="wip-card__tag">
        <span class="wip-pill">قيد التطوير</span>
        <span>هذه الميزة ضمن خارطة الطريق القادمة.</span>
      </div>
      <h3 class="wip-card__title">${safeTitle}</h3>
      <p class="wip-card__hint">${safeBody}</p>
      <div class="wip-card__actions">
        <button class="btn" data-role="wip-suggest">اقتراح ميزة</button>
      </div>
    `;

    subpanel.innerHTML = '';
    subpanel.appendChild(wrap);
    subpanel.dataset._wipBuilt = '1';
    subpanel.dataset._built = '1';

    const btn = wrap.querySelector('[data-role="wip-suggest"]');
    if (btn) {
      btn.addEventListener('click', () => {
        const dialog = document.createElement('dialog');
        dialog.className = 'modal wip-suggestion-modal';
        dialog.innerHTML = `
          <h3>اقتراح ميزة</h3>
          <div class="form-row">
            <textarea class="input" rows="3" data-role="wip-text" placeholder="اكتب اقتراحك بإيجاز..."></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button class="btn" data-action="close">إغلاق</button>
            <button class="btn primary" data-action="save">إرسال</button>
          </div>
        `;

        showModal(dialog);

        const closeBtn = dialog.querySelector('[data-action="close"]');
        const saveBtn = dialog.querySelector('[data-action="save"]');
        const input = dialog.querySelector('[data-role="wip-text"]');

        const focusInput = () => {
          if (input && typeof input.focus === 'function') {
            try {
              input.focus();
            } catch (error) {
              console.warn('تعذّر تركيز خانة الاقتراح.', error);
            }
          }
        };

        requestAnimationFrame(focusInput);

        closeBtn?.addEventListener('click', () => {
          closeModal(dialog);
        });

        dialog.addEventListener('cancel', (event) => {
          event.preventDefault();
          closeModal(dialog);
        });

        saveBtn?.addEventListener('click', () => {
          const text = (input?.value || '').trim();
          if (!text) {
            showToast('الرجاء كتابة اقتراحك أولاً.', 'error');
            focusInput();
            return;
          }

          const list = readJSON(WIP_SUGGESTIONS_STORAGE_KEY, []);
          const suggestions = Array.isArray(list) ? list.slice() : [];
          suggestions.push({ area: areaKey || 'unknown', text, ts: Date.now() });
          writeJSON(WIP_SUGGESTIONS_STORAGE_KEY, suggestions);
          closeModal(dialog);
          showToast('تم إرسال الاقتراح، شكرًا لك.', 'success');
        });
      });
    }
  }

  function buildHelpDiagnosticsSubtab(panel, subpanel) {
    if (!panel || !subpanel || subpanel.dataset._built) {
      return;
    }

    // إنشاء بطاقة أدوات التشخيص ضمن تبويب المساعدة
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML = `
      <h3 style="margin-top:0;">أدوات تشخيص النظام</h3>
      <p class="muted">
        استخدم هذه الأدوات لاختبار حالة الربط بين الواجهات، التهيئة، واتصال الشبكة / Supabase.
        يتم عرض نتيجة الفحص على لمبات الحالة في أعلى لوحة الإدارة.
      </p>

      <div class="form-row" style="margin:12px 0;">
        <label>حالة النظام الحالية:</label>
        <div class="diagnostics-status" data-role="diag-status-text">
          لم يتم إجراء الفحص بعد.
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
        <button class="btn" data-role="diag-run">اختبار الاتصال</button>
        <button class="btn" data-role="diag-refresh">تحديث عرض اللمبات</button>
      </div>

      <p class="muted" style="margin-top:10px;font-size:.85rem;">
        • الأخضر: النظام يعمل بشكل طبيعي.<br>
        • البرتقالي: مشكلة في الاتصال أو Supabase غير مهيأ بشكل كامل.<br>
        • الأحمر: مشكلة في الكود الأساسي أو مكوّنات رئيسية مفقودة.
      </p>
    `;

    subpanel.innerHTML = '';
    subpanel.appendChild(wrap);

    const statusEl = wrap.querySelector('[data-role="diag-status-text"]');
    const runBtn = wrap.querySelector('[data-role="diag-run"]');
    const refreshBtn = wrap.querySelector('[data-role="diag-refresh"]');

    // دالة مساعدة لتحويل حالة الفحص إلى نص مفهوم للمستخدم
    function describe(status) {
      switch (status) {
        case 'ok':
          return '✅ النظام يعمل بشكل طبيعي.';
        case 'network-error':
          return '🟠 هناك مشكلة في الاتصال أو تهيئة Supabase، تحقق من الشبكة والإعدادات.';
        case 'code-error':
          return '🔴 هناك مشكلة في الكود الأساسي أو تهيئة إحدى الوحدات (HaderAuth / HaderTheme / forceLogin).';
        default:
          return 'ℹ️ لم يتم التعرف على الحالة الحالية.';
      }
    }

    // تنفيذ فحص الصحة من خلال وحدة HaderHealth
    async function runCheck() {
      if (!window.HaderHealth || typeof HaderHealth.check !== 'function') {
        if (statusEl) {
          statusEl.textContent = 'لا يمكن إجراء الفحص: وحدة الصحة غير متوفرة.';
        }
        return;
      }

      if (statusEl) {
        statusEl.textContent = 'جاري الفحص...';
      }

      try {
        const result = await HaderHealth.check();
        if (statusEl) {
          statusEl.textContent = describe(result);
        }
      } catch (error) {
        console.error('تعذّر تنفيذ فحص النظام:', error);
        if (statusEl) {
          statusEl.textContent = 'حدث خطأ غير متوقع أثناء الفحص.';
        }
      }
    }

    if (runBtn) {
      runBtn.addEventListener('click', runCheck);
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (!window.HaderHealth || typeof HaderHealth.check !== 'function') {
          if (statusEl) {
            statusEl.textContent = 'لا يمكن تحديث الحالة: وحدة الصحة غير متوفرة.';
          }
          return;
        }
        runCheck();
      });
    }

    subpanel.dataset._built = '1';
  }

  function buildHelpWipSubtab(panel, subpanel) {
    buildWipCard(
      subpanel,
      'settings-help',
      'مركز المساعدة والدعم الفني',
      'سيتم توفير دليل استخدام تفاعلي ومواد تدريبية وروابط دعم فني مخصصة.'
    );
  }

  function buildAboutWipSubtab(panel, subpanel) {
    buildWipCard(
      subpanel,
      'settings-about',
      'عن نظام حاضر',
      'سيتم إضافة معلومات عن رؤية النظام، أهدافه، وحقوق الاستخدام والتحديثات القادمة.'
    );
  }

  function buildSmartToolsWipSubtab(panel, subpanel) {
    buildWipCard(
      subpanel,
      'settings-smart-tools',
      'أدوات ذكية للمراقبة والتحليل',
      'سيتم إضافة مجموعة من الأدوات الذكية لمراقبة السلوك، وتحليل الحضور، وتوليد تقارير متقدمة تلقائيًا.'
    );
  }

  function normalizeLabel(rawLabel, index) {
    const fallback = `قسم ${index + 1}`;
    if (typeof rawLabel !== 'string') {
      return fallback;
    }
    const trimmed = rawLabel.trim();
    return trimmed || fallback;
  }

  function createSubtabId(panelId, label, index) {
    const fallback = `${panelId || 'panel'}-${index + 1}`;
    if (typeof label !== 'string') {
      return fallback;
    }
    const normalized = label
      .trim()
      .replace(/[\s\u2000-\u200A\u202F\u205F\u3000\/|،؛]+/g, '-')
      .replace(/[^-\w\u0600-\u06FF]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `${panelId || 'panel'}-${normalized || fallback}`;
  }

  function readActiveTabPreference() {
    try {
      return localStorage.getItem(STORAGE_KEYS.activeTab) || null;
    } catch (error) {
      console.warn('تعذّر قراءة تفضيل التبويب الرئيسي.', error);
      return null;
    }
  }

  function writeActiveTabPreference(tabId) {
    try {
      localStorage.setItem(STORAGE_KEYS.activeTab, tabId);
    } catch (error) {
      console.warn('تعذّر حفظ تفضيل التبويب الرئيسي.', error);
    }
  }

  function readSubtabPreference(panelId) {
    try {
      return localStorage.getItem(`${STORAGE_KEYS.subtabPrefix}${panelId}`) || null;
    } catch (error) {
      console.warn('تعذّر قراءة تفضيل التبويب الفرعي.', error);
      return null;
    }
  }

  function writeSubtabPreference(panelId, subId) {
    try {
      localStorage.setItem(`${STORAGE_KEYS.subtabPrefix}${panelId}`, subId);
    } catch (error) {
      console.warn('تعذّر حفظ تفضيل التبويب الفرعي.', error);
    }
  }

  function findTabButton(tabId) {
    return state.tabButtons.find((button) => button.dataset.tab === tabId) || null;
  }

  function findPanel(panelId) {
    return state.panels.find((panel) => panel.dataset.panel === panelId) || null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
