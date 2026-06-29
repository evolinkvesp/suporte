import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  Search,
  Calendar
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { cn } from "@/lib/utils";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { format, startOfToday, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

type ServiceStatus = "Ativo" | "Em Manutenção" | "Pausado";

type Client = {
  id: string;
  nome_cliente_empresa: string;
  status_servico: ServiceStatus;
  proxima_manutencao: string;
  created_at: string;
};

export default function Dashboard() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [clientsRes, logsRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("maintenance_notification_logs").select("*").order("sent_at", { ascending: false }).limit(3)
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (logsRes.error) throw logsRes.error;

      setClients(clientsRes.data as Client[] ?? []);
      setLogs(logsRes.data as any[] ?? []);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const metrics = useMemo(() => {
    const total = clients.length;
    const active = clients.filter(c => c.status_servico === "Ativo").length;
    const maintenance = clients.filter(c => c.status_servico === "Em Manutenção").length;
    
    // Calculate growth (clients created this month vs last month)
    const now = new Date();
    const thisMonth = clients.filter(c => 
      isWithinInterval(new Date(c.created_at), { start: startOfMonth(now), end: endOfMonth(now) })
    ).length;
    const lastMonth = clients.filter(c => 
      isWithinInterval(new Date(c.created_at), { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) })
    ).length;
    
    const growth = lastMonth === 0 ? (thisMonth > 0 ? 100 : 0) : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);

    return [
      { label: "Clientes", val: total.toString(), delta: `${thisMonth >= lastMonth ? "+" : ""}${thisMonth}`, icon: Users, color: "text-primary", bg: "bg-primary/10" },
      { label: "Ativos", val: active.toString(), delta: `${Math.round((active / (total || 1)) * 100)}%`, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
      { label: "Manutenção", val: maintenance.toString(), delta: `${maintenance} Agend`, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
      { label: "Crescimento", val: `${growth}%`, delta: "Este mês", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    ];
  }, [clients]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), 5 - i));
    return months.map(m => {
      const name = format(m, "MMM", { locale: ptBR });
      const total = clients.filter(c => 
        isWithinInterval(new Date(c.created_at), { start: startOfMonth(m), end: endOfMonth(m) })
      ).length;
      return { name, total };
    });
  }, [clients]);

  const statusData = useMemo(() => {
    const total = clients.length || 1;
    const counts = {
      Ativo: clients.filter(c => c.status_servico === "Ativo").length,
      "Em Manutenção": clients.filter(c => c.status_servico === "Em Manutenção").length,
      Pausado: clients.filter(c => c.status_servico === "Pausado").length,
    };

    return [
      { name: "Ativos", value: Math.round((counts.Ativo / total) * 100), color: "#007AFF" },
      { name: "Manutenção", value: Math.round((counts["Em Manutenção"] / total) * 100), color: "#FF9500" },
      { name: "Pausados", value: Math.round((counts.Pausado / total) * 100), color: "#8E8E93" },
    ];
  }, [clients]);

  const nextVisits = useMemo(() => {
    const today = startOfToday();
    return clients
      .filter(c => new Date(`${c.proxima_manutencao}T00:00:00`) >= today)
      .sort((a, b) => new Date(a.proxima_manutencao).getTime() - new Date(b.proxima_manutencao).getTime())
      .slice(0, 3)
      .map(c => ({
        name: c.nome_cliente_empresa,
        date: format(new Date(`${c.proxima_manutencao}T00:00:00`), "dd MMM, HH:mm"),
        status: c.status_servico === "Em Manutenção" ? "Urgente" : "Agendado",
        icon: "🏢"
      }));
  }, [clients]);

  const systemAlerts = useMemo(() => {
    return logs.map((l: any) => ({
      msg: l.error_message || `Notificação ${l.window_type} enviada`,
      time: format(new Date(l.sent_at), "HH:mm"),
      type: l.status === "error" || l.error_message ? "error" : "success"
    }));
  }, [logs]);
  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Top Bar / Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-sm font-medium text-muted-foreground opacity-70 flex items-center gap-2">
                <Calendar className="h-3 w-3" /> Domingo, 26 de Abril
              </p>
            </div>
            <div className="relative group max-w-sm w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input 
                type="text" 
                placeholder="Buscar clientes ou serviços..." 
                className="w-full bg-secondary/50 backdrop-blur-md border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((stat, i) => (
              <div key={i} className="glass rounded-[2rem] p-6 ios-transition hover:translate-y-[-4px]">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-3 rounded-2xl", stat.bg)}>
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <span className={cn("text-xs font-bold px-2 py-1 rounded-full", stat.bg, stat.color)}>
                    {stat.delta}
                  </span>
                </div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold tracking-tight">{stat.val}</p>
              </div>
            ))}
          </div>

          {/* Main Charts Row */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 glass rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">Crescimento Mensal</h3>
                </div>
              </div>
              <div className="h-[320px] -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007AFF" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(142,142,147,0.1)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: "#8E8E93", fontSize: 11, fontWeight: 600 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: "#8E8E93", fontSize: 11, fontWeight: 600 }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "rgba(255,255,255,0.8)", 
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "16px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#007AFF" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorTotal)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 glass rounded-[2.5rem] p-8">
              <h3 className="text-lg font-bold mb-8">Status Geral</h3>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: "#8E8E93", fontSize: 11, fontWeight: 600 }} 
                    />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={40}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4 mt-6">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-xs font-black">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold">Próximas Visitas</h3>
                <Button variant="link" className="text-primary text-xs font-bold">Ver tudo</Button>
              </div>
              <div className="space-y-4">
                {nextVisits.length === 0 ? (
                  <p className="text-sm text-muted-foreground opacity-60 italic text-center py-10">Nenhuma visita agendada.</p>
                ) : (
                  nextVisits.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-3xl bg-secondary/30 ios-transition hover:bg-secondary/50">
                      <div className="h-12 w-12 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center text-xl shadow-sm">
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{item.name}</p>
                        <p className="text-[11px] font-semibold text-muted-foreground opacity-70 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {item.date}
                        </p>
                      </div>
                      <div className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border-none",
                        item.status === "Urgente" 
                          ? "bg-destructive/10 text-destructive" 
                          : "bg-primary/10 text-primary"
                      )}>
                        {item.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass rounded-[2.5rem] p-8">
              <h3 className="text-lg font-bold mb-8">Alertas de Sistema</h3>
              <div className="space-y-4">
                {systemAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground opacity-60 italic text-center py-10">Sem alertas recentes.</p>
                ) : (
                  systemAlerts.map((item, i) => (
                    <div key={i} className="flex gap-4 items-start p-4 rounded-3xl hover:bg-secondary/20 transition-colors">
                      <div className={cn(
                        "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0",
                        item.type === "error" ? "bg-destructive/10 text-destructive" : 
                        item.type === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                      )}>
                        {item.type === "error" ? <AlertTriangle className="h-5 w-5" /> : 
                         item.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold tracking-tight">{item.msg}</span>
                        <span className="text-[10px] font-black text-muted-foreground uppercase opacity-50">{item.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

