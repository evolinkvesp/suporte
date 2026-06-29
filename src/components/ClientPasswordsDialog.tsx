import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Key, Trash2, Plus, ShieldCheck } from "lucide-react";

interface Password {
  id: string;
  service_name: string;
  username: string;
  password: string;
}

interface ClientPasswordsDialogProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientPasswordsDialog({ clientId, clientName, isOpen, onOpenChange }: ClientPasswordsDialogProps) {
  const { toast } = useToast();
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newPass, setNewPass] = useState({ service_name: "", username: "", password: "" });

  const fetchPasswords = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clients-crm", {
        body: { action: "listPasswords", payload: { client_id: clientId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPasswords(data?.passwords || []);
    } catch (err) {
      toast({ title: "Erro ao carregar senhas", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchPasswords();
  }, [isOpen, clientId]);

  const handleAdd = async () => {
    if (!newPass.service_name || !newPass.password) return;
    try {
      const { data, error } = await supabase.functions.invoke("clients-crm", {
        body: {
          action: "addPassword",
          payload: { client_id: clientId, ...newPass },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPasswords([...passwords, data.password]);
      setNewPass({ service_name: "", username: "", password: "" });
      toast({ title: "Senha adicionada!" });
    } catch (err) {
      toast({ title: "Erro ao salvar senha", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("clients-crm", {
        body: { action: "deletePassword", payload: { id } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPasswords(passwords.filter(p => p.id !== id));
      toast({ title: "Senha removida" });
    } catch (err) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] glass border-none rounded-[2.5rem] p-6 lg:p-8 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl lg:text-2xl font-black">Senhas: {clientName}</DialogTitle>
          <DialogDescription className="font-semibold text-muted-foreground opacity-60 text-xs lg:text-sm">
            Gerencie as credenciais que estarão visíveis no portal do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* New Password Form */}
          <div className="space-y-3 bg-secondary/20 p-4 lg:p-5 rounded-3xl border border-white/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nova Credencial</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input 
                placeholder="Serviço (ex: Instagram)" 
                value={newPass.service_name}
                onChange={(e) => setNewPass({...newPass, service_name: e.target.value})}
                className="rounded-xl border-none bg-background/50 h-12"
              />
              <Input 
                placeholder="Usuário" 
                value={newPass.username}
                onChange={(e) => setNewPass({...newPass, username: e.target.value})}
                className="rounded-xl border-none bg-background/50 h-12"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input 
                type="text"
                placeholder="Senha" 
                value={newPass.password}
                onChange={(e) => setNewPass({...newPass, password: e.target.value})}
                className="rounded-xl border-none bg-background/50 h-12 flex-1"
              />
              <Button onClick={handleAdd} className="rounded-xl px-6 font-bold gap-2 h-12">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {passwords.map((pass) => (
              <div key={pass.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/10 border border-white/5">
                <div className="space-y-0.5">
                  <p className="text-xs font-black uppercase text-primary tracking-wider">{pass.service_name}</p>
                  <p className="text-sm font-bold">{pass.username} • <span className="opacity-40">{pass.password}</span></p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(pass.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {passwords.length === 0 && !isLoading && (
              <p className="text-center py-6 text-sm text-muted-foreground italic">Nenhuma senha cadastrada.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-full w-full font-bold" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
