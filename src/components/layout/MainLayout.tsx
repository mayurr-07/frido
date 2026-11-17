"use client";

import React, { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { IntroLoader } from "./IntroLoader";
import { ToastContainer } from "@/components/shared/ToastContainer";
import { WorkspaceSkeleton } from "@/components/shared/WorkspaceSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useFridoStore } from "@/context/FridoStoreContext";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { ready, error, refresh } = useFridoStore();

  return (
    <>
      <IntroLoader />
      <div className="flex min-h-screen bg-[#FAFAF8] text-[#171717]">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {!ready ? (
              <WorkspaceSkeleton />
            ) : error ? (
              <div className="space-y-4">
                <ErrorState
                  title="Unable to load workspace data"
                  description={error}
                  onRetry={() => void refresh()}
                />
                <p className="text-center text-xs text-[#929292]">
                  If this repeats, confirm DATABASE_URL is reachable and the seed script has run.
                </p>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
