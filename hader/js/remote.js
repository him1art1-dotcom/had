(function () {
  "use strict";

  const REMOTE_SYNC = window.HaderRemoteSync || null;
  const CHANNEL_NAME = REMOTE_SYNC?.CHANNEL_NAME || "hader-remote-sync";
  const STORAGE_KEY = "aa_remote_client_state";

  const DEFAULT_PREFS = Object.freeze({
    endpoint: "",
    schoolCode: "",
    token: "",
    supervisor: "all",
    autoRefresh: true,
    leaveSupervisorName: "",
    leaveSupervisorContact: ""
  });

  const state = {
    prefs: loadPreferences(),
    data: null,
    filtered: { present: [], late: [], absent: [] },
    recipients: [],
    lastStatus: null
  };

  const elements = {
    form: document.querySelector("[data-connection-form]"),
    endpoint: document.querySelector("[data-endpoint]"),
    schoolCode: document.querySelector("[data-school-code]"),
    token: document.querySelector("[data-token]"),
    supervisor: document.querySelector("[data-supervisor]"),
    day: document.querySelector("[data-day]") || document.createElement("input"),
    autoRefresh: document.querySelector("[data-auto-refresh]"),
    fetchButton: document.querySelector("[data-fetch]") || document.createElement("button"),
    status: document.querySelector("[data-status]") || document.createElement("span"),
    summaryTotal: document.querySelector("[data-summary-total]") || document.createElement("span"),
    summaryPresent: document.querySelector("[data-summary-present]") || document.createElement("span"),
    summaryLate: document.querySelector("[data-summary-late]") || document.createElement("span"),
    summaryAbsent: document.querySelector("[data-summary-absent]") || document.createElement("span"),
    summaryGenerated: document.querySelector("[data-summary-generated]") || document.createElement("span"),
    summarySchedule: document.querySelector("[data-summary-schedule]") || document.createElement("span"),
    tableBodies: {
      present: document.querySelector("[data-table-body=present]") || document.createElement("tbody"),
      late: document.querySelector("[data-table-body=late]") || document.createElement("tbody"),
      absent: document.querySelector("[data-table-body=absent]") || document.createElement("tbody")
    },
    emptyStates: {
      present: document.querySelector("[data-empty-state=present]") || document.createElement("div"),
      late: document.querySelector("[data-empty-state=late]") || document.createElement("div"),
      absent: document.querySelector("[data-empty-state=absent]") || document.createElement("div")
    },
    downloadButtons: Array.from(document.querySelectorAll("[data-download]")),
    toast: document.querySelector("[data-toast]") || document.createElement("div"),
    leaveForm: document.querySelector("[data-leave-form]") || null,
    leaveStudentId: document.querySelector("[data-leave-student-id]") || null,
    leaveStudentName: document.querySelector("[data-leave-student-name]") || null,
    leaveGrade: document.querySelector("[data-leave-grade]") || null,
    leaveClass: document.querySelector("[data-leave-class]") || null,
    leaveReason: document.querySelector("[data-leave-reason]") || null,
    leaveNote: document.querySelector("[data-leave-note]") || null,
    leaveSupervisorName: document.querySelector("[data-leave-supervisor-name]") || null,
    leaveSupervisorContact: document.querySelector("[data-leave-supervisor-contact]") || null,
    leaveStatus: document.querySelector("[data-leave-status]") || null,
    leaveSubmit: document.querySelector("[data-leave-submit]") || null
  };

  const remoteChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

  initialize();

  function initialize() {
    applyPreferences();
    bindEvents();
    renderCachedData();
    if (state.prefs.autoRefresh && state.data) {
      showStatus("تم تحميل آخر نسخة محفوظة.", "idle");
    }
    remoteChannel?.addEventListener("message", handleRemoteChannelMessage);
  }

  function bindEvents() {
    elements.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await fetchReport();
    });
    elements.supervisor?.addEventListener("change", () => {
      state.prefs.supervisor = elements.supervisor.value || "all";
      savePreferences();
      renderData(state.data);
    });
    elements.endpoint?.addEventListener("input", handlePrefsChange);
    elements.schoolCode?.addEventListener("input", handlePrefsChange);
    elements.token?.addEventListener("input", handlePrefsChange);
    elements.autoRefresh?.addEventListener("change", () => {
      state.prefs.autoRefresh = elements.autoRefresh.checked;
      savePreferences();
    });
    elements.downloadButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const type = button.dataset.download;
        if (!type) return;
        downloadCsv(type);
      });
    });
    elements.leaveForm?.addEventListener("submit", handleLeaveSubmit);
    elements.leaveSupervisorName?.addEventListener("input", () => {
      state.prefs.leaveSupervisorName = elements.leaveSupervisorName.value.trim();
      savePreferences();
    });
    elements.leaveSupervisorContact?.addEventListener("input", () => {
      state.prefs.leaveSupervisorContact = elements.leaveSupervisorContact.value.trim();
      savePreferences();
    });
  }

  function handlePrefsChange() {
    state.prefs.endpoint = elements.endpoint?.value?.trim() || "";
    state.prefs.schoolCode = elements.schoolCode?.value?.trim() || "";
    state.prefs.token = elements.token?.value?.trim() || "";
    savePreferences();
  }

  function applyPreferences() {
    if (elements.endpoint) elements.endpoint.value = state.prefs.endpoint;
    if (elements.schoolCode) elements.schoolCode.value = state.prefs.schoolCode;
    if (elements.token) elements.token.value = state.prefs.token;
    if (elements.supervisor) elements.supervisor.value = state.prefs.supervisor;
    if (elements.autoRefresh) elements.autoRefresh.checked = Boolean(state.prefs.autoRefresh);
    if (elements.leaveSupervisorName) elements.leaveSupervisorName.value = state.prefs.leaveSupervisorName || "";
    if (elements.leaveSupervisorContact) {
      elements.leaveSupervisorContact.value = state.prefs.leaveSupervisorContact || "";
    }
    if (elements.day && !elements.day.value) {
      elements.day.value = new Date().toISOString().slice(0, 10);
    }
  }

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PREFS };
      return { ...DEFAULT_PREFS, ...parsed };
    } catch (error) {
      console.warn("تعذّر قراءة تفضيلات الواجهة السحابية.", error);
      return { ...DEFAULT_PREFS };
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prefs));
    } catch (error) {
      console.warn("تعذّر حفظ تفضيلات الواجهة السحابية.", error);
    }
  }

  function renderCachedData() {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:payload`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      state.data = parsed;
      renderData(parsed);
    } catch (error) {
      console.warn("تعذّر قراءة آخر تقرير محفوظ.", error);
    }
  }

  async function fetchReport() {
    const endpoint = elements.endpoint?.value?.trim();
    const schoolCode = elements.schoolCode?.value?.trim();
    const day = elements.day?.value?.trim() || new Date().toISOString().slice(0, 10);

    if (!endpoint) {
      showStatus("يرجى إدخال رابط الواجهة قبل المتابعة.", "error");
      return;
    }
    if (!schoolCode) {
      showStatus("يرجى إدخال رمز المدرسة للمشاركة.", "error");
      return;
    }

    showStatus("جارٍ جلب التقرير...", "pending");

    try {
      const url = new URL(endpoint);
      url.searchParams.set("school", schoolCode);
      url.searchParams.set("day", day);
      const supervisorId = elements.supervisor?.value || "all";
      if (supervisorId && supervisorId !== "all") {
        url.searchParams.set("supervisor", supervisorId);
      }
      const headers = { Accept: "application/json" };
      const token = elements.token?.value?.trim();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (!payload || typeof payload !== "object") {
        throw new Error("استجابة غير متوقعة من الخادم.");
      }
      state.data = payload;
      localStorage.setItem(`${STORAGE_KEY}:payload`, JSON.stringify(payload));
      renderData(payload);
      showStatus("تم تحديث التقرير بنجاح.", "success");
    } catch (error) {
      console.error("فشل جلب التقرير السحابي", error);
      showStatus(`تعذّر جلب التقرير: ${error?.message || error}`, "error");
    }
  }

  function renderData(payload) {
    if (!payload || typeof payload !== "object") {
      clearTables();
      return;
    }
    const supervisorId = elements.supervisor?.value || "all";
    const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
    updateSupervisorOptions(recipients);

    const packages = payload.packages || {};
    const globalPackage = packages.all || { summary: {}, lists: {} };
    const supervisorPackage = packages.bySupervisor?.[supervisorId] || globalPackage;
    const lists = supervisorPackage.lists || globalPackage.lists || {};
    state.filtered = {
      present: Array.isArray(lists.present) ? lists.present : [],
      late: Array.isArray(lists.late) ? lists.late : [],
      absent: Array.isArray(lists.absent) ? lists.absent : []
    };

    renderSummary(payload, supervisorPackage.summary || globalPackage.summary || {}, supervisorId);
    renderTable("present", state.filtered.present);
    renderTable("late", state.filtered.late);
    renderTable("absent", state.filtered.absent);
  }

  function renderSummary(payload, summary = {}, supervisorId) {
    if (elements.summaryTotal) {
      elements.summaryTotal.textContent = Number(summary.total ?? payload.summary?.totalStudents ?? 0).toString();
    }
    if (elements.summaryPresent) {
      elements.summaryPresent.textContent = Number(summary.present ?? payload.summary?.presentCount ?? 0).toString();
    }
    if (elements.summaryLate) {
      elements.summaryLate.textContent = Number(summary.late ?? payload.summary?.lateCount ?? 0).toString();
    }
    if (elements.summaryAbsent) {
      elements.summaryAbsent.textContent = Number(summary.absent ?? payload.summary?.absentCount ?? 0).toString();
    }
    if (elements.summaryGenerated) {
      const dateLabel = payload.generatedAt ? formatDateTime(payload.generatedAt) : "غير متوفر";
      elements.summaryGenerated.textContent = dateLabel;
    }
    if (elements.summarySchedule) {
      const schedule = payload.schedule || {};
      if (schedule.mode === "countdown") {
        elements.summarySchedule.textContent = `بعد ${schedule.countdownMinutes ?? "—"} دقيقة من بداية الدوام`;
      } else {
        elements.summarySchedule.textContent = `يوميًا عند ${schedule.time || "—"}`;
      }
    }
    const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
    const active = recipients.find((recipient) => recipient.id === supervisorId);
    const suffix = supervisorId === "all" || !active ? "كامل المدرسة" : active.name;
    elements.summaryTotal?.setAttribute("data-scope", suffix);
  }

  function updateSupervisorOptions(recipients) {
    if (!elements.supervisor) return;
    const currentValue = elements.supervisor.value || state.prefs.supervisor || "all";
    const options = [
      { id: "all", name: "جميع المشرفين" },
      ...recipients.filter((recipient) => recipient && recipient.id !== "all")
    ];
    elements.supervisor.innerHTML = "";
    options.forEach((recipient) => {
      const option = document.createElement("option");
      option.value = recipient.id;
      option.textContent = recipient.name || recipient.id;
      elements.supervisor.appendChild(option);
    });
    if (options.some((option) => option.id === currentValue)) {
      elements.supervisor.value = currentValue;
    } else {
      elements.supervisor.value = "all";
      state.prefs.supervisor = "all";
      savePreferences();
    }
    state.recipients = options;
  }

  function renderTable(type, list) {
    const body = elements.tableBodies[type];
    const empty = elements.emptyStates[type];
    if (!body || !empty) return;
    body.innerHTML = "";
    if (!Array.isArray(list) || list.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.forEach((row) => {
      const tr = document.createElement("tr");
      const arrival = row.arrivalTime || "—";
      const lateLabel = row.lateMinutes > 0 ? row.lateMinutes : "—";
      tr.innerHTML = `
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.grade || "—")}</td>
        <td>${escapeHtml(row.class || "—")}</td>
        <td>${escapeHtml(arrival)}</td>
        <td>${escapeHtml(lateLabel)}</td>
      `;
      body.appendChild(tr);
    });
  }

  function clearTables() {
    renderTable("present", []);
    renderTable("late", []);
    renderTable("absent", []);
  }

  function downloadCsv(type) {
    const list = state.filtered?.[type];
    if (!Array.isArray(list) || list.length === 0) {
      showStatus("لا توجد بيانات للتصدير في هذا القسم.", "idle");
      return;
    }
    const headers = ["الرقم", "الاسم", "الصف", "الفصل", "وقت التسجيل", "دقائق التأخر"];
    const rows = list.map((row) => [
      row.id,
      row.name,
      row.grade || "",
      row.class || "",
      row.arrivalTime || "",
      row.lateMinutes || 0
    ]);
    const csv = [headers, ...rows]
      .map((cells) =>
        cells
          .map((cell) => {
            const value = String(cell ?? "");
            if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const date = state.data?.day || elements.day?.value || "report";
    const scope = elements.supervisor?.value || "all";
    link.download = `hader-${type}-${scope}-${date}.csv`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function handleRemoteChannelMessage(event) {
    const payload = event?.data?.payload;
    if (!payload || typeof payload !== "object") return;
    if (payload.kind === "status" && payload.status === "success") {
      showToast("تم رفع تقرير جديد. يمكنك التحديث الآن.");
      if (state.prefs.autoRefresh) {
        fetchReport();
      }
    }
    if (payload.kind === "state" && payload.state?.lastStatus === "success" && state.prefs.autoRefresh) {
      fetchReport();
    }
    if (payload.kind === "leave-requests-applied" && payload.acknowledgements?.length) {
      showToast("تم تسجيل طلبات الاستئذان الواردة في النظام المحلي.");
    }
  }

  async function handleLeaveSubmit(event) {
    event.preventDefault();
    if (!elements.leaveForm) return;

    const endpoint = elements.endpoint?.value?.trim();
    if (!endpoint) {
      showLeaveStatus("يرجى ضبط رابط الخدمة السحابية أولاً.", "error");
      return;
    }

    const schoolCode = elements.schoolCode?.value?.trim();
    if (!schoolCode) {
      showLeaveStatus("رمز المدرسة مطلوب لإرسال الطلب.", "error");
      return;
    }

    const studentId = elements.leaveStudentId?.value?.trim();
    if (!studentId) {
      showLeaveStatus("أدخل رقم الطالب قبل الإرسال.", "error");
      return;
    }

    const reason = elements.leaveReason?.value?.trim();
    if (!reason) {
      showLeaveStatus("يرجى كتابة سبب الاستئذان.", "error");
      return;
    }

    const supervisorName = elements.leaveSupervisorName?.value?.trim() || state.prefs.leaveSupervisorName || "";
    if (!supervisorName) {
      showLeaveStatus("عرّف اسم المشرف المرسل للطلب.", "error");
      return;
    }

    const payload = {
      version: "hader.remote/v1",
      kind: "leave-request",
      timestamp: new Date().toISOString(),
      school: {
        code: schoolCode
      },
      supervisor: {
        id: elements.supervisor?.value || "all",
        name: supervisorName,
        contact: elements.leaveSupervisorContact?.value?.trim() || ""
      },
      request: {
        studentId,
        studentName: elements.leaveStudentName?.value?.trim() || "",
        grade: elements.leaveGrade?.value?.trim() || "",
        class: elements.leaveClass?.value?.trim() || "",
        reason,
        note: elements.leaveNote?.value?.trim() || "",
        submittedBy: supervisorName,
        submittedContact: elements.leaveSupervisorContact?.value?.trim() || ""
      }
    };

    const token = elements.token?.value?.trim();
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    showLeaveStatus("جارٍ إرسال الطلب...", "pending");
    elements.leaveSubmit?.setAttribute("disabled", "true");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }

      const requestId = body?.request?.id || body?.id;
      showLeaveStatus(
        requestId ? `تم تسجيل الطلب وإرساله (رقم المتابعة: ${requestId}).` : "تم إرسال طلب الاستئذان بنجاح.",
        "success"
      );
      showToast("تم إرسال طلب الاستئذان للسيرفر السحابي.");
      resetLeaveForm();
    } catch (error) {
      console.error("فشل إرسال طلب الاستئذان السحابي", error);
      showLeaveStatus(`تعذّر إرسال الطلب: ${error?.message || error}`, "error");
    } finally {
      elements.leaveSubmit?.removeAttribute("disabled");
    }
  }

  function showLeaveStatus(message, tone) {
    if (!elements.leaveStatus) return;
    elements.leaveStatus.textContent = message || "";
    if (tone) {
      elements.leaveStatus.dataset.state = tone;
    }
  }

  function resetLeaveForm() {
    if (!elements.leaveForm) return;
    elements.leaveStudentId && (elements.leaveStudentId.value = "");
    elements.leaveStudentName && (elements.leaveStudentName.value = "");
    elements.leaveGrade && (elements.leaveGrade.value = "");
    elements.leaveClass && (elements.leaveClass.value = "");
    elements.leaveReason && (elements.leaveReason.value = "");
    elements.leaveNote && (elements.leaveNote.value = "");
  }

  function showStatus(message, tone) {
    if (!elements.status) return;
    elements.status.textContent = message || "";
    if (tone) {
      elements.status.dataset.state = tone;
    }
  }

  let toastTimer = null;

  function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.dataset.state = "visible";
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      elements.toast.dataset.state = "hidden";
      toastTimer = null;
    }, 5000);
  }

  function formatDateTime(isoString) {
    if (!isoString) return "غير متوفر";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "غير متوفر";
    return `${date.toISOString().slice(0, 10)} — ${date.toLocaleTimeString("ar-SA", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();

