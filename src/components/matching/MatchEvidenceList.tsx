"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import type { MatchEvidence } from "@/types/frido";
import { cn } from "@/lib/utils";

export function MatchEvidenceList({ evidence }: { evidence: MatchEvidence[] }) {
  if (evidence.length === 0) return null;

  return (
    <div className="space-y-2">
      {evidence.map((item) => {
        const Icon =
          item.type === "positive"
            ? CheckCircle2
            : item.type === "conflict"
            ? ShieldAlert
            : item.type === "warning"
            ? AlertTriangle
            : Info;

        const cls =
          item.type === "positive"
            ? "border-[#CBE7D5] bg-[#EAF5EE]/50 text-[#16834A]"
            : item.type === "conflict"
            ? "border-[#F6C8C8] bg-[#FDECEC]/60 text-[#DC4545]"
            : item.type === "warning"
            ? "border-[#F3DFAB] bg-[#FFF6DF]/60 text-[#B67C0A]"
            : "border-[#EAEAE7] bg-[#FAFAF8] text-[#666666]";

        return (
          <div
            key={item.id}
            className={cn("flex items-start gap-2.5 rounded-xl border p-3", cls)}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#171717]">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#666666]">
                {item.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
