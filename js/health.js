;(function(){
  'use strict';

  const STATUS = {
    OK: 'ok',
    CODE_ERROR: 'code-error',
    NETWORK_ERROR: 'network-error'
  };

  function getLightsRoot() {
    return document.querySelector('[data-role="system-status"]');
  }

  function setLights(status) {
    const root = getLightsRoot();
    if (!root) return;
    const dots = root.querySelectorAll('.status-lights__dot');
    dots.forEach(d => d.classList.remove('is-on'));

    if (status === STATUS.OK) {
      const green = root.querySelector('[data-color="green"]');
      green && green.classList.add('is-on');
    } else if (status === STATUS.NETWORK_ERROR) {
      const amber = root.querySelector('[data-color="amber"]');
      amber && amber.classList.add('is-on');
    } else if (status === STATUS.CODE_ERROR) {
      const red = root.querySelector('[data-color="red"]');
      red && red.classList.add('is-on');
    }
  }

  function checkCoreModules() {
    // تأكد من وجود الوحدات الأساسية للنظام
    const modulesOk =
      typeof window.HaderTheme === 'object' &&
      typeof window.HaderAuth === 'object' &&
      typeof window.forceLogin === 'object';

    return modulesOk;
  }

  function checkNetworkLayer() {
    // لو Supabase مفعّل نتأكد أنه جاهز، وإلا نستخدم حالة الاتصال العامة
    const hasSupabaseConfig = !!window.SB_URL && !String(window.SB_URL).includes('<project-ref>');
    const online = navigator.onLine !== false;

    if (hasSupabaseConfig) {
      // إذا متوقعين Supabase لكن window.sb غير مفعّل => مشكلة تهيئة/اتصال
      if (!window.sb) return false;
    }

    // لو ما فيه مشروع Supabase، نكتفي بحالة الشبكة العامة
    return online;
  }

  async function runHealthCheck() {
    try {
      const coreOk = checkCoreModules();
      if (!coreOk) {
        setLights(STATUS.CODE_ERROR);
        return STATUS.CODE_ERROR;
      }

      const netOk = checkNetworkLayer();
      if (!netOk) {
        setLights(STATUS.NETWORK_ERROR);
        return STATUS.NETWORK_ERROR;
      }

      setLights(STATUS.OK);
      return STATUS.OK;
    } catch (e) {
      console.error('Health check failed:', e);
      setLights(STATUS.CODE_ERROR);
      return STATUS.CODE_ERROR;
    }
  }

  // تشغيل عند تحميل صفحة الإدارة
  document.addEventListener('DOMContentLoaded', () => {
    // مهلة بسيطة حتى تُحمّل بقية السكربتات
    setTimeout(runHealthCheck, 200);
  });

  // إتاحة دوال للاستخدام من تبويب "مساعدة"
  window.HaderHealth = {
    check: runHealthCheck,
    setLights
  };
})();
