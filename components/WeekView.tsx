"use client";

import { useState } from "react";
import {
  addDays,
  describeRepeat,
  formatDateLong,
  formatDateShort,
  formatLocalTime,
  formatTime,
  occurrenceKey,
  occurrencesInRange,
  startOfWeek,
  todayLocal,
  DAY_SHORT,
  weekdayOf,
} from "@/lib/schedule";
import type { LogMap, Workout } from "@/lib/types";
import { IconCheck, IconChevronLeft, IconChevronRight, IconDumbbell, IconPlus } from "./Icons";

export function WeekView({
  workouts,
  logs,
  now,
  onEdit,
  onAddOn,
}: {
  workouts: Workout[];
  logs: LogMap;
  now: number;
  onEdit: (w: Workout) => void;
  onAddOn: (date: string) => void;
}) {
  const today = todayLocal(now);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const occ = occurrencesInRange(workouts, days[0], days[6]);
  const isThisWeek = weekStart === startOfWeek(today);

  const title = isThisWeek
    ? "Esta semana"
    : weekStart === addDays(startOfWeek(today), 7)
      ? "Próxima semana"
      : weekStart === addDays(startOfWeek(today), -7)
        ? "Semana pasada"
        : `${formatDateShort(days[0])} – ${formatDateShort(days[6])}`;

  return (
    <div>
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior">
          <IconChevronLeft size={20} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div className="week-title display">{title}</div>
          {!isThisWeek && (
            <button className="tiny" style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600 }} onClick={() => setWeekStart(startOfWeek(today))}>
              Volver a hoy
            </button>
          )}
        </div>
        <button className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana siguiente">
          <IconChevronRight size={20} />
        </button>
      </div>

      <div className="week-strip" aria-hidden>
        {days.map((d) => {
          const dayOcc = occ.filter((o) => o.date === d);
          return (
            <div key={d} className={`week-day ${d === today ? "is-today selected" : ""}`}>
              <div className="wd">{DAY_SHORT[weekdayOf(d)]}</div>
              <div className="dn">{Number(d.slice(8))}</div>
              <div className="dots">
                {dayOcc.slice(0, 3).map((o) => {
                  const s = logs.get(occurrenceKey(o.workout.id, o.date));
                  return <span key={o.workout.id} className={`dot ${s === "completed" ? "done" : s === "skipped" ? "skip" : ""}`} />;
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: "4px 16px" }}>
        {days.map((d) => {
          const dayOcc = occ.filter((o) => o.date === d);
          return (
            <div key={d} className="day-block">
              <div className="day-head">
                <span className={`name ${d === today ? "is-today" : ""}`}>
                  {formatDateLong(d)}
                  {d === today ? " · hoy" : ""}
                </span>
                <button
                  className="tiny"
                  style={{ background: "none", border: "none", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}
                  onClick={() => onAddOn(d)}
                  aria-label={`Agregar entrenamiento el ${formatDateLong(d)}`}
                >
                  <IconPlus size={14} /> Agregar
                </button>
              </div>
              {dayOcc.length === 0 ? (
                <div className="rest">Descanso</div>
              ) : (
                <div className="chip-row">
                  {dayOcc.map((o) => {
                    const s = logs.get(occurrenceKey(o.workout.id, o.date));
                    return (
                      <button
                        key={o.workout.id}
                        className={`wchip ${s === "completed" ? "done" : s === "skipped" ? "skip" : ""}`}
                        onClick={() => onEdit(o.workout)}
                      >
                        <span className="tm">{formatTime(o.startsAt)}</span>
                        <strong>{o.workout.name}</strong>
                        {s === "completed" && <IconCheck size={14} style={{ color: "var(--success)" }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <span>Tus entrenamientos</span>
        <span>{workouts.length}</span>
      </div>
      {workouts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><IconDumbbell size={28} /></div>
          <h3>Todavía no hay entrenamientos</h3>
          <p>Toca “Agregar” en cualquier día o el botón + para empezar.</p>
        </div>
      ) : (
        <div className="stack">
          {[...workouts]
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((w) => (
              <button key={w.id} className="list-item" onClick={() => onEdit(w)}>
                <span className="avatar">{w.name.charAt(0).toUpperCase()}</span>
                <span className="grow">
                  <div className="title">{w.name}</div>
                  <div className="sub">
                    {describeRepeat(w)} · {formatLocalTime(w.start_time, w.start_date)}
                  </div>
                </span>
                <IconChevronRight size={18} style={{ color: "var(--faint)" }} />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
