import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans p-6">
      <div className="glass rounded-[3rem] p-12 text-center space-y-6 max-w-lg w-full ios-transition hover:shadow-2xl hover:shadow-primary/5">
        <div className="space-y-2">
          <h1 className="text-8xl font-black tracking-tighter text-foreground opacity-20">404</h1>
          <h2 className="text-3xl font-extrabold text-foreground">Página Perdida</h2>
          <p className="text-muted-foreground font-medium">O recurso que você procura foi movido ou não existe.</p>
        </div>
        
        <div className="pt-4">
          <Button asChild variant="primary" className="rounded-2xl h-12 px-8 font-bold w-full sm:w-auto">
            <a href="/">
              Voltar ao Início
            </a>
          </Button>
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-30 pt-4">
          Setup Evolink • Experience
        </p>
      </div>
    </div>
  );
};

export default NotFound;
