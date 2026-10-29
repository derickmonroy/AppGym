import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { pushConfigured, sendToSubscriptions } from "@/lib/push";
import { APP_NAME } from "@/lib/config";

export const runtime = "nodejs";

// Envía una notificación de prueba a todos tus dispositivos suscritos.
export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 });

  if (!pushConfigured()) {
    return NextResponse.json(
      { error: "El servidor aún no tiene las claves VAPID configuradas en Vercel." },
      { status: 503 },
    );
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs?.length) {
    return NextResponse.json({ error: "No hay ningún dispositivo suscrito todavía." }, { status: 404 });
  }

  const result = await sendToSubscriptions(supabase, subs, {
    title: `${APP_NAME} 💪`,
    body: "¡Notificación de prueba! Así te avisaré antes de cada entrenamiento.",
    url: "/",
    tag: "prueba",
  });

  if (result.sent === 0) {
    return NextResponse.json(
      { error: "No se pudo entregar la notificación.", ...result },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
