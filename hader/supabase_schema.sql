-- سكربت إنشاء الجداول الأساسية لتطبيق الحضور على Supabase
-- شغِّله مرة واحدة من لوحة SQL في مشروعك.

-- التوسعات الموصى بها
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 1) الطلاب
create table if not exists public.students (
  id text primary key,
  name text not null,
  class_name text not null,
  section text not null,
  guardian_phone text
);
create index if not exists idx_students_class_section on public.students(class_name, section);

-- 2) سجلات الحضور
create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  date date not null,
  timestamp timestamptz not null,
  status text not null check (status in ('present','late','absent','excused')),
  constraint uq_attendance_day unique (student_id, date)
);
create index if not exists idx_attendance_student on public.attendance_logs(student_id);
create index if not exists idx_attendance_date on public.attendance_logs(date);

-- 3) الملخص اليومي
create table if not exists public.daily_summaries (
  date_summary date primary key,
  summary_data jsonb not null
);

-- 4) طلبات الخروج
create table if not exists public.exits (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  reason text not null,
  exit_time timestamptz not null,
  created_by text
);
create index if not exists idx_exits_student on public.exits(student_id);
create index if not exists idx_exits_time on public.exits(exit_time);

-- 5) المخالفات
create table if not exists public.violations (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  type text not null,
  level text not null check (level in ('low','medium','high')),
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_violations_student on public.violations(student_id);
create index if not exists idx_violations_created on public.violations(created_at);

-- 6) الإشعارات
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  target_audience text not null,
  target_id text,
  type text not null,
  title text,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_target on public.notifications(target_audience, target_id);
create index if not exists idx_notifications_created on public.notifications(created_at);

-- 7) الفصول
create table if not exists public.classes (
  id text primary key,
  name text not null,
  sections jsonb not null default '[]'::jsonb
);

-- 8) المستخدمون
create table if not exists public.users (
  id text primary key,
  username text unique not null,
  full_name text not null,
  role text not null,
  password text,
  assigned_classes jsonb
);
create index if not exists idx_users_role on public.users(role);

-- 9) الإعدادات العامة
create table if not exists public.settings (
  id int primary key default 1,
  systemReady boolean default true,
  schoolActive boolean default true,
  logoUrl text default '',
  theme jsonb,
  mode text default 'dark',
  kiosk jsonb,
  schoolName text default 'مدرسة المستقبل',
  schoolManager text default 'أ. محمد العلي',
  assemblyTime text default '07:00',
  gracePeriod int default 0
);

-- صف افتراضي للإعدادات
insert into public.settings (id)
values (1)
on conflict (id) do nothing;

