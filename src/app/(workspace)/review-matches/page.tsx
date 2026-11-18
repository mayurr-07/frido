"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  HelpCircle,
  History,
  Loader2,
  Package,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { StickerReference } from "@/types/frido";
import { useFridoStore } from "@/context/FridoStoreContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { MatchTypeBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { MatchEvidenceList } from "@/components/matching/MatchEvidenceList";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableLoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StickerDetailDrawer } from "@/components/stickers/StickerDetailDrawer";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

function ReviewMatchesContent() {
  const searchParams = useSearchParams();
  const paramMatchId = searchParams.get("match");

  const {
    matches,
    activeBatch,
    stickers,
    approveMatch,
    rejectMatch,
    keepForLater,
    markUnmatched,
    engineVersion,
  } = useFridoStore();

  const [queueFilter, setQueueFilter] = useState<"pending" | "all">("pending");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const activeMatchId = selectedMatchId ?? paramMatchId;
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<"approve" | "reject" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [inspectSticker, setInspectSticker] = useState<StickerReference | null>(null);
  const [pendingAction, setPendingAction] = useState<
    null | "approve" | "reject" | "defer" | "unmatched"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Build review queue from active batch (or include paramMatchId even if from another batch)
  const queueItems = useMemo(() => {
    const batchItems = matches.filter((m) => m.batchId === activeBatch?.id);
    if (queueFilter === "pending") {
      const pending = batchItems.filter(
        (m) => m.status === "needs_review" || m.status === "conflict"
      );
      if (paramMatchId) {
        const direct = matches.find((m) => m.id === paramMatchId);
        if (direct && !pending.some((p) => p.id === direct.id)) {
          return [direct, ...pending];
        }
      }
      return pending;
    }
    return batchItems;
  }, [matches, activeBatch?.id, queueFilter, paramMatchId]);

  const batchReviewCount = useMemo(() => {
    return matches.filter(
      (m) => m.batchId === activeBatch?.id && (m.status === "needs_review" || m.status === "conflict")
    ).length;
  }, [matches, activeBatch?.id]);

  const globalReviewCount = useMemo(() => {
    return matches.filter(
      (m) => m.status === "needs_review" || m.status === "conflict"
    ).length;
  }, [matches]);

  const currentMatch = useMemo(() => {
    if (activeMatchId) {
      const byId = queueItems.find((q) => q.id === activeMatchId) ?? matches.find((m) => m.id === activeMatchId);
      if (byId) return byId;
    }
    return queueItems[0] ?? null;
  }, [activeMatchId, queueItems, matches]);

  const currentIndex = currentMatch
    ? queueItems.findIndex((q) => q.id === currentMatch.id)
    : -1;

  // Determine active candidate sticker shown on the right panel
  const activeSticker = useMemo(() => {
    if (!currentMatch) return null;
    if (selectedCandidateId) {
      const fromCandidates = currentMatch.candidateStickers.find(
        (s) => s.id === selectedCandidateId
      );
      if (fromCandidates) return fromCandidates;
      const fromLibrary = stickers.find((s) => s.id === selectedCandidateId);
      if (fromLibrary) return fromLibrary;
    }
    return currentMatch.matchedSticker ?? currentMatch.candidateStickers[0] ?? null;
  }, [currentMatch, selectedCandidateId, stickers]);

  // Local selections intentionally reset when the compared product changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCandidateId(null);
    setActionNote("");
  }, [currentMatch?.id]);

  const goToRelative = (offset: number) => {
    if (queueItems.length === 0) return;
    const base = currentIndex >= 0 ? currentIndex : 0;
    const nextIdx = (base + offset + queueItems.length) % queueItems.length;
    setSelectedMatchId(queueItems[nextIdx].id);
  };

  const runAction = async (
    action: "approve" | "reject" | "defer" | "unmatched",
    matchId: string,
    note?: string,
    sticker?: StickerReference | null
  ) => {
    if (pendingAction) return; // prevent duplicate submissions
    setPendingAction(action);
    setActionError(null);
    const before = currentMatch?.status;
    try {
      if (action === "approve") await approveMatch(matchId, sticker ?? activeSticker, note);
      else if (action === "reject") await rejectMatch(matchId, note);
      else if (action === "defer") await keepForLater(matchId, note);
      else await markUnmatched(matchId, note);
      if (queueItems.length > 1) goToRelative(1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The decision could not be saved.");
    } finally {
      setPendingAction(null);
      void before;
    }
  };


  if (!currentMatch) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <PageHeader
          title="Review Matches"
          subtitle="Side-by-side product and prize-sticker verification workspace."
          actions={
            <Link
              href="/matching-results"
              className="rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F5F5F2]"
            >
              Back to Matching Results
            </Link>
          }
        />
        <EmptyState
          icon={ShieldCheck}
          title="All review items in this batch are resolved"
          description="There are no remaining Needs Review or Conflict products in the active batch. You can switch to viewing all batch items or inspect Matching Results."
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setQueueFilter("all")}
                className="rounded-[9px] bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#080808]"
              >
                Show All Batch Items
              </button>
              <Link
                href="/matching-results"
                className="rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F5F5F2]"
              >
                Open Matching Results
              </Link>
            </div>
          }
        />
      </motion.div>
    );
  }

  const productFields: { label: string; value?: string }[] = [
    { label: "Product Code", value: currentMatch.product.productCode },
    { label: "Product Name", value: currentMatch.product.name },
    { label: "Description", value: currentMatch.product.description },
    { label: "Brand", value: currentMatch.product.brand },
    { label: "Color", value: currentMatch.product.color },
    { label: "Size", value: currentMatch.product.size },
    { label: "Dimensions", value: currentMatch.product.dimensions },
    { label: "MRP", value: formatCurrency(currentMatch.product.mrp) },
    { label: "Type", value: currentMatch.product.type },
  ].filter((f) => Boolean(f.value));

  // Only genuinely extracted fields are shown; absent data is explicitly labelled.
  const stickerFields: { label: string; value?: string }[] = activeSticker
    ? [
        { label: "Original Word Filename", value: activeSticker.documentName },
        { label: "Extracted Identifier", value: activeSticker.stickerIdentifier },
        { label: "Product Name", value: activeSticker.productName },
        { label: "Common Name", value: activeSticker.commonName },
        { label: "Colour (extracted)", value: activeSticker.colorVariant ?? "Not available on sticker reference" },
        { label: "Size / Variant (extracted)", value: activeSticker.sizeVariant ?? "Not available on sticker reference" },
        { label: "Net Quantity", value: activeSticker.netQuantity },
        { label: "Dimensions", value: activeSticker.dimensions },
        { label: "Manufacturing Month/Year", value: activeSticker.manufacturingMonthYear },
        { label: "Batch Number", value: activeSticker.batchNumber },
        { label: "Marketed / Packaged By", value: activeSticker.marketedBy },
        { label: "Country of Origin", value: activeSticker.countryOfOrigin },
        {
          label: "MRP",
          value:
            activeSticker.mrp !== undefined
              ? formatCurrency(activeSticker.mrp)
              : undefined,
        },
        { label: "Customer Care Details", value: activeSticker.customerCareDetails },
      ].filter((f) => Boolean(f.value))
    : [];

  const alignmentLabel: Record<string, string> = {
    match: "Match",
    differs: "Differs",
    missing: "Not verifiable",
    conflict: "Conflict",
  };

  const alignmentClass: Record<string, string> = {
    match: "bg-[#EAF5EE] text-[#16834A] border-[#CBE7D5]",
    differs: "bg-[#FFF6DF] text-[#B67C0A] border-[#F3DFAB]",
    missing: "bg-[#F0F0ED] text-[#666666] border-[#DCDCD7]",
    conflict: "bg-[#FDECEC] text-[#DC4545] border-[#F6C8C8]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Review Matches"
        subtitle={`Compare Item Master CSV attributes side-by-side with Frido's permanent Word prize stickers before approving. ${batchReviewCount} items in this batch need review.`}
        meta={
          <>
            <span className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 font-mono text-xs font-semibold text-[#171717]">
              {activeBatch?.id ?? currentMatch.batchId}
            </span>
            {activeBatch?.csvFilename && (
              <span className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs text-[#666666]">
                {activeBatch.csvFilename}
              </span>
            )}
            <StatusBadge status={currentMatch.status} size="md" />
            <MatchTypeBadge matchType={currentMatch.matchType} />
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[9px] border border-[#EAEAE7] bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setQueueFilter("pending")}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 font-medium transition-colors",
                  queueFilter === "pending"
                    ? "bg-[#171717] text-white"
                    : "text-[#666666] hover:text-[#171717]"
                )}
              >
                Needs Review & Conflicts
              </button>
              <button
                type="button"
                onClick={() => setQueueFilter("all")}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 font-medium transition-colors",
                  queueFilter === "all"
                    ? "bg-[#171717] text-white"
                    : "text-[#666666] hover:text-[#171717]"
                )}
              >
                All Batch Items
              </button>
            </div>
          </div>
        }
      />

      {/* Queue Navigator Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#EAEAE7] bg-white px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-[#666666] tabular-nums">
            {currentIndex >= 0
              ? `Item ${currentIndex + 1} of ${queueItems.length}`
              : `${queueItems.length} item(s) in queue`}
          </span>
          <span className="text-xs text-[#DCDCD7]">|</span>
          <span className="text-xs text-[#171717]">
            <strong>{batchReviewCount}</strong> items in this batch ({activeBatch?.id ?? currentMatch.batchId}) need review
          </span>
          {globalReviewCount !== batchReviewCount && (
            <span className="text-[11px] text-[#888888]">
              ({globalReviewCount} overall across all batches)
            </span>
          )}
          <select
            aria-label="Select item from review queue"
            value={currentMatch.id}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            className="h-8.5 max-w-[260px] rounded-lg border border-[#EAEAE7] bg-[#FAFAF8] px-2.5 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none sm:max-w-xs"
          >
            {queueItems.map((q) => (
              <option key={q.id} value={q.id}>
                {q.product.productCode} — {q.product.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={queueItems.length <= 1}
            onClick={() => goToRelative(-1)}
            className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <button
            type="button"
            disabled={queueItems.length <= 1}
            onClick={() => goToRelative(1)}
            className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Review Reason & Conflict Banner */}
      {(currentMatch.reviewReason || currentMatch.conflictWarnings.length > 0) && (
        <div
          className={cn(
            "rounded-2xl border p-4",
            currentMatch.status === "conflict"
              ? "border-[#F6C8C8] bg-[#FDECEC]/65"
              : "border-[#F3DFAB] bg-[#FFF6DF]/70"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={cn(
                "mt-0.5 h-4.5 w-4.5 shrink-0",
                currentMatch.status === "conflict"
                  ? "text-[#DC4545]"
                  : "text-[#D99A16]"
              )}
            />
            <div className="text-xs">
              <p className="font-semibold text-[#171717]">
                {currentMatch.status === "conflict"
                  ? "Conflict Detected — Requires Verification"
                  : "Manual Review Reason"}
              </p>
              {currentMatch.reviewReason && (
                <p className="mt-1 leading-relaxed text-[#444444]">
                  {currentMatch.reviewReason}
                </p>
              )}
              {currentMatch.conflictWarnings.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[#7A2020]">
                  {currentMatch.conflictWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Split Comparison Workspace (Desktop 2-col, Mobile stacked) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* LEFT PANEL — ITEM MASTER PRODUCT */}
        <section
          aria-label="Item Master Product Details"
          className="flex flex-col rounded-2xl border border-[#EAEAE7] bg-white"
        >
          <div className="flex items-center justify-between border-b border-[#EAEAE7] bg-[#FAFAF8] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[#171717]" />
              <h2 className="text-xs font-semibold tracking-wide text-[#171717] uppercase">
                Item Master Product (CSV)
              </h2>
            </div>
            <span className="font-mono text-xs font-semibold text-[#666666]">
              {currentMatch.product.productCode}
            </span>
          </div>

          <div className="divide-y divide-[#EAEAE7] p-5 pt-2">
            {productFields.map((f) => (
              <div
                key={f.label}
                className="grid grid-cols-1 gap-1 py-3 text-xs sm:grid-cols-3 sm:gap-4"
              >
                <span className="font-medium text-[#666666]">{f.label}</span>
                <span
                  className={cn(
                    "font-medium text-[#171717] sm:col-span-2",
                    f.label === "Product Code" && "font-mono",
                    f.label === "MRP" && "font-semibold tabular-nums"
                  )}
                >
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT PANEL — STICKER REFERENCE */}
        <section
          aria-label="Sticker Reference Details"
          className="flex flex-col rounded-2xl border border-[#EAEAE7] bg-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAE7] bg-[#FAFAF8] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#171717]" />
              <h2 className="text-xs font-semibold tracking-wide text-[#171717] uppercase">
                Sticker Reference (Word DOCX)
              </h2>
            </div>

            {activeSticker && (
              <button
                type="button"
                onClick={() => setInspectSticker(activeSticker)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DCDCD7] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#171717] hover:bg-[#F5F5F2]"
              >
                <Eye className="h-3 w-3" />
                View Original Sticker
              </button>
            )}
          </div>

          {/* Candidate Switcher when multiple candidates exist */}
          {currentMatch.candidateStickers.length > 1 && (
            <div className="border-b border-[#EAEAE7] bg-[#FFF6DF]/40 px-5 py-2.5">
              <p className="mb-1.5 text-[11px] font-semibold text-[#7D5606]">
                {currentMatch.candidateStickers.length} Candidate Stickers Found — Select to
                Compare:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentMatch.candidateStickers.map((cand) => {
                  const isSel = activeSticker?.id === cand.id;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => setSelectedCandidateId(cand.id)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors",
                        isSel
                          ? "border-[#171717] bg-[#171717] text-white"
                          : "border-[#DCDCD7] bg-white text-[#171717] hover:bg-[#F5F5F2]"
                      )}
                    >
                      {cand.stickerIdentifier}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeSticker ? (
            <div className="divide-y divide-[#EAEAE7] p-5 pt-2">
              {stickerFields.map((f) => (
                <div
                  key={f.label}
                  className="grid grid-cols-1 gap-1 py-3 text-xs sm:grid-cols-3 sm:gap-4"
                >
                  <span className="font-medium text-[#666666]">{f.label}</span>
                  <span
                    className={cn(
                      "font-medium text-[#171717] sm:col-span-2",
                      (f.label === "Extracted Identifier" ||
                        f.label === "Original Word Filename") &&
                        "break-all font-mono",
                      f.label === "MRP" && "font-semibold tabular-nums"
                    )}
                  >
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-[#171717]">
                No Candidate Sticker Linked
              </p>
              <p className="mt-1 max-w-xs text-xs text-[#666666]">
                This product currently has no matching Word prize-sticker reference. You
                can manually select one from the 39 permanent stickers below.
              </p>
              <select
                aria-label="Manually assign candidate sticker"
                value=""
                onChange={(e) => {
                  if (e.target.value) setSelectedCandidateId(e.target.value);
                }}
                className="mt-4 h-9 w-full max-w-xs rounded-[9px] border border-[#DCDCD7] bg-white px-3 text-xs text-[#171717]"
              >
                <option value="">Assign reference sticker for comparison...</option>
                {stickers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stickerIdentifier} — {s.productName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
      </div>

      {/* Evidence & Attribute Comparison Section */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#171717]">
                Attribute & Identifier Comparison
              </h3>
              <p className="text-xs text-[#666666]">
                Rule applied:{" "}
                <strong className="font-medium text-[#171717]">
                  {currentMatch.matchingRuleApplied}
                </strong>
                <span className="ml-2 rounded-md border border-[#EAEAE7] bg-[#FAFAF8] px-1.5 py-0.5 font-mono text-[10.5px] text-[#666666]">
                  {currentMatch.ruleId} · engine {engineVersion || currentMatch.engineVersion}
                </span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#EAEAE7]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-[#EAEAE7] bg-[#FAFAF8] text-[#666666]">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Attribute</th>
                  <th className="px-3.5 py-2.5 font-semibold">Item Master CSV</th>
                  <th className="px-3.5 py-2.5 font-semibold">Sticker Reference</th>
                  <th className="px-3.5 py-2.5 font-semibold">Alignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAE7]">
                {currentMatch.attributeComparisons.map((row) => (
                  <tr key={row.attribute}>
                    <td className="px-3.5 py-2.5 font-medium text-[#666666]">
                      {row.attribute}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-[#171717]">
                      {row.csvValue ?? "—"}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-[#171717]">
                      {row.stickerValue ?? "—"}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          alignmentClass[row.alignment] ?? alignmentClass.missing
                        )}
                      >
                        {alignmentLabel[row.alignment] ?? row.alignment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-[#666666] uppercase">
              Transparent Match Evidence
            </h4>
            <MatchEvidenceList evidence={currentMatch.evidence} />
          </div>
        </div>

        {/* Review History */}
        <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-[#666666]" />
            <h3 className="text-sm font-semibold text-[#171717]">Review History</h3>
          </div>
          <div className="divide-y divide-[#EAEAE7]">
            {currentMatch.reviewHistory.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#171717]">{item.reviewer}</span>
                  <span className="text-[11px] text-[#929292]">
                    {formatDateTime(item.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#666666]">
                  <span className="font-medium capitalize text-[#171717]">
                    {item.action.replace(/_/g, " ")}
                  </span>{" "}
                  · {item.previousStatus} → {item.newStatus}
                </p>
                {item.note && (
                  <p className="mt-1 text-[11px] text-[#666666] italic">
                    &ldquo;{item.note}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review Action Bar */}
      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-[#F6C8C8] bg-[#FDECEC] px-4 py-2.5 text-xs text-[#B93838]"
        >
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="sticky bottom-4 z-20 flex flex-col justify-between gap-3 rounded-2xl border border-[#DCDCD7] bg-white/95 p-4 shadow-[0_8px_28px_rgba(8,8,8,0.08)] backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="text-xs text-[#666666]">
          Reviewing{" "}
          <strong className="font-mono text-[#171717]">
            {currentMatch.product.productCode}
          </strong>
          {activeSticker ? (
            <>
              {" "}
              against{" "}
              <strong className="font-mono text-[#171717]">
                {activeSticker.stickerIdentifier}
              </strong>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSticker && (
            <button
              type="button"
              onClick={() => setInspectSticker(activeSticker)}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#DCDCD7] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2]"
            >
              <Eye className="h-3.5 w-3.5" />
              View Original Sticker
            </button>
          )}
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runAction("defer", currentMatch.id, actionNote || undefined)}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#DCDCD7] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-50"
          >
            {pendingAction === "defer" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D99A16]" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-[#D99A16]" />
            )}
            {pendingAction === "defer" ? "Saving…" : "Keep for Later"}
          </button>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() =>
              void runAction(
                "unmatched",
                currentMatch.id,
                actionNote || "No suitable reference exists for this SKU."
              )
            }
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#DCDCD7] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-50"
          >
            {pendingAction === "unmatched" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#929292]" />
            ) : (
              <HelpCircle className="h-3.5 w-3.5 text-[#929292]" />
            )}
            {pendingAction === "unmatched" ? "Saving…" : "Mark Unmatched"}
          </button>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => setConfirmMode("reject")}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#F6C8C8] bg-[#FDECEC] px-3.5 py-2 text-xs font-semibold text-[#DC4545] hover:bg-[#FAD7D7] disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject Match
          </button>
          <button
            type="button"
            disabled={!activeSticker || pendingAction !== null}
            onClick={() => setConfirmMode("approve")}
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#16834A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#126B3C] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pendingAction === "approve" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {pendingAction === "approve" ? "Approving…" : "Approve Match"}
          </button>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmMode === "approve"}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => {
          void runAction("approve", currentMatch.id, actionNote || undefined, activeSticker);
        }}
        title={`Approve match for ${currentMatch.product.productCode}?`}
        description={`Confirm linking this Item Master product to sticker ${
          activeSticker?.stickerIdentifier ?? ""
        }. This decision is saved permanently to PostgreSQL and appended to the audit history. It cannot be undone automatically.`}
        confirmLabel="Approve Match"
        variant="approve"
      >
        <label className="block text-xs font-medium text-[#171717]">
          Approval Note (optional)
          <input
            type="text"
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="e.g., Confirmed color variant maps to standard sticker"
            className="mt-1.5 w-full rounded-[9px] border border-[#EAEAE7] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmMode === "reject"}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => {
          void runAction("reject", currentMatch.id, actionNote || undefined);
        }}
        title={`Reject match for ${currentMatch.product.productCode}?`}
        description="Rejecting removes the candidate sticker link and classifies this product as Unmatched."
        confirmLabel="Reject Match"
        variant="danger"
      >
        <label className="block text-xs font-medium text-[#171717]">
          Rejection Reason (optional)
          <input
            type="text"
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="e.g., Requires new prize sticker Word file due to MRP change"
            className="mt-1.5 w-full rounded-[9px] border border-[#EAEAE7] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
          />
        </label>
      </ConfirmDialog>

      <StickerDetailDrawer
        sticker={inspectSticker}
        onClose={() => setInspectSticker(null)}
      />
    </motion.div>
  );
}

export default function ReviewMatchesPage() {
  return (
    <Suspense fallback={<TableLoadingSkeleton rows={6} />}>
      <ReviewMatchesContent />
    </Suspense>
  );
}
