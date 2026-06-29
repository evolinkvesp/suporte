import { Sidebar } from "@/components/Sidebar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { 
  MessageSquare, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Ticket = {
  id: string;
  client_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  clients: {
    nome_cliente_empresa: string;
  };
};

export default function Tickets() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          clients (
            nome_cliente_empresa
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data as any[] ?? []);
    } catch (err) {
      toast({
        title: "Erro ao carregar chamados",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t));
      
      toast({
        title: "Status atualizado",
        description: `Chamado movido para ${newStatus}.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 lg:p-10 pb-32 lg:pb-10">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex flex-col gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">Chamados</h1>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground opacity-70 flex items-center gap-2">
                <MessageSquare className="h-3 w-3" /> Gestão de suporte e solicitações.
              </p>
            </div>
            <div className="relative group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input 
                type="text" 
                placeholder="Buscar por assunto ou cliente..." 
                className="w-full bg-secondary/50 backdrop-blur-md border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 -mx-4 px-6 sm:mx-0 sm:px-0">
              <Button variant="secondary" className="rounded-full px-6 font-bold gap-2 shrink-0 h-10 shadow-sm">
                <Filter className="h-4 w-4" /> Todos
              </Button>
              <Button variant="ghost" className="rounded-full px-6 font-bold text-muted-foreground shrink-0 h-10 bg-secondary/30">Abertos</Button>
              <Button variant="ghost" className="rounded-full px-6 font-bold text-muted-foreground shrink-0 h-10 bg-secondary/30">Em Andamento</Button>
              <Button variant="ghost" className="rounded-full px-6 font-bold text-muted-foreground shrink-0 h-10 bg-secondary/30">Concluídos</Button>
            </div>
            {/* Subtle fade effect for scrolling */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
          </div>

          {/* Tickets List */}
          <div className="space-y-4 pb-16">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="glass rounded-[2rem] p-10 lg:p-20 text-center space-y-4">
                <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mx-auto">
                  <MessageSquare className="h-8 w-8 text-muted-foreground opacity-30" />
                </div>
                <h3 className="text-lg font-bold">Nenhum chamado encontrado</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">Novas solicitações aparecerão aqui automaticamente.</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <div 
                  key={ticket.id}
                  className="glass rounded-[2rem] p-5 lg:p-8 ios-transition hover:translate-y-[-4px] border border-white/5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex flex-row gap-4 lg:gap-5">
                      <div className={cn(
                        "h-12 w-12 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                        ticket.status === "Aberto" ? "bg-primary/10 text-primary" :
                        ticket.status === "Em Andamento" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                      )}>
                        {ticket.status === "Aberto" ? <AlertTriangle className="h-6 w-6 lg:h-7 lg:w-7" /> : 
                         ticket.status === "Em Andamento" ? <Clock className="h-6 w-6 lg:h-7 lg:w-7" /> : <CheckCircle2 className="h-6 w-6 lg:h-7 lg:w-7" />}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={cn(
                            "text-[9px] lg:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                            ticket.priority === "Urgente" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"
                          )}>
                            {ticket.priority}
                          </span>
                          <span className="text-[9px] lg:text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-widest">
                            {format(new Date(ticket.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <h3 className="text-base lg:text-xl font-bold tracking-tight mt-1 leading-tight">{ticket.subject}</h3>
                        <div className="flex items-center gap-2 text-[11px] lg:text-xs font-semibold text-muted-foreground">
                          <User className="h-3 w-3" /> {ticket.clients?.nome_cliente_empresa}
                        </div>
                        <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-2 lg:line-clamp-3">{ticket.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between lg:justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-none border-white/5">
                      <select 
                        value={ticket.status}
                        onChange={(e) => updateStatus(ticket.id, e.target.value)}
                        className="bg-secondary/50 border-none rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none ios-transition"
                      >
                        <option value="Aberto">Aberto</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Concluído">Concluído</option>
                      </select>
                      <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-white/5">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
