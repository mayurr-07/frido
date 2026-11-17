"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  pageIndex,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(totalItems, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-[#EAEAE7] px-4 py-3 text-xs text-[#666666] sm:flex-row">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          Showing <strong className="font-medium text-[#171717]">{start}</strong>–
          <strong className="font-medium text-[#171717]">{end}</strong> of{" "}
          <strong className="font-medium text-[#171717]">{totalItems}</strong>
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="rounded-lg border border-[#EAEAE7] bg-white px-2 py-1 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pageIndex <= 0}
          onClick={() => onPageChange(pageIndex - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2.5 text-xs font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <span className="px-2 font-medium text-[#171717] tabular-nums">
          Page {pageIndex + 1} of {totalPages}
        </span>
        <button
          type="button"
          disabled={pageIndex + 1 >= totalPages}
          onClick={() => onPageChange(pageIndex + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2.5 text-xs font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
