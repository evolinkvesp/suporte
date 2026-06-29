import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ServiceStatus = "Ativo" | "Em Manutenção" | "Pausado";

const validStatus: ServiceStatus[] = ["Ativo", "Em Manutenção", "Pausado"];
const textEncoder = new TextEncoder();

const parseBody = async (req: Request) => {
  try { return await req.json(); } catch { return null; }
};

const validateString = (value: unknown, min = 0, max = 1000) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

const validateUrl = (value: unknown) => {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  return /^https?:\/\/.+/i.test(value.trim());
};

const validateDateYmd = (value: unknown, required = false) => {
  if ((value === null || value === undefined || value === "") && !required) return true;
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const deriveKey = async (secret: string) => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

const encryptText = async (plainText: string, secret: string) => {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plainText));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encryptedBuffer))}`;
};

const decryptText = async (encrypted: string, secret: string) => {
  const [ivBase64, cipherBase64] = encrypted.split(".");
  if (!ivBase64 || !cipherBase64) throw new Error("Formato de credencial inválido");
  const key = await deriveKey(secret);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
    key,
    base64ToBytes(cipherBase64)
  );
  return new TextDecoder().decode(decryptedBuffer);
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não suportado" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const CRM_CREDENTIALS_KEY = Deno.env.get("CRM_CREDENTIALS_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Configuração de backend incompleta." }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await parseBody(req);

  if (!body || typeof body.action !== "string") {
    return jsonResponse({ error: "Payload inválido." }, 400);
  }

  const { action, payload } = body;

  try {
    // ─── listClients ───────────────────────────────────────────────────────────
    if (action === "listClients") {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nome_cliente_empresa, site_url, automacoes, ultima_manutencao, proxima_manutencao, status_servico, valor_mensalidade, dia_vencimento, descricao_servico, created_at, updated_at")
        .order("proxima_manutencao", { ascending: true });

      if (error) throw error;
      return jsonResponse({ clients: data ?? [] });
    }

    // ─── createClient ──────────────────────────────────────────────────────────
    if (action === "createClient") {
      if (!payload || typeof payload !== "object") return jsonResponse({ error: "Dados inválidos." }, 400);
      const p = payload as Record<string, unknown>;

      if (!validateString(p.nome_cliente_empresa, 1, 140)) return jsonResponse({ error: "Nome do cliente inválido." }, 400);
      if (!validateUrl(p.site_url)) return jsonResponse({ error: "URL do site inválida." }, 400);
      if (!validateUrl(p.automacoes)) return jsonResponse({ error: "Link de automação inválido." }, 400);
      if (!validateDateYmd(p.ultima_manutencao, false) || !validateDateYmd(p.proxima_manutencao, true)) {
        return jsonResponse({ error: "Datas inválidas." }, 400);
      }
      if (!validStatus.includes(p.status_servico as ServiceStatus)) return jsonResponse({ error: "Status inválido." }, 400);

      if (!CRM_CREDENTIALS_KEY) return jsonResponse({ error: "CRM_CREDENTIALS_KEY não configurada." }, 500);

      const encryptedCredentials =
        typeof p.credenciais === "string" && p.credenciais.trim().length > 0
          ? await encryptText(p.credenciais.trim(), CRM_CREDENTIALS_KEY)
          : "";

      const { data, error } = await supabase
        .from("clients")
        .insert({
          nome_cliente_empresa: (p.nome_cliente_empresa as string).trim(),
          site_url: typeof p.site_url === "string" && p.site_url.trim() ? p.site_url.trim() : null,
          automacoes: typeof p.automacoes === "string" ? p.automacoes.trim() : "",
          credenciais_encriptadas: encryptedCredentials,
          ultima_manutencao: typeof p.ultima_manutencao === "string" && p.ultima_manutencao ? p.ultima_manutencao : null,
          proxima_manutencao: p.proxima_manutencao as string,
          status_servico: p.status_servico as ServiceStatus,
          valor_mensalidade: typeof p.valor_mensalidade === "number" ? Math.round(p.valor_mensalidade) : 0,
          dia_vencimento: typeof p.dia_vencimento === "number" ? p.dia_vencimento : 10,
          descricao_servico: typeof p.descricao_servico === "string" ? p.descricao_servico.trim() : null,
        })
        .select("id")
        .single();

      if (error) throw error;
      return jsonResponse({ id: data.id });
    }

    // ─── updateClient ──────────────────────────────────────────────────────────
    if (action === "updateClient") {
      if (!payload || typeof payload !== "object") return jsonResponse({ error: "Dados inválidos." }, 400);
      const p = payload as Record<string, unknown>;

      if (!validateString(p.id, 10, 80)) return jsonResponse({ error: "ID inválido." }, 400);
      if (!validateString(p.nome_cliente_empresa, 1, 140)) return jsonResponse({ error: "Nome do cliente inválido." }, 400);
      if (!validateUrl(p.site_url)) return jsonResponse({ error: "URL do site inválida." }, 400);
      if (!validateUrl(p.automacoes)) return jsonResponse({ error: "Link de automação inválido." }, 400);
      if (!validateDateYmd(p.ultima_manutencao, false) || !validateDateYmd(p.proxima_manutencao, true)) {
        return jsonResponse({ error: "Datas inválidas." }, 400);
      }
      if (!validStatus.includes(p.status_servico as ServiceStatus)) return jsonResponse({ error: "Status inválido." }, 400);

      const updatePayload: Record<string, unknown> = {
        nome_cliente_empresa: (p.nome_cliente_empresa as string).trim(),
        site_url: typeof p.site_url === "string" && p.site_url.trim() ? p.site_url.trim() : null,
        automacoes: typeof p.automacoes === "string" ? p.automacoes.trim() : "",
        ultima_manutencao: typeof p.ultima_manutencao === "string" && p.ultima_manutencao ? p.ultima_manutencao : null,
        proxima_manutencao: p.proxima_manutencao,
        status_servico: p.status_servico,
        valor_mensalidade: typeof p.valor_mensalidade === "number" ? Math.round(p.valor_mensalidade) : 0,
        dia_vencimento: typeof p.dia_vencimento === "number" ? p.dia_vencimento : 10,
        descricao_servico: typeof p.descricao_servico === "string" ? p.descricao_servico.trim() || null : null,
      };

      if (typeof p.credenciais === "string" && p.credenciais.trim().length > 0) {
        if (!CRM_CREDENTIALS_KEY) return jsonResponse({ error: "CRM_CREDENTIALS_KEY não configurada." }, 500);
        updatePayload.credenciais_encriptadas = await encryptText(p.credenciais.trim(), CRM_CREDENTIALS_KEY);
      }

      const { error } = await supabase.from("clients").update(updatePayload).eq("id", p.id as string);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ─── revealCredentials ────────────────────────────────────────────────────
    if (action === "revealCredentials") {
      if (!payload || typeof payload !== "object") return jsonResponse({ error: "Dados inválidos." }, 400);
      const p = payload as Record<string, unknown>;
      if (!validateString(p.id, 10, 80)) return jsonResponse({ error: "ID inválido." }, 400);
      if (!CRM_CREDENTIALS_KEY) return jsonResponse({ error: "CRM_CREDENTIALS_KEY não configurada." }, 500);

      const { data, error } = await supabase
        .from("clients")
        .select("credenciais_encriptadas")
        .eq("id", p.id as string)
        .single();

      if (error) throw error;
      if (!data.credenciais_encriptadas) return jsonResponse({ credenciais: "" });

      const credenciais = await decryptText(data.credenciais_encriptadas, CRM_CREDENTIALS_KEY);
      return jsonResponse({ credenciais });
    }

    // ─── listPasswords ────────────────────────────────────────────────────────
    if (action === "listPasswords") {
      const { client_id } = (payload as Record<string, unknown>) ?? {};
      if (!validateString(client_id, 10, 80)) return jsonResponse({ error: "client_id inválido." }, 400);

      const { data, error } = await supabase
        .from("client_passwords")
        .select("id, service_name, username, password")
        .eq("client_id", client_id as string)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return jsonResponse({ passwords: data ?? [] });
    }

    // ─── addPassword ──────────────────────────────────────────────────────────
    if (action === "addPassword") {
      const p = (payload as Record<string, unknown>) ?? {};
      if (!validateString(p.client_id, 10, 80)) return jsonResponse({ error: "client_id inválido." }, 400);
      if (!validateString(p.service_name, 1, 100)) return jsonResponse({ error: "Nome do serviço inválido." }, 400);
      if (!validateString(p.password, 1, 500)) return jsonResponse({ error: "Senha inválida." }, 400);

      const { data, error } = await supabase
        .from("client_passwords")
        .insert({
          client_id: p.client_id as string,
          service_name: (p.service_name as string).trim(),
          username: typeof p.username === "string" ? p.username.trim() : "",
          password: (p.password as string).trim(),
        })
        .select("id, service_name, username, password")
        .single();

      if (error) throw error;
      return jsonResponse({ password: data });
    }

    // ─── deletePassword ───────────────────────────────────────────────────────
    if (action === "deletePassword") {
      const { id } = (payload as Record<string, unknown>) ?? {};
      if (!validateString(id, 10, 80)) return jsonResponse({ error: "ID inválido." }, 400);

      const { error } = await supabase.from("client_passwords").delete().eq("id", id as string);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ─── listTickets ──────────────────────────────────────────────────────────
    if (action === "listTickets") {
      const { client_id } = (payload as Record<string, unknown>) ?? {};
      if (!validateString(client_id, 10, 80)) return jsonResponse({ error: "client_id inválido." }, 400);

      const { data, error } = await supabase
        .from("tickets")
        .select("id, titulo, descricao, status, created_at")
        .eq("client_id", client_id as string)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return jsonResponse({ tickets: data ?? [] });
    }

    // ─── createTicket ─────────────────────────────────────────────────────────
    if (action === "createTicket") {
      const p = (payload as Record<string, unknown>) ?? {};
      if (!validateString(p.client_id, 10, 80)) return jsonResponse({ error: "client_id inválido." }, 400);
      if (!validateString(p.titulo, 1, 200)) return jsonResponse({ error: "Título inválido." }, 400);

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          client_id: p.client_id as string,
          titulo: (p.titulo as string).trim(),
          descricao: typeof p.descricao === "string" ? p.descricao.trim() : "",
          status: "aberto",
        })
        .select("id, titulo, descricao, status, created_at")
        .single();

      if (error) throw error;
      return jsonResponse({ ticket: data });
    }

    return jsonResponse({ error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
