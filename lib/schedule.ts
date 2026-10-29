// Lógica de fechas y horarios. Todo se calcula en la zona horaria America/New_York,
// sin importar la zona del servidor (Vercel corre en UTC) ni la del dispositivo.
// Este archivo no importa nada para poder probarlo con `npm test`.

export const TIME_ZONE = "America/New_York";
export const TIME_ZONE_LABEL = "Nueva York (hora del Este)";

export interface WorkoutLike {
  id: string;
  name: string;
  start_date: string; // "YYYY-MM-DD" local
  start_time: string; // "HH:MM" o "HH:MM:SS" local
  repeat_weekly: boolean;
  repeat_days: number[] | null; // 0 = domingo … 6 = sábado
}

export interface Occurrence<W extends WorkoutLike = WorkoutLike> {
  workout: W;
  date: string; // fecha local
  startsAt: number; // instante en ms (UTC)
}

const MINUTE = 60_000;
const DAY = 86_400_000;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function zonedParts(ts: number) {
  const parts = partsFormatter.formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(ts: number): number {
  const p = zonedParts(ts);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

export function normalizeTime(time: string): string {
  const [h = "0", m = "0"] = time.split(":");
  return `${pad(Number(h))}:${pad(Number(m))}`;
}

/** Convierte fecha + hora de Nueva York al instante real (ms UTC). */
export function zonedToUtc(date: string, time: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = normalizeTime(time).split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ts = guess - offsetMs(guess);
  const second = guess - offsetMs(ts);
  if (second !== ts) ts = second;
  return ts;
}

/** Fecha local de Nueva York ("YYYY-MM-DD") para un instante. */
export function localDate(ts: number): string {
  const p = zonedParts(ts);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayLocal(now: number = Date.now()): string {
  return localDate(now);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function occursOn(w: WorkoutLike, date: string): boolean {
  if (date < w.start_date) return false;
  if (!w.repeat_weekly) return date === w.start_date;
  return (w.repeat_days ?? []).includes(weekdayOf(date));
}

/** Todas las sesiones entre dos fechas locales (incluidas), ordenadas por hora. */
export function occurrencesInRange<W extends WorkoutLike>(
  workouts: W[],
  from: string,
  to: string,
): Occurrence<W>[] {
  const out: Occurrence<W>[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const w of workouts) {
      if (occursOn(w, date)) {
        out.push({ workout: w, date, startsAt: zonedToUtc(date, w.start_time) });
      }
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

export function occurrenceKey(workoutId: string, date: string): string {
  return `${workoutId}|${date}`;
}

/**
 * Recordatorios que toca enviar ahora: aquellos cuya hora de aviso
 * (inicio − antelación) cayó en los últimos `lookbackMs` o cae en los próximos 30 s.
 * El servidor guarda cuáles ya envió, así que repetir la consulta no duplica avisos.
 */
export function dueReminders<W extends WorkoutLike>(
  workouts: W[],
  offsetMinutes: number,
  now: number,
  lookbackMs: number = 5 * MINUTE,
): Occurrence<W>[] {
  const today = localDate(now);
  const candidates = occurrencesInRange(workouts, addDays(today, -1), addDays(today, 1));
  return candidates.filter((o) => {
    const remindAt = o.startsAt - offsetMinutes * MINUTE;
    return remindAt > now - lookbackMs && remindAt <= now + 30_000;
  });
}

// ───────────── Formato para mostrar en español ─────────────

const timeFormatter = new Intl.DateTimeFormat("es-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("es-US", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function formatTime(ts: number): string {
  return timeFormatter.format(new Date(ts));
}

/** "6:30 p. m." a partir de una hora local "18:30". */
export function formatLocalTime(time: string, date: string = "2026-01-05"): string {
  return formatTime(zonedToUtc(date, time));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Jueves, 29 de octubre" */
export function formatDateLong(date: string): string {
  return capitalize(longDateFormatter.format(new Date(zonedToUtc(date, "12:00"))));
}

export function formatDateShort(date: string): string {
  return shortDateFormatter.format(new Date(zonedToUtc(date, "12:00")));
}

export function relativeDayLabel(date: string, now: number = Date.now()): string {
  const today = todayLocal(now);
  if (date === today) return "Hoy";
  if (date === addDays(today, 1)) return "Mañana";
  if (date === addDays(today, -1)) return "Ayer";
  return formatDateLong(date);
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "ahora";
  const totalMin = Math.round(ms / MINUTE);
  if (totalMin < 1) return "en menos de 1 min";
  if (totalMin < 60) return `en ${totalMin} min`;
  const days = Math.floor(ms / DAY);
  if (days >= 1) return days === 1 ? "en 1 día" : `en ${days} días`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
}

export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_INITIAL: Record<number, string> = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };
export const DAY_SHORT: Record<number, string> = {
  0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb",
};

export function describeRepeat(w: WorkoutLike): string {
  if (!w.repeat_weekly) return `Una vez · ${formatDateShort(w.start_date)}`;
  const days = WEEK_ORDER.filter((d) => (w.repeat_days ?? []).includes(d));
  if (days.length === 7) return "Todos los días";
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "De lunes a viernes";
  return "Cada " + days.map((d) => DAY_SHORT[d]).join(", ");
}
