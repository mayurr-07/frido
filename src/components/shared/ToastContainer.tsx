"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useFridoStore } from "@/context/FridoStoreContext";
import { cn } from "@/lib/utils";

export function ToastContainer() {
  const { toasts, dismissToast } = useFridoStore();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2 pl-4 sm:right-6 sm:bottom-6"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon =
            toast.variant === "success"
              ? CheckCircle2
              : toast.variant === "warning" || toast.variant === "danger"
              ? AlertTriangle
              : Info;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-[0_8px_24px_rgba(8,8,8,0.08)]",
                toast.variant === "success"
                  ? "border-[#CBE7D5]"
                  : toast.variant === "warning"
                  ? "border-[#F3DFAB]"
                  : toast.variant === "danger"
                  ? "border-[#F6C8C8]"
                  : "border-[#EAEAE7]"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  toast.variant === "success"
                    ? "text-[#16834A]"
                    : toast.variant === "warning"
                    ? "text-[#D99A16]"
                    : toast.variant === "danger"
                    ? "text-[#DC4545]"
                    : "text-[#3976CB]"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#171717]">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs text-[#666666]">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-[#929292] hover:bg-[#F5F5F2] hover:text-[#171717]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
