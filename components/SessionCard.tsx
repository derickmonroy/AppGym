"use client";

import { formatTime, type Occurrence } from "@/lib/schedule";
import type { LogStatus, Workout } from "@/lib/types";
import { IconCheck, IconSkip } from "./Icons";

export function splitTime(ts: number): { t: string; ap: string } {
  const s = formatTime(ts);
  const i = s.indexOf(" ");
  return i === -1 ? { t: s, ap: "" } : { t: s.slice(0, i), ap: s.slice(i + 1) };
}

export function SessionCard({
  occ,
  status,
  onStatus,
  onEdit,
}: {
  occ: Occurrence<Workout>;
  status: LogStatus | undefined;
  onStatus: (status: LogStatus | null) => void;
  onEdit: () => void;
}) {
  const { t, ap } = splitTime(occ.startsAt);
  const cls = status === "completed" ? "done" : status === "skipped" ? "skipped" : "";
  return (
    <div className={`session ${cls}`}>
      <div className="session-time">
        <div className="t">{t}</div>
        <div className="ap">{ap}</div>
      </div>
      <div>
        <button
          onClick={onEdit}
          style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
          aria-label={`Editar ${occ.workout.name}`}
        >
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="session-name">{occ.workout.name}</span>
            {status === "completed" && <span className="badge done">Completado</span>}
            {status === "skipped" && <span className="badge skip">Saltado</span>}
          </div>
          {occ.workout.notes && <div className="session-notes">{occ.workout.notes}</div>}
        </button>
        <div className="session-actions">
          <button
            className={`pill ${status === "completed" ? "on-done" : ""}`}
            onClick={() => onStatus(status === "completed" ? null : "completed")}
            aria-pressed={status === "completed"}
          >
            <IconCheck size={16} /> {status === "completed" ? "Hecho" : "Completar"}
          </button>
          <button
            className={`pill ${status === "skipped" ? "on-skip" : ""}`}
            onClick={() => onStatus(status === "skipped" ? null : "skipped")}
            aria-pressed={status === "skipped"}
          >
            <IconSkip size={16} /> {status === "skipped" ? "Saltado" : "Saltar"}
          </button>
        </div>
      </div>
    </div>
  );
}
