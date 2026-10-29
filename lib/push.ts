import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

let configured = false;
function ensureVapid() {
  if (configured) return;
  if (!pushConfigured()) {
    throw new Error("Faltan las variables VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Envía un push a varias suscripciones. Borra las que el navegador ya invalidó (404/410).
 * Devuelve cuántas se entregaron al servicio push de Apple/Google.
 */
export async function sendToSubscriptions(
  db: SupabaseClient,
  subs: StoredSubscription[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number; errors: string[] }> {
  ensureVapid();
  let sent = 0;
  let failed = 0;
  const expired: string[] = [];
  const errors: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(s.id);
        else errors.push(`HTTP ${status ?? "?"}: ${(err as Error).message ?? "error"}`);
      }
    }),
  );

  if (expired.length) {
    await db.from("push_subscriptions").delete().in("id", expired);
  }
  return { sent, failed, removed: expired.length, errors };
}
