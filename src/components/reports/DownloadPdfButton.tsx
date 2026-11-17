"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DownloadPdfButtonProps {
  reportId: string;
  filenameHint?: string;
  className?: string;
  label?: string;
  variant?: "solid" | "outline";
  onError?: (message: string) => void;
}

/**
 * Real PDF download with in-flight feedback.
 * Fetches the server-rendered document as a blob so failures are reported instead of
 * silently navigating to an error page.
 */
export function DownloadPdfButton({
  reportId,
  filenameHint,
  className,
  label = "PDF",
  variant = "solid",
  onError,
}: DownloadPdfButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (state === "loading") return;
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `PDF generation failed (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("The generated PDF was empty");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameHint
        ? `${reportId}-${filenameHint.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`
        : `${reportId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Download failed";
      setError(message);
      setState("error");
      onError?.(message);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={state === "loading"}
        aria-busy={state === "loading"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
          variant === "solid"
            ? "bg-[#171717] text-white hover:bg-[#080808]"
            : "border border-[#DCDCD7] bg-white text-[#171717] hover:bg-[#F5F5F2]",
          className
        )}
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {state === "loading" ? "Preparing…" : label}
      </button>
      {state === "error" && error && (
        <span className="max-w-[220px] text-right text-[10.5px] text-[#DC4545]">{error}</span>
      )}
    </span>
  );
}
