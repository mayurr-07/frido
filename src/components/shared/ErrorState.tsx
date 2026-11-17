"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Unable to load matching records",
  description = "A simulated frontend view error occurred. You can retry loading the local demonstration dataset.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-[#F6C8C8] bg-[#FDECEC]/60 px-6 py-12 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#F6C8C8] bg-white text-[#DC4545]">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#171717]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[#666666]">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2]"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}
    </div>
  );
}
