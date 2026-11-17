"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger" | "approve";
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  children,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#080808]/40 backdrop-blur-[1px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#EAEAE7] bg-white p-6 shadow-[0_12px_32px_rgba(8,8,8,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                    variant === "danger"
                      ? "border-[#F6C8C8] bg-[#FDECEC] text-[#DC4545]"
                      : variant === "approve"
                      ? "border-[#CBE7D5] bg-[#EAF5EE] text-[#16834A]"
                      : "border-[#EAEAE7] bg-[#F5F5F2] text-[#171717]"
                  )}
                >
                  {variant === "danger" ? (
                    <AlertTriangle className="h-4.5 w-4.5" />
                  ) : (
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  )}
                </div>
                <div>
                  <h3
                    id="confirm-dialog-title"
                    className="text-base font-semibold text-[#171717]"
                  >
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#666666]">
                    {description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg p-1 text-[#929292] transition-colors hover:bg-[#F5F5F2] hover:text-[#171717]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {children && <div className="mt-4">{children}</div>}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "rounded-[9px] px-4 py-2 text-sm font-semibold transition-colors",
                  variant === "danger"
                    ? "bg-[#DC4545] text-white hover:bg-[#C33939]"
                    : variant === "approve"
                    ? "bg-[#16834A] text-white hover:bg-[#126B3C]"
                    : "bg-[#171717] text-white hover:bg-[#080808]"
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
