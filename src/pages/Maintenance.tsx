import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Filter,
  Plus
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";

type ServiceStatus = "Ativo" | "Em Manutenção" | "Pausado";

type Client = {
  id: string;
  nome_cliente_empresa: string;
  site_url: string | null;
  automacoes: string;
  ultima_manutencao: string | null;
  proxima_manutencao: string;
  status_servico: ServiceStatus;
};

export default function Maintenance() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const refreshClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("proxima_manutencao", { ascending: true });

      if (error) throw error;
      setClients(data as Client[] ?? []);
    } catch (err) {
      toast({
        title: "Erro ao carregar manutenções",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshClients();
  }, []);

  const maintenanceTasks = useMemo(() => {
    const targetDate = format(selectedDate, "yyyy-MM-dd");
    return clients
      .filter((c) => c.proxima_manutencao === targetDate)
      .map((c) => ({
        id: c.id,
        client: c.nome_cliente_empresa,
        service: "Manutenção Preventiva", // Default service name for now
        date: new Date(`${c.proxima_manutencao}T09:00:00`), // Mocking time as 09:00
        priority: c.status_servico === "Em Manutenção" ? "High" : "Medium",
        status: c.status_servico === "Ativo" ? "Scheduled" : "Pending"
      }));
  }, [clients, selectedDate]);
  
  // Create a 7-day strip for the calendar header
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i));

  return (
    <div className="flex min-h-screen bg-background font-sans overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 lg:p-10 pb-32 lg:pb-10 w-full overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">Manutenção</h1>
              <p className="text-xs lg:text-sm font-medium text-muted-foreground opacity-70">Cronograma técnico e preventivo.</p>
            </div>
            <Button className="rounded-full h-11 w-11 lg:h-12 lg:w-12 p-0 shadow-xl shadow-primary/20 shrink-0">
              <Plus className="h-5 w-5 lg:h-6 lg:w-6" />
            </Button>
          </div>

          {/* iOS Style Calendar Strip */}
          <div className="glass rounded-[2rem] p-3 lg:p-6 flex gap-2 lg:gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0">
            {weekDays.map((date, i) => {
              const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
              const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-w-[58px] lg:min-w-[70px] py-3 lg:py-4 rounded-2xl transition-all duration-300 shrink-0",
                    isSelected 
                      ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105" 
                      : "hover:bg-white/50 dark:hover:bg-white/5 bg-white/30 dark:bg-white/5"
                  )}
                >
                  <span className={cn(
                    "text-[8px] lg:text-[10px] font-black uppercase tracking-widest",
                    isSelected ? "text-white/70" : "text-muted-foreground"
                  )}>
                    {format(date, "EEE", { locale: ptBR })}
                  </span>
                  <span className="text-sm lg:text-lg font-bold">
                    {format(date, "d")}
                  </span>
                  {isToday && !isSelected && (
                    <div className="h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 lg:mx-0">
            <Button variant="secondary" size="sm" className="rounded-full px-4 lg:px-5 font-bold gap-2 shrink-0 h-9">
              <Filter className="h-3 w-3" />
              Todos
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full px-4 lg:px-5 font-bold text-muted-foreground shrink-0 h-9">
              Urgentes
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full px-4 lg:px-5 font-bold text-muted-foreground shrink-0 h-9">
              Concluídos
            </Button>
          </div>

          {/* Task List */}
          <div className="space-y-4">
            <h3 className="text-lg lg:text-xl font-bold px-2">Tarefas para {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}</h3>
            
            <div className="grid gap-3 lg:gap-4">
              {maintenanceTasks.map((task) => (
                <div 
                  key={task.id}
                  className="glass rounded-[2rem] p-4 lg:p-6 ios-transition hover:translate-x-1 lg:hover:translate-x-2 group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 lg:gap-5 min-w-0">
                      <div className={cn(
                        "h-10 w-10 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-inner shrink-0",
                        task.priority === "High" ? "bg-destructive/10 text-destructive" :
                        task.priority === "Medium" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                      )}>
                        {task.priority === "High" ? <AlertTriangle className="h-5 w-5 lg:h-7 lg:w-7" /> : 
                         task.status === "Pending" ? <Clock className="h-5 w-5 lg:h-7 lg:w-7" /> : <CheckCircle2 className="h-5 w-5 lg:h-7 lg:w-7" />}
                      </div>
                      
                      <div className="space-y-0.5 lg:space-y-1 min-w-0">
                        <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 truncate">
                          {task.client}
                        </p>
                        <h4 className="text-sm lg:text-lg font-bold text-foreground leading-tight truncate">{task.service}</h4>
                        <div className="flex items-center gap-2 lg:gap-4 overflow-hidden">
                          <span className="text-[10px] lg:text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" /> {format(task.date, "HH:mm")}
                          </span>
                          <span className={cn(
                            "text-[8px] lg:text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0",
                            task.priority === "High" ? "bg-destructive/10 text-destructive" :
                            task.priority === "Medium" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                          )}>
                            {task.priority === "High" ? "Prioritário" : "Rotina"}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors shrink-0 h-9 w-9">
                      <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Widget */}
          <div className="grid gap-4 lg:gap-6 sm:grid-cols-2">
            <div className="glass rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-8 bg-gradient-to-br from-primary/10 to-transparent border-primary/10">
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <div className="p-2.5 lg:p-3 rounded-2xl bg-primary shadow-lg shadow-primary/20">
                  <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <span className="text-3xl lg:text-4xl font-black text-primary opacity-20">
                  {clients.filter(c => c.status_servico === "Ativo").length.toString().padStart(2, "0")}
                </span>
              </div>
              <h4 className="text-lg lg:text-xl font-bold mb-1">Clientes em Dia</h4>
              <p className="text-xs lg:text-sm text-muted-foreground font-medium">Serviços com status ativo no sistema.</p>
            </div>
            
            <div className="glass rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-8 bg-gradient-to-br from-warning/10 to-transparent border-warning/10">
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <div className="p-2.5 lg:p-3 rounded-2xl bg-warning shadow-lg shadow-warning/20">
                  <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <span className="text-3xl lg:text-4xl font-black text-warning opacity-20">
                  {clients.filter(c => {
                    const next = new Date(`${c.proxima_manutencao}T00:00:00`);
                    const today = startOfToday();
                    return next >= today && next <= addDays(today, 1);
                  }).length.toString().padStart(2, "0")}
                </span>
              </div>
              <h4 className="text-lg lg:text-xl font-bold mb-1">Próximas 24h</h4>
              <p className="text-xs lg:text-sm text-muted-foreground font-medium">Intervenções agendadas para hoje e amanhã.</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
