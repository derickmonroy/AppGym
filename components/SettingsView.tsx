"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_NAME, REMINDER_OPTIONS } from "@/lib/config";
import { TIME_ZONE, TIME_ZONE_LABEL } from "@/lib/schedule";
import type { Settings } from "@/lib/types";
import { IconAlert, IconBell, IconCheck, IconShare } from "./Icons";

type Support = "checking" | "ios-needs-install" | "unsupported" | "server-missing" | "ok";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectSupport(): Support {
  const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (!hasPush) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "server-missing";
  return "ok";
}

export function SettingsView({
  settings,
  email,
  onChange,
  onSignOut,
  toast,
}: {
  settings: Settings;
  email: string | null;
  onChange: (patch: Partial<Settings>) => Promise<string | null>;
  onSignOut: () => void;
  toast: (msg: string) => void;
}) {
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const s = detectSupport();
    setSupport(s);
    if ("Notification" in window) setPermission(Notification.permission);
    if (s === "ok") {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(Boolean(sub));
      } catch {
        setSubscribed(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Se llama directamente desde el toque del botón: iOS exige un gesto del usuario.
  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage({
          kind: "warn",
          text:
            result === "denied"
              ? "Bloqueaste las notificaciones. Actívalas en Ajustes del iPhone (ver abajo)."
              : "No se concedió el permiso. Vuelve a intentarlo.",
        });
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status} al guardar la suscripción`);
      }
      setSubscribed(true);
      await onChange({ notifications_enabled: true });
      setMessage({ kind: "ok", text: "¡Listo! Este dispositivo recibirá tus recordatorios." });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message || "No se pudieron activar las notificaciones." });
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (settings.notifications_enabled) {
      setBusy(true);
      const err = await onChange({ notifications_enabled: false });
      setBusy(false);
      if (err) setMessage({ kind: "error", text: err });
      else setMessage({ kind: "warn", text: "Recordatorios pausados. Tus entrenamientos siguen guardados." });
      return;
    }
    if (subscribed && permission === "granted") {
      setBusy(true);
      const err = await onChange({ notifications_enabled: true });
      setBusy(false);
      if (err) setMessage({ kind: "error", text: err });
      else setMessage({ kind: "ok", text: "Recordatorios activados." });
      return;
    }
    await enable();
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);
      setMessage({
        kind: "ok",
        text: `Enviada a ${j.sent} dispositivo${j.sent === 1 ? "" : "s"}. Debería llegar en unos segundos (puedes salir de la app).`,
      });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const active = settings.notifications_enabled && subscribed && permission === "granted";

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>Notificaciones</div>
      <div className="card stack" style={{ gap: 16 }}>
        {support === "checking" && <div className="spinner" />}

        {support === "ios-needs-install" && (
          <div className="notice warn">
            <span className="notice-icon"><IconShare size={20} /></span>
            <div>
              <strong>Primero agrega la app a tu pantalla de inicio</strong>
              <p>En iPhone, las notificaciones solo funcionan si abres {APP_NAME} desde su icono.</p>
              <ol className="steps">
                <li>En Safari, toca el botón <b>Compartir</b> (cuadro con flecha hacia arriba).</li>
                <li>Elige <b>Agregar a pantalla de inicio</b> y luego <b>Agregar</b>.</li>
                <li>Abre {APP_NAME} desde el nuevo icono y vuelve a esta pantalla.</li>
              </ol>
            </div>
          </div>
        )}

        {support === "unsupported" && (
          <div className="notice error">
            <span className="notice-icon"><IconAlert size={20} /></span>
            <div>
              <strong>Este navegador no admite notificaciones push</strong>
              <p>Usa Safari en iPhone con iOS 16.4 o superior (instalada en la pantalla de inicio), o Chrome, Edge o Firefox en computadora.</p>
            </div>
          </div>
        )}

        {support === "server-missing" && (
          <div className="notice error">
            <span className="notice-icon"><IconAlert size={20} /></span>
            <div>
              <strong>Falta configurar el servidor</strong>
              <p>No están las claves VAPID en Vercel. Genera las claves en <a href="/configurar">/configurar</a>, agrégalas en Vercel y vuelve a publicar.</p>
            </div>
          </div>
        )}

        {support === "ok" && (
          <>
            <div className="switch-row">
              <div className="row" style={{ gap: 12 }}>
                <span className="avatar" style={{ width: 40, height: 40 }}><IconBell size={20} /></span>
                <div>
                  <div style={{ fontWeight: 700 }}>Recordatorios</div>
                  <div className="small muted">
                    {active
                      ? "Activados en este dispositivo"
                      : permission === "denied"
                        ? "Bloqueados por el sistema"
                        : settings.notifications_enabled && !subscribed
                          ? "Activados en otro dispositivo"
                          : "Desactivados"}
                  </div>
                </div>
              </div>
              <button
                className={`switch ${settings.notifications_enabled && subscribed ? "on" : ""}`}
                role="switch"
                aria-checked={settings.notifications_enabled && subscribed}
                aria-label="Activar o desactivar recordatorios"
                disabled={busy || permission === "denied"}
                onClick={toggle}
              />
            </div>

            {permission === "denied" ? (
              <div className="notice error">
                <span className="notice-icon"><IconAlert size={20} /></span>
                <div>
                  <strong>Las notificaciones están bloqueadas</strong>
                  <p>
                    En el iPhone ve a <b>Ajustes → Notificaciones → {APP_NAME}</b> y activa <b>Permitir notificaciones</b>.
                    En computadora, permítelas desde el candado junto a la dirección web. Luego vuelve aquí.
                  </p>
                </div>
              </div>
            ) : !subscribed ? (
              <>
                <p className="small muted" style={{ margin: 0 }}>
                  Te pediremos permiso al tocar el botón. Así te avisaremos aunque la app esté cerrada.
                </p>
                <button className="btn btn-primary btn-block" onClick={enable} disabled={busy}>
                  <IconBell size={18} /> {busy ? "Activando…" : "Activar notificaciones"}
                </button>
              </>
            ) : (
              <button className="btn btn-block" onClick={sendTest} disabled={busy}>
                {busy ? "Enviando…" : "Enviar notificación de prueba"}
              </button>
            )}
          </>
        )}

        {message && (
          <div className={`notice ${message.kind}`} role="status">
            <span className="notice-icon">{message.kind === "ok" ? <IconCheck size={20} /> : <IconAlert size={20} />}</span>
            <p>{message.text}</p>
          </div>
        )}
      </div>

      <div className="section-title">Cuándo avisarme</div>
      <div className="card stack">
        <div className="segmented" role="radiogroup" aria-label="Momento del recordatorio">
          {REMINDER_OPTIONS.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={settings.reminder_offset_minutes === o.value}
              className={settings.reminder_offset_minutes === o.value ? "on" : ""}
              onClick={async () => {
                const err = await onChange({ reminder_offset_minutes: o.value });
                if (err) toast(err);
                else toast(`Te avisaré ${o.value === 0 ? "a la hora exacta" : `${o.value} minutos antes`}`);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          Zona horaria: {TIME_ZONE_LABEL} ({TIME_ZONE}). Los avisos pueden llegar hasta 1 minuto tarde.
        </p>
      </div>

      <div className="section-title">Cuenta</div>
      <div className="card stack">
        <div className="small muted">Sesión iniciada como</div>
        <div style={{ fontWeight: 700, wordBreak: "break-all" }}>{email ?? "—"}</div>
        <button className="btn btn-block" onClick={onSignOut}>Cerrar sesión</button>
      </div>
    </div>
  );
}
