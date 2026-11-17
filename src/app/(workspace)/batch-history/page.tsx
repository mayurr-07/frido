"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Download,
  Loader2,
  FileBarChart2,
  FileUp,
  History,
  X,
} from "lucide-react";
import type { BatchStatus, ItemMasterBatch, Report } from "@/types/frido";
import { useFridoStore } from "@/context/FridoStoreContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { BatchStatusBadge } from "@/components/shared/StatusBadge";
import { SearchInput } from "@/components/shared/SearchInput";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReportPreviewModal } from "@/components/reports/ReportPreviewModal";
import { formatDateTime } from "@/lib/utils";

export default function BatchHistoryPage() {
  const router = useRouter();
  const { batches, setActiveBatchId, createReport } = useFridoStore();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BatchStatus>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "30d" | "90d">("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [detailBatch, setDetailBatch] = useState<ItemMasterBatch | null>(null);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [preparingReport, setPreparingReport] = useState(false);
  const [referenceNow] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return batches.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;

      if (dateFilter !== "all") {
        const ageDays = (referenceNow - new Date(b.uploadDate).getTime()) / (1000 * 60 * 60 * 24);
        if (dateFilter === "30d" && ageDays > 30) return false;
        if (dateFilter === "90d" && ageDays > 90) return false;
      }

      if (q) {
        const hay = `${b.id} ${b.csvFilename} ${b.uploadedBy}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [batches, query, statusFilter, dateFilter, referenceNow]);

  const paged = useMemo(() => {
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageIndex, pageSize]);

  const openBatchResults = (batchId: string) => {
    setActiveBatchId(batchId);
    router.push(`/matching-results?batch=${encodeURIComponent(batchId)}`);
  };

  const openReportPreview = async (batch: ItemMasterBatch) => {
    if (preparingReport) return;
    setPreparingReport(true);
    try {
      const report = await createReport(batch.id, "complete_report");
      if (report) setPreviewReport(report);
    } finally {
      setPreparingReport(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Batch History"
        subtitle="Audit every historical Item Master CSV upload as an independent matching batch."
        actions={
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-[9px] bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#080808]"
          >
            <FileUp className="h-3.5 w-3.5 text-[#FCD10C]" />
            New CSV Batch
          </Link>
        }
      />

      <div className="rounded-2xl border border-[#EAEAE7] bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-[#EAEAE7] bg-[#FAFAF8]/70 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <SearchInput
              value={query}
              onChange={(val) => {
                setQuery(val);
                setPageIndex(0);
              }}
              placeholder="Search batch ID, CSV filename, or uploader..."
              className="w-full sm:w-72"
              ariaLabel="Search batch history"
            />
            <select
              aria-label="Filter by upload timeframe"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as "all" | "30d" | "90d");
                setPageIndex(0);
              }}
              className="h-9 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <select
              aria-label="Filter by batch status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | BatchStatus);
                setPageIndex(0);
              }}
              className="h-9 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              <option value="all">All Batch Statuses</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <span className="text-xs text-[#666666] tabular-nums">
            {filtered.length} batch(es)
          </span>
        </div>

        {paged.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={History}
              title="No matching batches found"
              description="No CSV batches match your current filters, or no batches have been uploaded yet."
              action={
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 rounded-[9px] bg-[#171717] px-4 py-2 text-xs font-semibold text-white"
                >
                  Upload Item Master CSV
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="border-b border-[#EAEAE7] bg-[#FAFAF8] text-xs text-[#666666]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Batch ID</th>
                    <th className="px-4 py-3 font-semibold">CSV Filename</th>
                    <th className="px-4 py-3 font-semibold">Upload Date</th>
                    <th className="px-4 py-3 font-semibold">Uploaded By</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                    <th className="px-4 py-3 font-semibold text-right">Confirmed</th>
                    <th className="px-4 py-3 font-semibold text-right">Review</th>
                    <th className="px-4 py-3 font-semibold text-right">Conflicts</th>
                    <th className="px-4 py-3 font-semibold text-right">Unmatched</th>
                    <th className="px-4 py-3 font-semibold">Batch Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAE7]">
                  {paged.map((batch) => (
                    <tr
                      key={batch.id}
                      onClick={() => setDetailBatch(batch)}
                      className="cursor-pointer transition-colors hover:bg-[#FAFAF8]"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="block font-mono text-xs font-semibold text-[#171717]">
                          {batch.id}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-[#929292]">
                          engine {batch.engineVersion}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <span className="block truncate font-medium text-[#171717]">
                          {batch.csvFilename}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] text-[#929292]">
                          {batch.validRows} valid · {batch.invalidRows} rejected
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#666666] whitespace-nowrap tabular-nums">
                        {formatDateTime(batch.uploadDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#666666] whitespace-nowrap">
                        {batch.uploadedBy}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#171717] tabular-nums">
                        {batch.totalProducts}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#16834A] tabular-nums">
                        {batch.confirmedCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#B67C0A] tabular-nums">
                        {batch.needsReviewCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#DC4545] tabular-nums">
                        {batch.conflictCount}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666] tabular-nums">
                        {batch.unmatchedCount}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <BatchStatusBadge status={batch.status} />
                      </td>
                      <td
                        className="px-4 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openBatchResults(batch.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] hover:border-[#171717] hover:bg-[#F5F5F2]"
                          >
                            Results
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                          <a
                            href={`/api/batches/${encodeURIComponent(batch.id)}?format=csv`}
                            title="Download original CSV"
                            className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2 py-1 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2]"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => void openReportPreview(batch)}
                            disabled={preparingReport}
                            title="Preview Batch Report"
                            aria-busy={preparingReport}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2 py-1 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-50"
                          >
                            {preparingReport ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileBarChart2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
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

      {/* Batch Detail Drawer / Modal */}
      {detailBatch && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={() => setDetailBatch(null)}
            className="fixed inset-0 bg-[#080808]/35"
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#EAEAE7] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#EAEAE7] pb-4">
              <div>
                <span className="font-mono text-xs font-semibold text-[#171717]">
                  {detailBatch.id}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[#171717]">
                  {detailBatch.csvFilename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailBatch(null)}
                aria-label="Close batch details"
                className="rounded-lg p-1 text-[#666666] hover:bg-[#F5F5F2]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex-1 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Batch Status</span>
                <BatchStatusBadge status={detailBatch.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Uploaded By</span>
                <span className="font-medium text-[#171717]">
                  {detailBatch.uploadedBy}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Rows imported</span>
                <span className="font-medium text-[#171717] tabular-nums">
                  {detailBatch.validRows} valid · {detailBatch.invalidRows} rejected of{" "}
                  {detailBatch.totalProducts}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Matching engine</span>
                <span className="font-mono text-[11px] font-medium text-[#171717]">
                  {detailBatch.engineVersion}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Upload Date</span>
                <span className="font-medium text-[#171717] tabular-nums">
                  {formatDateTime(detailBatch.uploadDate)}
                </span>
              </div>

              {detailBatch.notes && (
                <div className="rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] p-3 text-[#666666]">
                  {detailBatch.notes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="rounded-xl border border-[#CBE7D5] bg-[#EAF5EE]/60 p-3">
                  <span className="text-[#16834A]">Confirmed</span>
                  <p className="mt-1 text-lg font-semibold text-[#171717] tabular-nums">
                    {detailBatch.confirmedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#F3DFAB] bg-[#FFF6DF]/60 p-3">
                  <span className="text-[#B67C0A]">Needs Review</span>
                  <p className="mt-1 text-lg font-semibold text-[#171717] tabular-nums">
                    {detailBatch.needsReviewCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#F6C8C8] bg-[#FDECEC]/60 p-3">
                  <span className="text-[#DC4545]">Conflicts</span>
                  <p className="mt-1 text-lg font-semibold text-[#171717] tabular-nums">
                    {detailBatch.conflictCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#DCDCD7] bg-[#F5F5F2] p-3">
                  <span className="text-[#666666]">Unmatched</span>
                  <p className="mt-1 text-lg font-semibold text-[#171717] tabular-nums">
                    {detailBatch.unmatchedCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-[#EAEAE7] pt-4">
              <button
                type="button"
                onClick={() => openBatchResults(detailBatch.id)}
                className="w-full rounded-[9px] bg-[#171717] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#080808]"
              >
                Open Historical Matching Results
              </button>
              <button
                type="button"
                onClick={() => void openReportPreview(detailBatch)}
                className="w-full rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2.5 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2]"
              >
                Preview Batch Report
              </button>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/api/batches/${encodeURIComponent(detailBatch.id)}?format=csv`}
                  className="rounded-[9px] border border-[#DCDCD7] bg-white px-3 py-2 text-center text-[11px] font-medium text-[#171717] hover:bg-[#F5F5F2]"
                >
                  Original CSV
                </a>
                <a
                  href={`/api/batches/${encodeURIComponent(detailBatch.id)}?format=errors`}
                  className="rounded-[9px] border border-[#DCDCD7] bg-white px-3 py-2 text-center text-[11px] font-medium text-[#171717] hover:bg-[#F5F5F2]"
                >
                  Import errors
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}

      <ReportPreviewModal
        report={previewReport}
        onClose={() => setPreviewReport(null)}
      />
    </motion.div>
  );
}
