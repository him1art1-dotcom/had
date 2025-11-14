;(function(){
  'use strict';

  // تهيئة واجهة مصغّرة للمصادقة لحين ربط النظام بمزوّد الهوية الكامل
  const auth = (typeof window.HaderAuth === 'object' && window.HaderAuth) || {};

  if (typeof auth.getStatus !== 'function') {
    auth.getStatus = function(){
      return { authenticated: true, role: 'admin', provider: 'placeholder' };
    };
  }

  if (typeof auth.ensureSession !== 'function') {
    auth.ensureSession = function(){
      return Promise.resolve(true);
    };
  }

  window.HaderAuth = auth;
})();
