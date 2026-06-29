import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, startOfDay } from "date-fns";
import {
  AlertTriangle,
  BellRing,
  CalendarIcon,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Plus,
  Search,
  Settings,
  Wrench,
  Link as LinkIcon,
  ShieldCheck,
  Share2,
  Key as KeyIcon
} from "lucide-react";



import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ClientPasswordsDialog } from "@/components/ClientPasswordsDialog";

type ServiceStatus = "Ativo" | "Em Manutenção" | "Pausado";

type Client = {
  id: string;
  nome_cliente_empresa: string;
  site_url: string | null;
  automacoes: string;
  ultima_manutencao: string | null;
  proxima_manutencao: string;
  status_servico: ServiceStatus;
  valor_mensalidade: number;
  dia_vencimento: number;
  descricao_servico: string | null;
  created_at: string;
  updated_at: string;
};

type VaultState = {
  value: string;
  visible: boolean;
  loading: boolean;
};

const formSchema = z.object({
  nome_cliente_empresa: z.string().trim().min(1, "Nome obrigatório").max(140, "Máximo de 140 caracteres"),
  site_url: z
    .string()
    .trim()
    .max(300, "URL muito longa")
    .refine((value) => value === "" || /^https?:\/\/.+/i.test(value), "Use uma URL iniciando com http:// ou https://")
    .optional(),
  automacoes: z
    .string()
    .trim()
    .max(500, "URL muito longa")
    .refine((value) => value === "" || /^https?:\/\/.+/i.test(value), "Use uma URL iniciando com http:// ou https://")
    .optional(),
  credenciais: z.string().max(4000, "Máximo de 4000 caracteres").optional(),
  ultima_manutencao: z.date().optional(),
  proxima_manutencao: z.date({ required_error: "Próxima manutenção é obrigatória" }),
  status_servico: z.enum(["Ativo", "Em Manutenção", "Pausado"]),
  valor_mensalidade: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+([,\.]\d{0,2})?$/.test(v.trim()), "Valor inválido"),
  dia_vencimento: z
    .coerce
    .number()
    .min(1, "Mínimo dia 1")
    .max(28, "Máximo dia 28")
    .optional(),
  descricao_servico: z.string().max(5000, "Máximo de 5000 caracteres").optional(),
});

type FormValues = z.infer<typeof formSchema>;

type CtaMode = "create" | "edit";

const parseYmdDate = (value: string | null) => (value ? new Date(`${value}T00:00:00`) : undefined);

const toYmdDate = (value?: Date) => (value ? format(value, "yyyy-MM-dd") : null);

const invokeClients = async <T,>(action: string, payload?: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("clients-crm", {
    body: { action, payload },
  });

  if (error) throw new Error(error.message || "Falha na comunicação com o backend.");
  if (data?.error) throw new Error(data.error);

  return data as T;
};

