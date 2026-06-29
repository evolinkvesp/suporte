import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Key,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FileText,
  Lock,
  Eye,
  EyeOff,
  CreditCard,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Client = {
  id: string;
  nome_cliente_empresa: string;
  ultima_manutencao: string | null;
  valor_mensalidade?: number;
  descricao_servico?: string | null;
};

type Mensalidade = {
  id: string;
  status: "pendente" | "pago" | "cancelado" | "vencido";
  valor: number;
  link_pagamento: string | null;
  metodo_pagamento: string | null;
  receipt_url: string | null;
  pago_em: string | null;
};

type Password = {
  id: string;
  service_name: string;
  username: string;
  password: string;
  notes: string;
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
};

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export default function ClientPortal() {
  const { clientId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mensalidade, setMensalidade] = useState<Mensalidade | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});

  // New Ticket Form State
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Detect return from InfinitePay with payment params
  useEffect(() => {
    if (searchParams.get("order_nsu")) {
      toast({
        title: "Pagamento recebido!",
        description: "Seu pagamento está sendo processado.",
      });
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!clientId) return;
      setIsLoading(true);
      try {
        // Fetch client info + mensalidade via Edge Function (bypasses RLS)
        const { data: portalData } = await supabase.functions.invoke("infinitepay-checkout", {
          body: { action: "getPortalData", payload: { client_id: clientId } },
        });

        if (portalData?.client) {
          setClient(portalData.client);
          setMensalidade(portalData.mensalidade ?? null);
        }

        // Fetch passwords via Edge Function
        const { data: passData } = await supabase.functions.invoke("clients-crm", {
          body: { action: "listPasswords", payload: { client_id: clientId } },
        });
        setPasswords(passData?.passwords || []);

        // Fetch tickets via Edge Function
        const { data: ticketData } = await supabase.functions.invoke("clients-crm", {
          body: { action: "listTickets", payload: { client_id: clientId } },
        });
        setTickets(ticketData?.tickets || []);

      } catch (err) {
        toast({
          title: "Erro de acesso",
          description: "Link inválido ou expirado.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [clientId]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description || !clientId) return;

    setIsSending(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("clients-crm", {
        body: {
          action: "createTicket",
          payload: { client_id: clientId, subject, description, priority: "Normal" },
        },
      });

      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      toast({
        title: "Chamado enviado!",
        description: "Nossa equipe analisará sua solicitação em breve.",
      });

      setSubject("");
      setDescription("");

      // Refresh tickets
      const { data: ticketData } = await supabase.functions.invoke("clients-crm", {
        body: { action: "listTickets", payload: { client_id: clientId } },
      });
      setTickets(ticketData?.tickets || []);

    } catch (err) {
      toast({
        title: "Erro ao enviar chamado",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black">Portal Indisponível</h1>
          <p className="text-muted-foreground">O link de acesso não é válido ou foi removido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans p-4 lg:p-10 pb-32 lg:pb-10">
      <div className="max-w-4xl mx-auto space-y-8 lg:space-y-12">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-secondary/30 backdrop-blur-3xl p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] border border-white/10 shadow-2xl">
          <div className="space-y-1 text-center lg:text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Portal do Cliente</p>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight line-clamp-2">{client.nome_cliente_empresa}</h1>
            {client.ultima_manutencao && (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                Última Manutenção: {format(new Date(client.ultima_manutencao + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 bg-white/5 lg:bg-transparent p-3 lg:p-0 rounded-2xl lg:rounded-none">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
             </div>
             <span className="text-sm font-bold text-muted-foreground">Acesso Seguro</span>
          </div>
        </header>

        {/* Serviço Contratado */}
        {client.descricao_servico && (
          <section className="rounded-[2rem] border border-white/10 bg-secondary/20 p-6 lg:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-black uppercase tracking-widest text-primary/80">Serviço Contratado</h2>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium">
              {client.descricao_servico}
            </p>
          </section>
        )}

        {/* Mensalidade / Pagamento */}
        {client.valor_mensalidade !== undefined && client.valor_mensalidade > 0 && (
          <section>
            {(() => {
              const now = new Date();
              const mesAtual = MESES[now.getMonth()];
              const anoAtual = now.getFullYear();
              const isPago = mensalidade?.status === "pago";

              return (
                <div className={cn(
                  "rounded-[2rem] p-6 lg:p-8 space-y-4 border shadow-2xl",
                  isPago
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-primary/5 border-primary/10"
                )}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        isPago ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
                      )}>
                        {isPago ? <CheckCircle2 className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Mensalidade
                        </p>
                        <p className="font-black text-lg">{mesAtual} {anoAtual}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor</p>
                      <p className="font-black text-xl">{fmt(client.valor_mensalidade!)}</p>
                    </div>
                  </div>

                  {isPago ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-green-500/10 rounded-2xl p-4">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">Mensalidade paga!</p>
                        {mensalidade?.pago_em && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(mensalidade.pago_em).toLocaleDateString("pt-BR")}
                            {mensalidade.metodo_pagamento && ` · ${mensalidade.metodo_pagamento === "pix" ? "Pix" : mensalidade.metodo_pagamento === "credit_card" ? "Cartão" : mensalidade.metodo_pagamento}`}
                          </p>
                        )}
                      </div>
                      {mensalidade?.receipt_url && (
                        <Button size="sm" variant="outline" className="rounded-full gap-2 text-xs shrink-0" asChild>
                          <a href={mensalidade.receipt_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            Comprovante
                          </a>
                        </Button>
                      )}
                    </div>
                  ) : mensalidade?.link_pagamento ? (
                    <Button
                      className="w-full h-14 rounded-full text-base font-black gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all"
                      onClick={() => window.open(mensalidade.link_pagamento!, "_blank")}
                    >
                      <QrCode className="h-5 w-5" />
                      Pagar Mensalidade
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3 bg-muted/20 rounded-2xl p-4">
                      <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground">Link de pagamento ainda não gerado. Entre em contato.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        <div className="grid gap-8 lg:gap-12 lg:grid-cols-2">
          
          {/* Column 1: Passwords & Tickets */}
          <div className="space-y-8">
            
            {/* Passwords Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Key className="h-4 w-4 text-primary" />
                <h2 className="text-xl font-bold">Suas Senhas</h2>
              </div>
              <div className="space-y-3">
                {passwords.length === 0 ? (
                  <p className="text-sm text-muted-foreground opacity-60 italic p-4 bg-secondary/20 rounded-3xl text-center">Nenhuma senha compartilhada ainda.</p>
                ) : (
                  passwords.map((pass) => (
                    <div key={pass.id} className="glass rounded-3xl p-5 space-y-3 group">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-primary uppercase tracking-wider">{pass.service_name}</h3>
                        <Key className="h-4 w-4 opacity-20" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-muted-foreground uppercase opacity-50">Usuário</span>
                          <span className="text-sm font-semibold">{pass.username || "—"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-muted-foreground uppercase opacity-50">Senha</span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-mono tracking-wider font-bold">
                              {showPass[pass.id] ? pass.password : "••••••••"}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-full"
                              onClick={() => setShowPass(prev => ({ ...prev, [pass.id]: !prev[pass.id] }))}
                            >
                              {showPass[pass.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Tickets Status */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="text-xl font-bold">Histórico</h2>
              </div>
              <div className="space-y-3">
                {tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground opacity-60 italic p-4 bg-secondary/20 rounded-3xl text-center">Você ainda não abriu chamados.</p>
                ) : (
                  tickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center gap-4 p-4 rounded-3xl bg-secondary/30 border border-white/5">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                        ticket.status === "Aberto" ? "bg-primary/10 text-primary" :
                        ticket.status === "Em Andamento" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                      )}>
                        {ticket.status === "Aberto" ? <AlertTriangle className="h-5 w-5" /> : 
                         ticket.status === "Em Andamento" ? <Clock className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{ticket.subject}</p>
                        <p className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-widest">
                          {format(new Date(ticket.created_at), "dd/MM/yyyy", { locale: ptBR })} • {ticket.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Column 2: New Ticket Form */}
          <section className="space-y-6">
            <div className="glass rounded-[3rem] p-8 lg:p-10 space-y-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/10 shadow-2xl">
              <div className="space-y-2">
                <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-black tracking-tight">Novo Chamado</h2>
                <p className="text-sm font-semibold text-muted-foreground opacity-60">Solicite suporte ou informe uma instabilidade.</p>
              </div>

              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assunto</label>
                  <input 
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Instabilidade na automação X"
                    className="w-full bg-background/50 border border-white/10 rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Descrição Detalhada</label>
                  <textarea 
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o que está acontecendo..."
                    rows={5}
                    className="w-full bg-background/50 border border-white/10 rounded-[2rem] py-4 px-6 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                  />
                </div>
                <Button 
                  disabled={isSending}
                  type="submit" 
                  className="w-full h-16 rounded-full text-lg font-black tracking-tight gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all"
                >
                  {isSending ? "Enviando..." : (
                    <>
                      Enviar Solicitação <Send className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-secondary/20 border border-white/5 text-center space-y-3">
              <h4 className="font-bold text-sm">Precisa de Ajuda Imediata?</h4>
              <p className="text-xs text-muted-foreground">Para casos críticos, entre em contato via WhatsApp suporte.</p>
              <Button 
                variant="outline" 
                className="rounded-full gap-2 text-xs font-bold w-full"
                onClick={() => window.open("https://wa.me/553198168987", "_blank")}
              >
                WhatsApp Suporte <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
