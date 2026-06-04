import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  text: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((text: string, type: ToastType = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-card flex items-center justify-between gap-3 border-3 border-primary-dark text-xs transition-all duration-300 animate-scale-up ${
              toast.type === "success" ? "bg-white text-success shadow-teal-glow" :
              toast.type === "error" ? "bg-white text-coral shadow-coral-glow" :
              "bg-white text-primary-dark shadow-sky-glow"
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-success shrink-0 animate-crown-bounce" />}
              {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-coral shrink-0 animate-bounce" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-primary-light shrink-0" />}
              <span className="font-black uppercase tracking-wider leading-snug">{toast.text}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-primary-dark/40 hover:text-primary-dark cursor-pointer shrink-0 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
