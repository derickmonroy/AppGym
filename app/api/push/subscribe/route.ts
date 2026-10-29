import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Body {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

function isValidEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && endpoint.length < 2000;
  } catch {
    return false;
  }
}

// Guarda la suscripción push de este dispositivo y la vincula a tu cuenta.
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const endpoint = body.endpoint ?? "";
  const p256dh = body.keys?.p256dh ?? "";
  const auth = body.keys?.auth ?? "";
  if (!isValidEndpoint(endpoint) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: "Suscripción no válida" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, notifications_enabled: true }, { onConflict: "user_id" });
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// Quita la suscripción de este dispositivo.
export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.endpoint) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  }
  return NextResponse.json({ ok: true });
}
