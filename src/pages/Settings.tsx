import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Bell, 
  Shield, 
  Smartphone, 
  Globe, 
  Database,
  ChevronRight,
  LogOut,
  Moon,
  Cloud,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingGroups = [
  {
    title: "Conta & Perfil",
    items: [
      { icon: User, label: "Informações Pessoais", value: "Ryan Asafe", color: "bg-blue-500" },
      { icon: Shield, label: "Segurança & Senha", value: "Protegido", color: "bg-gray-500" },
      { icon: Database, label: "Conexão Supabase", value: "Ativo", color: "bg-emerald-500" },
    ]
  },
  {
    title: "Preferências",
    items: [
      { icon: Bell, label: "Notificações Push", value: "Ativado", color: "bg-red-500" },
      { icon: Moon, label: "Modo Escuro", value: "Sistema", color: "bg-indigo-500" },
      { icon: Smartphone, label: "Instalação PWA", value: "Configurado", color: "bg-orange-500" },
    ]
  },
  {
    title: "Sistema",
    items: [
      { icon: Globe, label: "Idioma", value: "Português (BR)", color: "bg-sky-500" },
      { icon: Cloud, label: "Backup Automático", value: "Diário", color: "bg-blue-400" },
      { icon: Zap, label: "Versão do App", value: "v2.4.0-apple", color: "bg-yellow-500" },
    ]
  }
];

export default function Settings() {
  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 lg:p-10 pb-24 lg:pb-10">
        <div className="max-w-3xl mx-auto space-y-10">
          
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Ajustes</h1>
            <p className="text-sm font-medium text-muted-foreground opacity-70">Personalize sua experiência no Evolink.</p>
          </div>

          {/* Profile Quick Card */}
          <div className="glass rounded-[2.5rem] p-6 flex items-center gap-6 ios-transition hover:shadow-2xl hover:shadow-primary/5">
            <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-primary to-blue-400 p-[3px]">
              <div className="h-full w-full rounded-full bg-background p-[2px]">
                <div className="h-full w-full rounded-full bg-muted flex items-center justify-center overflow-hidden">
                   <span className="text-2xl font-bold">RA</span>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground">Ryan Asafe</h3>
              <p className="text-sm font-medium text-muted-foreground">ryan@evolink.tech</p>
            </div>
            <Button variant="secondary" className="rounded-2xl font-bold px-6">Editar</Button>
          </div>

          {/* Settings Groups */}
          <div className="space-y-8">
            {settingGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 px-6">
                  {group.title}
                </h4>
                <div className="glass rounded-[2.5rem] overflow-hidden border-white/10 dark:border-white/5">
                  {group.items.map((item, iIdx) => (
                    <button
                      key={iIdx}
                      className={cn(
                        "w-full flex items-center justify-between p-5 hover:bg-white/50 dark:hover:bg-white/5 ios-transition group",
                        iIdx !== group.items.length - 1 && "border-b border-white/10 dark:border-white/5"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-lg", item.color)}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold text-foreground">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground opacity-60">{item.value}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Danger Zone */}
          <div className="pt-6">
            <Button variant="ghost" className="w-full h-16 rounded-[2rem] bg-destructive/5 text-destructive hover:bg-destructive/10 font-bold gap-3 ios-transition">
              <LogOut className="h-5 w-5" />
              Sair da conta
            </Button>
          </div>

          {/* Legal / Credits */}
          <div className="text-center space-y-2 pt-10">
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-30">
               Setup Evolink Enterprise
             </p>
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-30">
               Feito com ❤️ no Brasil
             </p>
          </div>

        </div>
      </main>
    </div>
  );
}
