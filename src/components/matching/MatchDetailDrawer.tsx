"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  History,
  Package,
  X,
  XCircle,
} from "lucide-react";
import type { MatchResult } from "@/types/frido";
import { MatchTypeBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { MatchEvidenceList } from "./MatchEvidenceList";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useFridoStore } from "@/context/FridoStoreContext";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface MatchDetailDrawerProps {
  match: MatchResult | null;
  onClose: () => void;
}

export function MatchDetailDrawer({ match, onClose }: MatchDetailDrawerProps) {
  const { approveMatch, rejectMatch } = useFridoStore();
  const [confirmMode, setConfirmMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  // Reset per-match local form state when the inspected record changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote("");
    setConfirmMode(null);
  }, [match?.id]);

  useEffect(() => {
    if (!match) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmMode) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match, confirmMode, onClose]);

  if (!match) return null;

  return (
    <>
      <AnimatePresence>
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-match-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#080808]/35 backdrop-blur-[1px]"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-[#EAEAE7] bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#EAEAE7] bg-[#FAFAF8] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[#171717]">
                    {match.product.productCode}
                  </span>
                  <StatusBadge status={match.status} />
                  <MatchTypeBadge matchType={match.matchType} />
                </div>
                <h2
                  id="drawer-match-title"
                  className="mt-1.5 text-base font-semibold text-[#171717]"
                >
                  {match.product.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close match details"
                className="rounded-lg p-1.5 text-[#666666] hover:bg-[#EAEAE7] hover:text-[#171717]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {/* Conflict warnings */}
              {match.conflictWarnings.length > 0 && (
                <div className="rounded-xl border border-[#F6C8C8] bg-[#FDECEC] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#DC4545]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Conflict Warnings
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#7A2020]">
                    {match.conflictWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Side-by-side summary cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#171717]">
                    <Package className="h-3.5 w-3.5 text-[#666666]" />
                    CSV Item Master Product
                  </div>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#666666]">Product Code</dt>
                      <dd className="font-mono font-medium text-[#171717]">
                        {match.product.productCode}
                      </dd>
                    </div>
                    {match.product.brand && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#666666]">Brand</dt>
                        <dd className="font-medium text-[#171717]">
                          {match.product.brand}
                        </dd>
                      </div>
                    )}
                    {match.product.color && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#666666]">Color</dt>
                        <dd className="font-medium text-[#171717]">
                          {match.product.color}
                        </dd>
                      </div>
                    )}
                    {match.product.size && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#666666]">Size</dt>
                        <dd className="font-medium text-[#171717]">
                          {match.product.size}
                        </dd>
                      </div>
                    )}
                    {match.product.dimensions && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#666666]">Dimensions</dt>
                        <dd className="text-right font-medium text-[#171717]">
                          {match.product.dimensions}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 border-t border-[#EAEAE7] pt-2">
                      <dt className="text-[#666666]">MRP</dt>
                      <dd className="font-semibold text-[#171717] tabular-nums">
                        {formatCurrency(match.product.mrp)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-[#EAEAE7] bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#171717]">
                    <FileText className="h-3.5 w-3.5 text-[#666666]" />
                    Sticker Reference
                  </div>
                  {match.matchedSticker ? (
                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#666666]">Identifier</dt>
                        <dd className="font-mono font-medium text-[#171717]">
                          {match.matchedSticker.stickerIdentifier}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#666666]">Word Document</dt>
                        <dd className="mt-0.5 truncate font-mono text-[11px] text-[#171717]">
                          {match.matchedSticker.documentName}
                        </dd>
                      </div>
                      {match.matchedSticker.netQuantity && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#666666]">Net Qty</dt>
                          <dd className="font-medium text-[#171717]">
                            {match.matchedSticker.netQuantity}
                          </dd>
                        </div>
                      )}
                      {match.matchedSticker.dimensions && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#666666]">Dimensions</dt>
                          <dd className="text-right font-medium text-[#171717]">
                            {match.matchedSticker.dimensions}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 border-t border-[#EAEAE7] pt-2">
                        <dt className="text-[#666666]">Sticker MRP</dt>
                        <dd className="font-semibold text-[#171717] tabular-nums">
                          {formatCurrency(match.matchedSticker.mrp)}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-[#DCDCD7] bg-[#FAFAF8] p-4 text-center text-xs text-[#666666]">
                      No sticker reference linked to this SKU.
                    </div>
                  )}
                </div>
              </div>

              {/* Matching Evidence */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold tracking-wide text-[#666666] uppercase">
                    Match Evidence & Rule Applied
                  </h3>
                  <span className="text-[11px] font-medium text-[#666666]">
                    {match.matchingRuleApplied}
                  </span>
                </div>
                <MatchEvidenceList evidence={match.evidence} />
              </div>

              {/* Review History */}
              <div>
                <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#666666] uppercase">
                  <History className="h-3.5 w-3.5" />
                  Historical Actions
                </div>
                <div className="divide-y divide-[#EAEAE7] rounded-xl border border-[#EAEAE7] bg-[#FAFAF8]">
                  {match.reviewHistory.map((action) => (
                    <div key={action.id} className="px-4 py-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#171717]">
                          {action.reviewer}
                        </span>
                        <span className="text-[11px] text-[#929292]">
                          {formatDateTime(action.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[#666666]">
                        Action:{" "}
                        <span className="font-medium text-[#171717]">
                          {action.action.replace(/_/g, " ")}
                        </span>{" "}
                        ({action.previousStatus} → {action.newStatus})
                      </p>
                      {action.note && (
                        <p className="mt-1 text-[11px] text-[#666666] italic">
                          &ldquo;{action.note}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#EAEAE7] bg-[#FAFAF8] px-5 py-3.5 sm:px-6">
              <Link
                href={`/review-matches?match=${encodeURIComponent(match.id)}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#DCDCD7] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2]"
              >
                Open Split Review Workspace
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>

              <div className="flex items-center gap-2">
                {match.matchedSticker && match.status !== "confirmed" && (
                  <button
                    type="button"
                    onClick={() => setConfirmMode("approve")}
                    className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#16834A] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#126B3C]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve Match
                  </button>
                )}
                {match.status !== "unmatched" && (
                  <button
                    type="button"
                    onClick={() => setConfirmMode("reject")}
                    className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#F6C8C8] bg-[#FDECEC] px-3.5 py-2 text-xs font-semibold text-[#DC4545] transition-colors hover:bg-[#FAD7D7]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject Match
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      </AnimatePresence>

      <ConfirmDialog
        open={confirmMode === "approve"}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => approveMatch(match.id, match.matchedSticker, note || undefined)}
        title={`Approve match for ${match.product.productCode}?`}
        description={`This confirms linking ${match.product.name} to sticker ${
          match.matchedSticker?.stickerIdentifier ?? ""
        } in local demonstration state.`}
        confirmLabel="Approve Match"
        variant="approve"
      >
        <label className="block text-xs font-medium text-[#171717]">
          Reviewer Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Verified cover color and MRP match"
            className="mt-1.5 w-full rounded-[9px] border border-[#EAEAE7] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmMode === "reject"}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => rejectMatch(match.id, note || undefined)}
        title={`Reject sticker match for ${match.product.productCode}?`}
        description="Rejecting removes the candidate sticker link and moves this item to Unmatched status."
        confirmLabel="Reject Match"
        variant="danger"
      >
        <label className="block text-xs font-medium text-[#171717]">
          Rejection Reason (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Packaging MRP differs from sticker DOCX"
            className="mt-1.5 w-full rounded-[9px] border border-[#EAEAE7] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
          />
        </label>
      </ConfirmDialog>
    </>
  );
}
