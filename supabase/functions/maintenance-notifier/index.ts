import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import webpush from "https://esm.sh/web-push@3.6.7?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type RuntimeConfig = {
  vapid_public_key: string;
  vapid_private_key: string;
  vapid_subject: string;
};

type ClientWindow = {
  nome_cliente_empresa: string;
  proxima_manutencao: string;
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const hashPayload = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const formatYmd = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const buildNotification = (windowType: "before_1d" | "after_1d", clients: ClientWindow[]) => {
  const total = clients.length;
  const highlighted = clients
    .slice(0, 3)
    .map((c) => c.nome_cliente_empresa)
    .join(", ");

  if (windowType === "before_1d") {
    return {
      title: "Manutenções vencem amanhã",
      body:
        total === 1
          ? `${highlighted} vence amanhã.`
          : `${total} clientes vencem amanhã${highlighted ? `: ${highlighted}` : ""}.`,
      url: "/",
      windowType,
    };
  }

  return {
    title: "Manutenções venceram ontem",
    body:
      total === 1
        ? `${highlighted} venceu ontem.`
        : `${total} clientes venceram ontem${highlighted ? `: ${highlighted}` : ""}.`,
    url: "/",
    windowType,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não suportado" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Configuração de backend incompleta." }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: config, error: configError } = await supabase
      .from("notification_runtime_config")
      .select("vapid_public_key, vapid_private_key, vapid_subject")
      .eq("id", true)
      .single();

    if (configError || !config) {
      return json({ error: "Configuração VAPID não encontrada. Ative notificações no app primeiro." }, 400);
    }

    const runtimeConfig = config as RuntimeConfig;

    webpush.setVapidDetails(runtimeConfig.vapid_subject, runtimeConfig.vapid_public_key, runtimeConfig.vapid_private_key);

    const todayUtc = new Date();
    const tomorrow = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() + 1));
    const yesterday = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - 1));

    const tomorrowYmd = formatYmd(tomorrow);
    const yesterdayYmd = formatYmd(yesterday);

    const [subsRes, beforeRes, afterRes] = await Promise.all([
      supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("active", true),
      supabase.from("clients").select("nome_cliente_empresa, proxima_manutencao").eq("proxima_manutencao", tomorrowYmd),
      supabase.from("clients").select("nome_cliente_empresa, proxima_manutencao").eq("proxima_manutencao", yesterdayYmd),
    ]);

    if (subsRes.error) throw subsRes.error;
    if (beforeRes.error) throw beforeRes.error;
    if (afterRes.error) throw afterRes.error;

    const subscriptions = (subsRes.data ?? []) as PushSubscriptionRow[];
    const beforeClients = (beforeRes.data ?? []) as ClientWindow[];
    const afterClients = (afterRes.data ?? []) as ClientWindow[];

    const windows: Array<{ type: "before_1d" | "after_1d"; clients: ClientWindow[] }> = [
      { type: "before_1d", clients: beforeClients },
      { type: "after_1d", clients: afterClients },
    ];

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    const runDate = formatYmd(new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())));

    for (const window of windows) {
      if (window.clients.length === 0) continue;

      const notificationPayload = buildNotification(window.type, window.clients);
      const payloadJson = JSON.stringify(notificationPayload);
      const payloadHash = await hashPayload(payloadJson);

      for (const subscription of subscriptions) {
        const { data: queuedLog, error: queueError } = await supabase
          .from("maintenance_notification_logs")
          .insert({
            subscription_id: subscription.id,
            notification_date: runDate,
            window_type: window.type,
            payload_hash: payloadHash,
            status: "queued",
          })
          .select("id")
          .single();

        if (queueError) {
          if ((queueError as { code?: string }).code === "23505") {
            skipped += 1;
            continue;
          }
          failed += 1;
          continue;
        }

        const logId = queuedLog.id;

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payloadJson,
          );

          await supabase
            .from("maintenance_notification_logs")
            .update({ status: "sent", response_status: 201, sent_at: new Date().toISOString() })
            .eq("id", logId);

          sent += 1;
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number }).statusCode ?? 500);
          const message = error instanceof Error ? error.message : "Falha no envio push";

          await supabase
            .from("maintenance_notification_logs")
            .update({ status: "failed", response_status: statusCode, error_message: message, sent_at: new Date().toISOString() })
            .eq("id", logId);

          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).eq("id", subscription.id);
          }

          failed += 1;
        }
      }
    }

    return json({ ok: true, sent, skipped, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return json({ error: message }, 500);
  }
});