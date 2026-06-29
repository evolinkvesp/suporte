import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import webpush from "https://esm.sh/web-push@3.6.7?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RuntimeConfig = {
  id: boolean;
  vapid_public_key: string;
  vapid_private_key: string;
  vapid_subject: string;
  cron_token: string;
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const parseBody = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

const randomToken = () => `${crypto.randomUUID()}-${crypto.randomUUID().replaceAll("-", "")}`;

const ensureRuntimeConfig = async (supabase: ReturnType<typeof createClient>) => {
  const { data: existing, error: fetchError } = await supabase
    .from("notification_runtime_config")
    .select("id, vapid_public_key, vapid_private_key, vapid_subject, cron_token")
    .eq("id", true)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing as RuntimeConfig;

  const keys = webpush.generateVAPIDKeys();

  const payload: RuntimeConfig = {
    id: true,
    vapid_public_key: keys.publicKey,
    vapid_private_key: keys.privateKey,
    vapid_subject: "mailto:suporte@supportevolink.local",
    cron_token: randomToken(),
  };

  const { data: created, error: createError } = await supabase
    .from("notification_runtime_config")
    .upsert(payload, { onConflict: "id" })
    .select("id, vapid_public_key, vapid_private_key, vapid_subject, cron_token")
    .single();

  if (createError) throw createError;
  return created as RuntimeConfig;
};

const isValidText = (value: unknown, min = 1, max = 5000) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

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
  const body = await parseBody(req);

  if (!body || typeof body.action !== "string") {
    return json({ error: "Payload inválido." }, 400);
  }

  const { action, payload } = body as { action: string; payload?: Record<string, unknown> };

  try {
    if (action === "getPublicKey") {
      const config = await ensureRuntimeConfig(supabase);
      return json({ publicKey: config.vapid_public_key });
    }

    if (action === "register") {
      if (!payload || typeof payload !== "object") {
        return json({ error: "Dados inválidos." }, 400);
      }

      if (!isValidText(payload.endpoint, 10, 3000) || !isValidText(payload.p256dh, 10, 1000) || !isValidText(payload.auth, 8, 1000)) {
        return json({ error: "Assinatura push inválida." }, 400);
      }

      const { data, error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            endpoint: (payload.endpoint as string).trim(),
            p256dh: (payload.p256dh as string).trim(),
            auth: (payload.auth as string).trim(),
            user_agent: isValidText(payload.userAgent, 0, 1000) ? (payload.userAgent as string).trim() : null,
            active: true,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" },
        )
        .select("id")
        .single();

      if (error) throw error;
      return json({ ok: true, subscriptionId: data.id });
    }

    if (action === "unregister") {
      if (!payload || typeof payload !== "object" || !isValidText(payload.endpoint, 10, 3000)) {
        return json({ error: "Endpoint inválido." }, 400);
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("endpoint", (payload.endpoint as string).trim());

      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return json({ error: message }, 500);
  }
});