const invokePushSubscriptions = async <T,>(action: string, payload?: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("push-subscriptions", {
    body: { action, payload },
  });

  if (error) throw new Error(error.message || "Falha na comunicação com o backend.");
  if (data?.error) throw new Error(data.error);

  return data as T;
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

const statusTone: Record<ServiceStatus, { label: string; className: string }> = {
  Ativo: { label: "Ativo", className: "bg-accent text-accent-foreground border-border" },
  "Em Manutenção": { label: "Em Manutenção", className: "bg-warning/20 text-warning border-warning/40" },
  Pausado: { label: "Pausado", className: "bg-muted text-muted-foreground border-border" },
};

const Index = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<CtaMode>("create");
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [vaultByClient, setVaultByClient] = useState<Record<string, VaultState>>({});
  const isMobile = useIsMobile();
  const [showAllMobileClients, setShowAllMobileClients] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
  const [passwordsDialogOpen, setPasswordsDialogOpen] = useState(false);
  const [activePasswordClient, setActivePasswordClient] = useState<{id: string, name: string} | null>(null);
  const [activeTab, setActiveTab] = useState("dados");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_cliente_empresa: "",
      site_url: "",
      automacoes: "",
      credenciais: "",
      ultima_manutencao: undefined,
      proxima_manutencao: undefined,
      status_servico: "Ativo",
    },
  });

  const refreshClients = async () => {
    setIsLoading(true);
    try {
      const response = await invokeClients<{ clients: Client[] }>("listClients");
      setClients(response.clients ?? []);
    } catch (err) {
      toast({
        title: "Erro ao carregar clientes",
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

  useEffect(() => {
    const syncPushStatus = async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setPushSupported(supported);
      if (!supported) return;

      setPushPermission(Notification.permission);

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscribed(Boolean(subscription));
      } catch {
        setPushSubscribed(false);
      }
    };

    void syncPushStatus();
  }, []);

  const filteredClients = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return clients.filter((client) => client.nome_cliente_empresa.toLowerCase().includes(normalized));
  }, [clients, search]);

  const alerts = useMemo(() => {
    const now = startOfDay(new Date());
    const overdue: Client[] = [];
    const today: Client[] = [];
    const next30: Client[] = [];

    clients.forEach((client) => {
      const nextDate = startOfDay(new Date(`${client.proxima_manutencao}T00:00:00`));
      const diffDays = Math.floor((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) overdue.push(client);
      else if (diffDays === 0) today.push(client);
      else if (diffDays <= 30) next30.push(client);
    });

    return { overdue, today, next30 };
  }, [clients]);

  const visibleClients = useMemo(() => {
    if (!isMobile || showAllMobileClients) return filteredClients;

    const todayIds = new Set(alerts.today.map((client) => client.id));
    return filteredClients.filter((client) => todayIds.has(client.id));
  }, [alerts.today, filteredClients, isMobile, showAllMobileClients]);

  const openCreateModal = () => {
    setMode("create");
    setEditingClient(null);
    setActiveTab("dados");
    form.reset({
      nome_cliente_empresa: "",
      site_url: "",
      automacoes: "",
      credenciais: "",
      ultima_manutencao: undefined,
      proxima_manutencao: undefined,
      status_servico: "Ativo",
      valor_mensalidade: "",
      dia_vencimento: 10,
      descricao_servico: "",
    });
    setDialogOpen(true);
  };

  const openEditModal = (client: Client) => {
    setMode("edit");
    setEditingClient(client);
    setActiveTab("dados");
    form.reset({
      nome_cliente_empresa: client.nome_cliente_empresa,
      site_url: client.site_url ?? "",
      automacoes: client.automacoes,
      credenciais: "",
      ultima_manutencao: parseYmdDate(client.ultima_manutencao),
      proxima_manutencao: parseYmdDate(client.proxima_manutencao),
      status_servico: client.status_servico,
      valor_mensalidade: client.valor_mensalidade
        ? (client.valor_mensalidade / 100).toFixed(2).replace(".", ",")
        : "",
      dia_vencimento: client.dia_vencimento || 10,
      descricao_servico: client.descricao_servico ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async (values: FormValues) => {
    const credentials = values.credenciais?.trim() ?? "";

    if (mode === "edit" && !editingClient) return;

    const valorCents = values.valor_mensalidade
      ? Math.round(parseFloat(values.valor_mensalidade.replace(",", ".")) * 100)
      : 0;

    setIsSaving(true);
    try {
      if (mode === "create") {
        await invokeClients("createClient", {
          nome_cliente_empresa: values.nome_cliente_empresa.trim(),
          site_url: values.site_url?.trim() || null,
          automacoes: values.automacoes?.trim() || "",
          credenciais: credentials,
          ultima_manutencao: toYmdDate(values.ultima_manutencao),
          proxima_manutencao: toYmdDate(values.proxima_manutencao),
          status_servico: values.status_servico,
          valor_mensalidade: valorCents,
          dia_vencimento: values.dia_vencimento || 10,
          descricao_servico: values.descricao_servico?.trim() || null,
        });
      } else {
        await invokeClients("updateClient", {
          id: editingClient.id,
          nome_cliente_empresa: values.nome_cliente_empresa.trim(),
          site_url: values.site_url?.trim() || null,
          automacoes: values.automacoes?.trim() || "",
          credenciais: credentials,
          ultima_manutencao: toYmdDate(values.ultima_manutencao),
          proxima_manutencao: toYmdDate(values.proxima_manutencao),
          status_servico: values.status_servico,
          valor_mensalidade: valorCents,
          dia_vencimento: values.dia_vencimento || 10,
          descricao_servico: values.descricao_servico?.trim() || null,
        });

        setVaultByClient((prev) => ({ ...prev, [editingClient.id]: { value: "", visible: false, loading: false } }));
      }

      toast({ title: mode === "create" ? "Cliente cadastrado" : "Cliente atualizado" });
      setDialogOpen(false);
      await refreshClients();
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchCredential = async (clientId: string) => {
    setVaultByClient((prev) => ({
      ...prev,
      [clientId]: { value: prev[clientId]?.value ?? "", visible: prev[clientId]?.visible ?? false, loading: true },
    }));

    try {
      const response = await invokeClients<{ credenciais: string }>("revealCredentials", { id: clientId });
      const value = response.credenciais ?? "";
      setVaultByClient((prev) => ({ ...prev, [clientId]: { value, visible: true, loading: false } }));
      return value;
    } catch (err) {
      setVaultByClient((prev) => ({
        ...prev,
        [clientId]: { value: prev[clientId]?.value ?? "", visible: false, loading: false },
      }));
      toast({
        title: "Falha ao abrir cofre",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
      return "";
    }
  };

  const toggleCredential = async (clientId: string) => {
    const state = vaultByClient[clientId];
    if (state?.visible) {
      setVaultByClient((prev) => ({ ...prev, [clientId]: { ...state, visible: false } }));
      return;
    }

    if (state?.value) {
      setVaultByClient((prev) => ({ ...prev, [clientId]: { ...state, visible: true } }));
      return;
    }

    await fetchCredential(clientId);
  };

  const copyCredential = async (clientId: string) => {
    let value = vaultByClient[clientId]?.value ?? "";

    if (!value) {
      value = await fetchCredential(clientId);
      if (!value) return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Credenciais copiadas" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const copyPortalLink = (clientId: string) => {
    const url = `${window.location.origin}/portal/${clientId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link do Portal Copiado",
        description: "Envie este link para o cliente acessar suas senhas e abrir chamados.",
      });
    });
  };

  const enablePushNotifications = async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      toast({ title: "Seu navegador não suporta push", variant: "destructive" });
      return;
    }

    setPushLoading(true);
    try {
      const requestedPermission = await Notification.requestPermission();
      setPushPermission(requestedPermission);

      if (requestedPermission !== "granted") {
        toast({ title: "Permissão de notificação não concedida", variant: "destructive" });
        return;
      }

      const response = await invokePushSubscriptions<{ publicKey: string }>("getPublicKey");
      if (!response.publicKey) {
        throw new Error("Chave pública de push não disponível.");
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(response.publicKey),
        }));

      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
        throw new Error("Assinatura push inválida.");
      }

      await invokePushSubscriptions("register", {
        endpoint: serialized.endpoint,
        p256dh: serialized.keys.p256dh,
        auth: serialized.keys.auth,
        userAgent: navigator.userAgent,
      });

      setPushSubscribed(true);
      toast({ title: "Notificações ativadas" });
    } catch (error) {
      toast({
        title: "Falha ao ativar notificações",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPushLoading(false);
    }
  };

  const disablePushNotifications = async () => {
    if (!("serviceWorker" in navigator)) {
      setPushSubscribed(false);
      return;
    }

    setPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await invokePushSubscriptions("unregister", { endpoint });
      }

      setPushSubscribed(false);
      toast({ title: "Notificações desativadas" });
    } catch (error) {
      toast({
        title: "Falha ao desativar notificações",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPushLoading(false);
    }
  };

  const openPasswordsDialog = (id: string, name: string) => {
    setActivePasswordClient({ id, name });
    setPasswordsDialogOpen(true);
  };

  const maintenanceTone = (dateValue: string) => {
    const now = startOfDay(new Date());
    const target = startOfDay(new Date(`${dateValue}T00:00:00`));
    const diffDays = Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: "Atrasada", className: "bg-destructive/15 text-destructive border-destructive/30" };
    if (diffDays === 0) return { label: "Vence hoje", className: "bg-warning/20 text-warning border-warning/40" };
    return { label: "Em dia", className: "bg-muted text-muted-foreground border-border" };
  };

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 lg:p-10 pb-32 lg:pb-10">
        <section className="mx-auto w-full max-w-6xl space-y-10">


        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground">Clientes</h2>
            <p className="text-sm font-medium text-muted-foreground opacity-70">Gerencie ativos e cronogramas de manutenção.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              onClick={openCreateModal} 
              variant="primary"
              className="flex-1 sm:flex-none rounded-2xl gap-2 font-bold px-6 shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
            <Button variant="secondary" className="flex-1 sm:flex-none rounded-2xl gap-2 font-bold px-6" onClick={() => setSettingsDialogOpen(true)}>
              <Settings className="h-4 w-4" />
              Ajustes
            </Button>
          </div>
        </div>

        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BellRing className="text-primary" />
                Notificações
              </DialogTitle>
              <DialogDescription>
                Configure alertas de manutenção no seu navegador.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Suporte:</span> {pushSupported ? "Disponível" : "Indisponível"}
                </p>
                <p>
                  <span className="text-muted-foreground">Permissão:</span> {pushPermission}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span> {pushSubscribed ? "Ativado" : "Desativado"}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="secondary" onClick={enablePushNotifications} disabled={pushLoading || !pushSupported}>
                  {pushLoading ? <Loader2 className="animate-spin mr-2" /> : <BellRing className="mr-2" />}
                  Ativar notificações
                </Button>
                <Button variant="outline" onClick={disablePushNotifications} disabled={pushLoading || !pushSubscribed}>
                  Desativar notificações
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {isMobile ? (
          <section className="mb-6 grid gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowAllMobileClients((prev) => !prev)} className="w-full">
              {showAllMobileClients ? "Mostrar só vencem hoje" : "Ver clientes"}
            </Button>

            <div className="glass rounded-[2rem] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-warning/10">
                    <Clock3 className="h-5 w-5 text-warning" />
                  </div>
                  <h3 className="text-base font-bold">Vencem hoje</h3>
                </div>
                <span className="text-xs font-black px-2 py-1 rounded-full bg-warning/10 text-warning">{alerts.today.length}</span>
              </div>
              <div className="space-y-2">
                {alerts.today.length === 0 ? (
                  <p className="text-xs text-muted-foreground opacity-60 italic py-2">Nenhuma manutenção para hoje.</p>
                ) : (
                  alerts.today.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => openEditModal(client)}
                      className="w-full rounded-2xl bg-white/50 dark:bg-white/5 p-4 text-left ios-transition hover:bg-white/80 dark:hover:bg-white/10"
                    >
                      <p className="text-sm font-bold">{client.nome_cliente_empresa}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase mt-1">{format(new Date(`${client.proxima_manutencao}T00:00:00`), "dd MMM yyyy")}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-3">
            {/* Atrasadas */}
            <div className="glass rounded-[2rem] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Atrasadas</h3>
                </div>
                <span className="text-xs font-black px-2 py-1 rounded-full bg-destructive/10 text-destructive">{alerts.overdue.length}</span>
              </div>
              <div className="space-y-2">
                {alerts.overdue.length === 0 ? (
                  <p className="text-xs text-muted-foreground opacity-60 italic py-2">Nenhum atraso detectado.</p>
                ) : (
                  alerts.overdue.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => openEditModal(client)}
                      className="w-full rounded-2xl bg-destructive/5 p-4 text-left ios-transition hover:bg-destructive/10"
                    >
                      <p className="text-sm font-bold text-destructive">{client.nome_cliente_empresa}</p>
                      <p className="text-[10px] font-black text-destructive/60 uppercase mt-1">{format(new Date(`${client.proxima_manutencao}T00:00:00`), "dd MMM yyyy")}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Vencem hoje */}
            <div className="glass rounded-[2rem] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-warning/10">
                    <Clock3 className="h-5 w-5 text-warning" />
                  </div>
                  <h3 className="text-base font-bold">Vencem hoje</h3>
                </div>
                <span className="text-xs font-black px-2 py-1 rounded-full bg-warning/10 text-warning">{alerts.today.length}</span>
              </div>
              <div className="space-y-2">
                {alerts.today.length === 0 ? (
                  <p className="text-xs text-muted-foreground opacity-60 italic py-2">Nada para hoje.</p>
                ) : (
                  alerts.today.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => openEditModal(client)}
                      className="w-full rounded-2xl bg-warning/5 p-4 text-left ios-transition hover:bg-warning/10"
                    >
                      <p className="text-sm font-bold">{client.nome_cliente_empresa}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase mt-1">{format(new Date(`${client.proxima_manutencao}T00:00:00`), "dd MMM yyyy")}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Próximos 30 dias */}
            <div className="glass rounded-[2rem] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Próximos 30 dias</h3>
                </div>
                <span className="text-xs font-black px-2 py-1 rounded-full bg-primary/10 text-primary">{alerts.next30.length}</span>
              </div>
              <div className="space-y-2">
                {alerts.next30.length === 0 ? (
                  <p className="text-xs text-muted-foreground opacity-60 italic py-2">Nenhuma manutenção em breve.</p>
                ) : (
                  alerts.next30.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => openEditModal(client)}
                      className="w-full rounded-2xl bg-secondary/30 p-4 text-left ios-transition hover:bg-secondary/50"
                    >
                      <p className="text-sm font-bold">{client.nome_cliente_empresa}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase mt-1">{format(new Date(`${client.proxima_manutencao}T00:00:00`), "dd MMM yyyy")}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        <div className="relative group max-w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input 
            type="text" 
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar clientes, sites ou automações..." 
            className="w-full bg-secondary/50 backdrop-blur-md border-none rounded-2xl py-4 pl-12 pr-4 text-base focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="h-56 animate-pulse" />
            ))}
          </div>
        ) : visibleClients.length === 0 ? (
          (isMobile && !showAllMobileClients) ? null : (
            <Card className="border-dashed">
            <CardContent className="flex min-h-52 flex-col items-center justify-center gap-2">
              <Wrench className="text-muted-foreground" />
              <p className="font-medium">{isMobile ? "Nenhum cliente para este filtro" : "Nenhum cliente encontrado"}</p>
              <p className="text-sm text-muted-foreground">
                {isMobile
                  ? showAllMobileClients
                    ? "Nenhum cliente encontrado na busca atual."
                    : "No mobile, a tela principal mostra apenas as manutenções de hoje."
                  : "Ajuste a busca ou cadastre um novo cliente."}
              </p>
            </CardContent>
          </Card>
          )
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleClients.map((client) => {
              const vaultState = vaultByClient[client.id] ?? { value: "", visible: false, loading: false };
              const tone = maintenanceTone(client.proxima_manutencao);
              return (
                <div key={client.id} className="glass rounded-[2rem] p-6 space-y-6 ios-transition hover:shadow-2xl hover:shadow-primary/5 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6">
                    <Badge variant="outline" className={cn("rounded-full px-3 border-none font-black text-[10px] uppercase tracking-widest", statusTone[client.status_servico].className)}>
                      {statusTone[client.status_servico].label}
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black leading-tight text-foreground line-clamp-1">{client.nome_cliente_empresa}</h3>
                      <p className="text-xs font-medium text-muted-foreground opacity-60">
                        {client.site_url ? "Domínio ativo" : "Sem site vinculado"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase opacity-50">Última</p>
                        <p className="text-sm font-bold">
                          {client.ultima_manutencao ? format(new Date(`${client.ultima_manutencao}T00:00:00`), "dd/MM/yy") : "—"}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase opacity-50">Próxima</p>
                        <p className={cn("text-sm font-bold", tone.label === "Atrasada" ? "text-destructive" : "text-foreground")}>
                          {format(new Date(`${client.proxima_manutencao}T00:00:00`), "dd/MM/yy")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/40 dark:bg-black/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-muted-foreground opacity-50">Credenciais</p>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleCredential(client.id)} 
                          disabled={vaultState.loading}
                          className="p-2 rounded-xl bg-white/50 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 ios-transition"
                        >
                          {vaultState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : vaultState.visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                        <button 
                          onClick={() => copyCredential(client.id)} 
                          disabled={vaultState.loading}
                          className="p-2 rounded-xl bg-white/50 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 ios-transition"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 min-h-[40px] flex items-center justify-center">
                      <p className={cn("text-xs font-bold tracking-tight", vaultState.visible ? "font-mono text-primary" : "text-muted-foreground opacity-30")}>
                        {vaultState.loading ? "Consultando..." : vaultState.visible ? vaultState.value || "Vazio" : "••••••••••••••••"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1 flex gap-2">
                      {client.site_url && (
                        <a 
                          href={client.site_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex-1 bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-[11px] font-black uppercase tracking-wider h-10 rounded-2xl flex items-center justify-center gap-2 ios-transition"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Site
                        </a>
                      )}
                      {client.automacoes && (
                        <a 
                          href={client.automacoes} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex-1 bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-[11px] font-black uppercase tracking-wider h-10 rounded-2xl flex items-center justify-center gap-2 ios-transition"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Flow
                        </a>
                      )}
                    </div>
                    <Button 
                      variant="primary" 
                      className="rounded-2xl h-10 px-6 font-black text-[11px] uppercase tracking-wider" 
                      onClick={() => openEditModal(client)}
                    >
                      Editar
                    </Button>
                    <button 
                      onClick={() => openPasswordsDialog(client.id, client.nome_cliente_empresa)}
                      className="h-10 w-10 rounded-2xl bg-secondary text-muted-foreground flex items-center justify-center hover:bg-secondary/80 ios-transition"
                      title="Gerenciar Senhas"
                    >
                      <KeyIcon className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => copyPortalLink(client.id)}
                      className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 ios-transition"
                      title="Copiar Link do Portal"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </section>



      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Novo Cliente" : "Editar Cliente"}</DialogTitle>
            <DialogDescription>Cadastre dados técnicos, manutenção e cofre de credenciais.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(handleSave)}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full rounded-2xl">
                  <TabsTrigger value="dados" className="flex-1 gap-2 rounded-xl">
                    <Settings className="h-3.5 w-3.5" />
                    Dados
                  </TabsTrigger>
                  <TabsTrigger value="servico" className="flex-1 gap-2 rounded-xl">
                    <FileText className="h-3.5 w-3.5" />
                    Serviço Contratado
                  </TabsTrigger>
                </TabsList>

                {/* ── ABA DADOS ─────────────────────────────────────── */}
                <TabsContent value="dados" className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="nome_cliente_empresa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Cliente/Empresa</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Acme Tecnologia" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="site_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site</FormLabel>
                          <FormControl>
                            <Input placeholder="https://empresa.com" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="status_servico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status do Serviço</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Ativo">Ativo</SelectItem>
                              <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                              <SelectItem value="Pausado">Pausado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="credenciais"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cofre de Credenciais {mode === "edit" ? "(opcional)" : ""}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="login: ... | senha: ..."
                              className="min-h-[96px]"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="automacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link da Automação (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://n8n.seudominio.com/workflow/..." {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="ultima_manutencao"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Última Manutenção</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                  <CalendarIcon className="mr-2" />
                                  {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecionar data</span>}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="proxima_manutencao"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Próxima Manutenção</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                  <CalendarIcon className="mr-2" />
                                  {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecionar data</span>}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Cobrança Mensal · InfinitePay</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="valor_mensalidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor da Mensalidade (R$)</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: 150,00" inputMode="decimal" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dia_vencimento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dia de Vencimento</FormLabel>
                            <FormControl>
                              <Input
                                type="number" min="1" max="28" placeholder="Ex: 10"
                                {...field}
                                value={field.value ?? ""}
                                onChange={e => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* ── ABA SERVIÇO CONTRATADO ────────────────────────── */}
                <TabsContent value="servico" className="space-y-4 mt-4">
                  <div className="rounded-2xl border border-dashed border-border bg-secondary/10 p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Descrição do Serviço Contratado
                    </p>
                    <p className="text-xs text-muted-foreground opacity-60">
                      Descreva o que está incluído no contrato — sistemas gerenciados, automações, suporte, SLA, etc.
                      Esta descrição ficará visível no portal do cliente.
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="descricao_servico"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder={`Ex:\n• Site WordPress hospedado e mantido\n• Automação de e-mails via n8n\n• Suporte técnico em até 24h\n• Backup semanal automático\n• Relatório mensal de desempenho`}
                            className="min-h-[260px] font-mono text-sm leading-relaxed resize-none"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-[10px] text-muted-foreground text-right">
                          {(field.value ?? "").length}/5000
                        </p>
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  {mode === "create" ? "Cadastrar" : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </main>

    <ClientPasswordsDialog 
      isOpen={passwordsDialogOpen}
      onOpenChange={setPasswordsDialogOpen}
      clientId={activePasswordClient?.id || ""}
      clientName={activePasswordClient?.name || ""}
    />
  </div>
  );
};

export default Index;
