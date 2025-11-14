import '../storage-sql.js';

function hasSqlStore() {
  return (
    typeof window !== 'undefined' &&
    window.HaderStores &&
    typeof window.HaderStores.createSqlStore === 'function'
  );
}

function ensureSqlStoreFactory() {
  if (!hasSqlStore()) {
    throw new Error('مخزن SQL.js غير مهيأ.');
  }
  return window.HaderStores.createSqlStore;
}

function migrateLegacyKeys(activeSchoolId) {
  if (typeof window.HaderStores?.migrateOldSqlJsKeys === 'function') {
    window.HaderStores.migrateOldSqlJsKeys(activeSchoolId);
  } else if (typeof window.migrateOldKeysIfNeeded === 'function') {
    window.migrateOldKeysIfNeeded(activeSchoolId);
  }
}

const backend = {
  name: 'sqljs',
  describe() {
    return hasSqlStore()
      ? { ready: true }
      : { ready: false, reason: 'مكتبة SQL.js غير مهيأة' };
  },
  async init(context = {}) {
    if (!hasSqlStore()) {
      throw new Error('مكتبة SQL.js غير مهيأة.');
    }
    migrateLegacyKeys(context.schoolId);
  },
  create(context = {}) {
    const factory = ensureSqlStoreFactory();
    return factory({ activeSchoolId: context.schoolId });
  }
};

export default backend;
