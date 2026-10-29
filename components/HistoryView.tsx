"use client";

import {
  addDays,
  formatTime,
  occurrenceKey,
  occurrencesInRange,
  relativeDayLabel,
  todayLocal,
} from "@/lib/schedule";
import type { LogMap, LogStatus, Workout } from "@/lib/types";
import { IconCheck, IconHistory, IconSkip } from "./Icons";

const DAYS_BACK = 30;

export function HistoryView({
  workouts,
  logs,
  now,
  onStatus,
}: {
  workouts: Workout[];
  logs: LogMap;
  now: number;
  onStatus: (workoutId: string, date: string, status: LogStatus | null) => void;
}) {
  const today = todayLocal(now);
  const past = occurrencesInRange(workouts, addDays(today, -DAYS_BACK), today)
    .filter((o) => o.startsAt <= now || logs.has(occurrenceKey(o.workout.id, o.date)))
    .reverse();

  const statusOf = (id: string, date: string) => logs.get(occurrenceKey(id, date));
  const done = past.filter((o) => statusOf(o.workout.id, o.date) === "completed").length;
  const skipped = past.filter((o) => statusOf(o.workout.id, o.date) === "skipped").length;
  const pending = past.length - done - skipped;

  // Agrupar por día
  const groups: { date: string; items: typeof past }[] = [];
  for (const o of past) {
    const g = groups[groups.length - 1];
    if (g && g.date === o.date) g.items.push(o);
    else groups.push({ date: o.date, items: [o] });
  }

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>Últimos {DAYS_BACK} días</div>
      <div className="stats">
        <div className="stat done"><div className="n">{done}</div><div className="l">Completados</div></div>
        <div className="stat skip"><div className="n">{skipped}</div><div className="l">Saltados</div></div>
        <div className="stat pending"><div className="n">{pending}</div><div className="l">Sin marcar</div></div>
      </div>
      {past.length > 0 && (
        <p className="small muted" style={{ margin: "10px 2px 0" }}>
          Cumplimiento: <strong style={{ color: "var(--text)" }}>{Math.round((done / past.length) * 100)}%</strong>
        </p>
      )}

      {groups.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>
          <div className="empty-icon"><IconHistory size={28} /></div>
          <h3>Tu historial está vacío</h3>
          <p>Aquí verás los entrenamientos que ya pasaron y si los completaste o saltaste.</p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.date}>
            <div className="section-title"><span>{relativeDayLabel(g.date, now)}</span></div>
            <div className="card" style={{ padding: "2px 14px" }}>
              {g.items.map((o) => {
                const s = statusOf(o.workout.id, o.date);
                return (
                  <div key={o.workout.id} className="hist-row">
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>{o.workout.name}</div>
                      <div className="small muted">
                        {formatTime(o.startsAt)} ·{" "}
                        {s === "completed" ? (
                          <span className="badge done">Completado</span>
                        ) : s === "skipped" ? (
                          <span className="badge skip">Saltado</span>
                        ) : (
                          <span className="badge pending">Sin marcar</span>
                        )}
                      </div>
                    </div>
                    <div className="mini-actions">
                      <button
                        className={`mini ${s === "completed" ? "on-done" : ""}`}
                        onClick={() => onStatus(o.workout.id, o.date, s === "completed" ? null : "completed")}
                        aria-label="Marcar como completado"
                        aria-pressed={s === "completed"}
                      >
                        <IconCheck size={18} />
                      </button>
                      <button
                        className={`mini ${s === "skipped" ? "on-skip" : ""}`}
                        onClick={() => onStatus(o.workout.id, o.date, s === "skipped" ? null : "skipped")}
                        aria-label="Marcar como saltado"
                        aria-pressed={s === "skipped"}
                      >
                        <IconSkip size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
