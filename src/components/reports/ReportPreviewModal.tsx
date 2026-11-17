"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileCheck2, Printer, X } from "lucide-react";
import type { Report } from "@/types/frido";
import { useFridoStore } from "@/context/FridoStoreContext";
import { FridoLogo } from "@/components/shared/FridoLogo";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { DownloadPdfButton } from "./DownloadPdfButton";

interface ReportPreviewModalProps {
  report: Report | null;
  onClose: () => void;
}

export function ReportPreviewModal({ report, onClose }: ReportPreviewModalProps) {
  const { matches } = useFridoStore();

  useEffect(() => {
    if (!report) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [report, onClose]);

  if (!report) return null;

  const batchMatches = matches.filter((m) => m.batchId === report.batchId);
  const includedRows =
    report.reportType === "approved_only"
      ? batchMatches.filter((m) => m.status === "confirmed")
      : report.reportType === "conflict_report"
      ? batchMatches.filter((m) => m.status === "conflict")
      : report.reportType === "review_report"
      ? batchMatches.filter((m) => m.status === "needs_review" || m.reviewState !== "pending")
      : batchMatches;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-preview-title"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#080808]/45 backdrop-blur-[1px]"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.18 }}
          className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#EAEAE7] bg-white shadow-2xl"
        >
          {/* Modal Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAEAE7] bg-[#FAFAF8] px-5 py-3.5">
            <div>
              <h2
                id="report-preview-title"
                className="text-sm font-semibold text-[#171717]"
              >
                Report Preview · {report.id}
              </h2>
              <p className="text-xs text-[#666666]">
                {report.reportType === "approved_only"
                  ? "Approved Matches Only"
                  : "Complete Matching Report"}{" "}
                · {report.batchId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#DCDCD7] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2]"
              >
                <Printer className="h-3.5 w-3.5" />
                Print View
              </button>
              <DownloadPdfButton
                reportId={report.id}
                filenameHint={report.batchId}
                label="Download PDF"
                className="px-3.5 py-1.5"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close report preview"
                className="rounded-lg p-1.5 text-[#666666] hover:bg-[#EAEAE7] hover:text-[#171717]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-b border-[#CBE7D5] bg-[#EAF5EE] px-5 py-2.5 text-xs text-[#126B3C]">
            <FileCheck2 className="h-4 w-4 shrink-0 text-[#16834A]" />
            <span>
              Generated server-side from the persisted batch, matching evidence and reviewer
              notes. Downloading produces a real PDF file.
            </span>
          </div>

          {/* Printable Report Document Surface */}
          <div className="flex-1 overflow-y-auto bg-[#F5F5F2] p-4 sm:p-6">
            <div className="mx-auto max-w-3xl rounded-2xl border border-[#EAEAE7] bg-white p-6 sm:p-8">
              {/* Report Header */}
              <div className="flex flex-col justify-between gap-4 border-b border-[#EAEAE7] pb-6 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-14 items-center justify-center rounded-xl bg-[#FCD10C] px-2">
                    <FridoLogo variant="wordmark" height={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#171717]">
                      Frido Prize Sticker Matching Report
                    </h3>
                    <p className="text-xs text-[#666666]">
                      {report.reportType === "approved_only"
                        ? "Scope: Approved / Confirmed Matches Only"
                        : "Scope: Complete Batch Classification Report"}
                    </p>
                  </div>
                </div>
                <div className="text-left text-xs text-[#666666] sm:text-right">
                  <p className="font-mono font-semibold text-[#171717]">{report.id}</p>
                  <p>Generated: {formatDateTime(report.generatedDate)}</p>
                  <p>Prepared by: {report.generatedBy}</p>
                </div>
              </div>

              {/* Batch metadata */}
              <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] p-4 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-[#929292]">Batch ID</span>
                  <p className="mt-0.5 font-mono font-semibold text-[#171717]">
                    {report.batchId}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[#929292]">Source Item Master CSV</span>
                  <p className="mt-0.5 truncate font-medium text-[#171717]">
                    {report.csvFilename}
                  </p>
                </div>
              </div>

              {/* Summary metrics */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#CBE7D5] bg-[#EAF5EE]/60 p-3">
                  <span className="text-[11px] font-medium text-[#16834A]">Confirmed</span>
                  <p className="mt-1 text-xl font-semibold text-[#171717] tabular-nums">
                    {report.confirmedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#F3DFAB] bg-[#FFF6DF]/60 p-3">
                  <span className="text-[11px] font-medium text-[#B67C0A]">Needs Review</span>
                  <p className="mt-1 text-xl font-semibold text-[#171717] tabular-nums">
                    {report.needsReviewCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#F6C8C8] bg-[#FDECEC]/60 p-3">
                  <span className="text-[11px] font-medium text-[#DC4545]">Conflicts</span>
                  <p className="mt-1 text-xl font-semibold text-[#171717] tabular-nums">
                    {report.conflictCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#DCDCD7] bg-[#F5F5F2] p-3">
                  <span className="text-[11px] font-medium text-[#666666]">Unmatched</span>
                  <p className="mt-1 text-xl font-semibold text-[#171717] tabular-nums">
                    {report.unmatchedCount}
                  </p>
                </div>
              </div>

              {/* Product mapping table */}
              <div className="mt-6">
                <h4 className="mb-3 text-xs font-semibold tracking-wide text-[#666666] uppercase">
                  Product Mapping Schedule ({includedRows.length} items)
                </h4>
                <div className="overflow-x-auto rounded-xl border border-[#EAEAE7]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="border-b border-[#EAEAE7] bg-[#F5F5F2] text-[#666666]">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Product Code</th>
                        <th className="px-3 py-2.5 font-semibold">Product Name</th>
                        <th className="px-3 py-2.5 font-semibold">MRP</th>
                        <th className="px-3 py-2.5 font-semibold">Sticker Ref</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAEAE7]">
                      {includedRows.map((row) => (
                        <tr key={row.id} className="hover:bg-[#FAFAF8]">
                          <td className="px-3 py-2.5 font-mono font-medium text-[#171717]">
                            {row.product.productCode}
                          </td>
                          <td className="px-3 py-2.5 text-[#171717]">{row.product.name}</td>
                          <td className="px-3 py-2.5 text-[#171717] tabular-nums">
                            {formatCurrency(row.product.mrp)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[#666666]">
                            {row.matchedSticker?.stickerIdentifier ?? "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                      {includedRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-xs text-[#666666]"
                          >
                            No rows match this report scope.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
