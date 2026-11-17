"use client";

import React, { useRef, useState } from "react";
import { FileSpreadsheet, Trash2, UploadCloud } from "lucide-react";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

interface FileDropzoneProps {
  selectedFile: { name: string; size: number; selectedAt: string } | null;
  onFileSelected: (file: File) => void;
  onLoadSample: () => void;
  onRemoveFile: () => void;
  errorMessage?: string | null;
  disabled?: boolean;
}

export function FileDropzone({
  selectedFile,
  onFileSelected,
  onLoadSample,
  onRemoveFile,
  errorMessage,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    onFileSelected(files[0]);
  };

  if (selectedFile) {
    return (
      <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FCD10C]/60 bg-[#FCD10C]/20 text-[#171717]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#171717]">
                {selectedFile.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#666666]">
                <span className="tabular-nums">{formatBytes(selectedFile.size)}</span>
                <span>·</span>
                <span>Selected {formatDateTime(selectedFile.selectedAt)}</span>
                <span>·</span>
                <span className="font-medium text-[#16834A]">Parsed locally for preview</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemoveFile}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 self-start rounded-[9px] border border-[#DCDCD7] bg-white px-3 py-2 text-xs font-medium text-[#DC4545] transition-colors hover:border-[#F6C8C8] hover:bg-[#FDECEC] disabled:opacity-50 sm:self-center"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove file
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[#F6C8C8] bg-[#FDECEC] px-4 py-3 text-xs text-[#B93838]"
          >
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all",
        isDragging
          ? "border-[#171717] bg-[#FCD10C]/10"
          : "border-[#DCDCD7] bg-white hover:border-[#171717]/40",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#EAEAE7] bg-[#FAFAF8] text-[#171717]">
        <UploadCloud className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-[#171717]">
        {isDragging ? "Drop your Item Master CSV here" : "Drag and drop the Item Master CSV"}
      </h3>
      <p className="mt-1 max-w-md text-sm text-[#666666]">
        The full Item Master schema is imported and validated on the server against the
        permanent sticker reference library. Every upload creates a new immutable batch.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-[9px] bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#080808]"
        >
          Browse files
        </button>
        <button
          type="button"
          onClick={onLoadSample}
          className="rounded-[9px] border border-[#DCDCD7] bg-[#FAFAF8] px-4 py-2.5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#F0F0ED]"
        >
          Load sample CSV
        </button>
      </div>

      <p className="mt-4 text-xs text-[#929292]">
        Accepted format: <strong className="font-medium text-[#666666]">.csv</strong> · Max
        upload size:{" "}
        <strong className="font-medium text-[#666666]">{formatBytes(MAX_UPLOAD_BYTES)}</strong>{" "}
        · UTF-8 with or without BOM
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="mt-5 w-full max-w-lg rounded-xl border border-[#F6C8C8] bg-[#FDECEC] px-4 py-3 text-left text-xs text-[#B93838]"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
