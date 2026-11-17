"use client";

import React from "react";

/** Neutral shell shown while the workspace payload is loading. */
export function WorkspaceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading workspace data…</span>

      <div className="border-b border-[#EAEAE7] pb-5">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[#EAEAE7]" />
        <div className="mt-2.5 h-4 w-80 max-w-full animate-pulse rounded bg-[#F0F0ED]" />
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-32 animate-pulse rounded-full bg-[#F0F0ED]" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-[#F0F0ED]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="h-3.5 w-24 animate-pulse rounded bg-[#F0F0ED]" />
              <div className="h-8 w-8 animate-pulse rounded-[10px] bg-[#F0F0ED]" />
            </div>
            <div className="mt-4 h-7 w-16 animate-pulse rounded bg-[#EAEAE7]" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-[#F0F0ED]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-[300px] animate-pulse rounded-2xl border border-[#EAEAE7] bg-white lg:col-span-2" />
        <div className="h-[300px] animate-pulse rounded-2xl border border-[#EAEAE7] bg-white" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAEAE7] bg-white">
        <div className="border-b border-[#EAEAE7] bg-[#FAFAF8] px-4 py-3">
          <div className="h-4 w-40 animate-pulse rounded bg-[#EAEAE7]" />
        </div>
        <div className="divide-y divide-[#EAEAE7]">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-4 w-28 animate-pulse rounded bg-[#F0F0ED]" />
              <div className="h-4 flex-1 animate-pulse rounded bg-[#F0F0ED]" />
              <div className="hidden h-4 w-32 animate-pulse rounded bg-[#F0F0ED] sm:block" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-[#F0F0ED]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
