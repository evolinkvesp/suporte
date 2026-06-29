import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Wrench,
  Settings,
  LogOut,
  Bell,
  MessageSquare,
  DollarSign,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Clientes", path: "/clients" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
  { icon: MessageSquare, label: "Chamados", path: "/tickets" },
  { icon: Wrench, label: "Manutenção", path: "/maintenance" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <>
      {/* Desktop Sidebar (Apple Style) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 p-6 lg:block">
        <div className="flex h-full flex-col gap-8 rounded-[2.5rem] bg-secondary/30 backdrop-blur-3xl border border-white/20 dark:border-white/5 p-6 shadow-2xl shadow-black/5">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">SetupEvo</h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-60">Evolution Suite</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "group flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300",
                    isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary transition-colors")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Profile/Actions */}
          <div className="mt-auto space-y-3 pt-6 border-t border-white/10">
            <Button variant="ghost" className="w-full justify-start gap-4 rounded-2xl px-4 py-6 text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              Notificações
            </Button>
            <div className="flex items-center gap-3 rounded-3xl bg-white/40 dark:bg-white/5 p-3 backdrop-blur-md">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-blue-400 p-[2px]">
                <div className="h-full w-full rounded-full bg-background p-[2px]">
                  <div className="h-full w-full rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    <span className="text-xs font-bold">RA</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-bold text-foreground">Ryan Asafe</p>
                <p className="truncate text-[10px] text-muted-foreground">Administrador</p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Tab Bar (Apple Style) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-between border-t border-white/20 bg-white/80 px-2 pb-safe-bottom backdrop-blur-2xl dark:border-white/5 dark:bg-black/80 lg:hidden shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 transition-all duration-300 py-2",
                isActive ? "text-primary" : "text-muted-foreground opacity-60"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                isActive ? "bg-primary/10" : ""
              )}>
                <item.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", isActive ? "stroke-[2.5px]" : "")} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold tracking-tight uppercase w-full text-center truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

