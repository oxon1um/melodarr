"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconInfo, IconX } from "@/components/ui/icons";

type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  title?: string;
  description: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastRecord = {
  id: number;
  title?: string;
  description: string;
  variant: ToastVariant;
  durationMs: number;
  isExiting: boolean;
};

type ToastApi = {
  show: (input: ToastInput) => void;
  success: (description: string, title?: string) => void;
  error: (description: string, title?: string) => void;
  info: (description: string, title?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const defaultDuration = (variant: ToastVariant): number =>
  variant === "error" ? 6000 : 4200;

const variantStyles: Record<ToastVariant, string> = {
  success: "toast-success",
  error: "toast-error",
  info: "toast-info"
};

const variantIcon = (variant: ToastVariant) => {
  if (variant === "success") return <IconCheck className="h-4 w-4" />;
  if (variant === "error") return <IconX className="h-4 w-4" />;
  return <IconInfo className="h-4 w-4" />;
};

const variantIconStyles: Record<ToastVariant, string> = {
  success: "border-success/40 text-success",
  error: "border-danger/40 text-danger",
  info: "border-accent/40 text-accent"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const idRef = useRef(1);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const EXIT_MS = 210;

  const beginExit = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, isExiting: true } : toast))
    );

    const removeTimer = setTimeout(() => {
      timersRef.current.delete(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, EXIT_MS);

    timersRef.current.set(id, removeTimer);
  }, []);

  const show = useCallback((input: ToastInput) => {
    const id = idRef.current++;
    const variant = input.variant ?? "info";
    const durationMs = input.durationMs ?? defaultDuration(variant);

    const nextToast: ToastRecord = {
      id,
      title: input.title,
      description: input.description,
      variant,
      durationMs,
      isExiting: false
    };

    setToasts((prev) => [...prev.slice(-4), nextToast]);

    const timer = setTimeout(() => {
      beginExit(id);
    }, durationMs);

    timersRef.current.set(id, timer);
  }, [beginExit]);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (description, title) => show({ variant: "success", description, title }),
      error: (description, title) => show({ variant: "error", description, title }),
      info: (description, title) => show({ variant: "info", description, title })
    }),
    [show]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[var(--z-toast)] flex w-[min(92vw,24rem)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`panel pointer-events-auto rounded-2xl border p-3 shadow-panel ${
              toast.isExiting ? "motion-safe:animate-toast-out" : "motion-safe:animate-toast-in"
            } ${variantStyles[toast.variant]}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border ${variantIconStyles[toast.variant]}`}
              >
                {variantIcon(toast.variant)}
              </span>
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold leading-tight">{toast.title}</p> : null}
                <p className="text-sm text-text/90">{toast.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastApi => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
};
