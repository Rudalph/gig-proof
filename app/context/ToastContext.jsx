"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

const ToastContext = createContext(null);

const CONFIG = {
  success: {
    icon: CheckCircle,
    classes: "border-green-200 bg-green-50 text-green-800",
    iconClass: "text-green-500",
  },
  error: {
    icon: AlertCircle,
    classes: "border-red-200 bg-red-50 text-red-800",
    iconClass: "text-red-500",
  },
  info: {
    icon: Info,
    classes: "border-black/10 bg-white text-black",
    iconClass: "text-black/40",
  },
};

function ToastItem({ t, onDismiss }) {
  const { icon: Icon, classes, iconClass } = CONFIG[t.type] || CONFIG.info;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg w-80 ${classes}`}>
      <Icon size={16} className={`shrink-0 mt-0.5 ${iconClass}`} />
      <p className="text-sm flex-1 leading-snug">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="shrink-0 opacity-40 hover:opacity-80 transition mt-0.5"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
