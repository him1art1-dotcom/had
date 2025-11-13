// scripts/seed.js
// تشغيل: node scripts/seed.js
import { readFileSync } from "fs";
import admin from "firebase-admin";

const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();
const { Timestamp } = admin.firestore;

// ======= إعدادات سريعة =======
const SCHOOL_ID = process.env.SCHOOL_ID || "school_1";
const SCHOOL_NAME = "مدرسة الأمير سعود بن جلوي المتوسطة";

// ======= بيانات أولية (تقدر تعدلها براحتك) =======
const schools = [
  { id: SCHOOL_ID, data: { code: SCHOOL_ID, name: SCHOOL_NAME, enabled: true, logoUrl: "", theme: {} } },
];

const supervisors = [
  // مشرف عام (يعتمد لكل شيء)
  {
    id: null, // Auto-ID
    data: {
      schoolId: SCHOOL_ID,
      name: "المشرف العام",
      role: "school_admin",          // school_admin | class_supervisor
      identifier: "ADMIN_SUPER",     // المعرف الذي سيدخله في البوابة
      grades: [],
      classes: [],
      active: true,
    },
  },
  // مثال مشرف صف
  {
    id: null,
    data: {
      schoolId: SCHOOL_ID,
      name: "مشرف صف سادس أ",
      role: "class_supervisor",
      identifier: "CLS_6A_ALI",
      grades: ["6"],
      classes: ["6A"],
      active: true,
    },
  },
];

const supervisorPortalSettings = [
  {
    id: SCHOOL_ID, // نخلي الوثيقة بنفس معرف المدرسة لتسهيل القراءة
    data: {
      schoolId: SCHOOL_ID,
      heroImageUrl: "",
      morningMessage: "صباح الإبداع — نلتزم بالوقت والابتسامة.",
      announcements: ["تنبيه: الاختبارات الأسبوع القادم.", "اجتماع مشرفي الصفوف 10:30"],
    },
  },
];

const students = [
  { id: null, data: { schoolId: SCHOOL_ID, studentId: "1001", name: "إلياس الزهراني", grade: "6", classCode: "6A" } },
  { id: null, data: { schoolId: SCHOOL_ID, studentId: "1002", name: "مهند القحطاني", grade: "6", classCode: "6A" } },
  { id: null, data: { schoolId: SCHOOL_ID, studentId: "2001", name: "خليل الشهراني", grade: "5", classCode: "5B" } },
];

// أمثلة حضور (اختياري — بس عشان تشوف الواجهة تشتغل فورًا)
const todayStr = () => new Date().toISOString().slice(0, 10);
const attendance = [
  { id: null, data: { schoolId: SCHOOL_ID, studentId: "1001", name: "إلياس الزهراني", grade: "6", classCode: "6A", date: todayStr(), status: "present", time: "07:12" } },
  { id: null, data: { schoolId: SCHOOL_ID, studentId: "1002", name: "مهند القحطاني", grade: "6", classCode: "6A", date: todayStr(), status: "late",    time: "07:25" } },
];

// أمثلة استئذان
const leaveRequests = [
  { id: null, data: { schoolId: SCHOOL_ID, studentId: "1001", reason: "موعد مستشفى", note: "", date: todayStr(), createdAt: Timestamp.now(), state: "pending", by: "supervisor" } },
];

// ======= دوال مساعدة للكتابة =======
async function upsertCol(coll, docs) {
  const batch = db.batch();
  for (const { id, data } of docs) {
    const ref = id ? db.collection(coll).doc(id) : db.collection(coll).doc();
    batch.set(ref, data, { merge: true });
  }
  await batch.commit();
  console.log(`✓ Seeded ${coll}: ${docs.length} doc(s).`);
}

async function main() {
  console.log(`Seeding Firestore for schoolId=${SCHOOL_ID}…`);
  await upsertCol("schools", schools);
  await upsertCol("supervisors", supervisors);
  await upsertCol("supervisorPortalSettings", supervisorPortalSettings);
  await upsertCol("students", students);
  await upsertCol("attendance", attendance);
  await upsertCol("leaveRequests", leaveRequests);
  console.log("✓ Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});