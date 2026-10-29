// Cambia el nombre de la app aquí. Se usa en la interfaz, el manifest y las notificaciones.
export const APP_NAME = "Mi Entreno";
export const APP_SHORT_NAME = "Mi Entreno";
export const APP_DESCRIPTION = "Organiza tus entrenamientos y recibe recordatorios en tu iPhone.";

// Colores principales (también en app/globals.css).
export const THEME_COLOR = "#0d0f12";
export const ACCENT_COLOR = "#c6f432";

export const MUSCLE_GROUPS = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Brazos",
  "Core",
  "Glúteos",
  "Cardio",
  "Full body",
];

export const REMINDER_OPTIONS = [
  { value: 0, label: "A la hora" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
] as const;
