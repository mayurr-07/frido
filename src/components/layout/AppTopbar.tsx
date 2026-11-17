"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  FileUp,
  Menu,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";
import { useFridoStore } from "@/context/FridoStoreContext";
import { formatRelativeTime } from "@/lib/utils";
import { FridoLogo } from "@/components/shared/FridoLogo";

const ROUTE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  "/": [{ label: "Frido" }, { label: "Workspace" }, { label: "Overview" }],
  "/upload": [
    { label: "Frido", href: "/" },
    { label: "Workspace" },
    { label: "Upload Item Master" },
  ],
  "/matching-results": [
    { label: "Frido", href: "/" },
    { label: "Workspace" },
    { label: "Matching Results" },
  ],
  "/review-matches": [
    { label: "Frido", href: "/" },
    { label: "Workspace" },
    { label: "Review Matches" },
  ],
  "/sticker-library": [
    { label: "Frido", href: "/" },
    { label: "Data Management" },
    { label: "Sticker Library" },
  ],
  "/batch-history": [
    { label: "Frido", href: "/" },
    { label: "Data Management" },
    { label: "Batch History" },
  ],
  "/reports": [
    { label: "Frido", href: "/" },
    { label: "Data Management" },
    { label: "Reports" },
  ],
  "/settings": [
    { label: "Frido", href: "/" },
    { label: "System" },
    { label: "Settings" },
  ],
};

export function AppTopbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activities, preferences, activeBatch, triggerReplayIntro, user, authMode } = useFridoStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const notifRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const crumbs = ROUTE_BREADCRUMBS[pathname] ?? [
    { label: "Frido", href: "/" },
    { label: "Workspace" },
  ];

  const initials = preferences.displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickQuery.trim();
    if (!trimmed) {
      router.push("/matching-results");
      return;
    }
    router.push(`/matching-results?q=${encodeURIComponent(trimmed)}`);
    setQuickQuery("");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#EAEAE7] bg-white/95 px-4 backdrop-blur-xs sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#EAEAE7] bg-white text-[#171717] hover:bg-[#F5F5F2] lg:hidden"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <Link href="/" className="flex items-center lg:hidden">
          <div className="flex h-8 w-10 items-center justify-center rounded-lg bg-[#FCD10C] px-1">
            <FridoLogo variant="wordmark" height={14} />
          </div>
        </Link>

        <div className="hidden sm:block">
          <Breadcrumbs items={crumbs} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Quick SKU search */}
        <form onSubmit={handleQuickSearch} className="relative hidden md:block">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#929292]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Jump to SKU or product..."
            aria-label="Quick search products in matching results"
            className="h-8.5 w-52 rounded-[9px] border border-[#EAEAE7] bg-[#FAFAF8] pr-3 pl-8 text-xs text-[#171717] placeholder:text-[#929292] transition-all focus:w-64 focus:border-[#171717] focus:bg-white focus:outline-none"
          />
        </form>

        {/* Demo mode pill */}
        {preferences.showDemoBanner && (
          <span
            title="Frontend demonstration mode with local mock data"
            className="hidden items-center gap-1.5 rounded-full border border-[#EAEAE7] bg-[#F5F5F2] px-2.5 py-1 text-[11px] font-medium text-[#666666] xl:inline-flex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#D99A16]" />
            Demo Data · {activeBatch?.id ?? "Ready"}
          </span>
        )}

        <Link
          href="/upload"
          className="hidden items-center gap-1.5 rounded-[9px] bg-[#FCD10C] px-3 py-1.5 text-xs font-semibold text-[#080808] transition-colors hover:bg-[#F2C700] sm:inline-flex"
        >
          <FileUp className="h-3.5 w-3.5" />
          Upload CSV
        </Link>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Open notifications"
            aria-expanded={notifOpen}
            className="relative flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#EAEAE7] bg-white text-[#171717] transition-colors hover:bg-[#F5F5F2]"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#DC4545]" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#EAEAE7] bg-white p-3 shadow-[0_12px_32px_rgba(8,8,8,0.08)]">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-[#171717]">
                  Workspace Activity
                </span>
                <span className="text-[11px] text-[#929292]">Demo feed</span>
              </div>
              <div className="max-h-72 divide-y divide-[#EAEAE7] overflow-y-auto">
                {activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 py-2.5 px-1">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16834A]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#171717]">{act.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[#666666]">
                        {act.description}
                      </p>
                      <span className="mt-1 block text-[10px] text-[#929292]">
                        {formatRelativeTime(act.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Account menu */}
        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => setAccountOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={accountOpen}
            className="flex h-9 items-center gap-2 rounded-[9px] border border-[#EAEAE7] bg-white px-2 transition-colors hover:bg-[#F5F5F2]"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171717] text-[10px] font-semibold text-[#FCD10C]">
              {initials}
            </div>
            <span className="hidden text-xs font-medium text-[#171717] sm:inline">
              {preferences.displayName.split(" ")[0]}
            </span>
          </button>

          {accountOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#EAEAE7] bg-white p-2 shadow-[0_12px_32px_rgba(8,8,8,0.08)]">
              <div className="border-b border-[#EAEAE7] px-2.5 py-2">
                <p className="text-xs font-semibold text-[#171717]">
                  {preferences.displayName}
                </p>
                <p className="truncate text-[11px] text-[#666666]">{preferences.email}</p>
              </div>
              <div className="mt-1 space-y-0.5">
                <Link
                  href="/settings"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2]"
                >
                  <Settings className="h-3.5 w-3.5 text-[#666666]" />
                  Workspace Settings
                </Link>
                <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] text-[#666666]">
                  <span>{user?.role === "super_admin" ? "SUPER_ADMIN" : "EMPLOYEE"}</span>
                  <span className="font-mono text-[10px]">engine {activeBatch?.engineVersion ?? "2.0.0"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    triggerReplayIntro();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#171717] hover:bg-[#F5F5F2]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#D99A16]" />
                  Replay Brand Intro
                </button>
                <div className="mt-1 border-t border-[#EAEAE7] px-2.5 pt-2 pb-1">
                  <p className="text-[10.5px] leading-relaxed text-[#929292]">
                    {authMode === "single_user"
                      ? "Single-user workspace — actions are attributed to this account."
                      : "Signed in with a secure server session."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
