import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Delete, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

interface PasscodeLockProps {
  children: React.ReactNode;
  correctPasscode: string;
}

export const PasscodeLock: React.FC<PasscodeLockProps> = ({ children, correctPasscode }) => {
  const location = useLocation();
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("app_unlocked");
    if (saved === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const isPortal = location.pathname.startsWith("/portal/");

  const handleKeyPress = (num: string) => {
    if (passcode.length < 4) {
      const newPasscode = passcode + num;
      setPasscode(newPasscode);
      
      if (newPasscode.length === 4) {
        if (newPasscode === correctPasscode) {
          setTimeout(() => {
            setIsUnlocked(true);
            sessionStorage.setItem("app_unlocked", "true");
          }, 300);
        } else {
          setTimeout(() => {
            setError(true);
            setTimeout(() => {
              setError(false);
              setPasscode("");
            }, 500);
          }, 300);
        }
      }
    }
  };

  const handleDelete = () => {
    setPasscode(passcode.slice(0, -1));
  };

  if (isUnlocked || isPortal) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-3xl">
      <div className="w-full max-w-sm px-8 flex flex-col items-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-12 flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-2">Digite o Código</h2>
          <p className="text-sm font-semibold text-muted-foreground opacity-60">Acesso Restrito</p>
        </motion.div>

        {/* Passcode Dots */}
        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex gap-6 mb-16"
        >
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-300",
                passcode.length > i 
                  ? "bg-primary border-primary scale-110 shadow-[0_0_15px_rgba(0,122,255,0.5)]" 
                  : "border-muted-foreground/30",
                error && "border-destructive bg-destructive"
              )}
            />
          ))}
        </motion.div>

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-6 w-full max-w-[300px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="w-20 h-20 rounded-full bg-secondary/30 hover:bg-secondary/60 active:scale-90 transition-all flex flex-col items-center justify-center border border-white/10"
            >
              <span className="text-2xl font-bold">{num}</span>
              <span className="text-[10px] font-black opacity-30 tracking-widest uppercase">
                {num === 2 && "ABC"}
                {num === 3 && "DEF"}
                {num === 4 && "GHI"}
                {num === 5 && "JKL"}
                {num === 6 && "MNO"}
                {num === 7 && "PQRS"}
                {num === 8 && "TUV"}
                {num === 9 && "WXYZ"}
              </span>
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress("0")}
            className="w-20 h-20 rounded-full bg-secondary/30 hover:bg-secondary/60 active:scale-90 transition-all flex items-center justify-center border border-white/10"
          >
            <span className="text-2xl font-bold">0</span>
          </button>
          <button
            onClick={handleDelete}
            className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-all text-muted-foreground"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <button 
          className="mt-12 text-sm font-black text-primary uppercase tracking-widest hover:opacity-70 transition-opacity"
          onClick={() => {
            // Optional: reset or some other action
          }}
        >
          Esqueceu o Código?
        </button>
      </div>
    </div>
  );
};
