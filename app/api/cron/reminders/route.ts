import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceSupabase } from "@/lib/supabase/server";
import { pushConfigured, sendToSubscriptions, type StoredSubscription } from "@/lib/push";
import { dueReminders, formatTime, addDays, todayLocal, type WorkoutLike } from "@/lib/schedule";
import { APP_NAME } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Supabase Cron llama a esta ruta cada minuto. Decide qué recordatorios tocan y los envía.
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "VAPID no configurado" }, { status: 503 });
  }

  const db = createServiceSupabase();
  const now = Date.now();
  const today = todayLocal(now);

  const { data: settings, error: settingsError } = await db
    .from("user_settings")
    .select("user_id, reminder_offset_minutes")
    .eq("notifications_enabled", true);
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  let sent = 0;
  let checked = 0;

  for (const s of settings ?? []) {
    const { data: workouts } = await db
      .from("workouts")
      .select("id, name, start_date, start_time, repeat_weekly, repeat_days")
      .eq("user_id", s.user_id)
      .lte("start_date", addDays(today, 1));
    const due = dueReminders((workouts ?? []) as WorkoutLike[], s.reminder_offset_minutes, now);
    checked += due.length;
    if (!due.length) continue;

    // No recordar sesiones que ya marcaste como completadas o saltadas.
    const { data: logs } = await db
      .from("workout_logs")
      .select("workout_id, occurrence_date")
      .eq("user_id", s.user_id)
      .in("occurrence_date", [...new Set(due.map((d) => d.date))]);
    const logged = new Set((logs ?? []).map((l) => `${l.workout_id}|${l.occurrence_date}`));
    const pending = due.filter((d) => !logged.has(`${d.workout.id}|${d.date}`));
    if (!pending.length) continue;

    // Reservamos cada recordatorio antes de enviarlo: si el cron corre dos veces, no se duplica.
    const { data: claimed } = await db
      .from("sent_reminders")
      .upsert(
        pending.map((d) => ({ workout_id: d.workout.id, occurrence_date: d.date })),
        { onConflict: "workout_id,occurrence_date", ignoreDuplicates: true },
      )
      .select("workout_id, occurrence_date");
    const claimedKeys = new Set((claimed ?? []).map((c) => `${c.workout_id}|${c.occurrence_date}`));
    const toSend = pending.filter((d) => claimedKeys.has(`${d.workout.id}|${d.date}`));
    if (!toSend.length) continue;

    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", s.user_id);
    if (!subs?.length) continue;

    for (const occ of toSend) {
      const minutes = s.reminder_offset_minutes;
      const when = minutes === 0 ? "¡Es la hora!" : `Empieza en ${minutes} min`;
      const result = await sendToSubscriptions(db, subs as StoredSubscription[], {
        title: `💪 ${occ.workout.name}`,
        body: `${when} · ${formatTime(occ.startsAt)}. ¡Vamos!`,
        url: "/",
        tag: `entreno-${occ.workout.id}-${occ.date}`,
      });
      sent += result.sent;
    }
  }

  // Limpieza: borra registros de envío de hace más de 30 días.
  await db.from("sent_reminders").delete().lt("occurrence_date", addDays(today, -30));

  return NextResponse.json({ ok: true, app: APP_NAME, users: settings?.length ?? 0, checked, sent });
}
