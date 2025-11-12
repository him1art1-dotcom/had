(function (global) {
  "use strict";

  const CHANNEL_NAME = "hader-remote-sync";
  const STATE_KEY = "aa_remote_sync_state";

  const DEFAULT_REMOTE_SETTINGS = Object.freeze({
    remoteSyncEnabled: false,
    remoteSyncEndpoint: "",
    remoteSyncAuthToken: "",
    remoteSyncSchoolCode: "",
    remoteSyncMode: "time",
    remoteSyncTime: "08:00",
    remoteSyncCountdownMinutes: 30,
    remoteSyncSupervisors: [],
    remoteSyncSupervisorsText: ""
  });

  const DEFAULT_STATE = Object.freeze({
    lastAttemptAt: null,
    lastAttemptDay: null,
    lastSuccessAt: null,
    lastSuccessDay: null,
    lastStatus: null,
    lastSummary: null,
    lastError: null,
    pendingRetryAt: null,
    pendingLeaveAck: []
  });

  const RETRY_MINUTES = 10;

  function uniqueStrings(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    list.forEach((value) => {
      const token = typeof value === "string" ? value.trim() : String(value ?? "").trim();
      if (!token || seen.has(token)) return;
      seen.add(token);
      result.push(token);
    });
    return result;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    if (typeof min === "number" && number < min) {
      return min;
    }
    if (typeof max === "number" && number > max) {
      return max;
    }
    return number;
  }

  function sanitizeTimeString(value, fallback) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (/^\d{2}:\d{2}$/.test(raw)) {
      const [hours, minutes] = raw.split(":").map((part) => parseInt(part, 10));
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        const safeHours = clampNumber(hours, 0, 23, 0);
        const safeMinutes = clampNumber(minutes, 0, 59, 0);
        return `${String(safeHours).padStart(2, "0")}:${String(safeMinutes).padStart(2, "0")}`;
      }
    }
    if (raw.length === 5 && raw.includes(".")) {
      const candidate = raw.replace(".", ":");
      return sanitizeTimeString(candidate, fallback);
    }
    return typeof fallback === "string" && fallback ? fallback : "08:00";
  }

  function parseTimeToSeconds(timeString) {
    const safe = sanitizeTimeString(timeString, "00:00");
    const [hours, minutes] = safe.split(":").map((part) => parseInt(part, 10));
    return hours * 3600 + minutes * 60;
  }

  function parseSupervisorLines(input) {
    const raw = Array.isArray(input)
      ? input
      : String(input || "")
          .split(/\r?\n/)
          .map((line) => line.trim());
    const supervisors = [];
    const errors = [];

    raw.forEach((line, index) => {
      if (!line) return;
      const parts = line.split("|").map((part) => part.trim()).filter((part) => part !== "");
      if (parts.length === 0) {
        errors.push({ line: index + 1, reason: "missing-id" });
        return;
      }

      const [idPart, namePart, ...rest] = parts;
      if (!idPart) {
        errors.push({ line: index + 1, reason: "missing-id" });
        return;
      }

      const descriptor = {
        id: idPart,
        name: namePart || idPart,
        scope: "all",
        grades: [],
        classes: [],
        phases: [],
        tags: [],
        rawLine: line
      };

      rest.forEach((segment) => {
        if (!segment) return;
        const [key, value] = segment.split("=").map((part) => part.trim());
        if (!value) {
          const token = key.toLowerCase();
          if (["all", "everyone", "general"].includes(token)) {
            descriptor.scope = "all";
          } else if (token.startsWith("tag:")) {
            descriptor.tags.push(token.slice(4));
          }
          return;
        }

        const normalizedKey = key.toLowerCase();
        const list = value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        if (normalizedKey === "grades" || normalizedKey === "grade") {
          descriptor.grades.push(...list);
        } else if (normalizedKey === "classes" || normalizedKey === "class") {
          descriptor.classes.push(...list);
        } else if (normalizedKey === "phases" || normalizedKey === "phase" || normalizedKey === "stage") {
          descriptor.phases.push(...list);
        } else if (normalizedKey === "tags" || normalizedKey === "tag") {
          descriptor.tags.push(...list.map((item) => item.toLowerCase()));
        } else if (normalizedKey === "scope") {
          descriptor.scope = list[0]?.toLowerCase() === "custom" ? "custom" : "all";
        }
      });

      if (descriptor.grades.length > 0 || descriptor.classes.length > 0 || descriptor.phases.length > 0) {
        descriptor.scope = "custom";
      }

      supervisors.push(descriptor);
    });

    return { supervisors, errors };
  }

  function formatSupervisorLine(supervisor) {
    if (!supervisor || typeof supervisor !== "object") {
      return "";
    }
    const pieces = [supervisor.id || "", supervisor.name || supervisor.id || ""];
    if (Array.isArray(supervisor.grades) && supervisor.grades.length > 0) {
      pieces.push(`grades=${supervisor.grades.join(",")}`);
    }
    if (Array.isArray(supervisor.classes) && supervisor.classes.length > 0) {
      pieces.push(`classes=${supervisor.classes.join(",")}`);
    }
    if (Array.isArray(supervisor.phases) && supervisor.phases.length > 0) {
      pieces.push(`phases=${supervisor.phases.join(",")}`);
    }
    if (Array.isArray(supervisor.tags) && supervisor.tags.length > 0) {
      pieces.push(`tags=${supervisor.tags.join(",")}`);
    }
    if (supervisor.scope === "custom" && pieces.length <= 2) {
      pieces.push("scope=custom");
    }
    return pieces.filter(Boolean).join(" | ");
  }

  function normalizeSettings(base) {
    const source = base && typeof base === "object" ? base : {};
    const merged = { ...DEFAULT_REMOTE_SETTINGS, ...source };
    merged.remoteSyncEnabled = Boolean(merged.remoteSyncEnabled);
    merged.remoteSyncEndpoint = typeof merged.remoteSyncEndpoint === "string"
      ? merged.remoteSyncEndpoint.trim()
      : "";
    merged.remoteSyncAuthToken = typeof merged.remoteSyncAuthToken === "string"
      ? merged.remoteSyncAuthToken.trim()
      : "";
    merged.remoteSyncSchoolCode = typeof merged.remoteSyncSchoolCode === "string"
      ? merged.remoteSyncSchoolCode.trim()
      : "";
    merged.remoteSyncMode = typeof merged.remoteSyncMode === "string" && merged.remoteSyncMode.toLowerCase() === "countdown"
      ? "countdown"
      : "time";
    merged.remoteSyncTime = sanitizeTimeString(merged.remoteSyncTime, DEFAULT_REMOTE_SETTINGS.remoteSyncTime);
    merged.remoteSyncCountdownMinutes = clampNumber(
      merged.remoteSyncCountdownMinutes,
      0,
      720,
      DEFAULT_REMOTE_SETTINGS.remoteSyncCountdownMinutes
    );

    const parsedSupervisors = parseSupervisorLines(
      merged.remoteSyncSupervisorsText || merged.remoteSyncSupervisors
    );
    merged.remoteSyncSupervisors = parsedSupervisors.supervisors;
    merged.remoteSyncSupervisorsText = Array.isArray(source.remoteSyncSupervisorsText)
      ? source.remoteSyncSupervisorsText
          .map((line) => (typeof line === "string" ? line.trim() : ""))
          .filter(Boolean)
          .join("\n")
      : typeof source.remoteSyncSupervisorsText === "string"
        ? source.remoteSyncSupervisorsText
        : parsedSupervisors.supervisors.map((item) => formatSupervisorLine(item)).join("\n");

    return merged;
  }

  function readState(storage) {
    const store = storage || (typeof global.localStorage !== "undefined" ? global.localStorage : null);
    if (!store) return { ...DEFAULT_STATE };
    try {
      const raw = store.getItem(STATE_KEY);
      if (!raw) {
        return { ...DEFAULT_STATE };
      }
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch (error) {
      console.warn("تعذّر قراءة حالة المزامنة السحابية.", error);
      return { ...DEFAULT_STATE };
    }
  }

  function writeState(storage, nextState) {
    const store = storage || (typeof global.localStorage !== "undefined" ? global.localStorage : null);
    if (!store) return;
    try {
      store.setItem(STATE_KEY, JSON.stringify(nextState));
    } catch (error) {
      console.warn("تعذّر حفظ حالة المزامنة السحابية.", error);
    }
  }

  function normalizeToken(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
  }

  function matchesToken(tokens, target) {
    if (!tokens || tokens.length === 0) return false;
    const normalizedTarget = normalizeToken(target);
    return tokens.some((token) => normalizedTarget === token || normalizedTarget.includes(token));
  }

  function normalizeSupervisorDescriptor(descriptor) {
    if (!descriptor || typeof descriptor !== "object") return null;
    const grades = Array.isArray(descriptor.grades)
      ? descriptor.grades.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const classes = Array.isArray(descriptor.classes)
      ? descriptor.classes.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const phases = Array.isArray(descriptor.phases)
      ? descriptor.phases.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const tags = Array.isArray(descriptor.tags)
      ? descriptor.tags.map((item) => normalizeToken(item)).filter(Boolean)
      : [];

    const gradeTokens = grades.map((item) => normalizeToken(item)).filter(Boolean);
    const classTokens = classes.map((item) => normalizeToken(item)).filter(Boolean);
    const phaseTokens = phases.map((item) => normalizeToken(item)).filter(Boolean);

    return {
      id: String(descriptor.id || "").trim() || null,
      name: String(descriptor.name || descriptor.id || "").trim() || null,
      scope: descriptor.scope === "custom" ? "custom" : "all",
      grades,
      classes,
      phases,
      tags,
      gradeTokens,
      classTokens,
      phaseTokens
    };
  }

  function buildPayload(studentsInput, attendanceInput, settingsInput, now = new Date(), options = {}) {
    const settings = normalizeSettings(settingsInput);
    const students = Array.isArray(studentsInput) ? studentsInput : [];
    const attendance = attendanceInput && typeof attendanceInput === "object" ? attendanceInput : {};
    const todayKey = now.toISOString().slice(0, 10);
    const thresholdSeconds = parseTimeToSeconds(settings.schoolStart || "07:00") + (Number(settings.graceMinutes) || 0) * 60;

    const rows = students.map((student) => {
      const id = String(student.id || "").trim();
      const grade = student.grade != null ? String(student.grade).trim() : "";
      const klass = student.class != null ? String(student.class).trim() : "";
      const dayRecords = attendance?.[todayKey] || {};
      const recordedTime = dayRecords?.[id] || null;
      let status = "absent";
      let lateMinutes = 0;
      if (recordedTime) {
        const diffSeconds = parseTimeToSeconds(recordedTime) - thresholdSeconds;
        if (diffSeconds > 0) {
          status = "late";
          lateMinutes = Math.ceil(diffSeconds / 60);
        } else {
          status = "present";
        }
      }
      return {
        id,
        name: student.name != null ? String(student.name).trim() : "",
        grade,
        class: klass,
        arrivalTime: recordedTime,
        status,
        lateMinutes
      };
    });

    const presentList = rows.filter((row) => row.status !== "absent");
    const lateList = rows.filter((row) => row.status === "late");
    const absentList = rows.filter((row) => row.status === "absent");

    const summary = {
      totalStudents: students.length,
      presentCount: presentList.length,
      lateCount: lateList.length,
      absentCount: absentList.length
    };

    const supervisorDescriptors = Array.isArray(settings.remoteSyncSupervisors)
      ? settings.remoteSyncSupervisors
      : [];
    const normalizedSupervisors = supervisorDescriptors
      .map((descriptor) => normalizeSupervisorDescriptor(descriptor))
      .filter((descriptor) => descriptor && descriptor.id);

    const packages = {};
    normalizedSupervisors.forEach((supervisor) => {
      const filtered = rows.filter((row) => {
        if (supervisor.scope === "all" && supervisor.gradeTokens.length === 0 && supervisor.classTokens.length === 0 && supervisor.phaseTokens.length === 0) {
          return true;
        }
        const matchesGrade = matchesToken(supervisor.gradeTokens, row.grade);
        const matchesClass = matchesToken(supervisor.classTokens, row.class);
        const matchesPhase = matchesToken(supervisor.phaseTokens, `${row.grade} ${row.class}`);
        return matchesGrade || matchesClass || matchesPhase;
      });
      const supervisorPresent = filtered.filter((row) => row.status !== "absent");
      const supervisorLate = filtered.filter((row) => row.status === "late");
      const supervisorAbsent = filtered.filter((row) => row.status === "absent");
      packages[supervisor.id] = {
        summary: {
          total: filtered.length,
          present: supervisorPresent.length,
          late: supervisorLate.length,
          absent: supervisorAbsent.length
        },
        lists: {
          present: supervisorPresent,
          late: supervisorLate,
          absent: supervisorAbsent
        }
      };
    });

    const payload = {
      version: "hader.remote/v1",
      generatedAt: now.toISOString(),
      day: todayKey,
      school: {
        code: settings.remoteSyncSchoolCode || "",
        name: settings.schoolName || ""
      },
      schedule: {
        mode: settings.remoteSyncMode,
        time: settings.remoteSyncTime,
        countdownMinutes: settings.remoteSyncCountdownMinutes
      },
      summary,
      lists: {
        present: presentList,
        late: lateList,
        absent: absentList
      },
      recipients: [
        {
          id: "all",
          name: "جميع المشرفين",
          scope: "all",
          grades: [],
          classes: [],
          phases: [],
          tags: []
        },
        ...normalizedSupervisors.map((descriptor) => ({
          id: descriptor.id,
          name: descriptor.name,
          scope: descriptor.scope,
          grades: descriptor.grades,
          classes: descriptor.classes,
          phases: descriptor.phases,
          tags: descriptor.tags
        }))
      ],
      packages: {
        all: {
          summary,
          lists: {
            present: presentList,
            late: lateList,
            absent: absentList
          }
        },
        bySupervisor: packages
      }
    };

    const ack = Array.isArray(options.acknowledgedLeaveRequests)
      ? uniqueStrings(options.acknowledgedLeaveRequests)
      : [];
    if (ack.length > 0) {
      payload.acknowledgedLeaveRequests = ack;
    }

    return payload;
  }

  function collectLeaveRequests(responseBody) {
    if (!responseBody || typeof responseBody !== "object") return [];
    if (Array.isArray(responseBody.leaveRequests)) {
      return responseBody.leaveRequests;
    }
    if (responseBody.inbox && Array.isArray(responseBody.inbox.leaveRequests)) {
      return responseBody.inbox.leaveRequests;
    }
    if (Array.isArray(responseBody.commands)) {
      return responseBody.commands
        .filter((command) => command && command.kind === "leave-request")
        .map((command) => command.payload)
        .filter(Boolean);
    }
    return [];
  }

  function computeScheduledTime(now, settings) {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const dayKey = midnight.toISOString().slice(0, 10);

    if (settings.remoteSyncMode === "countdown") {
      const schoolStart = sanitizeTimeString(settings.schoolStart || "07:00", "07:00");
      const baseMinutes = parseTimeToSeconds(schoolStart) / 60;
      const countdownMinutes = clampNumber(settings.remoteSyncCountdownMinutes, 0, 720, 30);
      const scheduledMinutes = baseMinutes + countdownMinutes;
      const scheduled = new Date(midnight.getTime() + scheduledMinutes * 60 * 1000);
      return { dayKey, scheduled };
    }

    const scheduledTime = sanitizeTimeString(settings.remoteSyncTime, "08:00");
    const [hour, minute] = scheduledTime.split(":").map((part) => parseInt(part, 10));
    const scheduled = new Date(midnight);
    scheduled.setHours(hour, minute, 0, 0);
    return { dayKey, scheduled };
  }

  function createManager(options = {}) {
    const {
      getSettings = () => ({}),
      getStudents = () => [],
      getAttendance = () => ({}),
      fetchImpl = typeof global.fetch === "function" ? global.fetch.bind(global) : null,
      notify,
      applyLeaveRequests,
      storage = typeof global.localStorage !== "undefined" ? global.localStorage : null,
      channelName = CHANNEL_NAME
    } = options;

    let timerId = null;
    let running = false;
    const controlChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName) : null;

    const emit = (payload) => {
      if (typeof notify === "function") {
        try {
          notify(payload);
        } catch (error) {
          console.warn("تعذّر تمرير إشعار المزامنة السحابية.", error);
        }
      }
      if (controlChannel && payload) {
        controlChannel.postMessage({ type: "status", payload });
      }
    };

    const readCurrentState = () => readState(storage);
    const writeCurrentState = (state) => {
      writeState(storage, state);
      emit({
        kind: "state",
        state,
        timestamp: new Date().toISOString()
      });
    };

    const shouldRunNow = (settings, state, now) => {
      if (!settings.remoteSyncEnabled) return false;
      if (!settings.remoteSyncEndpoint) return false;
      const { scheduled, dayKey } = computeScheduledTime(now, settings);
      if (state.pendingRetryAt) {
        const retryDate = new Date(state.pendingRetryAt);
        if (Number.isFinite(retryDate.getTime()) && retryDate > now) {
          return false;
        }
      }
      if (now < scheduled) {
        return false;
      }
      if (state.lastSuccessDay === dayKey) {
        return false;
      }
      if (state.lastAttemptDay === dayKey && state.lastStatus === "pending") {
        return false;
      }
      return true;
    };

    const scheduleNext = () => {
      if (!running) return;
      if (timerId) {
        clearTimeout(timerId);
      }
      const settings = normalizeSettings(getSettings() || {});
      if (!settings.remoteSyncEnabled || !settings.remoteSyncEndpoint) {
        return;
      }
      const now = new Date();
      const state = readCurrentState();
      if (shouldRunNow(settings, state, now)) {
        triggerSync("schedule");
        return;
      }

      const { scheduled } = computeScheduledTime(now, settings);
      let delayMs = scheduled.getTime() - now.getTime();
      if (state.pendingRetryAt) {
        const retryDate = new Date(state.pendingRetryAt);
        if (Number.isFinite(retryDate.getTime())) {
          const retryDelay = retryDate.getTime() - now.getTime();
          if (retryDelay > 0) {
            delayMs = Math.min(delayMs > 0 ? delayMs : Number.MAX_SAFE_INTEGER, retryDelay);
          }
        }
      }

      if (!Number.isFinite(delayMs) || delayMs < 0) {
        delayMs = 60 * 60 * 1000; // ساعة افتراضية
      }

      timerId = setTimeout(() => {
        timerId = null;
        if (running) {
          triggerSync("schedule");
        }
      }, Math.max(delayMs, 30 * 1000));
    };

    const triggerSync = async (reason = "manual") => {
      const settings = normalizeSettings(getSettings() || {});
      if (!settings.remoteSyncEnabled || !settings.remoteSyncEndpoint) {
        emit({
          kind: "status",
          status: "disabled",
          reason,
          timestamp: new Date().toISOString()
        });
        scheduleNext();
        return;
      }

      const now = new Date();
      const state = readCurrentState();
      const ackToSend = Array.isArray(state.pendingLeaveAck)
        ? uniqueStrings(state.pendingLeaveAck)
        : [];
      const nextState = {
        ...state,
        lastAttemptAt: now.toISOString(),
        lastAttemptDay: now.toISOString().slice(0, 10),
        lastStatus: "pending",
        lastError: null,
        pendingRetryAt: null,
        pendingLeaveAck: ackToSend
      };
      writeCurrentState(nextState);

      emit({
        kind: "status",
        status: "pending",
        reason,
        timestamp: now.toISOString(),
        settings
      });

      let payload;
      try {
        payload = buildPayload(getStudents(), getAttendance(), settings, now, {
          acknowledgedLeaveRequests: ackToSend
        });
      } catch (error) {
        const failureState = {
          ...nextState,
          lastStatus: "error",
          lastError: { message: error?.message || "تعذّر تجهيز البيانات.", at: now.toISOString() },
          pendingRetryAt: new Date(now.getTime() + RETRY_MINUTES * 60 * 1000).toISOString()
        };
        writeCurrentState(failureState);
        emit({
          kind: "status",
          status: "error",
          reason,
          timestamp: now.toISOString(),
          error: failureState.lastError
        });
        scheduleNext();
        return;
      }

      if (typeof fetchImpl !== "function") {
        const failureState = {
          ...nextState,
          lastStatus: "error",
          lastError: { message: "واجهة fetch غير متاحة في هذا المتصفح.", at: now.toISOString() },
          pendingRetryAt: new Date(now.getTime() + RETRY_MINUTES * 60 * 1000).toISOString()
        };
        writeCurrentState(failureState);
        emit({
          kind: "status",
          status: "error",
          reason,
          timestamp: now.toISOString(),
          error: failureState.lastError
        });
        scheduleNext();
        return;
      }

      let appliedLeaveAck = [];

      try {
        const response = await fetchImpl(settings.remoteSyncEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(settings.remoteSyncAuthToken
              ? { Authorization: `Bearer ${settings.remoteSyncAuthToken}` }
              : {})
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch (error) {
          /* تجاهل أخطاء قراءة الجسم */
        }

        const leaveRequests = collectLeaveRequests(responseBody);
        if (Array.isArray(leaveRequests) && leaveRequests.length > 0 && typeof applyLeaveRequests === "function") {
          try {
            const processed = await applyLeaveRequests(leaveRequests);
            appliedLeaveAck = uniqueStrings(processed);
          } catch (error) {
            console.warn("تعذّر تطبيق طلبات الاستئذان الواردة من السحابة.", error);
          }
        }

        const successState = {
          ...nextState,
          lastStatus: "success",
          lastSuccessAt: now.toISOString(),
          lastSuccessDay: payload.day,
          lastSummary: payload.summary,
          lastError: null,
          pendingRetryAt: null,
          pendingLeaveAck: appliedLeaveAck
        };
        writeCurrentState(successState);
        emit({
          kind: "status",
          status: "success",
          reason,
          timestamp: now.toISOString(),
          payload,
          response: responseBody
        });
        if (appliedLeaveAck.length > 0) {
          emit({
            kind: "leave-requests-applied",
            acknowledgements: appliedLeaveAck,
            timestamp: now.toISOString()
          });
        }
      } catch (error) {
        const failureState = {
          ...nextState,
          lastStatus: "error",
          lastError: { message: error?.message || "فشل الاتصال بالخادم.", at: now.toISOString() },
          pendingRetryAt: new Date(now.getTime() + RETRY_MINUTES * 60 * 1000).toISOString(),
          pendingLeaveAck: ackToSend
        };
        writeCurrentState(failureState);
        emit({
          kind: "status",
          status: "error",
          reason,
          timestamp: now.toISOString(),
          error: failureState.lastError
        });
      }

      scheduleNext();
    };

    const handleChannelMessage = (event) => {
      if (!event || !event.data) return;
      if (event.data.type === "request-sync") {
        triggerSync(event.data.reason || "remote-request");
      }
      if (event.data.type === "state-request") {
        emit({
          kind: "state",
          state: readCurrentState(),
          timestamp: new Date().toISOString(),
          passive: true
        });
      }
    };

    if (controlChannel) {
      controlChannel.addEventListener("message", handleChannelMessage);
    }

    const start = () => {
      if (running) return;
      running = true;
      scheduleNext();
    };

    const stop = () => {
      running = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (controlChannel) {
        controlChannel.removeEventListener("message", handleChannelMessage);
      }
    };

    const refresh = () => {
      scheduleNext();
    };

    return {
      start,
      stop,
      triggerSync,
      refresh,
      readState: readCurrentState
    };
  }

  global.HaderRemoteSync = Object.freeze({
    CHANNEL_NAME,
    STATE_KEY,
    DEFAULT_REMOTE_SETTINGS,
    createManager,
    parseSupervisorLines,
    formatSupervisorLine,
    buildPayload,
    normalizeSettings,
    readState,
    sanitizeTimeString
  });
})(typeof window !== "undefined" ? window : globalThis);

