"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ActivityEvent,
  ItemMasterBatch,
  MatchResult,
  Report,
  ReportType,
  SessionProfile,
  StickerReference,
  UserPreferences,
} from "@/types/frido";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

interface BootstrapPayload {
  user: SessionProfile;
  stickers: StickerReference[];
  batches: ItemMasterBatch[];
  matches: MatchResult[];
  reports: Report[];
  activities: ActivityEvent[];
  engineVersion: string;
  authMode: "single_user" | "session";
  fetchedAt: string;
}

interface FridoStoreContextValue {
  ready: boolean;
  error: string | null;
  user: SessionProfile | null;
  engineVersion: string;
  stickers: StickerReference[];
  batches: ItemMasterBatch[];
  matches: MatchResult[];
  activeBatchId: string;
  activeBatch: ItemMasterBatch | undefined;
  reports: Report[];
  activities: ActivityEvent[];
  preferences: UserPreferences;
  toasts: ToastItem[];
  introReplayNonce: number;
  authMode: "single_user" | "session";

  refresh: () => Promise<void>;
  setActiveBatchId: (batchId: string) => void;
  uploadCsvFile: (file: File) => Promise<{ batchCode: string }>;
  uploadStickerDocument: (file: File) => Promise<{ stickerIdentifier: string; extractionStatus: string; missingFields: string[] }>;
  approveMatch: (matchId: string, stickerOverride?: StickerReference | null, note?: string) => Promise<void>;
  rejectMatch: (matchId: string, reason?: string) => Promise<void>;
  keepForLater: (matchId: string, note?: string) => Promise<void>;
  markUnmatched: (matchId: string, note?: string) => Promise<void>;
  bulkApproveMatches: (matchIds: string[]) => Promise<void>;
  createReport: (batchId: string, reportType: ReportType) => Promise<Report | null>;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
  triggerReplayIntro: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  tableDensity: "comfortable",
  defaultPageSize: 10,
  showDemoBanner: true,
  emailDigestEnabled: true,
  conflictAlertsEnabled: true,
  displayName: "",
  roleTitle: "",
  email: "",
};

const FridoStoreContext = createContext<FridoStoreContextValue | null>(null);

