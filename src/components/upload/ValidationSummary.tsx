"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Download, Info, XCircle } from "lucide-react";
import type { ParsedCsv } from "@/lib/csv";
import { ITEM_MASTER_FIELDS, buildErrorReportCsv } from "@/lib/csv";

export function ValidationSummary({ parsed }: { parsed: ParsedCsv }) {
  const downloadErrors = () => {
    const csv = buildErrorReportCsv(parsed);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${parsed.filename.replace(/\.csv$/i, "")}-import-errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[#EAEAE7] bg-white p-3.5">
          <span className="text-xs text-[#666666]">Total Rows</span>
          <p className="mt-1 text-xl font-semibold text-[#171717] tabular-nums">
            {parsed.totalRows}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAEAE7] bg-white p-3.5">
          <span className="text-xs text-[#666666]">Valid Rows</span>
          <p className="mt-1 text-xl font-semibold text-[#16834A] tabular-nums">
            {parsed.validRows}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAEAE7] bg-white p-3.5">
          <span className="text-xs text-[#666666]">Rejected Rows</span>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${
              parsed.invalidRows > 0 ? "text-[#DC4545]" : "text-[#16834A]"
            }`}
          >
            {parsed.invalidRows}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAEAE7] bg-white p-3.5">
          <span className="text-xs text-[#666666]">Duplicate Codes</span>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${
              parsed.duplicateProductCodes.length > 0 ? "text-[#D99A16]" : "text-[#16834A]"
            }`}
          >
            {parsed.duplicateProductCodes.length}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#EAEAE7] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-[#666666] uppercase">
            Item Master field coverage
          </h3>
          <span className="text-[11px] text-[#929292]">
            {parsed.detectedFields.length}/{ITEM_MASTER_FIELDS.length} expected fields detected
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ITEM_MASTER_FIELDS.map((field) => {
            const present = parsed.detectedFields.includes(field.label);
            const required = "required" in field && field.required;
            return (
              <span
                key={field.key}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  present
                    ? "border-[#CBE7D5] bg-[#EAF5EE] text-[#16834A]"
                    : required
                    ? "border-[#F6C8C8] bg-[#FDECEC] text-[#DC4545]"
                    : "border-[#EAEAE7] bg-[#FAFAF8] text-[#666666]"
                }`}
              >
                {present ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : required ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#929292]" />
                )}
                {field.label}
                {!present && !required && (
                  <span className="text-[10px] text-[#929292]">(optional)</span>
                )}
              </span>
            );
          })}
        </div>

        {parsed.unknownColumns.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#CFE0FB] bg-[#EDF4FE] px-3.5 py-2.5 text-xs text-[#2B5FA8]">
            <span className="font-semibold">Preserved unmapped columns:</span>{" "}
            {parsed.unknownColumns.join(", ")} — retained in the raw row payload for traceability.
          </div>
        )}

        {parsed.duplicateProductCodes.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#F3DFAB] bg-[#FFF6DF] px-3.5 py-2.5 text-xs text-[#7D5606]">
            <strong>Duplicate Product Codes:</strong>{" "}
            <span className="font-mono">{parsed.duplicateProductCodes.join(", ")}</span>. All
            duplicate rows are rejected so a product cannot be matched twice.
          </div>
        )}

        {parsed.invalidRows > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F6C8C8] bg-[#FDECEC]/70 px-3.5 py-2.5 text-xs text-[#B93838]">
              <span>
                <strong>{parsed.invalidRows} row(s)</strong> will be excluded from matching.
                Download the error report for the full detail.
              </span>
              <button
                type="button"
                onClick={downloadErrors}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#F6C8C8] bg-white px-2.5 py-1.5 font-semibold text-[#B93838] hover:bg-[#FDECEC]"
              >
                <Download className="h-3.5 w-3.5" />
                Download error report (.csv)
              </button>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] p-3 text-xs">
              {parsed.rows
                .filter((row) => !row.isValid)
                .map((row) => (
                  <li key={row.rowNumber} className="flex gap-2">
                    <span className="font-mono text-[#929292]">Row {row.rowNumber}</span>
                    <span className="font-mono text-[#171717]">
                      {row.data.productCode || "(no code)"}
                    </span>
                    <span className="text-[#DC4545]">{row.issues.join(" · ")}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {parsed.invalidRows === 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#CBE7D5] bg-[#EAF5EE]/70 px-3.5 py-2.5 text-xs text-[#126B3C]">
            <Info className="h-3.5 w-3.5" />
            All rows passed structural validation. Matching evidence is still evaluated per row
            — unresolved attributes are never auto-confirmed.
          </div>
        )}
      </div>
    </div>
  );
}
