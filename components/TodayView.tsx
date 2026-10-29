"use client";

import {
  addDays,
  formatCountdown,
  formatTime,
  occurrenceKey,
  occurrencesInRange,
  relativeDayLabel,
  todayLocal,
} from "@/lib/schedule";
import type { LogMap, LogStatus, Workout } from "@/lib/types";
import { SessionCard } from "./SessionCard";
import { IconBellOff, IconDumbbell, IconPlus } from "./Icons";

export function TodayView({
  workouts,
  logs,
  now,
  notificationsOn,
  onStatus,
  onEdit,
  onAdd,
  onGoSettings,
}: {
  workouts: Workout[];
  logs: LogMap;
  now: number;
  notificationsOn: boolean;
  onStatus: (workoutId: string, date: string, status: LogStatus | null) => void;
  onEdit: (w: Workout) => void;
  onAdd: () => void;
  onGoSettings: () => void;
}) {
  const today = todayLocal(now);
  const todays = occurrencesInRange(workouts, today, today);
  const next = occurrencesInRange(workouts, today, addDays(today, 60)).find(
    (o) => o.startsAt > now && !logs.has(occurrenceKey(o.workout.id, o.date)),
  );

  return (
    <div>
      {!notificationsOn && workouts.length > 0 && (
        <button className="notice warn" onClick={onGoSettings} style={{ width: "100%", textAlign: "left", marginBottom: 16 }}>
          <span className="notice-icon"><IconBellOff size={20} /></span>
          <span>
            <strong>Recordatorios desactivados</strong>
            <p>Toca aquí para activar las notificaciones en tu iPhone.</p>
          </span>
        </button>
      )}

      {next ? (
        <div className="hero">
          <div className="hero-label">Próximo entrenamiento</div>
          <div className="hero-name display">{next.workout.name}</div>
          <div className="hero-meta">
            {relativeDayLabel(next.date, now)} · {formatTime(next.startsAt)}
          </div>
          <div className="hero-countdown">{formatCountdown(next.startsAt - now)}</div>
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon"><IconDumbbell size={28} /></div>
          <h3>No tienes entrenamientos programados</h3>
          <p>Crea tu primer entrenamiento y elige qué días se repite.</p>
          <button className="btn btn-primary" onClick={onAdd}>
            <IconPlus size={18} /> Crear entrenamiento
          </button>
        </div>
      )}

      <div className="section-title">
        <span>Hoy</span>
        {todays.length > 0 && (
          <span>
            {todays.filter((o) => logs.get(occurrenceKey(o.workout.id, o.date)) === "completed").length}/{todays.length} hechos
          </span>
        )}
      </div>

      {todays.length === 0 ? (
        <div className="card row" style={{ gap: 14 }}>
          <div className="avatar" aria-hidden>😴</div>
          <div>
            <div style={{ fontWeight: 700 }}>Día de descanso</div>
            <div className="small muted">No hay nada programado para hoy. Recupera bien.</div>
          </div>
        </div>
      ) : (
        <div className="stack">
          {todays.map((o) => (
            <SessionCard
              key={occurrenceKey(o.workout.id, o.date)}
              occ={o}
              status={logs.get(occurrenceKey(o.workout.id, o.date))}
              onStatus={(s) => onStatus(o.workout.id, o.date, s)}
              onEdit={() => onEdit(o.workout)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
