"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Eye,
  FilePlus2,
  FileText,
  Fingerprint,
  Info,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import type { ExtractionStatus, StickerReference } from "@/types/frido";
import { useFridoStore } from "@/context/FridoStoreContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { ExtractionStatusBadge } from "@/components/shared/StatusBadge";
import { SearchInput } from "@/components/shared/SearchInput";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { StickerDetailDrawer } from "@/components/stickers/StickerDetailDrawer";
import { formatCurrency, formatShortDate } from "@/lib/utils";

export default function StickerLibraryPage() {
  const { stickers, user, uploadStickerDocument, pushToast } = useFridoStore();

  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ExtractionStatus>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSticker, setSelectedSticker] = useState<StickerReference | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const handleDocxUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      await uploadStickerDocument(file);
      setAdminModalOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "DOCX extraction failed");
    } finally {
      setUploading(false);
    }
  };

  const summary = useMemo(() => {
    // "complete" = extracted with no missing fields whatsoever.
    // "incomplete" = extracted but with informational warnings (some fields missing, non-critical).
    // "attention" = needs_attention (critical fields missing or conflicting data).
    // "conflicted" = extraction found internal contradictions.
    const complete = stickers.filter(
      (s) => s.extractionStatus === "extracted" && (!s.missingFields || s.missingFields.length === 0)
    ).length;
    const incomplete = stickers.filter(
      (s) => s.extractionStatus === "extracted" && s.missingFields && s.missingFields.length > 0
    ).length;
    const attention = stickers.filter(
      (s) => s.extractionStatus === "needs_attention"
    ).length;
    const uniqueIds = new Set(stickers.map((s) => s.stickerIdentifier)).size;
    return {
      total: stickers.length,
      // Legacy "extracted" count = complete + incomplete (all successfully extracted).
      extracted: complete + incomplete,
      complete,
      incomplete,
      attention,
      uniqueIds,
    };
  }, [stickers]);

  const productFamilies = useMemo(() => {
    const categories = new Set<string>();
    stickers.forEach((s) => {
      if (s.stickerIdentifier.includes("-INS-")) categories.add("Insoles & Footwear");
      else if (s.stickerIdentifier.includes("-SIT-")) categories.add("Seat & Lumbar Cushions");
      else if (s.stickerIdentifier.includes("-SLP-")) categories.add("Sleep & Pillows");
      else categories.add("Posture & Mobility");
    });
    return Array.from(categories);
  }, [stickers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stickers.filter((s) => {
      if (statusFilter !== "all" && s.extractionStatus !== statusFilter) return false;
      if (productFilter !== "all") {
        const family = s.stickerIdentifier.includes("-INS-")
          ? "Insoles & Footwear"
          : s.stickerIdentifier.includes("-SIT-")
          ? "Seat & Lumbar Cushions"
          : s.stickerIdentifier.includes("-SLP-")
          ? "Sleep & Pillows"
          : "Posture & Mobility";
        if (family !== productFilter) return false;
      }
      if (q) {
        const match =
          s.documentName.toLowerCase().includes(q) ||
          s.stickerIdentifier.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [stickers, query, productFilter, statusFilter]);

  const paged = useMemo(() => {
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageIndex, pageSize]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Sticker Library"
        subtitle="Manage and inspect the permanent Frido product sticker references."
        actions={
          <button
            type="button"
            onClick={() => setAdminModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-xs font-semibold text-[#171717] transition-colors hover:bg-[#F5F5F2]"
          >
            <FilePlus2 className="h-4 w-4" />
            Admin: Import Reference DOCX
          </button>
        }
      />

      {/* Permanent reference distinction banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#EAEAE7] bg-white p-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FCD10C]/25 text-[#171717]">
          <Info className="h-4 w-4" />
        </div>
        <div className="text-xs">
          <p className="font-semibold text-[#171717]">
            Permanent Reference Collection (Separate From Weekly CSV Uploads)
          </p>
          <p className="mt-0.5 text-[#666666]">
            These {summary.total} Word prize-sticker documents are stored permanently as
            Frido&apos;s master reference library. Employees do not re-upload sticker
            documents when importing Item Master CSV files.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={summary.total}
          supportingText="Initial demonstration dataset"
          icon={BookMarked}
          accent="yellow"
        />
        <StatCard
          title="Complete"
          value={summary.complete}
          supportingText="All fields extracted"
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard
          title="Incomplete"
          value={summary.incomplete}
          supportingText="Extracted with informational warnings"
          icon={CheckCircle2}
          accent="neutral"
        />
        <StatCard
          title="Needs Attention"
          value={summary.attention}
          supportingText="Critical fields missing or conflicting"
          icon={AlertTriangle}
          accent="warning"
          onClick={() =>
            setStatusFilter((s) =>
              s === "needs_attention" ? "all" : "needs_attention"
            )
          }
          active={statusFilter === "needs_attention"}
        />
      </div>

      {/* Document Table */}
      <div className="rounded-2xl border border-[#EAEAE7] bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-[#EAEAE7] bg-[#FAFAF8]/70 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <SearchInput
              value={query}
              onChange={(val) => {
                setQuery(val);
                setPageIndex(0);
              }}
              placeholder="Search filename, identifier, or product name..."
              className="w-full sm:w-72"
              ariaLabel="Search sticker library"
            />
            <select
              aria-label="Filter by product family"
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setPageIndex(0);
              }}
              className="h-9 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              <option value="all">All Product Families</option>
              {productFamilies.map((fam) => (
                <option key={fam} value={fam}>
                  {fam}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by extraction status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | ExtractionStatus);
                setPageIndex(0);
              }}
              className="h-9 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              <option value="all">All Extraction Statuses</option>
              <option value="extracted">Extracted</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="conflicted">Conflicted</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#666666]">
            <span className="tabular-nums">{filtered.length} document(s)</span>
            <span className="rounded-full border border-[#F3DFAB] bg-[#FFF6DF] px-2 py-0.5 text-[11px] font-medium text-[#9C6908]">
              {stickers.filter((sticker) => sticker.extractionStatus === "conflicted").length} conflicted
            </span>
          </div>
        </div>

        {paged.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title="No sticker documents match your filter"
              description="Clear your search query or extraction status filter to view all 39 permanent documents."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setProductFilter("all");
                    setStatusFilter("all");
                  }}
                  className="rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F5F5F2]"
                >
                  Reset Filters
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="border-b border-[#EAEAE7] bg-[#FAFAF8] text-xs text-[#666666]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document Name</th>
                    <th className="px-4 py-3 font-semibold">Sticker Identifier</th>
                    <th className="px-4 py-3 font-semibold">Product Name</th>
                    <th className="px-4 py-3 font-semibold">Extraction Status</th>
                    <th className="px-4 py-3 font-semibold">Last Updated</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAE7]">
                  {paged.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedSticker(doc)}
                      className="cursor-pointer transition-colors hover:bg-[#FAFAF8]"
                    >
                      <td className="max-w-[260px] px-4 py-3">
                        <p className="truncate font-mono text-xs text-[#171717]">{doc.documentName}</p>
                        <span
                          className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                            doc.documentSource === "seed_demo"
                              ? "border-[#EAEAE7] bg-[#F5F5F2] text-[#666666]"
                              : "border-[#CBE7D5] bg-[#EAF5EE] text-[#16834A]"
                          }`}
                        >
                          {doc.documentSource === "seed_demo" ? "Demonstration reference" : "Uploaded DOCX"}
                          {doc.missingFields.length > 0 ? ` · ${doc.missingFields.length} missing` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#171717] whitespace-nowrap">
                        {doc.stickerIdentifier}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <p className="truncate font-medium text-[#171717]">
                          {doc.productName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#666666] tabular-nums">
                          {doc.mrp !== undefined ? formatCurrency(doc.mrp) : "MRP missing"}
                          {doc.netQuantity ? ` · ${doc.netQuantity}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ExtractionStatusBadge status={doc.extractionStatus} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#666666] whitespace-nowrap">
                        {formatShortDate(doc.lastUpdated)}
                      </td>
                      <td
                        className="px-4 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSticker(doc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] hover:border-[#171717] hover:bg-[#F5F5F2]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPageIndex}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPageIndex(0);
              }}
            />
          </>
        )}
      </div>

      {/* Document detail drawer */}
      <StickerDetailDrawer
        sticker={selectedSticker}
        onClose={() => setSelectedSticker(null)}
      />

      {/* Future Admin Import Modal */}
      {adminModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={() => setAdminModalOpen(false)}
            className="fixed inset-0 bg-[#080808]/40"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#EAEAE7] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#171717]">
                  Import Reference Sticker DOCX
                </h3>
                <p className="mt-1 text-xs text-[#666666]">
                  Administrative interface planned for future backend integration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1 text-[#929292] hover:bg-[#F5F5F2]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {user?.role !== "super_admin" ? (
              <div className="mt-4 rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] p-4 text-xs text-[#666666]">
                Only SUPER_ADMIN users can import or replace permanent sticker references.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void handleDocxUpload(file);
                  }}
                />
                <div className="rounded-xl border border-dashed border-[#DCDCD7] bg-[#FAFAF8] p-5 text-center text-xs text-[#666666]">
                  <UploadCloud className="mx-auto h-7 w-7 text-[#929292]" />
                  <p className="mt-2 font-medium text-[#171717]">
                    Upload the official Frido Word prize sticker
                  </p>
                  <p className="mt-1">
                    The document is parsed server-side (mammoth) and stored permanently. Missing
                    fields or duplicate identifiers block automatic confirmation.
                  </p>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => docInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-2 rounded-[9px] bg-[#171717] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    {uploading ? "Extracting…" : "Select .docx file"}
                  </button>
                </div>
                {uploadError && (
                  <p className="rounded-lg border border-[#F6C8C8] bg-[#FDECEC] px-3 py-2 text-xs text-[#B93838]">
                    {uploadError}
                  </p>
                )}
                <ul className="list-disc space-y-1 pl-5 text-[11px] text-[#666666]">
                  <li>Extracted: identifier, product &amp; common name, net quantity, dimensions.</li>
                  <li>Extracted: MRP, batch number, mfg month/year, packaged &amp; marketed by, care details.</li>
                  <li>Contradictory MRP values or duplicate identifiers are flagged, never auto-resolved.</li>
                </ul>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-xs font-medium text-[#171717]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
