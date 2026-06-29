import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, ChevronLeft, ChevronRight, CheckCircle2, Clock,
  AlertCircle, Copy, ExternalLink, Loader2, Pencil, Check, X, QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addMonths, subMonths } from "date-fns";

type Mensalidade = {
  id: string;
  status: "pendente" | "pago" | "cancelado" | "vencido";
  valor: number;
  link_pagamento: string | null;
  metodo_pagamento: string | null;
  receipt_url: string | null;
  pago_em: string | null;
};

type ClienteComMensalidade = {
  id: string;
  nome_cliente_empresa: string;
  status_servico: string;
  valor_mensalidade: number;
  dia_vencimento: number;
  mensalidade: Mensalidade | null;
};

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export default function Financeiro() {
  const { toast } = useToast();
  const [ref, setRef] = useState(new Date());
  const [clientes, setClientes] = useState<ClienteComMensalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editDia, setEditDia] = useState("");
  const [saving, setSaving] = useState(false);

  const mes = ref.getMonth() + 1;
  const ano = ref.getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("infinitepay-checkout", {
        body: { action: "listarMensalidades", payload: { mes, ano } },
      });
      if (error) throw error;
      setClientes(data?.clientes ?? []);
    } catch {
      toast({ title: "Erro ao carregar financeiro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => { void load(); }, [load]);

  const gerarLink = async (clientId: string) => {
    setGeneratingFor(clientId);
    try {
      const { data, error } = await supabase.functions.invoke("infinitepay-checkout", {
        body: { action: "gerarLink", payload: { client_id: clientId } },
      });
      if (error) throw new Error(error.message);
      if (data?.error || data?.ok === false) throw new Error(data.error ?? "Erro desconhecido");
      await navigator.clipboard.writeText(data.link);
      toast({ title: "Link gerado e copiado!", description: String(data.link).substring(0, 70) + "…" });
      void load();
    } catch (e) {
      toast({
        title: "Erro ao gerar link",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!" });
  };

  const startEdit = (c: ClienteComMensalidade) => {
    setEditingId(c.id);
    setEditValor(c.valor_mensalidade ? (c.valor_mensalidade / 100).toFixed(2).replace(".", ",") : "");
    setEditDia(String(c.dia_vencimento || 10));
  };

  const saveEdit = async (clientId: string) => {
    setSaving(true);
    try {
      const valorCents = Math.round(parseFloat(editValor.replace(",", ".")) * 100);
      const dia = parseInt(editDia, 10);
      if (isNaN(valorCents) || valorCents <= 0) throw new Error("Valor inválido");
      if (isNaN(dia) || dia < 1 || dia > 28) throw new Error("Dia deve ser entre 1 e 28");

      const { error } = await supabase.functions.invoke("infinitepay-checkout", {
        body: {
          action: "atualizarBillingCliente",
          payload: { client_id: clientId, valor_mensalidade: valorCents, dia_vencimento: dia },
        },
      });
      if (error) throw error;
      toast({ title: "Configuração salva!" });
      setEditingId(null);
      void load();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const previsto = clientes.reduce((s, c) => s + (c.valor_mensalidade || 0), 0);
  const recebido = clientes
    .filter(c => c.mensalidade?.status === "pago")
    .reduce((s, c) => s + (c.mensalidade?.valor || 0), 0);
  const aPagar = clientes
    .filter(c => c.mensalidade?.status === "pendente")
    .reduce((s, c) => s + (c.mensalidade?.valor || 0), 0);
  const semConfig = clientes.filter(c => !c.valor_mensalidade).length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-80 p-5 lg:p-8 pb-28 lg:pb-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Header + navegador de mês */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Financeiro</h1>
              <p className="text-sm text-muted-foreground">Mensalidades · InfinitePay</p>
            </div>
            <div className="flex items-center gap-1 bg-secondary/40 backdrop-blur-xl rounded-2xl p-1 self-start sm:self-auto">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setRef(d => subMonths(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-bold px-4 min-w-[160px] text-center">
                {MESES[ref.getMonth()]} {ano}
              </span>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setRef(d => addMonths(d, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Previsto",    value: fmt(previsto), Icon: DollarSign,   cls: "" },
              { label: "Recebido",    value: fmt(recebido), Icon: CheckCircle2, cls: "text-green-500" },
              { label: "A Receber",   value: fmt(aPagar),   Icon: Clock,        cls: "text-yellow-500" },
              { label: "Sem config.", value: `${semConfig}`, Icon: AlertCircle, cls: "text-muted-foreground" },
            ].map(({ label, value, Icon, cls }) => (
              <div key={label} className="bg-secondary/30 border border-white/10 rounded-3xl p-5 space-y-2">
                <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest", cls)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
                <p className="text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>

          {/* Lista de clientes */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : clientes.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">Nenhum cliente cadastrado.</p>
            ) : clientes.map((c) => {
              const m = c.mensalidade;
              const isEditing = editingId === c.id;
              const isGenerating = generatingFor === c.id;

              return (
                <div key={c.id} className="bg-secondary/20 border border-white/10 rounded-3xl p-5 space-y-4">

                  {/* Cabeçalho do card */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <p className="font-bold truncate">{c.nome_cliente_empresa}</p>
                      <span className={cn(
                        "inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                        c.status_servico === "Ativo"
                          ? "bg-green-500/10 text-green-500"
                          : c.status_servico === "Em Manutenção"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-muted/50 text-muted-foreground"
                      )}>{c.status_servico}</span>
                    </div>

                    {/* Badge status de pagamento */}
                    {m ? (
                      <div className={cn(
                        "shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-2xl",
                        m.status === "pago"     ? "bg-green-500/10 text-green-500" :
                        m.status === "pendente" ? "bg-yellow-500/10 text-yellow-500" :
                                                  "bg-muted/30 text-muted-foreground"
                      )}>
                        {m.status === "pago"
                          ? <CheckCircle2 className="h-3.5 w-3.5" />
                          : <Clock className="h-3.5 w-3.5" />}
                        {m.status === "pago" ? "Pago" : m.status === "pendente" ? "Aguardando" : m.status}
                      </div>
                    ) : (
                      <span className="shrink-0 text-[10px] font-bold text-muted-foreground px-3 py-1.5 bg-muted/20 rounded-2xl">
                        Não gerado
                      </span>
                    )}
                  </div>

                  {/* Modo edição de billing */}
                  {isEditing ? (
                    <div className="flex flex-wrap items-end gap-3 bg-background/50 rounded-2xl p-4 border border-white/5">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Valor mensal (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editValor}
                          onChange={e => setEditValor(e.target.value)}
                          placeholder="0,00"
                          className="w-32 bg-background border border-white/10 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Dia vencimento
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={editDia}
                          onChange={e => setEditDia(e.target.value)}
                          className="w-20 bg-background border border-white/10 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl h-9 gap-1.5"
                          onClick={() => saveEdit(c.id)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl h-9"
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Modo visualização */
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-6 text-sm">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Mensalidade</span>
                          <p className="font-black text-base mt-0.5">
                            {c.valor_mensalidade
                              ? fmt(c.valor_mensalidade)
                              : <span className="text-muted-foreground font-medium">Não configurado</span>}
                          </p>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Vencimento</span>
                          <p className="font-bold mt-0.5">Dia {c.dia_vencimento || 10}</p>
                        </div>
                        {m?.pago_em && (
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Pago em</span>
                            <p className="font-bold mt-0.5">
                              {new Date(m.pago_em).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        )}
                        {m?.metodo_pagamento && (
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Método</span>
                            <p className="font-bold mt-0.5">
                              {m.metodo_pagamento === "pix"
                                ? "Pix"
                                : m.metodo_pagamento === "credit_card"
                                ? "Cartão"
                                : m.metodo_pagamento}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl h-8 gap-1.5 text-xs"
                          onClick={() => startEdit(c)}
                        >
                          <Pencil className="h-3 w-3" />
                          Editar
                        </Button>

                        {m?.status === "pago" && m.receipt_url && (
                          <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1.5 text-xs" asChild>
                            <a href={m.receipt_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              Comprovante
                            </a>
                          </Button>
                        )}

                        {m?.status !== "pago" && m?.link_pagamento && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-8 gap-1.5 text-xs"
                            onClick={() => copyLink(m.link_pagamento!)}
                          >
                            <Copy className="h-3 w-3" />
                            Copiar Link
                          </Button>
                        )}

                        {m?.status !== "pago" && (
                          <Button
                            size="sm"
                            className="rounded-xl h-8 gap-1.5 text-xs"
                            onClick={() => gerarLink(c.id)}
                            disabled={isGenerating || !c.valor_mensalidade}
                            title={!c.valor_mensalidade ? "Configure o valor primeiro" : undefined}
                          >
                            {isGenerating
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <QrCode className="h-3 w-3" />}
                            {m?.link_pagamento ? "Regen. Link" : "Gerar Link"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
