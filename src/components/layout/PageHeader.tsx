"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, meta }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#EAEAE7] pb-5 md:flex-row md:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[#171717] sm:text-[28px] lg:text-[30px]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[#666666]">{subtitle}</p>
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </div>
  );
}
