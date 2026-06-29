import { ArrowLeft, Download, MonitorSmartphone, Share2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Install = () => {
  return (
    <main className="min-h-screen bg-background font-sans">
      <section className="mx-auto w-full max-w-4xl px-6 py-12 lg:py-24 space-y-12">
        <Button asChild variant="secondary" className="rounded-2xl gap-2 font-bold mb-8">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </Button>

        <header className="space-y-4">
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-foreground">
            Instalar <span className="text-primary">Evolink</span>
          </h1>
          <p className="text-lg lg:text-xl font-medium text-muted-foreground opacity-70 max-w-2xl">
            Acesse seu ecossistema de automações com um toque. Rápido, leve e sempre disponível na sua tela de início.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="glass rounded-[2rem] p-8 space-y-4 ios-transition hover:shadow-2xl hover:shadow-primary/5">
            <div className="p-3 rounded-2xl bg-primary/10 w-fit">
              <Share2 className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">iPhone (Safari)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Toque no ícone de <span className="font-bold text-foreground">Compartilhar</span> no Safari e selecione <span className="font-bold text-foreground">Adicionar à Tela de Início</span>.
              </p>
            </div>
          </div>

          <div className="glass rounded-[2rem] p-8 space-y-4 ios-transition hover:shadow-2xl hover:shadow-primary/5">
            <div className="p-3 rounded-2xl bg-warning/10 w-fit">
              <Download className="h-6 w-6 text-warning" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Android (Chrome)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Abra o menu do Chrome (três pontos) e selecione <span className="font-bold text-foreground">Instalar aplicativo</span>.
              </p>
            </div>
          </div>

          <div className="glass rounded-[2rem] p-8 space-y-6 sm:col-span-2 flex flex-col md:flex-row md:items-center gap-8 ios-transition hover:shadow-2xl hover:shadow-primary/5">
            <div className="p-4 rounded-2xl bg-secondary w-fit shrink-0">
              <MonitorSmartphone className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold">Desktop (Mac & PC)</h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Clique no ícone de instalação <span className="inline-block px-2 py-0.5 rounded-md bg-secondary text-xs font-black">⊕</span> na barra de endereços do Chrome ou Edge para fixar o Evolink como um aplicativo nativo.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-12 text-center border-t border-white/10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">
            © 2026 Setup Evolink • Apple Human Interface Experience
          </p>
        </div>
      </section>
    </main>
  );
};

export default Install;
