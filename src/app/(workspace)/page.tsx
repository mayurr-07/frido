"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Clock,
  FileBarChart2,
  FileSpreadsheet,
  FileUp,
  GitCompareArrows,
  HelpCircle,
  PackageCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { BatchStatusBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { OverviewCharts } from "@/components/dashboard/OverviewCharts";
import { EmptyState } from "@/components/shared/EmptyState";
import { useFridoStore } from "@/context/FridoStoreContext";
import { formatRelativeTime, formatShortDate } from "@/lib/utils";

export default function OverviewPage() {
  const router = useRouter();
  const { batches, matches, activities, stickers, setActiveBatchId, engineVersion } = useFridoStore();

  const totalProducts = matches.length;
  const confirmedCount = matches.filter((m) => m.status === "confirmed").length;
  const needsReviewCount = matches.filter((m) => m.status === "needs_review").length;
  const conflictCount = matches.filter((m) => m.status === "conflict").length;
  const unmatchedCount = matches.filter((m) => m.status === "unmatched").length;

  const openBatchResults = (batchId: string) => {
    setActiveBatchId(batchId);
    router.push(`/matching-results?batch=${encodeURIComponent(batchId)}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Good morning"
        subtitle="Here's an overview of your product matching activity."
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAEAE7] bg-white px-3 py-1 text-xs font-medium text-[#666666]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16834A]" />
            {stickers.length} permanent sticker references indexed · engine {engineVersion || "2.0.0"}
          </span>
        }
        actions={
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#080808]"
          >
            <FileUp className="h-4 w-4 text-[#FCD10C]" />
            Upload Item Master
          </Link>
        }
      />

      {/* 4 Statistic Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Products Processed"
          value={totalProducts}
          supportingText={`Across ${batches.length} persisted CSV batch${batches.length === 1 ? "" : "es"}`}
          icon={PackageCheck}
          trendLabel={batches[0]?.id ?? "No batches"}
          accent="neutral"
        />
        <StatCard
          title="Confirmed Matches"
          value={confirmedCount}
          supportingText="Verified against Word prize stickers"
          icon={CheckCircle2}
          trendLabel={`${Math.round((confirmedCount / Math.max(1, totalProducts)) * 100)}% of total`}
          accent="success"
        />
        <StatCard
          title="Needs Review"
          value={needsReviewCount}
          supportingText="Awaiting manual side-by-side sign-off"
          icon={Clock}
          accent="warning"
          onClick={() => router.push("/review-matches")}
        />
        <StatCard
          title="Conflicts"
          value={conflictCount}
          supportingText="MRP, Net Qty, or multiple reference alerts"
          icon={AlertTriangle}
          accent="danger"
          onClick={() => router.push("/matching-results?status=conflict")}
        />
        <StatCard
          title="Unmatched"
          value={unmatchedCount}
          supportingText="New SKUs without a sticker reference"
          icon={HelpCircle}
          accent="neutral"
          onClick={() => router.push("/matching-results?status=unmatched")}
        />
      </div>

      {batches.length === 0 && (
        <EmptyState
          icon={FileUp}
          title="No Item Master batches yet"
          description="Upload your first Item Master CSV to run deterministic matching against the permanent sticker library. Dashboard metrics, trends and recent activity will populate from persisted data."
          action={
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-[9px] bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#080808]"
            >
              <FileUp className="h-3.5 w-3.5 text-[#FCD10C]" />
              Upload Item Master
            </Link>
          }
        />
      )}

      {/* Charts */}
      <OverviewCharts
        batches={batches}
        totals={{
          confirmed: confirmedCount,
          needsReview: needsReviewCount,
          conflicts: conflictCount,
          unmatched: unmatchedCount,
        }}
      />

      {/* Bottom Operational Grid: Recent Batches + Activity & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent Batches Table */}
        <div className="rounded-2xl border border-[#EAEAE7] bg-white xl:col-span-2">
          <div className="flex items-center justify-between border-b border-[#EAEAE7] px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[#171717]">Recent Batches</h2>
              <p className="text-xs text-[#666666]">
                Each Item Master CSV upload is tracked as an independent batch
              </p>
            </div>
            <Link
              href="/batch-history"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#171717] hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-[#EAEAE7] bg-[#FAFAF8] text-xs text-[#666666]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Batch ID</th>
                  <th className="px-4 py-3 font-semibold">File Name</th>
                  <th className="px-4 py-3 font-semibold">Upload Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-right">Confirmed</th>
                  <th className="px-4 py-3 font-semibold text-right">Review</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAE7]">
                {batches.slice(0, 5).map((batch) => (
                  <tr key={batch.id} className="transition-colors hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#171717] whitespace-nowrap">
                      {batch.id}
                    </td>
                    <td className="max-w-[210px] truncate px-4 py-3 font-medium text-[#171717]">
                      {batch.csvFilename}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666] whitespace-nowrap">
                      {formatShortDate(batch.uploadDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#171717] tabular-nums">
                      {batch.totalProducts}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#16834A] tabular-nums">
                      {batch.confirmedCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#B67C0A] tabular-nums">
                      {batch.needsReviewCount + batch.conflictCount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <BatchStatusBadge status={batch.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openBatchResults(batch.id)}
                        className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] transition-colors hover:border-[#171717] hover:bg-[#F5F5F2]"
                      >
                        Open Results
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Quick Actions + Recent Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
            <h2 className="text-[15px] font-semibold text-[#171717]">Quick Actions</h2>
            <p className="mt-0.5 text-xs text-[#666666]">
              Jump directly to core operational workflows
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Link
                href="/upload"
                className="flex items-center justify-between rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] px-3.5 py-2.5 text-sm font-medium text-[#171717] transition-colors hover:border-[#171717] hover:bg-[#FCD10C]/15"
              >
                <span className="flex items-center gap-2.5">
                  <FileUp className="h-4 w-4 text-[#171717]" />
                  Upload new Item Master
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#666666]" />
              </Link>
              <Link
                href="/matching-results"
                className="flex items-center justify-between rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] px-3.5 py-2.5 text-sm font-medium text-[#171717] transition-colors hover:border-[#171717] hover:bg-[#F5F5F2]"
              >
                <span className="flex items-center gap-2.5">
                  <GitCompareArrows className="h-4 w-4 text-[#171717]" />
                  View Matching Results
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#666666]" />
              </Link>
              <Link
                href="/sticker-library"
                className="flex items-center justify-between rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] px-3.5 py-2.5 text-sm font-medium text-[#171717] transition-colors hover:border-[#171717] hover:bg-[#F5F5F2]"
              >
                <span className="flex items-center gap-2.5">
                  <BookMarked className="h-4 w-4 text-[#171717]" />
                  Open Sticker Library
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#666666]" />
              </Link>
              <Link
                href="/reports"
                className="flex items-center justify-between rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] px-3.5 py-2.5 text-sm font-medium text-[#171717] transition-colors hover:border-[#171717] hover:bg-[#F5F5F2]"
              >
                <span className="flex items-center gap-2.5">
                  <FileBarChart2 className="h-4 w-4 text-[#171717]" />
                  View Reports
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#666666]" />
              </Link>
            </div>
          </div>


          {/* Pending review queue */}
          <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-[#171717]">Pending review queue</h2>
                <p className="mt-0.5 text-xs text-[#666666]">
                  Products awaiting a human decision
                </p>
              </div>
              <Link
                href="/review-matches"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#171717] hover:underline"
              >
                Review
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-[#EAEAE7]">
              {matches
                .filter((match) => match.status === "needs_review" || match.status === "conflict")
                .slice(0, 4)
                .map((match) => (
                  <Link
                    key={match.id}
                    href={`/review-matches?match=${encodeURIComponent(match.id)}`}
                    className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[11px] font-medium text-[#171717]">
                        {match.product.productCode}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#666666]">
                        {match.reviewReason ?? match.matchingRuleApplied}
                      </span>
                    </span>
                    <StatusBadge status={match.status} />
                  </Link>
                ))}
              {matches.filter((match) => match.status === "needs_review" || match.status === "conflict")
                .length === 0 && (
                <p className="py-2 text-xs text-[#666666]">
                  No products are awaiting review. Every classification is resolved.
                </p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
            <h2 className="text-[15px] font-semibold text-[#171717]">Recent Activity</h2>
            <p className="mt-0.5 text-xs text-[#666666]">
              Latest imports, reviews, and report previews
            </p>
            <div className="mt-4 divide-y divide-[#EAEAE7]">
              {activities.slice(0, 5).map((act) => {
                const Icon =
                  act.type === "csv_uploaded"
                    ? FileSpreadsheet
                    : act.type === "report_generated"
                    ? FileBarChart2
                    : act.type === "match_rejected"
                    ? AlertTriangle
                    : CheckCircle2;
                const colorCls =
                  act.type === "match_rejected"
                    ? "bg-[#FFF6DF] text-[#B67C0A]"
                    : act.type === "report_generated"
                    ? "bg-[#EDF4FE] text-[#3976CB]"
                    : act.type === "match_approved"
                    ? "bg-[#EAF5EE] text-[#16834A]"
                    : "bg-[#F5F5F2] text-[#171717]";

                return (
                  <div key={act.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorCls}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#171717]">{act.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#666666]">
                        {act.description}
                      </p>
                      <span className="mt-1 block text-[10.5px] text-[#929292]">
                        {act.actor} · {formatRelativeTime(act.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
