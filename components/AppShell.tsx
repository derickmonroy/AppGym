"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";
import { addDays, formatDateLong, occurrenceKey, todayLocal } from "@/lib/schedule";
import type { LogMap, LogStatus, Settings, Workout, WorkoutInput, WorkoutLog } from "@/lib/types";
import { TodayView } from "./TodayView";
import { WeekView } from "./WeekView";
import { HistoryView } from "./HistoryView";
import { SettingsView } from "./SettingsView";
import { WorkoutForm } from "./WorkoutForm";
import { IconCalendar, IconDumbbell, IconHistory, IconHome, IconPlus, IconSettings } from "./Icons";

type Tab = "hoy" | "semana" | "historial" | "ajustes";

const DEFAULT_SETTINGS: Settings = { notifications_enabled: false, reminder_offset_minutes: 15 };

export function AppShell() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("hoy");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [logList, setLogList] = useState<WorkoutLog[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState<{ workout: Workout | null; date?: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const logs: LogMap = useMemo(
    () => new Map(logList.map((l) => [occurrenceKey(l.workout_id, l.occurrence_date), l.status])),
    [logList],
  );

  const load = useCallback(async () => {
    const { data: userData } = await getSupabase().auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    setUserId(userData.user.id);
    setEmail(userData.user.email ?? null);

    const since = addDays(todayLocal(), -90);
    const [w, l, s] = await Promise.all([
      getSupabase()
        .from("workouts")
        .select("id, name, notes, start_date, start_time, repeat_weekly, repeat_days")
        .order("start_time"),
      getSupabase()
        .from("workout_logs")
        .select("workout_id, occurrence_date, status")
        .gte("occurrence_date", since),
      getSupabase()
        .from("user_settings")
        .select("notifications_enabled, reminder_offset_minutes")
        .maybeSingle(),
    ]);
    const err = w.error ?? l.error ?? s.error;
    if (err) {
      setLoadError(err.message);
    } else {
      setLoadError(null);
      setWorkouts((w.data ?? []) as Workout[]);
      setLogList((l.data ?? []) as WorkoutLog[]);
      setSettings((s.data as Settings | null) ?? DEFAULT_SETTINGS);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
    // Registrar el service worker (necesario para instalar la app y recibir push).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function setStatus(workoutId: string, date: string, status: LogStatus | null) {
    const prev = logList;
    const without = logList.filter((l) => !(l.workout_id === workoutId && l.occurrence_date === date));
    setLogList(status ? [...without, { workout_id: workoutId, occurrence_date: date, status }] : without);

    const { error } = status
      ? await getSupabase()
          .from("workout_logs")
          .upsert({ workout_id: workoutId, occurrence_date: date, status }, { onConflict: "workout_id,occurrence_date" })
      : await getSupabase().from("workout_logs").delete().eq("workout_id", workoutId).eq("occurrence_date", date);
    if (error) {
      setLogList(prev);
      toast("No se pudo guardar: " + error.message);
    } else if (status === "completed") {
      toast("¡Buen trabajo! 💪");
    }
  }

  async function saveWorkout(input: WorkoutInput, id?: string): Promise<string | null> {
    const { error } = id
      ? await getSupabase().from("workouts").update(input).eq("id", id)
      : await getSupabase().from("workouts").insert(input);
    if (error) return error.message;
    await load();
    toast(id ? "Entrenamiento actualizado" : "Entrenamiento creado");
    return null;
  }

  async function deleteWorkout(id: string): Promise<string | null> {
    const { error } = await getSupabase().from("workouts").delete().eq("id", id);
    if (error) return error.message;
    await load();
    toast("Entrenamiento eliminado");
    return null;
  }

  async function updateSettings(patch: Partial<Settings>): Promise<string | null> {
    if (!userId) return "Sesión no válida";
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await getSupabase()
      .from("user_settings")
      .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    if (error) {
      setSettings(settings);
      return error.message;
    }
    return null;
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const today = todayLocal(now);

  return (
    <>
      <main className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark"><IconDumbbell size={22} /></span>
            <span className="brand-name display">{APP_NAME}</span>
          </div>
          <div className="topbar-date">{formatDateLong(today)}</div>
        </header>

        {loading ? (
          <div className="spinner" aria-label="Cargando" />
        ) : loadError ? (
          <div className="notice error">
            <div>
              <strong>No se pudieron cargar tus datos</strong>
              <p>{loadError}</p>
              <p style={{ marginTop: 6 }}>Si es la primera vez, revisa que ejecutaste <code>supabase/schema.sql</code> en Supabase.</p>
              <button className="btn" style={{ marginTop: 12 }} onClick={() => { setLoading(true); load(); }}>Reintentar</button>
            </div>
          </div>
        ) : (
          <>
            {tab === "hoy" && (
              <TodayView
                workouts={workouts}
                logs={logs}
                now={now}
                notificationsOn={settings.notifications_enabled}
                onStatus={setStatus}
                onEdit={(w) => setForm({ workout: w })}
                onAdd={() => setForm({ workout: null })}
                onGoSettings={() => setTab("ajustes")}
              />
            )}
            {tab === "semana" && (
              <WeekView
                workouts={workouts}
                logs={logs}
                now={now}
                onEdit={(w) => setForm({ workout: w })}
                onAddOn={(date) => setForm({ workout: null, date })}
              />
            )}
            {tab === "historial" && (
              <HistoryView workouts={workouts} logs={logs} now={now} onStatus={setStatus} />
            )}
            {tab === "ajustes" && (
              <SettingsView
                settings={settings}
                email={email}
                onChange={updateSettings}
                onSignOut={signOut}
                toast={toast}
              />
            )}
          </>
        )}
      </main>

      {tab !== "ajustes" && !loading && !loadError && (
        <button className="fab" onClick={() => setForm({ workout: null })} aria-label="Nuevo entrenamiento">
          <IconPlus size={28} strokeWidth={2.6} />
        </button>
      )}

      <nav className="tabbar" aria-label="Secciones">
        <div className="tabbar-inner">
          {(
            [
              ["hoy", "Hoy", IconHome],
              ["semana", "Semana", IconCalendar],
              ["historial", "Historial", IconHistory],
              ["ajustes", "Ajustes", IconSettings],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              className={`tab ${tab === key ? "active" : ""}`}
              onClick={() => {
                setTab(key);
                window.scrollTo({ top: 0 });
              }}
              aria-current={tab === key ? "page" : undefined}
            >
              <Icon size={24} />
              {key === "ajustes" && !settings.notifications_enabled && !loading && <span className="tab-dot" />}
              {label}
            </button>
          ))}
        </div>
      </nav>

      {form && (
        <WorkoutForm
          key={form.workout?.id ?? `new-${form.date ?? ""}`}
          initial={form.workout}
          presetDate={form.date}
          onClose={() => setForm(null)}
          onSave={(input) => saveWorkout(input, form.workout?.id)}
          onDelete={form.workout ? () => deleteWorkout(form.workout!.id) : undefined}
        />
      )}

      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}
