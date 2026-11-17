"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  supportingText: string;
  icon: React.ComponentType<{ className?: string }>;
  trendLabel?: string;
  accent?: "neutral" | "success" | "warning" | "danger" | "yellow";
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({
  title,
  value,
  supportingText,
  icon: Icon,
  trendLabel,
  accent = "neutral",
  onClick,
  active = false,
}: StatCardProps) {
  const iconCls =
    accent === "success"
      ? "bg-[#EAF5EE] text-[#16834A] border-[#CBE7D5]"
      : accent === "warning"
      ? "bg-[#FFF6DF] text-[#B67C0A] border-[#F3DFAB]"
      : accent === "danger"
      ? "bg-[#FDECEC] text-[#DC4545] border-[#F6C8C8]"
      : accent === "yellow"
      ? "bg-[#FCD10C]/20 text-[#171717] border-[#FCD10C]/50"
      : "bg-[#F5F5F2] text-[#171717] border-[#EAEAE7]";

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col justify-between rounded-2xl border bg-white p-5 text-left transition-all duration-150",
        active
          ? "border-[#171717] ring-1 ring-[#171717]"
          : "border-[#EAEAE7] hover:border-[#DCDCD7]",
        onClick && "cursor-pointer hover:bg-[#FAFAF8]/60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-[#666666]">{title}</span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border",
            iconCls
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-[28px] leading-tight font-semibold tracking-tight text-[#171717] tabular-nums">
          {value}
        </span>
        {trendLabel && (
          <span className="rounded-md bg-[#F5F5F2] px-2 py-0.5 text-[11px] font-medium text-[#666666]">
            {trendLabel}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-[#666666]">{supportingText}</p>
    </Comp>
  );
}
