import '../storage-ls.js';

function hasLocalStore() {
  return (
    typeof window !== 'undefined' &&
    window.HaderStores &&
    typeof window.HaderStores.createLocalStore === 'function'
  );
}

function ensureLocalStoreFactory() {
  if (!hasLocalStore()) {
    throw new Error('مخزن LocalStorage غير مهيأ.');
  }
  return window.HaderStores.createLocalStore;
}

const backend = {
  name: 'localstorage',
  describe() {
    return hasLocalStore()
      ? { ready: true }
      : { ready: false, reason: 'مخزن LocalStorage غير متوفر' };
  },
  async init() {
    if (!hasLocalStore()) {
      throw new Error('مخزن LocalStorage غير مهيأ.');
    }
  },
  create(context = {}) {
    const factory = ensureLocalStoreFactory();
    return factory({ activeSchoolId: context.schoolId });
  }
};

export default backend;
