"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";
import { IconDumbbell } from "@/components/Icons";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const configured = supabaseConfigured();
  const [first, ...rest] = APP_NAME.split(" ");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = getSupabase();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setInfo("Te enviamos un correo para confirmar tu cuenta. Ábrelo, confirma y luego inicia sesión aquí.");
          setMode("login");
        }
      }
    } catch (err) {
      const msg = (err as Error).message ?? "Error";
      setError(
        msg.includes("Invalid login credentials")
          ? "Correo o contraseña incorrectos."
          : msg.includes("Email not confirmed")
            ? "Primero confirma tu correo con el enlace que te enviamos."
            : msg.includes("Signups not allowed")
              ? "El registro de nuevas cuentas está desactivado."
              : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <span className="brand-mark" style={{ width: 56, height: 56, borderRadius: 16 }}>
        <IconDumbbell size={32} />
      </span>
      <h1 className="auth-hero display">
        {first} <span>{rest.join(" ")}</span>
      </h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 28 }}>
        Planifica tus entrenamientos y recibe un aviso antes de empezar.
      </p>

      {!configured ? (
        <div className="notice error">
          <div>
            <strong>Falta conectar Supabase</strong>
            <p>
              Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en Vercel y
              vuelve a publicar. Más ayuda en <a href="/configurar">/configurar</a>.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <label className="field">
            Correo
            <input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Contraseña
            <input
              className="input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="notice error" role="alert"><p>{error}</p></div>}
          {info && <div className="notice ok" role="status"><p>{info}</p></div>}
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? "Un momento…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "¿Primera vez? Crear cuenta" : "Ya tengo cuenta"}
          </button>
        </form>
      )}
    </main>
  );
}