async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export function FridoStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string>("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [introReplayNonce, setIntroReplayNonce] = useState(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 5200);
    },
    [dismissToast]
  );

  const refresh = useCallback(async () => {
    try {
      const payload = await callApi<BootstrapPayload>("/api/bootstrap");
      setData(payload);
      setError(null);
      setActiveBatchId((current) => {
        if (current && payload.batches.some((batch) => batch.id === current)) return current;
        return payload.batches[0]?.id ?? "";
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load workspace data");
    } finally {
      setReady(true);
    }
  }, []);

  // The external workspace API is the source of truth; bootstrap it once on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const batches = useMemo(() => data?.batches ?? [], [data]);
  const matches = useMemo(() => data?.matches ?? [], [data]);
  const stickers = useMemo(() => data?.stickers ?? [], [data]);
  const reports = useMemo(() => data?.reports ?? [], [data]);
  const activities = useMemo(() => data?.activities ?? [], [data]);

  const activeBatch = useMemo(
    () => batches.find((batch) => batch.id === activeBatchId) ?? batches[0],
    [batches, activeBatchId]
  );

  const preferences = useMemo<UserPreferences>(() => {
    const stored = (data?.user ? {} : {}) as Record<string, unknown>;
    return {
      ...DEFAULT_PREFERENCES,
      ...stored,
      emailDigestEnabled: true,
      conflictAlertsEnabled: true,
      displayName: data?.user.displayName ?? "",
      roleTitle: data?.user.jobTitle ?? "",
      email: data?.user.email ?? "",
    };
  }, [data?.user]);

  const uploadCsvFile = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const result = await callApi<{ batchCode: string; matchCount: number; invalidRows: number }>(
        "/api/batches",
        { method: "POST", body: form }
      );
      await refresh();
      setActiveBatchId(result.batchCode);
      pushToast({
        title: `Batch ${result.batchCode} processed`,
        description: `${result.matchCount} valid rows matched. ${result.invalidRows} invalid row(s) excluded from matching.`,
        variant: "success",
      });
      return { batchCode: result.batchCode };
    },
    [pushToast, refresh]
  );

  const uploadStickerDocument = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const result = await callApi<{
        stickerIdentifier: string;
        extractionStatus: string;
        missingFields: string[];
      }>("/api/stickers", { method: "POST", body: form });
      await refresh();
      pushToast({
        title: `Reference ${result.stickerIdentifier} imported`,
        description:
          result.missingFields.length > 0
            ? `Extracted with ${result.missingFields.length} missing field(s): ${result.missingFields.join(", ")}.`
            : "All required fields extracted and verified.",
        variant: result.extractionStatus === "extracted" ? "success" : "warning",
      });
      return result;
    },
    [pushToast, refresh]
  );

  const reviewMatch = useCallback(
    async (matchId: string, action: "approve" | "reject" | "defer" | "mark_unmatched", stickerId?: string | null, note?: string) => {
      await callApi(`/api/matches/${encodeURIComponent(matchId)}/review`, {
        method: "POST",
        body: JSON.stringify({ action, stickerId: stickerId ?? null, note }),
      });
      await refresh();
    },
    [refresh]
  );

  const approveMatch = useCallback(
    async (matchId: string, stickerOverride?: StickerReference | null, note?: string) => {
      try {
        await reviewMatch(matchId, "approve", stickerOverride?.id ?? null, note);
        pushToast({ title: "Match approved", description: "Decision persisted with an audit trail.", variant: "success" });
      } catch (cause) {
        pushToast({
          title: "Approval blocked",
          description: cause instanceof Error ? cause.message : "Approval failed",
          variant: "danger",
        });
      }
    },
    [pushToast, reviewMatch]
  );

  const rejectMatch = useCallback(
    async (matchId: string, reason?: string) => {
      try {
        await reviewMatch(matchId, "reject", null, reason);
        pushToast({ title: "Candidate rejected", description: "Product marked Unmatched and recorded in the audit trail.", variant: "warning" });
      } catch (cause) {
        pushToast({ title: "Rejection failed", description: cause instanceof Error ? cause.message : "Request failed", variant: "danger" });
      }
    },
    [pushToast, reviewMatch]
  );

  const keepForLater = useCallback(
    async (matchId: string, note?: string) => {
      try {
        await reviewMatch(matchId, "defer", null, note ?? "Deferred for secondary verification.");
        pushToast({ title: "Kept for later", description: "Decision recorded; item stays in the review queue.", variant: "default" });
      } catch (cause) {
        pushToast({ title: "Could not defer", description: cause instanceof Error ? cause.message : "Request failed", variant: "danger" });
      }
    },
    [pushToast, reviewMatch]
  );

  const markUnmatched = useCallback(
    async (matchId: string, note?: string) => {
      try {
        await reviewMatch(matchId, "mark_unmatched", null, note);
        pushToast({ title: "Marked unmatched", description: "Product requires a new prize sticker reference.", variant: "warning" });
      } catch (cause) {
        pushToast({ title: "Action failed", description: cause instanceof Error ? cause.message : "Request failed", variant: "danger" });
      }
    },
    [pushToast, reviewMatch]
  );

  const bulkApproveMatches = useCallback(
    async (matchIds: string[]) => {
      if (matchIds.length === 0) return;
      try {
        const result = await callApi<{ approved: number; skipped: number }>("/api/matches/bulk-approve", {
          method: "POST",
          body: JSON.stringify({ matchIds }),
        });
        await refresh();
        pushToast({
          title: `${result.approved} match(es) approved`,
          description:
            result.skipped > 0
              ? `${result.skipped} item(s) were skipped because they lack a verified reference.`
              : "All selected items had verified references.",
          variant: result.skipped > 0 ? "warning" : "success",
        });
      } catch (cause) {
        pushToast({ title: "Bulk approval failed", description: cause instanceof Error ? cause.message : "Request failed", variant: "danger" });
      }
    },
    [pushToast, refresh]
  );

  const createReport = useCallback(
    async (batchId: string, reportType: ReportType) => {
      try {
        const report = await callApi<Report>("/api/reports", {
          method: "POST",
          body: JSON.stringify({ batchId, reportType }),
        });
        await refresh();
        pushToast({ title: `Report ${report.id} generated`, description: "A real PDF is available for download.", variant: "success" });
        return report;
      } catch (cause) {
        pushToast({ title: "Report generation failed", description: cause instanceof Error ? cause.message : "Request failed", variant: "danger" });
        return null;
      }
    },
    [pushToast, refresh]
  );

  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      try {
        await callApi("/api/preferences", { method: "PATCH", body: JSON.stringify(partial) });
        await refresh();
        pushToast({ title: "Preferences saved", description: "Stored against your user profile.", variant: "success" });
      } catch (cause) {
        pushToast({ title: "Could not save preferences", description: cause instanceof Error ? cause.message : "Request failed", variant: "danger" });
      }
    },
    [pushToast, refresh]
  );

  const triggerReplayIntro = useCallback(() => {
    try {
      sessionStorage.removeItem("frido_intro_seen");
    } catch {
      // ignore storage failures
    }
    setIntroReplayNonce((nonce) => nonce + 1);
  }, []);

  const value: FridoStoreContextValue = {
    ready,
    error,
    user: data?.user ?? null,
    engineVersion: data?.engineVersion ?? "",
    stickers,
    batches,
    matches,
    activeBatchId,
    activeBatch,
    reports,
    activities,
    preferences,
    toasts,
    introReplayNonce,
    authMode: data?.authMode ?? "single_user",
    refresh,
    setActiveBatchId,
    uploadCsvFile,
    uploadStickerDocument,
    approveMatch,
    rejectMatch,
    keepForLater,
    markUnmatched,
    bulkApproveMatches,
    createReport,
    updatePreferences,
    pushToast,
    dismissToast,
    triggerReplayIntro,
  };

  return <FridoStoreContext.Provider value={value}>{children}</FridoStoreContext.Provider>;
}

export function useFridoStore() {
  const context = useContext(FridoStoreContext);
  if (!context) throw new Error("useFridoStore must be used inside FridoStoreProvider");
  return context;
}
