"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  HelpCircle,
  XCircle,
} from "lucide-react";
import type { BatchStatus, ExtractionStatus, MatchStatus, MatchType } from "@/types/frido";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: MatchStatus;
  size?: "sm" | "md";
  className?: string;
}

const MATCH_STATUS_CONFIG: Record<
  MatchStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  confirmed: {
    label: "Confirmed",
    bg: "bg-[#EAF5EE]",
    text: "text-[#16834A]",
    border: "border-[#CBE7D5]",
    icon: CheckCircle2,
  },
  needs_review: {
    label: "Needs Review",
    bg: "bg-[#FFF6DF]",
    text: "text-[#B67C0A]",
    border: "border-[#F3DFAB]",
    icon: Clock,
  },
  conflict: {
    label: "Conflict",
    bg: "bg-[#FDECEC]",
    text: "text-[#DC4545]",
    border: "border-[#F6C8C8]",
    icon: AlertTriangle,
  },
  unmatched: {
    label: "Unmatched",
    bg: "bg-[#F0F0ED]",
    text: "text-[#666666]",
    border: "border-[#DCDCD7]",
    icon: HelpCircle,
  },
};

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const cfg = MATCH_STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-[13px]",
        cfg.bg,
        cfg.text,
        cfg.border,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

export function MatchTypeBadge({ matchType }: { matchType: MatchType }) {
  const map: Record<MatchType, { label: string; cls: string }> = {
    exact_approved_mapping: {
      label: "Approved Mapping",
      cls: "bg-[#EAF5EE] text-[#16834A] border-[#CBE7D5]",
    },
    exact_identifier: {
      label: "Exact Identifier",
      cls: "bg-[#EDF4FE] text-[#2B5FA8] border-[#CFE0FB]",
    },
    approved_family: {
      label: "Approved Family",
      cls: "bg-[#F5F5F2] text-[#171717] border-[#EAEAE7]",
    },
    attribute_candidate: {
      label: "Attribute Candidate",
      cls: "bg-[#FFF6DF] text-[#9C6908] border-[#F3DFAB]",
    },
    no_reference: {
      label: "No Reference",
      cls: "bg-[#F0F0ED] text-[#666666] border-[#DCDCD7]",
    },
  };
  const cfg = map[matchType];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CBE7D5] bg-[#EAF5EE] px-2.5 py-0.5 text-xs font-medium text-[#16834A]">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Completed
      </span>
    );
  }
  if (status === "in_review") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F3DFAB] bg-[#FFF6DF] px-2.5 py-0.5 text-xs font-medium text-[#B67C0A]">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        In Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F6C8C8] bg-[#FDECEC] px-2.5 py-0.5 text-xs font-medium text-[#DC4545]">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {status === "failed" ? "Failed" : "Processing"}
    </span>
  );
}

export function ExtractionStatusBadge({ status }: { status: ExtractionStatus }) {
  if (status === "extracted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CBE7D5] bg-[#EAF5EE] px-2.5 py-0.5 text-xs font-medium text-[#16834A]">
        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
        Extracted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F3DFAB] bg-[#FFF6DF] px-2.5 py-0.5 text-xs font-medium text-[#B67C0A]">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      Needs Attention
    </span>
  );
}
