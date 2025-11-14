(function (global) {
  "use strict";

  const defaultMapping = Object.freeze({
    targets: {
      students: ["id", "name", "grade", "class", "national_id", "guardian_phone", "created_at"],
      attendance: ["id", "student_id", "date", "status", "note", "created_at"],
      permissions: ["id", "student_id", "reason", "note", "status", "created_at"]
    }
  });

  const LEGACY_KEYS = {
    students: {
      name: ["full_name", "name", "studentName", "std_name"],
      national_id: ["national_id", "nid", "iqama"],
      grade: ["grade", "gradeLevel"],
      class: ["class", "className"],
      guardian_phone: ["guardian_phone", "parentPhone"],
      id: ["id"],
      created_at: ["created_at", "createdAt"]
    },
    attendance: {
      id: ["id"],
      student_id: ["student_id", "st_id", "national_id"],
      date: ["ts", "datetime", "time", "date"],
      status: ["status", "status_text"],
      note: ["late_minutes", "late", "tardy_mins"],
      created_at: ["created_at"]
    },
    permissions: {
      id: ["id"],
      student_id: ["student_id", "st_id", "national_id"],
      reason: ["reason", "type"],
      note: ["note", "notes"],
      status: ["status", "approved"],
      created_at: ["created_at", "createdAt"]
    }
  };

  let legacyBannerShown = false;

  function nowISO() {
    return new Date().toISOString();
  }

  function toISO(value) {
    if (!value) return null;
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toISOString();
    } catch (error) {
      return String(value);
    }
  }

  function ensureNow(nowOverride) {
    if (nowOverride == null) {
      return nowISO();
    }
    const iso = toISO(nowOverride);
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) {
      return nowISO();
    }
    return new Date(parsed).toISOString();
  }

  function containersFrom(source) {
    const list = [];
    if (source && typeof source === "object") {
      list.push(source);
      if (source.data && typeof source.data === "object") {
        list.push(source.data);
      }
      if (source.tables && typeof source.tables === "object") {
        list.push(source.tables);
      }
      if (source.payload && typeof source.payload === "object") {
        list.push(source.payload);
      }
    }
    return list;
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (!value || typeof value !== "object") {
      return [];
    }
    if (Array.isArray(value.rows)) {
      return value.rows;
    }
    return Object.values(value);
  }

  function normalizeTables(source) {
    const result = {
      students: [],
      attendance: [],
      permissions: []
    };
    const nameMap = {
      students: ["students", "student", "pupils"],
      attendance: ["attendance", "attendances"],
      permissions: ["permissions", "permits", "requests"]
    };
    const pools = containersFrom(source);
    Object.entries(nameMap).forEach(([target, aliases]) => {
      for (let i = 0; i < pools.length; i += 1) {
        const pool = pools[i];
        for (let j = 0; j < aliases.length; j += 1) {
          const key = aliases[j];
          if (Object.prototype.hasOwnProperty.call(pool || {}, key)) {
            const candidate = pool[key];
            const arrayValue = toArray(candidate);
            result[target] = arrayValue;
            return;
          }
        }
      }
    });
    return result;
  }

  function hasLegacyIndicator(studentsRow, attendanceRow, permissionsRow) {
    if (studentsRow && typeof studentsRow === "object") {
      if (Object.prototype.hasOwnProperty.call(studentsRow, "full_name")) {
        return true;
      }
    }
    if (attendanceRow && typeof attendanceRow === "object") {
      if (
        Object.prototype.hasOwnProperty.call(attendanceRow, "ts") ||
        Object.prototype.hasOwnProperty.call(attendanceRow, "late_minutes")
      ) {
        return true;
      }
    }
    if (permissionsRow && typeof permissionsRow === "object") {
      if (Object.prototype.hasOwnProperty.call(permissionsRow, "approved")) {
        return true;
      }
    }
    return false;
  }

  function isLegacyJSON(obj) {
    if (!obj || typeof obj !== "object") {
      return false;
    }
    if (obj.meta?.schema === "hader.v1") {
      return true;
    }
    const tables = normalizeTables(obj);
    const firstStudent = tables.students?.[0] || null;
    const firstAttendance = tables.attendance?.[0] || null;
    const firstPermission = tables.permissions?.[0] || null;
    return hasLegacyIndicator(firstStudent, firstAttendance, firstPermission);
  }

  function detectSchema(oldData) {
    const normalized = normalizeTables(oldData || {});
    const pick = (row, keys) => keys.find((key) => key && row && Object.prototype.hasOwnProperty.call(row, key));
    const studentSample = normalized.students?.[0] || {};
    const attendanceSample = normalized.attendance?.[0] || {};
    const permissionSample = normalized.permissions?.[0] || {};
    const S = LEGACY_KEYS.students;
    const A = LEGACY_KEYS.attendance;
    const P = LEGACY_KEYS.permissions;
    return {
      students: {
        id: pick(studentSample, S.id),
        name: pick(studentSample, S.name),
        national_id: pick(studentSample, S.national_id),
        grade: pick(studentSample, S.grade),
        class: pick(studentSample, S.class),
        guardian: pick(studentSample, S.guardian_phone),
        created_at: pick(studentSample, S.created_at)
      },
      attendance: {
        id: pick(attendanceSample, A.id),
        national_id: pick(attendanceSample, A.student_id),
        ts: pick(attendanceSample, A.date),
        status: pick(attendanceSample, A.status),
        late: pick(attendanceSample, A.note),
        created_at: pick(attendanceSample, A.created_at)
      },
      permissions: {
        id: pick(permissionSample, P.id),
        student_id: pick(permissionSample, P.student_id),
        reason: pick(permissionSample, P.reason),
        note: pick(permissionSample, P.note),
        status: pick(permissionSample, P.status),
        created_at: pick(permissionSample, P.created_at)
      }
    };
  }

  function buildDynamicMapping(schema) {
    const m = {
      targets: defaultMapping.targets,
      mapping: {
        students: {},
        attendance: {},
        permissions: {}
      }
    };
    const students = schema?.students || {};
    const attendance = schema?.attendance || {};
    const permissions = schema?.permissions || {};

    if (students.name) m.mapping.students[students.name] = "name";
    if (students.national_id) m.mapping.students[students.national_id] = "national_id";
    if (students.grade) m.mapping.students[students.grade] = "grade";
    if (students.class) m.mapping.students[students.class] = "class";
    if (students.guardian) m.mapping.students[students.guardian] = "guardian_phone";
    m.mapping.students[students.id || "id"] = "id";
    if (students.created_at) m.mapping.students[students.created_at] = "created_at";

    if (attendance.national_id) m.mapping.attendance[attendance.national_id] = "student_id";
    if (attendance.ts) m.mapping.attendance[attendance.ts] = "date";
    if (attendance.status) m.mapping.attendance[attendance.status] = "status";
    if (attendance.late) m.mapping.attendance[attendance.late] = "note";
    m.mapping.attendance[attendance.id || "id"] = "id";
    if (attendance.created_at) m.mapping.attendance[attendance.created_at] = "created_at";

    if (permissions.student_id) m.mapping.permissions[permissions.student_id] = "student_id";
    if (permissions.reason) m.mapping.permissions[permissions.reason] = "reason";
    if (permissions.note) m.mapping.permissions[permissions.note] = "note";
    if (permissions.status) m.mapping.permissions[permissions.status] = "status";
    m.mapping.permissions[permissions.id || "id"] = "id";
    if (permissions.created_at) m.mapping.permissions[permissions.created_at] = "created_at";

    return m;
  }

  function normalizeStudentRow(mapped, source, nowStamp) {
    const target = { ...mapped };
    const idSource = target.id ?? source?.id;
    const id = idSource != null ? String(idSource).trim() : "";
    if (!id) {
      return null;
    }
    target.id = id;
    const nameSource = target.name ?? source?.name ?? source?.full_name ?? "";
    target.name = String(nameSource ?? "").trim();
    if (target.grade != null) target.grade = String(target.grade).trim();
    if (target.class != null) target.class = String(target.class).trim();
    if (target.national_id != null) target.national_id = String(target.national_id).trim();
    if (target.guardian_phone != null) target.guardian_phone = String(target.guardian_phone).trim();
    const createdSource = target.created_at ?? source?.created_at ?? source?.createdAt;
    const createdAt = createdSource ? toISO(createdSource) : nowStamp;
    target.created_at = createdAt || nowStamp;
    if (target.national_id == null) target.national_id = "";
    if (target.guardian_phone == null) target.guardian_phone = "";
    if (!target.name) target.name = "";
    if (target.grade == null) target.grade = "";
    if (target.class == null) target.class = "";
    return target;
  }

  function normalizeAttendanceRow(mapped, source, nowStamp) {
    const target = { ...mapped };
    const studentSource =
      target.student_id ?? source?.student_id ?? source?.st_id ?? source?.national_id ?? source?.id;
    const studentId = studentSource != null ? String(studentSource).trim() : "";
    if (!studentId) {
      return null;
    }
    target.student_id = studentId;

    if (target.id != null) {
      target.id = String(target.id).trim();
    }

    const dateSource = target.date ?? source?.date ?? source?.datetime ?? source?.ts ?? source?.time;
    const isoDate = dateSource ? toISO(dateSource) : null;
    target.date = isoDate;

    if (target.status != null) {
      target.status = String(target.status).trim();
    } else if (source?.status_text != null) {
      target.status = String(source.status_text).trim();
    } else if (source?.status != null) {
      target.status = String(source.status).trim();
    } else {
      target.status = "";
    }

    if (target.note == null) {
      if (source?.late_minutes != null) {
        target.note = String(source.late_minutes);
      } else if (source?.late != null) {
        target.note = String(source.late);
      } else if (source?.tardy_mins != null) {
        target.note = String(source.tardy_mins);
      } else {
        target.note = "";
      }
    } else if (typeof target.note !== "string") {
      target.note = String(target.note);
    }

    if (target.created_at != null) {
      target.created_at = toISO(target.created_at);
    }
    if (!target.created_at) {
      const fallback = source?.created_at ?? source?.createdAt;
      const fallbackIso = fallback ? toISO(fallback) : null;
      target.created_at = fallbackIso || target.date || nowStamp;
    }

    if (!target.id) {
      target.id = `${target.student_id}-${target.date || nowStamp}`;
    }

    return target;
  }

  function normalizePermissionRow(mapped, source, nowStamp) {
    const target = { ...mapped };
    const studentSource =
      target.student_id ?? source?.student_id ?? source?.st_id ?? source?.national_id ?? source?.id;
    const studentId = studentSource != null ? String(studentSource).trim() : "";
    if (!studentId) {
      return null;
    }
    target.student_id = studentId;

    if (target.id != null) {
      target.id = String(target.id).trim();
    }

    if (target.reason != null) {
      target.reason = String(target.reason).trim();
    } else if (source?.reason != null) {
      target.reason = String(source.reason).trim();
    } else if (source?.type != null) {
      target.reason = String(source.type).trim();
    } else {
      target.reason = "";
    }

    if (target.note != null) {
      target.note = String(target.note).trim();
    } else if (source?.note != null) {
      target.note = String(source.note).trim();
    } else if (source?.notes != null) {
      target.note = String(source.notes).trim();
    } else {
      target.note = "";
    }

    if (target.status == null && Object.prototype.hasOwnProperty.call(source || {}, "approved")) {
      target.status = source.approved ? "approved" : "pending";
    } else if (typeof target.status === "boolean") {
      target.status = target.status ? "approved" : "pending";
    } else if (target.status != null) {
      const normalizedStatus = String(target.status).trim().toLowerCase();
      if (["true", "1", "yes", "approved"].includes(normalizedStatus)) {
        target.status = "approved";
      } else if (["false", "0", "no", "pending", "waiting"].includes(normalizedStatus)) {
        target.status = "pending";
      } else {
        target.status = normalizedStatus || "pending";
      }
    } else {
      target.status = "pending";
    }

    if (target.created_at != null) {
      target.created_at = toISO(target.created_at);
    }
    if (!target.created_at) {
      const fallback = source?.created_at ?? source?.createdAt;
      const fallbackIso = fallback ? toISO(fallback) : null;
      target.created_at = fallbackIso || nowStamp;
    }

    if (!target.id) {
      target.id = `${target.student_id}-${target.created_at}`;
    }

    return target;
  }

  function mapRows(table, rows, mapping, nowStamp) {
    const list = Array.isArray(rows) ? rows : toArray(rows);
    const map = mapping?.[table] || {};
    const result = [];
    for (let index = 0; index < list.length; index += 1) {
      const row = list[index];
      if (!row || typeof row !== "object") continue;
      const mapped = {};
      Object.entries(map).forEach(([sourceKey, targetKey]) => {
        if (Object.prototype.hasOwnProperty.call(row, sourceKey) && row[sourceKey] != null) {
          mapped[targetKey] = row[sourceKey];
        }
      });
      let normalizedRow = null;
      if (table === "students") {
        normalizedRow = normalizeStudentRow(mapped, row, nowStamp);
      } else if (table === "attendance") {
        normalizedRow = normalizeAttendanceRow(mapped, row, nowStamp);
      } else if (table === "permissions") {
        normalizedRow = normalizePermissionRow(mapped, row, nowStamp);
      } else {
        normalizedRow = mapped;
      }
      if (normalizedRow) {
        result.push(normalizedRow);
      }
    }
    return result;
  }

  function announceLegacyMode() {
    if (legacyBannerShown) return;
    if (typeof document === "undefined") return;
    const message = "تم تفعيل وضع التوافق مع حاضر القديم";
    const host =
      document.querySelector("[data-legacy-status]") ||
      document.querySelector("[data-status-message]") ||
      document.querySelector("[data-backup-status]") ||
      document.querySelector("[data-database-status]");
    if (host) {
      if (host.childElementCount === 0 && host.textContent.trim() === "") {
        host.textContent = message;
      } else {
        const note = document.createElement("p");
        note.className = "legacy-compat";
        note.textContent = message;
        host.appendChild(note);
      }
      host.dataset.state = "info";
    } else {
      const banner = document.createElement("div");
      banner.className = "legacy-compat";
      banner.textContent = message;
      banner.dataset.state = "info";
      document.body?.appendChild(banner);
    }
    legacyBannerShown = true;
  }

  function toNewJSON(rawInput, options = {}) {
    const tables = normalizeTables(rawInput || {});
    const schema = detectSchema(tables);
    const mappingInfo = buildDynamicMapping(schema);
    const mapping = options.mapping || mappingInfo.mapping;
    const nowStamp = ensureNow(options.now);
    const legacyMode = isLegacyJSON(rawInput);

    const students = mapRows("students", tables.students, mapping, nowStamp);
    const attendance = mapRows("attendance", tables.attendance, mapping, nowStamp);
    const permissions = mapRows("permissions", tables.permissions, mapping, nowStamp).map((entry) => {
      if (entry.status === true) {
        entry.status = "approved";
      } else if (entry.status === false) {
        entry.status = "pending";
      }
      if (typeof entry.status === "string") {
        const lowered = entry.status.toLowerCase();
        if (["true", "1", "yes"].includes(lowered)) {
          entry.status = "approved";
        } else if (["false", "0", "no", "pending", "waiting"].includes(lowered)) {
          entry.status = "pending";
        } else {
          entry.status = lowered;
        }
      }
      return entry;
    });

    if (legacyMode) {
      announceLegacyMode();
    }

    const meta = {
      schema: "hader.v2",
      generated_at: nowStamp
    };
    if (legacyMode) {
      meta.legacy = true;
      meta.source_schema = rawInput?.meta?.schema || "hader.v1";
    } else if (rawInput?.meta?.schema) {
      meta.source_schema = rawInput.meta.schema;
    }

    return {
      meta,
      students,
      attendance,
      permissions
    };
  }

  function readTableFromDatabase(db, name) {
    if (!db || typeof db.exec !== "function") {
      return [];
    }
    try {
      const query = `SELECT * FROM "${name}"`;
      const result = db.exec(query);
      if (!result || !result.length || !result[0].values.length) {
        return [];
      }
      const { columns, values } = result[0];
      return values.map((row) => {
        const record = {};
        for (let index = 0; index < columns.length; index += 1) {
          record[columns[index]] = row[index];
        }
        return record;
      });
    } catch (error) {
      try {
        const fallbackResult = db.exec(`SELECT * FROM ${name}`);
        if (!fallbackResult || !fallbackResult.length || !fallbackResult[0].values.length) {
          return [];
        }
        const { columns, values } = fallbackResult[0];
        return values.map((row) => {
          const record = {};
          for (let index = 0; index < columns.length; index += 1) {
            record[columns[index]] = row[index];
          }
          return record;
        });
      } catch (fallbackError) {
        console.warn(`تعذّر قراءة جدول ${name} من قاعدة البيانات legacy.`, fallbackError);
        return [];
      }
    }
  }

  function readOld(db) {
    if (!db) {
      return {
        students: [],
        attendance: [],
        permissions: []
      };
    }

    if (typeof db === "string") {
      try {
        const parsed = JSON.parse(db);
        return readOld(parsed);
      } catch (error) {
        console.warn("تعذّر تحليل تمثيل قاعدة البيانات كنص JSON.", error);
        return {
          students: [],
          attendance: [],
          permissions: []
        };
      }
    }

    if (typeof db.exec === "function") {
      const studentsPrimary = readTableFromDatabase(db, "students");
      const studentsFallback =
        studentsPrimary.length > 0 ? studentsPrimary : readTableFromDatabase(db, "student");
      const students =
        studentsFallback.length > 0 ? studentsFallback : readTableFromDatabase(db, "pupils");

      const attendancePrimary = readTableFromDatabase(db, "attendance");
      const attendance =
        attendancePrimary.length > 0 ? attendancePrimary : readTableFromDatabase(db, "attendances");

      const permissionsPrimary = readTableFromDatabase(db, "permissions");
      const permissionsFallback =
        permissionsPrimary.length > 0 ? permissionsPrimary : readTableFromDatabase(db, "permits");
      const permissions =
        permissionsFallback.length > 0 ? permissionsFallback : readTableFromDatabase(db, "requests");
      return {
        students,
        attendance,
        permissions
      };
    }

    return normalizeTables(db);
  }

  const api = {
    defaultMapping,
    LEGACY_KEYS,
    isLegacyJSON,
    detectSchema,
    buildDynamicMapping,
    toNewJSON,
    readOld,
    normalizeTables,
    toISO
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.HaderLegacy = Object.assign(global.HaderLegacy || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : window);
