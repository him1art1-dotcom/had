// بدّل القيم لاحقًا من لوحة الدعم أو يدويًا
window.SB_URL = window.SB_URL || "https://<project-ref>.supabase.co";
window.SB_ANON = window.SB_ANON || "<public-anon-key>";

// تهيئة عميل عام للجميع
window.sb = window.SB_URL && window.SB_ANON
  ? supabase.createClient(window.SB_URL, window.SB_ANON)
  : null;

// مساعدات عامة للجلسة
const AUTH_KEY = 'hader:auth:session';
export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}
export function setSession(s) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(s));
}
export function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}
