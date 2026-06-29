import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const parseBody = async (req: Request) => {
  try { return await req.json(); } catch { return null; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao suportado" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const HANDLE = Deno.env.get("INFINITEPAY_HANDLE") ?? "vesp";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await parseBody(req);

  if (!body || typeof body.action !== "string") {
    return json({ error: "Payload invalido." }, 400);
  }

  const { action, payload } = body;

  try {
    // ----------- Portal (publico) -----------
    if (action === "getPortalData") {
      const { client_id } = payload ?? {};
      if (!client_id) return json({ error: "client_id obrigatorio" }, 400);

      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();

      const [clientRes, mensalidadeRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, nome_cliente_empresa, ultima_manutencao, valor_mensalidade, descricao_servico")
          .eq("id", client_id)
          .maybeSingle(),
        supabase
          .from("mensalidades")
          .select("id, status, valor, link_pagamento, metodo_pagamento, receipt_url, pago_em")
          .eq("client_id", client_id)
          .eq("mes", mes)
          .eq("ano", ano)
          .maybeSingle(),
      ]);

      if (!clientRes.data) return json({ client: null, mensalidade: null });

      return json({ client: clientRes.data, mensalidade: mensalidadeRes.data ?? null });
    }

    // ----------- Admin: listar -----------
    if (action === "listarMensalidades") {
      const now = new Date();
      const mes = payload?.mes ?? (now.getMonth() + 1);
      const ano = payload?.ano ?? now.getFullYear();

      const [clientsRes, mensalidadesRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, nome_cliente_empresa, status_servico, valor_mensalidade, dia_vencimento")
          .order("nome_cliente_empresa"),
        supabase
          .from("mensalidades")
          .select("*")
          .eq("mes", mes)
          .eq("ano", ano),
      ]);

      if (clientsRes.error) throw clientsRes.error;

      const mMap: Record<string, unknown> = {};
      for (const m of mensalidadesRes.data ?? []) {
        mMap[(m as { client_id: string }).client_id] = m;
      }

      return json({
        clientes: (clientsRes.data ?? []).map(c => ({ ...c, mensalidade: mMap[c.id] ?? null })),
        mes,
        ano,
      });
    }

    // ----------- Admin: gerar link -----------
    if (action === "gerarLink") {
      const { client_id } = payload ?? {};
      if (!client_id) return json({ error: "client_id obrigatorio" }, 400);

      const { data: client, error: cErr } = await supabase
        .from("clients")
        .select("id, nome_cliente_empresa, valor_mensalidade, dia_vencimento")
        .eq("id", client_id)
        .single();

      if (cErr || !client) return json({ error: "Cliente nao encontrado" }, 404);
      if (!client.valor_mensalidade || client.valor_mensalidade <= 0) {
        return json({ error: "Configure o valor da mensalidade primeiro." }, 400);
      }

      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();

      const { data: existing } = await supabase
        .from("mensalidades")
        .select("status, order_nsu")
        .eq("client_id", client_id)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (existing?.status === "pago") {
        return json({ error: "Esta mensalidade ja foi paga." }, 400);
      }

      const order_nsu = existing?.order_nsu
        ?? `${client_id.replace(/-/g, "").substring(0, 12)}-${ano}${String(mes).padStart(2, "0")}`;

      const SITE_URL = Deno.env.get("SITE_URL") ?? "";
      const webhookUrl = `${SUPABASE_URL}/functions/v1/infinitepay-webhook`;

      // InfinitePay espera o preco em centavos (inteiro)
      const priceInCents = Math.round(client.valor_mensalidade);
      const clientName = client.nome_cliente_empresa.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      const description = `Mensalidade ${String(mes).padStart(2, "0")}/${ano} ${clientName}`;

      const ipPayload: Record<string, unknown> = {
        handle: HANDLE,
        items: [{
          quantity: 1,
          price: priceInCents,
          description,
        }],
        order_nsu,
        webhook_url: webhookUrl,
        customer: { name: clientName || "Cliente" },
      };

      if (SITE_URL) {
        ipPayload.redirect_url = `${SITE_URL}/portal/${client_id}`;
      }

      console.log("[infinitepay] gerarLink payload:", JSON.stringify(ipPayload));

      const ipRes = await fetch("https://api.checkout.infinitepay.io/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ipPayload),
      });

      const ipText = await ipRes.text();
      let ipData: Record<string, unknown> = {};
      try { ipData = JSON.parse(ipText); } catch { ipData = { raw: ipText }; }

      console.log("[infinitepay] response status:", ipRes.status, "body:", ipText.substring(0, 500));

      if (!ipRes.ok) {
        const errMsg = (ipData.message as string) ||
          (ipData.error as string) ||
          (Array.isArray(ipData.errors) ? JSON.stringify(ipData.errors) : null) ||
          `HTTP ${ipRes.status}: ${ipText.substring(0, 200)}`;
        return json({ ok: false, error: `InfinitePay: ${errMsg}`, status: ipRes.status, details: ipData });
      }

      const link =
        (ipData.url as string | undefined) ??
        (ipData.link as string | undefined) ??
        (ipData.payment_url as string | undefined) ??
        (ipData.checkout_url as string | undefined) ??
        (ipData.payment_link as string | undefined);

      if (!link) {
        console.error("[infinitepay] no link in response:", JSON.stringify(ipData));
        return json({ ok: false, error: "InfinitePay nao retornou URL de pagamento", raw: ipData });
      }

      const { error: upsertErr } = await supabase
        .from("mensalidades")
        .upsert(
          { client_id, mes, ano, valor: client.valor_mensalidade, status: "pendente", link_pagamento: link, order_nsu },
          { onConflict: "client_id,mes,ano" }
        );

      if (upsertErr) throw upsertErr;

      return json({ ok: true, link, order_nsu, mes, ano });
    }

    // ----------- Admin: atualizar billing -----------
    if (action === "atualizarBillingCliente") {
      const { client_id, valor_mensalidade, dia_vencimento } = payload ?? {};
      if (!client_id) return json({ error: "client_id obrigatorio" }, 400);

      const updates: Record<string, unknown> = {};
      if (typeof valor_mensalidade === "number" && valor_mensalidade >= 0) {
        updates.valor_mensalidade = Math.round(valor_mensalidade);
      }
      if (typeof dia_vencimento === "number" && dia_vencimento >= 1 && dia_vencimento <= 28) {
        updates.dia_vencimento = dia_vencimento;
      }

      if (Object.keys(updates).length === 0) return json({ error: "Nenhum campo para atualizar" }, 400);

      const { error } = await supabase.from("clients").update(updates).eq("id", client_id);
      if (error) throw error;

      return json({ ok: true });
    }

    return json({ error: "Acao invalida." }, 400);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    console.error("[infinitepay] uncaught:", message);
    return json({ error: message }, 500);
  }
});
