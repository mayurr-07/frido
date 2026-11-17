"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { ValidationSummary } from "@/components/upload/ValidationSummary";
import {
  CsvStructureError,
  SAMPLE_ITEM_MASTER_CSV,
  parseItemMasterCsv,
  type ParsedCsv,
} from "@/lib/csv";
import { useFridoStore } from "@/context/FridoStoreContext";
import { formatCurrency } from "@/lib/utils";

type Stage = "empty" | "preview" | "uploading" | "complete" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { uploadCsvFile, engineVersion } = useFridoStore();

  const [stage, setStage] = useState<Stage>("empty");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [resultBatch, setResultBatch] = useState<string | null>(null);

  const selectedFile = useMemo(
    () =>
      file
        ? {
            name: file.name,
            size: file.size,
            selectedAt: new Date().toISOString(),
          }
        : null,
    [file]
  );

  const reset = () => {
    setStage("empty");
    setParsed(null);
    setFile(null);
    setErrorMessage(null);
    setProgress(0);
    setResultBatch(null);
  };

  const previewFile = async (candidate: File) => {
    setErrorMessage(null);
    setResultBatch(null);
    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      setStage("error");
      setErrorMessage("Unsupported file type. Upload the Item Master as a .csv file.");
      return;
    }
    try {
      const text = await candidate.text();
      const result = parseItemMasterCsv(text, candidate.name);
      setParsed(result);
      setFile(candidate);
      setStage("preview");
    } catch (error) {
      setFile(null);
      setParsed(null);
      setStage("error");
      setErrorMessage(
        error instanceof CsvStructureError
          ? error.message
          : "The CSV could not be parsed. Check the file encoding and structure."
      );
    }
  };

  const handleLoadSample = () => {
    const sample = new File([SAMPLE_ITEM_MASTER_CSV], "Frido_ItemMaster_Sample_May2026.csv", {
      type: "text/csv",
    });
    void previewFile(sample);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_ITEM_MASTER_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Frido_ItemMaster_Sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async () => {
    if (!file) return;
    setStage("uploading");
    setProgress(35);
    const ticker = window.setTimeout(() => setProgress(70), 400);
    try {
      const result = await uploadCsvFile(file);
      window.clearTimeout(ticker);
      setProgress(100);
      setResultBatch(result.batchCode);
      setStage("complete");
      router.push(`/matching-results?batch=${encodeURIComponent(result.batchCode)}`);
    } catch (error) {
      window.clearTimeout(ticker);
      setProgress(0);
      setStage("error");
      setErrorMessage(
        error instanceof Error ? error.message : "The batch could not be processed."
      );
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
        title="Upload Item Master"
        subtitle="Import a Frido product catalogue. Every upload becomes its own immutable batch, matched deterministically against the sticker library."
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAEAE7] bg-white px-3 py-1 text-xs font-medium text-[#666666]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#16834A]" />
            Matching engine {engineVersion || "2.0.0"} · fail-closed confirmation
          </span>
        }
        actions={
          <button
            type="button"
            onClick={handleDownloadSample}
            className="inline-flex items-center gap-2 rounded-[9px] border border-[#DCDCD7] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2]"
          >
            <Download className="h-3.5 w-3.5" />
            Download sample CSV
          </button>
        }
      />

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#EAEAE7] bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EDF4FE] text-[#3976CB]">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#171717]">
              Sticker references are permanent — never re-uploaded with a CSV
            </p>
            <p className="mt-0.5 text-xs text-[#666666]">
              DOCX prize stickers live in the Sticker Library. Invalid CSV rows are rejected
              before matching, and previous batches are never overwritten.
            </p>
          </div>
        </div>
      </div>

      <FileDropzone
        selectedFile={selectedFile}
        onFileSelected={(candidate) => void previewFile(candidate)}
        onLoadSample={handleLoadSample}
        onRemoveFile={reset}
        errorMessage={stage === "error" ? errorMessage : null}
        disabled={stage === "uploading"}
      />

      {(stage === "uploading" || stage === "complete") && (
        <div className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {stage === "complete" ? (
                <CheckCircle2 className="h-5 w-5 text-[#16834A]" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-[#171717]" />
              )}
              <div>
                <p className="text-sm font-semibold text-[#171717]">
                  {stage === "complete"
                    ? `Batch ${resultBatch} created — opening matching results…`
                    : "Validating rows and running the matching engine…"}
                </p>
                <p className="text-xs text-[#666666]">
                  Server-side parse, validation, deterministic classification and audit logging
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#171717] tabular-nums">{progress}%</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#F0F0ED]">
            <div
              className="h-full rounded-full bg-[#FCD10C] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {stage === "error" && errorMessage && parsed && (
        <div className="rounded-2xl border border-[#F6C8C8] bg-[#FDECEC] p-4 text-xs text-[#B93838]">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Import failed</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {parsed && stage !== "uploading" && stage !== "complete" && (
        <>
          <ValidationSummary parsed={parsed} />

          <div className="overflow-hidden rounded-2xl border border-[#EAEAE7] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAE7] px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-[#171717]">Parsed row preview</h2>
                <p className="text-xs text-[#666666]">
                  First {Math.min(10, parsed.rows.length)} of {parsed.totalRows} rows · all
                  original columns are stored server-side
                </p>
              </div>
              <span className="rounded-full border border-[#EAEAE7] bg-[#FAFAF8] px-2.5 py-1 text-[11px] font-medium text-[#666666]">
                {parsed.detectedFields.length} mapped fields
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[#EAEAE7] bg-[#FAFAF8] text-[#666666]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Row</th>
                    <th className="px-4 py-2.5 font-semibold">Product Code</th>
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold">Scan ID</th>
                    <th className="px-4 py-2.5 font-semibold">Color</th>
                    <th className="px-4 py-2.5 font-semibold">Size</th>
                    <th className="px-4 py-2.5 text-right font-semibold">MRP</th>
                    <th className="px-4 py-2.5 font-semibold">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAE7]">
                  {parsed.rows.slice(0, 10).map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={row.isValid ? "hover:bg-[#FAFAF8]" : "bg-[#FDECEC]/40"}
                    >
                      <td className="px-4 py-2.5 text-[#929292] tabular-nums">{row.rowNumber}</td>
                      <td className="px-4 py-2.5 font-mono font-medium text-[#171717]">
                        {row.data.productCode || "—"}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-[#171717]">
                        {row.data.name || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[#666666]">
                        {row.data.scanIdentifier || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[#666666]">{row.data.color || "—"}</td>
                      <td className="px-4 py-2.5 text-[#666666]">{row.data.size || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-[#171717] tabular-nums">
                        {formatCurrency(row.data.mrp)}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[#16834A]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Valid
                          </span>
                        ) : (
                          <span className="text-[#DC4545]">{row.issues.join(", ")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {stage === "preview" && parsed.validRows > 0 && (
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#EAEAE7] bg-white p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#16834A]">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#171717]">
                    Ready to create batch
                  </h3>
                  <p className="mt-0.5 text-xs text-[#666666]">
                    <strong className="text-[#171717]">{parsed.validRows}</strong> valid rows
                    will be matched ·{" "}
                    <strong className="text-[#1C7A45]">{parsed.invalidRows}</strong> invalid
                    row(s) stored as import errors and excluded from matching.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2.5 text-sm font-medium text-[#171717] hover:bg-[#F5F5F2]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  className="inline-flex items-center gap-2 rounded-[9px] bg-[#171717] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#080808]"
                >
                  Continue to matching results
                  <ArrowRight className="h-4 w-4 text-[#FCD10C]" />
                </button>
              </div>
            </div>
          )}

          {stage === "error" && parsed.invalidRows === 0 && (
            <div className="rounded-2xl border border-[#F6C8C8] bg-[#FDECEC] p-4 text-xs text-[#B93838]">
              {errorMessage}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
