-- Mi Entreno · Esquema de base de datos
-- Ejecuta este archivo completo en Supabase → SQL Editor → New query → Run.
-- Todas las tablas usan Row Level Security (RLS): cada usuario solo ve sus propios datos.

-- ───────────── Entrenamientos ─────────────
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  notes text check (notes is null or char_length(notes) <= 1000),
  -- Fecha y hora LOCALES de Nueva York (America/New_York).
  start_date date not null,
  start_time time not null,
  repeat_weekly boolean not null default false,
  -- Días de la semana: 0 = domingo, 1 = lunes … 6 = sábado.
  repeat_days smallint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repeat_days_valid check (repeat_days <@ array[0,1,2,3,4,5,6]::smallint[])
);
create index if not exists workouts_user_idx on public.workouts (user_id);

-- ───────────── Historial: completado / saltado ─────────────
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  occurrence_date date not null,
  status text not null check (status in ('completed', 'skipped')),
  created_at timestamptz not null default now(),
  unique (workout_id, occurrence_date)
);
create index if not exists workout_logs_user_idx on public.workout_logs (user_id, occurrence_date);

-- ───────────── Preferencias ─────────────
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  notifications_enabled boolean not null default false,
  reminder_offset_minutes smallint not null default 15 check (reminder_offset_minutes in (0, 15, 30)),
  updated_at timestamptz not null default now()
);

-- ───────────── Suscripciones push (una por dispositivo) ─────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ───────────── Recordatorios ya enviados (evita duplicados) ─────────────
-- Solo la usa el servidor con la clave secreta; no tiene políticas para usuarios.
create table if not exists public.sent_reminders (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  occurrence_date date not null,
  sent_at timestamptz not null default now(),
  primary key (workout_id, occurrence_date)
);

-- ───────────── Row Level Security ─────────────
alter table public.workouts enable row level security;
alter table public.workout_logs enable row level security;
alter table public.user_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.sent_reminders enable row level security;

drop policy if exists "workouts_own" on public.workouts;
create policy "workouts_own" on public.workouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "logs_own" on public.workout_logs;
create policy "logs_own" on public.workout_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );

drop policy if exists "settings_own" on public.user_settings;
create policy "settings_own" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Mantener updated_at al día
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workouts_touch on public.workouts;
create trigger workouts_touch before update on public.workouts
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.user_settings;
create trigger settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();
