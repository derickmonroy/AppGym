"use client";

import { useState } from "react";
import { MUSCLE_GROUPS } from "@/lib/config";
import {
  DAY_INITIAL,
  DAY_SHORT,
  WEEK_ORDER,
  TIME_ZONE_LABEL,
  normalizeTime,
  todayLocal,
  weekdayOf,
  zonedParts,
} from "@/lib/schedule";
import type { Workout, WorkoutInput } from "@/lib/types";
import { IconX } from "./Icons";

function defaultTime(): string {
  const p = zonedParts(Date.now());
  const h = (p.hour + 1) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

export function WorkoutForm({
  initial,
  presetDate,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Workout | null;
  presetDate?: string;
  onSave: (input: WorkoutInput) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.start_date ?? presetDate ?? todayLocal());
  const [time, setTime] = useState(initial ? normalizeTime(initial.start_time) : defaultTime());
  const [repeat, setRepeat] = useState(initial?.repeat_weekly ?? false);
  const [days, setDays] = useState<number[]>(initial?.repeat_days ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleRepeat() {
    const next = !repeat;
    setRepeat(next);
    if (next && days.length === 0 && date) setDays([weekdayOf(date)]);
  }

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Escribe un nombre o elige un grupo muscular.");
    if (!date) return setError("Elige la fecha.");
    if (!time) return setError("Elige la hora.");
    if (repeat && days.length === 0) return setError("Elige al menos un día para repetir.");
    setSaving(true);
    setError(null);
    const err = await onSave({
      name: trimmed.slice(0, 80),
      notes: notes.trim() ? notes.trim().slice(0, 1000) : null,
      start_date: date,
      start_time: time,
      repeat_weekly: repeat,
      repeat_days: repeat ? [...days].sort() : [],
    });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  async function remove() {
    if (!onDelete) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setSaving(true);
    const err = await onDelete();
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Editar entrenamiento" : "Nuevo entrenamiento"}
      >
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="display">{initial ? "Editar" : "Nuevo entreno"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <IconX size={18} />
          </button>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="stack">
            <span className="small muted" style={{ fontWeight: 600 }}>¿Qué entrenas?</span>
            <div className="chips">
              {MUSCLE_GROUPS.map((g) => (
                <button
                  type="button"
                  key={g}
                  className={`chip ${name === g ? "on" : ""}`}
                  onClick={() => setName(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="O escribe un nombre: Pecho y tríceps…"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              aria-label="Nombre del entrenamiento"
            />
          </div>

          <div className="grid-2">
            <label className="field">
              {repeat ? "Empieza el" : "Fecha"}
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field">
              Hora
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>
          </div>
          <p className="tiny muted" style={{ margin: "-10px 2px 0" }}>Hora de {TIME_ZONE_LABEL}</p>

          <div className="stack">
            <div className="switch-row">
              <div>
                <div style={{ fontWeight: 700 }}>Repetir cada semana</div>
                <div className="small muted">
                  {repeat && days.length
                    ? WEEK_ORDER.filter((d) => days.includes(d)).map((d) => DAY_SHORT[d]).join(", ")
                    : "Solo una vez"}
                </div>
              </div>
              <button
                type="button"
                className={`switch ${repeat ? "on" : ""}`}
                onClick={toggleRepeat}
                role="switch"
                aria-checked={repeat}
                aria-label="Repetir cada semana"
              />
            </div>
            {repeat && (
              <div className="daypick">
                {WEEK_ORDER.map((d) => (
                  <button
                    type="button"
                    key={d}
                    className={days.includes(d) ? "on" : ""}
                    onClick={() => toggleDay(d)}
                    aria-pressed={days.includes(d)}
                    aria-label={DAY_SHORT[d]}
                  >
                    {DAY_INITIAL[d]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="field">
            Notas (opcional)
            <textarea
              className="textarea"
              placeholder="Series, pesos, rutina…"
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {error && (
            <div className="notice error" role="alert">
              <p>{error}</p>
            </div>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear entrenamiento"}
          </button>
          {initial && onDelete && (
            <button type="button" className="btn btn-danger btn-block" onClick={remove} disabled={saving}>
              {confirmDelete
                ? initial.repeat_weekly
                  ? "Toca otra vez: se borran todas las semanas"
                  : "Toca otra vez para confirmar"
                : "Eliminar entrenamiento"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
