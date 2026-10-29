"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/config";

// Genera las claves VAPID y el CRON_SECRET directamente en tu navegador.
// No se envían a ningún servidor: solo las copias a Vercel.

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface Keys {
  publicKey: string;
  privateKey: string;
  cronSecret: string;
}

const PUBLIC_VARS: [string, boolean][] = [
  ["NEXT_PUBLIC_SUPABASE_URL", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
  ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)],
];

export default function ConfigurarPage() {
  const [keys, setKeys] = useState<Keys | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setError(null);
    try {
      const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
      const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
      const secret = crypto.getRandomValues(new Uint8Array(32));
      setKeys({ publicKey: toBase64Url(pub), privateKey: jwk.d!, cronSecret: toBase64Url(secret) });
    } catch (e) {
      setError("Tu navegador no pudo generar las claves: " + (e as Error).message);
    }
  }

  async function copy(name: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(name);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  const rows: [string, keyof Keys][] = [
    ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "publicKey"],
    ["VAPID_PRIVATE_KEY", "privateKey"],
    ["CRON_SECRET", "cronSecret"],
  ];

  return (
    <main className="auth-wrap" style={{ maxWidth: 620, justifyContent: "flex-start" }}>
      <h1 className="display" style={{ fontSize: 40, margin: "8px 0" }}>Configurar {APP_NAME}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Esta página genera las claves secretas <b>dentro de tu navegador</b>. No se guardan ni se envían a ningún
        lado: cópialas directamente en Vercel → tu proyecto → Settings → Environment Variables.
      </p>

      <div className="section-title">Estado del servidor (variables públicas)</div>
      <div className="card stack">
        {PUBLIC_VARS.map(([name, ok]) => (
          <div key={name} className="row" style={{ justifyContent: "space-between" }}>
            <code className="small">{name}</code>
            <span className={`badge ${ok ? "done" : "pending"}`}>{ok ? "Configurada" : "Falta"}</span>
          </div>
        ))}
        <p className="tiny muted" style={{ margin: 0 }}>
          Las variables secretas no se pueden comprobar desde aquí, por seguridad.
        </p>
      </div>

      <div className="section-title">Generar claves</div>
      <div className="card stack" style={{ gap: 14 }}>
        <button className="btn btn-primary btn-block" onClick={generate}>
          {keys ? "Generar otras claves" : "Generar claves VAPID y CRON_SECRET"}
        </button>
        {error && <div className="notice error"><p>{error}</p></div>}
        {keys && (
          <>
            <div className="notice warn">
              <div>
                <strong>Guárdalas en Vercel ahora</strong>
                <p>
                  Si recargas esta página se pierden. No las pegues en chats ni en el código. Si cambias las claves VAPID
                  más adelante, tendrás que volver a activar las notificaciones en el iPhone.
                </p>
              </div>
            </div>
            {rows.map(([name, k]) => (
              <div key={name} className="stack" style={{ gap: 6 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <code className="small" style={{ fontWeight: 700 }}>{name}</code>
                  <button className="pill" onClick={() => copy(name, keys[k])}>
                    {copied === name ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                <div className="code">{keys[k]}</div>
              </div>
            ))}
            <div className="stack" style={{ gap: 6 }}>
              <code className="small" style={{ fontWeight: 700 }}>VAPID_SUBJECT</code>
              <div className="code">mailto:tu-correo@ejemplo.com</div>
              <p className="tiny muted" style={{ margin: 0 }}>Escribe tu propio correo después de “mailto:”.</p>
            </div>
          </>
        )}
      </div>

      <p className="small muted" style={{ marginTop: 24 }}>
        <a href="/">← Volver a la app</a>
      </p>
    </main>
  );
}
