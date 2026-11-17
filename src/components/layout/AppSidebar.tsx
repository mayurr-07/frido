"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileBarChart2,
  FileUp,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Settings,
  X,
} from "lucide-react";
import { FridoLogo } from "@/components/shared/FridoLogo";
import { useFridoStore } from "@/context/FridoStoreContext";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { activeBatch, preferences } = useFridoStore();

  const pendingReviewCount =
    (activeBatch?.needsReviewCount ?? 0) + (activeBatch?.conflictCount ?? 0);

  const navGroups: NavGroup[] = [
    {
      title: "WORKSPACE",
      items: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Upload Item Master", href: "/upload", icon: FileUp },
        { label: "Matching Results", href: "/matching-results", icon: GitCompareArrows },
        {
          label: "Review Matches",
          href: "/review-matches",
          icon: ClipboardCheck,
          badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
        },
      ],
    },
    {
      title: "DATA MANAGEMENT",
      items: [
        { label: "Sticker Library", href: "/sticker-library", icon: BookMarked },
        { label: "Batch History", href: "/batch-history", icon: History },
        { label: "Reports", href: "/reports", icon: FileBarChart2 },
      ],
    },
    {
      title: "SYSTEM",
      items: [{ label: "Settings", href: "/settings", icon: Settings }],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const initials = preferences.displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const renderSidebarInner = (isMobileDrawer: boolean) => {
    const isIconOnly = !isMobileDrawer && collapsed;

    return (
      <div className="flex h-full flex-col bg-white">
        {/* Brand header */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-[#EAEAE7] px-4",
            isIconOnly ? "justify-center px-2" : "justify-between"
          )}
        >
          <Link
            href="/"
            onClick={isMobileDrawer ? onCloseMobile : undefined}
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none"
          >
            {isIconOnly ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD10C]">
                <FridoLogo variant="wordmark" height={14} />
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-11 items-center justify-center rounded-xl bg-[#FCD10C] px-1.5">
                  <FridoLogo variant="wordmark" height={17} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] leading-tight font-semibold text-[#171717]">
                    Frido Intelligence
                  </span>
                  <span className="text-[11px] leading-tight text-[#929292]">
                    Sticker Matching
                  </span>
                </div>
              </div>
            )}
          </Link>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation drawer"
              className="rounded-lg p-1.5 text-[#666666] hover:bg-[#F5F5F2] hover:text-[#171717]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "hidden rounded-lg border border-[#EAEAE7] bg-[#FAFAF8] p-1 text-[#666666] transition-colors hover:bg-[#F0F0ED] hover:text-[#171717] lg:flex",
                isIconOnly && "absolute -right-3 top-5 z-20 bg-white shadow-xs"
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-6 overflow-y-auto px-3 py-5"
        >
          {navGroups.map((group) => (
            <div key={group.title}>
              {!isIconOnly && (
                <p className="mb-2 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-[#929292] uppercase">
                  {group.title}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={isMobileDrawer ? onCloseMobile : undefined}
                        title={isIconOnly ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                          isIconOnly && "justify-center px-2",
                          active
                            ? "bg-[#171717] text-white"
                            : "text-[#666666] hover:bg-[#F5F5F2] hover:text-[#171717]"
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[#FCD10C]"
                          />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active
                              ? "text-[#FCD10C]"
                              : "text-[#666666] group-hover:text-[#171717]"
                          )}
                          aria-hidden="true"
                        />
                        {!isIconOnly && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge !== undefined && (
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums",
                                  active
                                    ? "bg-[#FCD10C] text-[#080808]"
                                    : "bg-[#FFF6DF] text-[#B67C0A]"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User profile footer */}
        <div className="shrink-0 border-t border-[#EAEAE7] p-3">
          <Link
            href="/settings"
            onClick={isMobileDrawer ? onCloseMobile : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-[#F5F5F2]",
              isIconOnly && "justify-center"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FCD10C] text-xs font-bold text-[#080808]">
              {initials}
            </div>
            {!isIconOnly && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#171717]">
                  {preferences.displayName}
                </p>
                <p className="truncate text-[11px] text-[#666666]">
                  {preferences.roleTitle}
                </p>
              </div>
            )}
          </Link>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative hidden shrink-0 border-r border-[#EAEAE7] bg-white transition-[width] duration-200 lg:block",
          collapsed ? "w-[74px]" : "w-[252px]"
        )}
      >
        <div className="sticky top-0 h-screen">{renderSidebarInner(false)}</div>
      </aside>

      {/* Mobile / Tablet drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-[#080808]/40 backdrop-blur-[1px]"
          />
          <aside className="relative z-10 h-full w-[272px] max-w-[85vw] border-r border-[#EAEAE7] bg-white shadow-xl">
            {renderSidebarInner(true)}
          </aside>
        </div>
      )}
    </>
  );
}
