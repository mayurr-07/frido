"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ItemMasterBatch } from "@/types/frido";
import { formatShortDate } from "@/lib/utils";

interface OverviewChartsProps {
  batches: ItemMasterBatch[];
  totals: {
    confirmed: number;
    needsReview: number;
    conflicts: number;
    unmatched: number;
  };
}

export function OverviewCharts({ batches, totals }: OverviewChartsProps) {
  const distributionData = [
    { name: "Confirmed", value: totals.confirmed, color: "#16834A" },
    { name: "Needs Review", value: totals.needsReview, color: "#D99A16" },
    { name: "Conflicts", value: totals.conflicts, color: "#DC4545" },
    { name: "Unmatched", value: totals.unmatched, color: "#929292" },
  ].filter((entry) => entry.value > 0);

  // Trend is derived from persisted batches (oldest → newest), never hardcoded.
  const trendData = [...batches]
    .slice(0, 6)
    .reverse()
    .map((batch) => ({
      label: formatShortDate(batch.uploadDate),
      confirmed: batch.confirmedCount,
      needsReview: batch.needsReviewCount,
      conflicts: batch.conflictCount,
      unmatched: batch.unmatchedCount,
    }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-[#171717]">
              Matching activity by batch
            </h2>
            <p className="text-xs text-[#666666]">
              Persisted classification counts for the most recent imports
            </p>
          </div>
          <span className="rounded-full border border-[#EAEAE7] bg-[#FAFAF8] px-2.5 py-1 text-[11px] font-medium text-[#666666]">
            {batches.length} batch{batches.length === 1 ? "" : "es"}
          </span>
        </div>

        {trendData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed border-[#DCDCD7] bg-[#FAFAF8] text-xs text-[#666666]">
            No batches imported yet. Upload an Item Master CSV to populate this chart.
          </div>
        ) : (
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEAE7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#666666" }}
                  axisLine={{ stroke: "#EAEAE7" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#666666" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "#F5F5F2" }}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #EAEAE7",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 8px 20px rgba(8,8,8,0.06)",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill="#16834A" />
                <Bar dataKey="needsReview" name="Needs Review" stackId="a" fill="#D99A16" />
                <Bar dataKey="conflicts" name="Conflicts" stackId="a" fill="#DC4545" />
                <Bar dataKey="unmatched" name="Unmatched" stackId="a" fill="#929292" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#EAEAE7] bg-white p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-[#171717]">Status distribution</h2>
          <p className="text-xs text-[#666666]">Every processed product across all batches</p>
        </div>

        {distributionData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[#DCDCD7] bg-[#FAFAF8] text-center text-xs text-[#666666]">
            No matched products yet.
          </div>
        ) : (
          <>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {distributionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EAEAE7",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {distributionData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border border-[#EAEAE7] bg-[#FAFAF8] px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-1.5 text-[#666666]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-semibold text-[#171717] tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
