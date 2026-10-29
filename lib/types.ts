import type { WorkoutLike } from "./schedule";

export interface Workout extends WorkoutLike {
  notes: string | null;
}

export type LogStatus = "completed" | "skipped";

export interface WorkoutLog {
  workout_id: string;
  occurrence_date: string;
  status: LogStatus;
}

export interface Settings {
  notifications_enabled: boolean;
  reminder_offset_minutes: number;
}

export interface WorkoutInput {
  name: string;
  notes: string | null;
  start_date: string;
  start_time: string;
  repeat_weekly: boolean;
  repeat_days: number[];
}

export type LogMap = Map<string, LogStatus>;
