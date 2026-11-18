"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Columns3,
  Download,
  Eye,
  FileSearch,
  HelpCircle,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import type { MatchResult, MatchStatus, MatchType, Report } from "@/types/frido";
import { useFridoStore } from "@/context/FridoStoreContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  BatchStatusBadge,
  MatchTypeBadge,
  StatusBadge,
} from "@/components/shared/StatusBadge";
import { SearchInput } from "@/components/shared/SearchInput";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableLoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MatchDetailDrawer } from "@/components/matching/MatchDetailDrawer";
import { ReportPreviewModal } from "@/components/reports/ReportPreviewModal";
import { cn, formatCurrency, formatDateTime, formatShortDate } from "@/lib/utils";

type StatusTab = "all" | MatchStatus;

const columnHelper = createColumnHelper<MatchResult>();

function MatchingResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    batches,
    matches,
    activeBatchId,
    setActiveBatchId,
    preferences,
    bulkApproveMatches,
    createReport,
    serverMatches,
    matchPage,
    matchPageSize,
    matchTotalCount,
    matchAggregations,
    matchesLoading,
    fetchMatchPage,
  } = useFridoStore();

  const paramBatch = searchParams.get("batch");
  const paramStatus = searchParams.get("status") as StatusTab | null;
  const paramQuery = searchParams.get("q");

  useEffect(() => {
    if (paramBatch && batches.some((b) => b.id === paramBatch)) {
      setActiveBatchId(paramBatch);
    }
  }, [paramBatch, batches, setActiveBatchId]);

  const [statusFilter, setStatusFilter] = useState<StatusTab>(
    paramStatus && ["all", "confirmed", "needs_review", "conflict", "unmatched"].includes(paramStatus)
      ? paramStatus
      : "all"
  );
  const [matchTypeFilter, setMatchTypeFilter] = useState<"all" | MatchType>("all");
  const [globalQuery, setGlobalQuery] = useState(paramQuery ?? "");
  const [codeQuery, setCodeQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [viewModeState, setViewModeState] = useState<"ready" | "loading" | "error">("ready");

  const currentBatch = useMemo(
    () => batches.find((b) => b.id === activeBatchId) ?? batches[0],
    [batches, activeBatchId]
  );

  // Debounce global search query for server-side fetch
  const [debouncedQuery, setDebouncedQuery] = useState(globalQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(globalQuery), 300);
    return () => clearTimeout(timer);
  }, [globalQuery]);

  // Trigger server fetch when status or debounced query changes
  useEffect(() => {
    if (currentBatch) {
      const batchUuid = currentBatch.uuid ?? currentBatch.id;
      void fetchMatchPage(batchUuid, {
        page: 1,
        pageSize: matchPageSize,
        status: statusFilter !== "all" ? statusFilter : undefined,
        q: debouncedQuery || undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedQuery, currentBatch?.uuid, currentBatch?.id]);

  // Sync selected drawer item with live server matches
  const liveSelectedMatch = useMemo(
    () =>
      selectedMatch
        ? (serverMatches.find((m) => m.id === selectedMatch.id) ?? matches.find((m) => m.id === selectedMatch.id) ?? null)
        : null,
    [selectedMatch, serverMatches, matches]
  );

  // Status card counts — from full-batch aggregations (server-side, not page-limited)
  const counts = useMemo(() => {
    if (matchAggregations) {
      return {
        all: matchAggregations.all,
        confirmed: matchAggregations.confirmed,
        needs_review: matchAggregations.needs_review,
        conflict: matchAggregations.conflict,
        unmatched: matchAggregations.unmatched,
      };
    }
    // Fallback to bootstrap data while aggregations load
    const batchMatches = matches.filter((m) => m.batchId === currentBatch?.id);
    return {
      all: batchMatches.length,
      confirmed: batchMatches.filter((m) => m.status === "confirmed").length,
      needs_review: batchMatches.filter((m) => m.status === "needs_review").length,
      conflict: batchMatches.filter((m) => m.status === "conflict").length,
      unmatched: batchMatches.filter((m) => m.status === "unmatched").length,
    };
  }, [matchAggregations, matches, currentBatch?.id]);

  // For the table, apply client-side match-type filter and code filter to serverMatches
  const filteredData = useMemo(() => {
    const cq = codeQuery.trim().toLowerCase();
    return serverMatches.filter((row) => {
      if (matchTypeFilter !== "all" && row.matchType !== matchTypeFilter) return false;
      if (cq && !row.product.productCode.toLowerCase().includes(cq)) return false;
      return true;
    });
  }, [serverMatches, matchTypeFilter, codeQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(matchTotalCount / matchPageSize));

  const goToPage = (page: number) => {
    if (!currentBatch) return;
    const batchUuid = currentBatch.uuid ?? currentBatch.id;
    void fetchMatchPage(batchUuid, {
      page,
      pageSize: matchPageSize,
      status: statusFilter !== "all" ? statusFilter : undefined,
      q: debouncedQuery || undefined,
    });
  };

  // Clear selection when batch or filter changes
  useEffect(() => {
    setRowSelection({});
  }, [currentBatch?.id, statusFilter, matchTypeFilter, globalQuery, codeQuery]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all visible rows"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 rounded border-[#DCDCD7] accent-[#171717]"
          />
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              aria-label={`Select ${row.original.product.productCode}`}
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              className="h-4 w-4 rounded border-[#DCDCD7] accent-[#171717]"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      }),
      columnHelper.accessor((row) => row.product.productCode, {
        id: "productCode",
        header: "Product Code",
        cell: (info) => (
          <div className="font-mono text-xs font-semibold text-[#171717] whitespace-nowrap">
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.product.name, {
        id: "productName",
        header: "Product Name",
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="min-w-[200px] max-w-[280px]">
              <p className="truncate text-[13px] font-medium text-[#171717]">
                {item.product.name}
              </p>
              <p className="mt-0.5 text-[11px] text-[#666666] tabular-nums">
                {formatCurrency(item.product.mrp)}
                {item.product.size ? ` · ${item.product.size}` : ""}
              </p>
            </div>
          );
        },
      }),
      columnHelper.accessor(
        (row) => row.matchedSticker?.stickerIdentifier ?? "Unlinked",
        {
          id: "stickerReference",
          header: "Sticker Reference",
          cell: (info) => {
            const sticker = info.row.original.matchedSticker;
            if (!sticker) {
              return <span className="text-xs text-[#929292]">No reference</span>;
            }
            return (
              <div className="min-w-[160px] max-w-[230px]">
                <p className="font-mono text-xs font-medium text-[#171717]">
                  {sticker.stickerIdentifier}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[#666666]">
                  {sticker.documentName}
                </p>
              </div>
            );
          },
        }
      ),
      columnHelper.accessor("matchType", {
        id: "matchType",
        header: "Match Type",
        cell: (info) => <MatchTypeBadge matchType={info.getValue()} />,
      }),
      columnHelper.accessor(
        (row) => row.evidence[0]?.title ?? row.matchingRuleApplied,
        {
          id: "matchEvidence",
          header: "Match Evidence",
          cell: (info) => {
            const row = info.row.original;
            const primaryEvidence = row.evidence[0];
            return (
              <div className="min-w-[190px] max-w-[260px]">
                <p className="truncate text-xs font-medium text-[#171717]">
                  {primaryEvidence?.title ?? row.matchingRuleApplied}
                </p>
                {row.evidence.length > 1 && (
                  <p className="mt-0.5 text-[11px] text-[#666666]">
                    +{row.evidence.length - 1} additional evidence note(s)
                  </p>
                )}
              </div>
            );
          },
        }
      ),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("lastUpdated", {
        id: "lastUpdated",
        header: "Last Updated",
        cell: (info) => (
          <span className="text-xs text-[#666666] whitespace-nowrap tabular-nums">
            {formatDateTime(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedMatch(row.original)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] transition-colors hover:border-[#171717] hover:bg-[#F5F5F2]"
            >
              <Eye className="h-3.5 w-3.5" />
              Inspect
            </button>
            {(row.original.status === "needs_review" ||
              row.original.status === "conflict") && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/review-matches?match=${encodeURIComponent(row.original.id)}`
                  )
                }
                title="Open in Review Workspace"
                className="inline-flex items-center gap-1 rounded-lg bg-[#FCD10C] px-2.5 py-1 text-xs font-semibold text-[#080808] transition-colors hover:bg-[#F2C700]"
              >
                Review
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ),
        enableHiding: false,
      }),
    ],
    [router]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
    },
    initialState: {
      pagination: {
        // Show all rows on the current server page; server controls actual paging
        pageSize: 100,
      },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  const selectedRowIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const approvableSelectedIds = selectedRowIds.filter((id) => {
    const found = serverMatches.find((m) => m.id === id) ?? matches.find((m) => m.id === id);
    return found && found.matchedSticker && found.status !== "confirmed" && found.status !== "conflict";
  });

  const handleDownloadReport = async () => {
    if (!currentBatch || generatingReport) return;
    setGeneratingReport(true);
    try {
      const report = await createReport(currentBatch.id, "complete_report");
      if (report) setPreviewReport(report);
    } finally {
      setGeneratingReport(false);
    }
  };

  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: "all", label: "All Products", count: counts.all },
    { key: "confirmed", label: "Confirmed", count: counts.confirmed },
    { key: "needs_review", label: "Needs Review", count: counts.needs_review },
    { key: "conflict", label: "Conflicts", count: counts.conflict },
    { key: "unmatched", label: "Unmatched", count: counts.unmatched },
  ];

  const cellPadding =
    preferences.tableDensity === "compact" ? "px-3.5 py-2.5" : "px-4 py-3.5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Matching Results"
        subtitle="Review product matches between the Item Master and Frido's sticker reference library."
        meta={
          currentBatch && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 font-mono text-xs font-semibold text-[#171717]">
                {currentBatch.id}
              </span>
              <span className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs text-[#666666]">
                {currentBatch.csvFilename}
              </span>
              <span className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs text-[#666666]">
                Uploaded {formatShortDate(currentBatch.uploadDate)}
              </span>
              <BatchStatusBadge status={currentBatch.status} />
              <span className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] tabular-nums">
                {currentBatch.validRows} valid · {currentBatch.invalidRows} rejected
              </span>
              <span className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 font-mono text-[11px] text-[#666666]">
                engine {currentBatch.engineVersion}
              </span>
            </>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Select Item Master Batch"
              value={currentBatch?.id ?? ""}
              onChange={(e) => {
                const newBatchId = e.target.value;
                setActiveBatchId(newBatchId);
                const target = batches.find((b) => b.id === newBatchId || b.uuid === newBatchId);
                if (target) {
                  void fetchMatchPage(target.uuid ?? target.id, {
                    page: 1,
                    pageSize: matchPageSize,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                    q: debouncedQuery || undefined,
                  });
                }
              }}
              className="h-10 rounded-[9px] border border-[#DCDCD7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} — {b.csvFilename}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleDownloadReport()}
              disabled={generatingReport}
              aria-busy={generatingReport}
              className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-[#171717] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#080808] disabled:opacity-60"
            >
              {generatingReport ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#FCD10C]" />
              ) : (
                <Download className="h-4 w-4 text-[#FCD10C]" />
              )}
              {generatingReport ? "Preparing report…" : "Download Report"}
            </button>
          </div>
        }
      />

      {currentBatch && currentBatch.invalidRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F3DFAB] bg-[#FFF6DF] px-4 py-2.5 text-xs text-[#7D5606]">
          <span>
            <strong>{currentBatch.invalidRows} row(s)</strong> were rejected at import and never
            entered matching. Review or download the import error report.
          </span>
          <a
            href={`/api/batches/${encodeURIComponent(currentBatch.id)}?format=errors`}
            className="rounded-lg border border-[#F3DFAB] bg-white px-2.5 py-1.5 font-semibold text-[#7D5606] hover:bg-[#FFF6DF]"
          >
            Download import errors
          </a>
        </div>
      )}

      {currentBatch && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#666666]">
          <a
            href={`/api/batches/${encodeURIComponent(currentBatch.id)}?format=csv`}
            className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 font-medium text-[#171717] hover:bg-[#F5F5F2]"
          >
            Download original CSV
          </a>
          <span className="rounded-lg border border-[#EAEAE7] bg-white px-2.5 py-1 font-mono text-[11px]">
            {currentBatch.csvFilename}
          </span>
        </div>
      )}

      {/* 4 Clickable Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard
          title="Confirmed"
          value={counts.confirmed}
          supportingText="Verified sticker links"
          icon={CheckCircle2}
          accent="success"
          active={statusFilter === "confirmed"}
          onClick={() =>
            setStatusFilter((prev) => (prev === "confirmed" ? "all" : "confirmed"))
          }
        />
        <StatCard
          title="Needs Review"
          value={counts.needs_review}
          supportingText="Click to filter review items"
          icon={Clock}
          accent="warning"
          active={statusFilter === "needs_review"}
          onClick={() =>
            setStatusFilter((prev) =>
              prev === "needs_review" ? "all" : "needs_review"
            )
          }
        />
        <StatCard
          title="Conflicts"
          value={counts.conflict}
          supportingText="MRP or multi-sticker alerts"
          icon={AlertTriangle}
          accent="danger"
          active={statusFilter === "conflict"}
          onClick={() =>
            setStatusFilter((prev) => (prev === "conflict" ? "all" : "conflict"))
          }
        />
        <StatCard
          title="Unmatched"
          value={counts.unmatched}
          supportingText="No reference found"
          icon={HelpCircle}
          accent="neutral"
          active={statusFilter === "unmatched"}
          onClick={() =>
            setStatusFilter((prev) => (prev === "unmatched" ? "all" : "unmatched"))
          }
        />
      </div>

      {/* Status Tabs + Table Surface */}
      <div className="rounded-2xl border border-[#EAEAE7] bg-white">
        {/* Status Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto border-b border-[#EAEAE7] px-4 pt-3">
          <div className="flex items-center gap-1" role="tablist" aria-label="Match statuses">
            {tabs.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    "relative inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    active
                      ? "border-[#171717] text-[#171717]"
                      : "border-transparent text-[#666666] hover:text-[#171717]"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] tabular-nums",
                      active
                        ? "bg-[#171717] text-white"
                        : "bg-[#F0F0ED] text-[#666666]"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Subtle state preview switcher for QA */}
          <div className="hidden items-center gap-1 pb-2 text-[11px] text-[#929292] xl:flex">
            <span>State:</span>
            {(["ready", "loading", "error"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewModeState(mode)}
                className={cn(
                  "rounded px-1.5 py-0.5 capitalize",
                  viewModeState === mode
                    ? "bg-[#F0F0ED] font-semibold text-[#171717]"
                    : "hover:text-[#171717]"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col justify-between gap-3 border-b border-[#EAEAE7] bg-[#FAFAF8]/70 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <SearchInput
              value={globalQuery}
              onChange={setGlobalQuery}
              placeholder="Search product name, sticker, or evidence..."
              className="w-full sm:w-72"
              ariaLabel="Global matching results search"
            />

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((o) => !o)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] sm:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>

            <div
              className={cn(
                "w-full flex-wrap items-center gap-2.5 sm:flex sm:w-auto",
                mobileFiltersOpen ? "flex" : "hidden"
              )}
            >
              <input
                type="text"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder="Filter Product Code..."
                aria-label="Filter by Product Code"
                className="h-9 w-full rounded-[9px] border border-[#EAEAE7] bg-white px-3 font-mono text-xs text-[#171717] placeholder:font-sans placeholder:text-[#929292] focus:border-[#171717] focus:outline-none sm:w-44"
              />

              <select
                aria-label="Filter by Match Type"
                value={matchTypeFilter}
                onChange={(e) =>
                  setMatchTypeFilter(e.target.value as "all" | MatchType)
                }
                className="h-9 w-full rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] focus:border-[#171717] focus:outline-none sm:w-auto"
              >
                <option value="all">All Match Types</option>
                <option value="exact_identifier">Exact Identifier</option>
                <option value="approved_family">Approved Family</option>
                <option value="attribute_candidate">Attribute Candidate</option>
                <option value="multiple_candidates">Multiple Candidates</option>
                <option value="no_reference">No Reference</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Column visibility toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setColMenuOpen((o) => !o)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717] transition-colors hover:bg-[#F5F5F2]"
              >
                <Columns3 className="h-3.5 w-3.5 text-[#666666]" />
                Columns
              </button>

              {colMenuOpen && (
                <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-xl border border-[#EAEAE7] bg-white p-2 shadow-lg">
                  {table
                    .getAllLeafColumns()
                    .filter((col) => col.getCanHide())
                    .map((col) => (
                      <label
                        key={col.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#171717] hover:bg-[#F5F5F2]"
                      >
                        <input
                          type="checkbox"
                          checked={col.getIsVisible()}
                          onChange={col.getToggleVisibilityHandler()}
                          className="h-3.5 w-3.5 accent-[#171717]"
                        />
                        <span className="capitalize">
                          {col.id.replace(/([A-Z])/g, " $1")}
                        </span>
                      </label>
                    ))}
                </div>
              )}
            </div>

            {(statusFilter !== "all" ||
              matchTypeFilter !== "all" ||
              globalQuery ||
              codeQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setMatchTypeFilter("all");
                  setGlobalQuery("");
                  setCodeQuery("");
                }}
                className="text-xs font-medium text-[#666666] hover:text-[#171717]"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedRowIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3DFAB] bg-[#FFF6DF] px-4 py-2.5 text-xs">
            <span className="font-semibold text-[#171717] tabular-nums">
              {selectedRowIds.length} product(s) selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {approvableSelectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBulkConfirmOpen(true)}
                  className="rounded-lg bg-[#16834A] px-3 py-1.5 font-semibold text-white hover:bg-[#126B3C]"
                >
                  Approve Eligible ({approvableSelectedIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/review-matches?match=${encodeURIComponent(selectedRowIds[0])}`
                  )
                }
                className="rounded-lg border border-[#DCDCD7] bg-white px-3 py-1.5 font-medium text-[#171717] hover:bg-[#F5F5F2]"
              >
                Open in Review Workspace
              </button>
              <button
                type="button"
                onClick={() => setRowSelection({})}
                className="px-2 py-1 font-medium text-[#666666] hover:text-[#171717]"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table Content Area */}
        {viewModeState === "loading" || matchesLoading ? (
          <div className="p-4">
            <TableLoadingSkeleton rows={6} />
          </div>
        ) : viewModeState === "error" ? (
          <div className="p-6">
            <ErrorState onRetry={() => setViewModeState("ready")} />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileSearch}
              title={
                matchTotalCount === 0
                  ? "No matching records in this batch"
                  : "No matching products found"
              }
              description={
                matchTotalCount === 0
                  ? "Upload an Item Master CSV to populate matching results."
                  : "Try adjusting your search query, Product Code filter, or selected status tab."
              }
              action={
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setMatchTypeFilter("all");
                    setGlobalQuery("");
                    setCodeQuery("");
                  }}
                  className="rounded-[9px] border border-[#DCDCD7] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F5F5F2]"
                >
                  Clear All Filters
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 border-b border-[#EAEAE7] bg-[#FAFAF8] text-xs text-[#666666]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        return (
                          <th
                            key={header.id}
                            className="px-4 py-3 font-semibold whitespace-nowrap"
                          >
                            {header.isPlaceholder ? null : canSort ? (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className="inline-flex items-center gap-1 hover:text-[#171717]"
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                <ArrowDownUp className="h-3 w-3 text-[#929292]" />
                              </button>
                            ) : (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-[#EAEAE7]">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedMatch(row.original)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-[#FAFAF8]",
                        row.getIsSelected() && "bg-[#FCD10C]/10"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={cellPadding}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-[#EAEAE7] px-4 py-3 sm:flex-row">
              <span className="text-xs text-[#666666] tabular-nums">
                Page <strong>{matchPage}</strong> of <strong>{totalPages}</strong>
                {" "}({matchTotalCount} total records · {matchPageSize} per page)
                {matchesLoading && (
                  <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-[#929292]" />
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={matchPage <= 1 || matchesLoading}
                  onClick={() => goToPage(matchPage - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={matchPage >= totalPages || matchesLoading}
                  onClick={() => goToPage(matchPage + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#EAEAE7] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Match Detail Drawer */}
      <MatchDetailDrawer
        match={liveSelectedMatch}
        onClose={() => setSelectedMatch(null)}
      />

      {/* Bulk Approve Confirmation */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={() => {
          void bulkApproveMatches(approvableSelectedIds).then(() => {
            setRowSelection({});
            if (currentBatch) {
              const batchUuid = currentBatch.uuid ?? currentBatch.id;
              void fetchMatchPage(batchUuid, {
                page: matchPage,
                pageSize: matchPageSize,
                status: statusFilter !== "all" ? statusFilter : undefined,
                q: debouncedQuery || undefined,
              });
            }
          });
        }}
        title={`Approve ${approvableSelectedIds.length} selected product(s)?`}
        description="Only selected items that already have a verified candidate sticker reference and no conflicts will be marked Confirmed."
        confirmLabel="Approve Selected"
        variant="approve"
      />

      {/* Report Preview Modal */}
      <ReportPreviewModal
        report={previewReport}
        onClose={() => setPreviewReport(null)}
      />
    </motion.div>
  );
}

export default function MatchingResultsPage() {
  return (
    <Suspense fallback={<TableLoadingSkeleton rows={8} />}>
      <MatchingResultsContent />
    </Suspense>
  );
}
