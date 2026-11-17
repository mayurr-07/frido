"use client";

import React from "react";

export function TableLoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEAE7] bg-white">
      <div className="border-b border-[#EAEAE7] bg-[#F5F5F2] px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-[#EAEAE7]" />
      </div>
      <div className="divide-y divide-[#EAEAE7]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-4 w-4 animate-pulse rounded bg-[#F0F0ED]" />
            <div className="h-4 w-28 animate-pulse rounded bg-[#F0F0ED]" />
            <div className="h-4 flex-1 animate-pulse rounded bg-[#F0F0ED]" />
            <div className="hidden h-4 w-40 animate-pulse rounded bg-[#F0F0ED] md:block" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-[#F0F0ED]" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-[#F0F0ED]" />
          </div>
        ))}
      </div>
    </div>
  );
}
