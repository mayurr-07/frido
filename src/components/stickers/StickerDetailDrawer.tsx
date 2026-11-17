"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, FileText, Info, X } from "lucide-react";
import type { StickerReference } from "@/types/frido";
import { ExtractionStatusBadge } from "@/components/shared/StatusBadge";
import { FridoLogo } from "@/components/shared/FridoLogo";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface StickerDetailDrawerProps {
  sticker: StickerReference | null;
  onClose: () => void;
}

export function StickerDetailDrawer({ sticker, onClose }: StickerDetailDrawerProps) {
  useEffect(() => {
    if (!sticker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sticker, onClose]);

  if (!sticker) return null;

  const extractedFields: { label: string; value?: string }[] = [
    { label: "Sticker Identifier", value: sticker.stickerIdentifier },
    { label: "Product Name", value: sticker.productName },
    { label: "Common Name", value: sticker.commonName },
    { label: "Net Quantity", value: sticker.netQuantity },
    { label: "Color Variant", value: sticker.colorVariant },
    { label: "Size Variant", value: sticker.sizeVariant },
    { label: "Dimensions", value: sticker.dimensions },
    {
      label: "MRP (Incl. of all taxes)",
      value: sticker.mrp !== undefined ? formatCurrency(sticker.mrp) : undefined,
    },
    { label: "Manufactured & Marketed By", value: sticker.marketedBy },
    { label: "Customer Care", value: sticker.customerCareDetails },
  ].filter((f) => Boolean(f.value));

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex justify-end"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sticker-drawer-title"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#080808]/40 backdrop-blur-[1px]"
        />

        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[#EAEAE7] bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#EAEAE7] bg-[#FAFAF8] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[#171717]">
                  {sticker.stickerIdentifier}
                </span>
                <ExtractionStatusBadge status={sticker.extractionStatus} />
              </div>
              <h2
                id="sticker-drawer-title"
                className="mt-1.5 text-base font-semibold text-[#171717]"
              >
                {sticker.productName}
              </h2>
              <p className="mt-0.5 truncate font-mono text-[11px] text-[#666666]">
                {sticker.documentName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sticker drawer"
              className="rounded-lg p-1.5 text-[#666666] hover:bg-[#EAEAE7] hover:text-[#171717]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            {sticker.extractionNote && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[#F3DFAB] bg-[#FFF6DF] p-3.5 text-xs text-[#7D5606]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D99A16]" />
                <div>
                  <p className="font-semibold">Extraction Attention Required</p>
                  <p className="mt-0.5">{sticker.extractionNote}</p>
                </div>
              </div>
            )}

            {/* Simulated Word Document Prize-Sticker Preview */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wide text-[#666666] uppercase">
                  Prize Sticker Reference Preview (.docx)
                </h3>
                <span className="text-[11px] text-[#929292]">
                  Mock DOCX Layout Preview
                </span>
              </div>

              <div className="rounded-2xl border-2 border-[#171717] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#EAEAE7] pb-3">
                  <div className="flex h-8 w-11 items-center justify-center rounded-lg bg-[#FCD10C] px-1.5">
                    <FridoLogo variant="wordmark" height={14} />
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[#171717]">
                    REF: {sticker.stickerIdentifier}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <p className="text-sm font-bold text-[#171717]">
                    {sticker.productName}
                  </p>
                  {sticker.commonName && (
                    <p className="text-[#666666]">
                      Common / Generic Name:{" "}
                      <strong className="font-medium text-[#171717]">
                        {sticker.commonName}
                      </strong>
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 border-y border-[#EAEAE7] py-2.5">
                    {sticker.netQuantity && (
                      <div>
                        <span className="text-[10.5px] text-[#929292]">Net Quantity</span>
                        <p className="font-semibold text-[#171717]">
                          {sticker.netQuantity}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10.5px] text-[#929292]">
                        MRP (Incl. of all taxes)
                      </span>
                      <p className="font-bold text-[#171717] tabular-nums">
                        {sticker.mrp !== undefined
                          ? formatCurrency(sticker.mrp)
                          : "MISSING IN DOCX"}
                      </p>
                    </div>
                  </div>
                  {sticker.dimensions && (
                    <p className="text-[11px] text-[#666666]">
                      Dimensions:{" "}
                      <span className="font-medium text-[#171717]">
                        {sticker.dimensions}
                      </span>
                    </p>
                  )}
                  {sticker.marketedBy && (
                    <p className="text-[11px] leading-relaxed text-[#666666]">
                      Mfg & Mktd By: {sticker.marketedBy}
                    </p>
                  )}
                  {sticker.customerCareDetails && (
                    <p className="text-[11px] text-[#666666]">
                      {sticker.customerCareDetails}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Extracted Field Viewer */}
            <div>
              <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-[#666666] uppercase">
                Extracted Reference Fields
              </h3>
              <div className="divide-y divide-[#EAEAE7] overflow-hidden rounded-xl border border-[#EAEAE7] bg-[#FAFAF8]">
                {extractedFields.map((field) => (
                  <div
                    key={field.label}
                    className="grid grid-cols-1 gap-1 px-4 py-2.5 text-xs sm:grid-cols-3 sm:gap-3"
                  >
                    <span className="font-medium text-[#666666]">{field.label}</span>
                    <span className="font-medium text-[#171717] sm:col-span-2">
                      {field.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] p-3 text-[11px] text-[#666666]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#929292]" />
              <span>
                Last indexed {formatDateTime(sticker.lastUpdated)}. Permanent Word
                documents are stored centrally; actual `.docx` binary extraction will
                connect via backend services later.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#EAEAE7] bg-[#FAFAF8] px-5 py-3.5 sm:px-6">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#666666]">
              <FileText className="h-3.5 w-3.5" />
              Permanent Reference Document
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[9px] bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#080808]"
            >
              Done
            </button>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
