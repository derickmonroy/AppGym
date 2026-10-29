import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zonedToUtc,
  localDate,
  addDays,
  weekdayOf,
  startOfWeek,
  occurrencesInRange,
  dueReminders,
  formatLocalTime,
  formatCountdown,
  describeRepeat,
  type WorkoutLike,
} from "../lib/schedule.ts";

test("convierte hora de Nueva York a UTC en horario de verano y de invierno", () => {
  // 29 oct 2026: EDT (UTC-4)
  assert.equal(new Date(zonedToUtc("2026-10-29", "18:30")).toISOString(), "2026-10-29T22:30:00.000Z");
  // 10 nov 2026: EST (UTC-5)
  assert.equal(new Date(zonedToUtc("2026-11-10", "06:00:00")).toISOString(), "2026-11-10T11:00:00.000Z");
  // Día del cambio de hora (1 nov 2026, 2:00 → 1:00)
  assert.equal(new Date(zonedToUtc("2026-11-01", "09:00")).toISOString(), "2026-11-01T14:00:00.000Z");
});

test("fecha local correcta cerca de medianoche", () => {
  // 03:30 UTC del 30 oct = 23:30 del 29 oct en Nueva York
  assert.equal(localDate(Date.parse("2026-10-30T03:30:00Z")), "2026-10-29");
});

test("días de la semana y semanas", () => {
  assert.equal(weekdayOf("2026-10-29"), 4); // jueves
  assert.equal(startOfWeek("2026-10-29"), "2026-10-26"); // lunes
  assert.equal(startOfWeek("2026-11-01"), "2026-10-26"); // domingo pertenece a la semana del lunes anterior
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

const pecho: WorkoutLike = {
  id: "a", name: "Pecho", start_date: "2026-10-26", start_time: "18:00:00",
  repeat_weekly: true, repeat_days: [1, 4],
};
const piernas: WorkoutLike = {
  id: "b", name: "Piernas", start_date: "2026-10-30", start_time: "07:00",
  repeat_weekly: false, repeat_days: [],
};

test("sesiones repetidas y únicas en un rango", () => {
  const occ = occurrencesInRange([pecho, piernas], "2026-10-26", "2026-11-05");
  assert.deepEqual(
    occ.map((o) => `${o.workout.id}:${o.date}`),
    ["a:2026-10-26", "a:2026-10-29", "b:2026-10-30", "a:2026-11-02", "a:2026-11-05"],
  );
});

test("no aparecen sesiones antes de la fecha de inicio", () => {
  const occ = occurrencesInRange([{ ...pecho, start_date: "2026-10-28" }], "2026-10-26", "2026-10-29");
  assert.deepEqual(occ.map((o) => o.date), ["2026-10-29"]);
});

test("recordatorio 15 min antes", () => {
  const start = zonedToUtc("2026-10-29", "18:00");
  const at = start - 15 * 60_000;
  assert.equal(dueReminders([pecho], 15, at).length, 1);
  assert.equal(dueReminders([pecho], 15, at - 2 * 60_000).length, 0, "demasiado pronto");
  assert.equal(dueReminders([pecho], 15, at + 4 * 60_000).length, 1, "tolera retrasos");
  assert.equal(dueReminders([pecho], 15, at + 10 * 60_000).length, 0, "ya pasó la ventana");
});

test("recordatorio que cruza medianoche", () => {
  const w: WorkoutLike = { ...piernas, start_date: "2026-10-30", start_time: "00:10" };
  const now = zonedToUtc("2026-10-29", "23:40");
  const due = dueReminders([w], 30, now);
  assert.equal(due.length, 1);
  assert.equal(due[0].date, "2026-10-30");
});

test("formatos en español", () => {
  assert.match(formatLocalTime("18:30"), /6:30/);
  assert.equal(formatCountdown(90 * 60_000), "en 1 h 30 min");
  assert.equal(formatCountdown(5 * 60_000), "en 5 min");
  assert.equal(describeRepeat(pecho), "Cada Lun, Jue");
});
