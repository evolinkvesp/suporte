import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DottedSurfaceBackground } from "@/components/DottedSurfaceBackground";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { PasscodeLock } from "@/components/PasscodeLock";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import Maintenance from "./pages/Maintenance";
import Tickets from "./pages/Tickets";
import ClientPortal from "./pages/ClientPortal";
import Settings from "./pages/Settings";
import Financeiro from "./pages/Financeiro";

const App = () => (
  <BrowserRouter>
    <Toaster />
    <Sonner />
    <PasscodeLock correctPasscode="8878">
      <div className="relative isolate min-h-screen overflow-x-hidden">
        <DottedSurfaceBackground />
        <div className="relative z-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/install" element={<Install />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/portal/:clientId" element={<ClientPortal />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </PasscodeLock>
  </BrowserRouter>
);

export default App;
