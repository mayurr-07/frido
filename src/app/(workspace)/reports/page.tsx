"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, FileBarChart2, Info, Loader2, Plus } from "lucide-react";
import type { Report, ReportType } from "@/types/frido";
import { useFridoStore } from "@/context/FridoStoreContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { ReportPreviewModal } from "@/components/reports/ReportPreviewModal";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime } from "@/lib/utils";

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  { value: "approved_only", label: "Approved Matches Only", description: "Confirmed product-to-sticker mappings only." },
  { value: "complete_report", label: "Complete Matching Report", description: "Every valid row with its classification and evidence." },
  { value: "batch_summary", label: "Batch Summary Report", description: "Batch level counts and processing metadata." },
  { value: "conflict_report", label: "Conflict Report", description: "Products blocked by contradictory evidence." },
  { value: "review_report", label: "Manual Review Report", description: "Items with reviewer decisions and notes." },
];

const typeLabel = (type: ReportType) =>
  REPORT_TYPES.find((entry) => entry.value === type)?.label ?? type;

export default function ReportsPage() {
  const { batches, reports, createReport, ready } = useFridoStore();

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedType, setSelectedType] = useState<ReportType>("approved_only");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ReportType>("all");
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);

  const effectiveBatchId = selectedBatchId || batches[0]?.id || "";

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (typeFilter !== "all" && report.reportType !== typeFilter) return false;
      if (!search) return true;
      return `${report.id} ${report.batchId} ${report.csvFilename} ${report.generatedBy}`
        .toLowerCase()
        .includes(search);
    });
  }, [reports, query, typeFilter]);

  const handleGenerate = async () => {
    const target = effectiveBatchId;
    if (!target) return;
    setGenerating(true);
    try {
      const report = await createReport(target, selectedType);
      if (report) setPreviewReport(report);
    } finally {
      setGenerating(false);
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
        title="Reports"
        subtitle="Generate real, downloadable PDF reports from persisted batches and audited review decisions."
      />

      <div className="flex items-start gap-3 rounded-2xl border border-[#EAEAE7] bg-white p-4 text-xs text-[#666666]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3976CB]" />
        <p>
          Reports are rendered server-side with PDF-lib from the stored batch, matching
          evidence and reviewer notes. Every generated report is recorded in the audit trail and
          can be downloaded immediately.
        </p>
      </div>

      <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#171717]">Generate a report</h2>
        <p className="mt-0.5 text-xs text-[#666666]">
          Choose the batch and report scope. Generation writes an auditable report record before
          the PDF is served.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block text-xs font-medium text-[#666666]">
            Batch
            <select
              value={effectiveBatchId}
              onChange={(event) => setSelectedBatchId(event.target.value)}
              disabled={batches.length === 0}
              className="mt-1.5 h-10 w-full rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none disabled:opacity-60"
            >
              {batches.length === 0 && <option value="">No batches available</option>}
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.id} — {batch.csvFilename}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-[#666666]">
            Report scope
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as ReportType)}
              className="mt-1.5 h-10 w-full rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || batches.length === 0}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-[#171717] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#080808] disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#FCD10C]" />
              ) : (
                <Plus className="h-4 w-4 text-[#FCD10C]" />
              )}
              {generating ? "Generating report…" : "Generate report"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[#929292]">
          {REPORT_TYPES.find((type) => type.value === selectedType)?.description}
        </p>
      </div>

      <div className="rounded-2xl border border-[#EAEAE7] bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-[#EAEAE7] bg-[#FAFAF8]/70 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search report ID, batch ID, or filename…"
              className="w-full sm:w-72"
              ariaLabel="Search reports"
            />
            <select
              aria-label="Filter by report type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "all" | ReportType)}
              className="h-9 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              <option value="all">All report types</option>
              {REPORT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-[#666666] tabular-nums">
            {filtered.length} report(s)
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileBarChart2}
              title={ready ? "No reports match your filter" : "Loading reports…"}
              description={
                reports.length === 0
                  ? "Generate your first report above. Reports are created from persisted batch data."
                  : "Clear the search or report type filter to see all generated reports."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-[#EAEAE7] bg-[#FAFAF8] text-xs text-[#666666]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Report ID</th>
                  <th className="px-4 py-3 font-semibold">Batch ID</th>
                  <th className="px-4 py-3 font-semibold">CSV filename</th>
                  <th className="px-4 py-3 font-semibold">Generated</th>
                  <th className="px-4 py-3 font-semibold">Scope</th>
                  <th className="px-4 py-3 text-right font-semibold">Rows</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAE7]">
                {filtered.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setPreviewReport(report)}
                    className="cursor-pointer transition-colors hover:bg-[#FAFAF8]"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap text-[#171717]">
                      {report.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-[#171717]">
                      {report.batchId}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-[#171717]">
                      {report.csvFilename}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-[#666666] tabular-nums">
                      {formatDateTime(report.generatedDate)}
                      <span className="block text-[11px] text-[#929292]">
                        {report.generatedBy}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex rounded-full border border-[#EAEAE7] bg-[#F5F5F2] px-2.5 py-0.5 text-xs font-medium text-[#444444]">
                        {typeLabel(report.reportType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#171717] tabular-nums">
                      {report.productCount}
                    </td>
                    <td
                      className="px-4 py-3 text-right whitespace-nowrap"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewReport(report)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] hover:border-[#171717] hover:bg-[#F5F5F2]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        <DownloadPdfButton reportId={report.id} filenameHint={report.batchId} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportPreviewModal report={previewReport} onClose={() => setPreviewReport(null)} />
    </motion.div>
  );
}
