"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  Bell,
  Database,
  FileCheck2,
  Loader2,
  Monitor,
  Shield,
  Sliders,
  Sparkles,
  UploadCloud,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFridoStore } from "@/context/FridoStoreContext";
import { formatDateTime } from "@/lib/utils";

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  roleTitle: z.string().min(2, "Role title is required"),
  email: z.string().email("Enter a valid corporate email address"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const MATCHING_RULES = [
  { id: "R1", label: "Exact approved product-to-sticker mapping", note: "Requires a human-approved mapping row; blocked by duplicate identifiers or MRP contradictions." },
  { id: "R2", label: "Exact verified sticker identifier", note: "Product code or scan identifier must equal the extracted identifier; collisions are flagged." },
  { id: "R3", label: "Explicit product-family mapping", note: "Only patterns approved by an administrator. Variant differences downgrade to review." },
  { id: "R4", label: "Attribute-based candidate", note: "Similarity can select candidates but can never auto-confirm a product." },
  { id: "R5", label: "No sufficiently relevant reference", note: "Classified Unmatched and kept out of approval workflows." },
];

type SystemHealth = {
  counts: {
    batches: number;
    products: number;
    matches: number;
    stickers: number;
    documents: number;
    conflicts: number;
    decisions: number;
    reports: number;
  };
  engineVersion: string;
  database: string;
  nodeEnv: string;
  lastBatchAt: string | null;
};

type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  role: "super_admin" | "employee";
  isActive: boolean;
  createdAt: string;
};

function ScopePill({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        active
          ? "border-[#CBE7D5] bg-[#EAF5EE] text-[#16834A]"
          : "border-[#EAEAE7] bg-[#F5F5F2] text-[#666666]"
      }`}
    >
      {label ?? (active ? "Persisted" : "Backend pending")}
    </span>
  );
}

export default function SettingsPage() {
  const {
    preferences,
    updatePreferences,
    triggerReplayIntro,
    user,
    engineVersion,
    stickers,
    uploadStickerDocument,
    ready,
  } = useFridoStore();

  const isAdmin = user?.role === "super_admin";
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[] | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: preferences.displayName,
      roleTitle: preferences.roleTitle,
      email: preferences.email,
    },
  });

  useEffect(() => {
    reset({
      displayName: preferences.displayName,
      roleTitle: preferences.roleTitle,
      email: preferences.email,
    });
  }, [preferences.displayName, preferences.roleTitle, preferences.email, reset]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const [systemResponse, usersResponse] = await Promise.all([
          fetch("/api/system", { cache: "no-store" }),
          fetch("/api/users", { cache: "no-store" }),
        ]);
        const system = (await systemResponse.json()) as { error?: string } & Partial<SystemHealth>;
        const usersPayload = (await usersResponse.json()) as { error?: string; users?: ManagedUser[] };
        if (!systemResponse.ok) throw new Error(system?.error ?? "Unable to load system health");
        if (!usersResponse.ok) throw new Error(usersPayload?.error ?? "Unable to load users");
        if (!cancelled) {
          setHealth(system as SystemHealth);
          setManagedUsers((usersPayload.users ?? []) as ManagedUser[]);
        }
      } catch (error) {
        if (!cancelled) {
          setAdminError(error instanceof Error ? error.message : "Administration data unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const onSaveProfile = async (data: ProfileFormValues) => {
    await updatePreferences(data);
  };

  const handleDocx = async (file: File) => {
    setUploadingDoc(true);
    try {
      await uploadStickerDocument(file);
    } finally {
      setUploadingDoc(false);
    }
  };

  const seedReferences = stickers.filter((sticker) => sticker.documentSource === "seed_demo").length;
  const uploadedReferences = stickers.length - seedReferences;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      <PageHeader
        title="Settings"
        subtitle="Profile, workspace preferences and administration. Every change is stored against your user record."
      />

      {!ready && (
        <div className="rounded-xl border border-[#EAEAE7] bg-white px-4 py-2.5 text-xs text-[#666666]">
          Loading your stored profile…
        </div>
      )}

      {/* Profile */}
      <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE7] pb-4">
          <div className="flex items-center gap-2.5">
            <User className="h-4.5 w-4.5 text-[#171717]" />
            <div>
              <h2 className="text-sm font-semibold text-[#171717]">User profile</h2>
              <p className="text-xs text-[#666666]">
                Reviewer identity attached to every persisted approval decision
              </p>
            </div>
          </div>
          <ScopePill active />
        </div>

        <form onSubmit={handleSubmit(onSaveProfile)} className="mt-5 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[#171717]">
              Full name
              <input
                {...register("displayName")}
                className="mt-1.5 h-10 w-full rounded-[9px] border border-[#EAEAE7] px-3 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
              />
              {errors.displayName && (
                <span className="mt-1 block text-xs text-[#DC4545]">{errors.displayName.message}</span>
              )}
            </label>

            <label className="block text-xs font-medium text-[#171717]">
              Role title
              <input
                {...register("roleTitle")}
                className="mt-1.5 h-10 w-full rounded-[9px] border border-[#EAEAE7] px-3 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
              />
              {errors.roleTitle && (
                <span className="mt-1 block text-xs text-[#DC4545]">{errors.roleTitle.message}</span>
              )}
            </label>

            <label className="block text-xs font-medium text-[#171717] sm:col-span-2">
              Work email
              <input
                {...register("email")}
                type="email"
                className="mt-1.5 h-10 w-full rounded-[9px] border border-[#EAEAE7] px-3 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
              />
              {errors.email && (
                <span className="mt-1 block text-xs text-[#DC4545]">{errors.email.message}</span>
              )}
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#929292]">
              {isSubmitSuccessful ? "Saved to the database." : `Role: ${user?.role ?? "—"}`}
            </span>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-[9px] bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#080808] disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      {/* Preferences */}
      <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE7] pb-4">
          <div className="flex items-center gap-2.5">
            <Monitor className="h-4.5 w-4.5 text-[#171717]" />
            <div>
              <h2 className="text-sm font-semibold text-[#171717]">Workspace preferences</h2>
              <p className="text-xs text-[#666666]">Stored on your user record in PostgreSQL</p>
            </div>
          </div>
          <ScopePill active />
        </div>

        <div className="mt-4 divide-y divide-[#EAEAE7]">
          <div className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Matching table density</p>
              <p className="text-xs text-[#666666]">Row padding across Matching Results</p>
            </div>
            <div className="inline-flex rounded-[9px] border border-[#EAEAE7] bg-[#FAFAF8] p-0.5 text-xs">
              {(["comfortable", "compact"] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => void updatePreferences({ tableDensity: density })}
                  className={`rounded-[7px] px-3 py-1.5 font-medium capitalize transition-colors ${
                    preferences.tableDensity === density
                      ? "bg-[#171717] text-white"
                      : "text-[#666666] hover:text-[#171717]"
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Default page size</p>
              <p className="text-xs text-[#666666]">Initial rows per page on matching tables</p>
            </div>
            <select
              aria-label="Default table page size"
              value={preferences.defaultPageSize}
              onChange={(event) =>
                void updatePreferences({
                  defaultPageSize: Number(event.target.value) as 10 | 20 | 50,
                })
              }
              className="h-9 rounded-[9px] border border-[#EAEAE7] bg-white px-3 text-xs font-medium text-[#171717]"
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>

          <div className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Environment indicator</p>
              <p className="text-xs text-[#666666]">Show the active batch and engine in the top bar</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.showDemoBanner}
              onClick={() => void updatePreferences({ showDemoBanner: !preferences.showDemoBanner })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                preferences.showDemoBanner ? "bg-[#171717]" : "bg-[#DCDCD7]"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                  preferences.showDemoBanner ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col justify-between gap-3 pt-3.5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Cinematic brand opening</p>
              <p className="text-xs text-[#666666]">
                Replay the first-launch sequence (session scoped, reduced-motion aware)
              </p>
            </div>
            <button
              type="button"
              onClick={triggerReplayIntro}
              className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#FCD10C] px-3.5 py-2 text-xs font-semibold text-[#080808] hover:bg-[#F2C700]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Replay brand intro
            </button>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE7] pb-4">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4.5 w-4.5 text-[#171717]" />
            <div>
              <h2 className="text-sm font-semibold text-[#171717]">Notifications</h2>
              <p className="text-xs text-[#666666]">
                Preferences are saved; email delivery requires the mail provider integration
              </p>
            </div>
          </div>
          <ScopePill active={false} label="Stored · delivery pending" />
        </div>

        <div className="mt-4 divide-y divide-[#EAEAE7]">
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Batch completion digest</p>
              <p className="text-xs text-[#666666]">Send a summary after each import completes</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.emailDigestEnabled}
              onClick={() =>
                void updatePreferences({ emailDigestEnabled: !preferences.emailDigestEnabled })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                preferences.emailDigestEnabled ? "bg-[#171717]" : "bg-[#DCDCD7]"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  preferences.emailDigestEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Conflict alerts</p>
              <p className="text-xs text-[#666666]">Flag packaging owners when MRP evidence conflicts</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.conflictAlertsEnabled}
              onClick={() =>
                void updatePreferences({ conflictAlertsEnabled: !preferences.conflictAlertsEnabled })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                preferences.conflictAlertsEnabled ? "bg-[#171717]" : "bg-[#DCDCD7]"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  preferences.conflictAlertsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE7] pb-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4.5 w-4.5 text-[#171717]" />
            <div>
              <h2 className="text-sm font-semibold text-[#171717]">Security</h2>
              <p className="text-xs text-[#666666]">
                Server-enforced role checks; sign-in screen disabled for this workspace stage
              </p>
            </div>
          </div>
          <ScopePill active label="Single-user workspace" />
        </div>
        <div className="mt-4 flex items-start gap-2.5 text-xs text-[#666666]">
          <Sliders className="mt-0.5 h-4 w-4 text-[#929292]" />
          <p>
            The login screen has been removed for now. Requests resolve to the active workspace
            owner, whose identity is recorded on every review decision, report and audit event —
            actions are never anonymous. Password hashing (scrypt) and hashed server-side sessions
            remain implemented in the backend; set <code>AUTH_REQUIRED=1</code> and restore the
            <code> /login</code> route to enforce sign-in again. Corporate SSO is still an
            integration task.
          </p>
        </div>
      </section>

      {/* Admin */}
      {isAdmin ? (
        <>
          <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
            <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE7] pb-4">
              <div className="flex items-center gap-2.5">
                <Database className="h-4.5 w-4.5 text-[#171717]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#171717]">System health</h2>
                  <p className="text-xs text-[#666666]">Live counts from PostgreSQL</p>
                </div>
              </div>
              <ScopePill active label={health?.database === "connected" ? "Connected" : "Checking"} />
            </div>

            {adminError && (
              <p className="mt-4 rounded-lg border border-[#F6C8C8] bg-[#FDECEC] px-3 py-2 text-xs text-[#B93838]">
                {adminError}
              </p>
            )}

            {!health ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-[#666666]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading health…
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  ["Batches", health.counts.batches],
                  ["Products", health.counts.products],
                  ["Matches", health.counts.matches],
                  ["Sticker refs", health.counts.stickers],
                  ["Documents", health.counts.documents],
                  ["Conflicts", health.counts.conflicts],
                  ["Decisions", health.counts.decisions],
                  ["Reports", health.counts.reports],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] p-3">
                    <span className="text-[11px] text-[#666666]">{label}</span>
                    <p className="mt-0.5 text-lg font-semibold text-[#171717] tabular-nums">
                      {value as number}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-3 text-[11px] text-[#929292]">
              Engine {health?.engineVersion ?? engineVersion} · env {health?.nodeEnv ?? "—"} · last
              batch {health?.lastBatchAt ? formatDateTime(health.lastBatchAt) : "none"}
            </p>
          </section>

          <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
            <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE7] pb-4">
              <div className="flex items-center gap-2.5">
                <Users className="h-4.5 w-4.5 text-[#171717]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#171717]">Users &amp; roles</h2>
                  <p className="text-xs text-[#666666]">Role-based access enforced server-side</p>
                </div>
              </div>
              <ScopePill active label="Read only" />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[#EAEAE7] text-[#666666]">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Email</th>
                    <th className="py-2 pr-3 font-semibold">Role</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAE7]">
                  {(managedUsers ?? []).map((managed) => (
                    <tr key={managed.id}>
                      <td className="py-2.5 pr-3 font-medium text-[#171717]">{managed.displayName}</td>
                      <td className="py-2.5 pr-3 text-[#666666]">{managed.email}</td>
                      <td className="py-2.5 pr-3">
                        <span className="rounded-full border border-[#EAEAE7] bg-[#F5F5F2] px-2 py-0.5 font-mono text-[10.5px] text-[#444444]">
                          {managed.role}
                        </span>
                      </td>
                      <td className="py-2.5 text-[#666666]">{managed.isActive ? "Active" : "Disabled"}</td>
                    </tr>
                  ))}
                  {!managedUsers && (
                    <tr>
                      <td colSpan={4} className="py-3 text-[#666666]">
                        Loading users…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
            <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE7] pb-4">
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="h-4.5 w-4.5 text-[#171717]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#171717]">Reference library &amp; matching rules</h2>
                  <p className="text-xs text-[#666666]">
                    {stickers.length} references ({uploadedReferences} uploaded DOCX, {seedReferences}{" "}
                    demonstration)
                  </p>
                </div>
              </div>
              <ScopePill active />
            </div>

            <div className="mt-4">
              <input
                ref={docInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleDocx(file);
                }}
              />
              <button
                type="button"
                disabled={uploadingDoc}
                onClick={() => docInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-[9px] border border-[#DCDCD7] bg-white px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F5F5F2] disabled:opacity-60"
              >
                {uploadingDoc ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                {uploadingDoc ? "Extracting DOCX…" : "Import sticker DOCX"}
              </button>
              <p className="mt-2 text-[11px] text-[#929292]">
                Uploaded documents are parsed with mammoth and stored permanently. Duplicate
                identifiers and contradictory MRP values are flagged for manual resolution.
              </p>
            </div>

            <ul className="mt-4 space-y-2">
              {MATCHING_RULES.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-start gap-2.5 rounded-xl border border-[#EAEAE7] bg-[#FAFAF8] px-3 py-2.5 text-xs"
                >
                  <span className="rounded-md bg-[#171717] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#FCD10C]">
                    {rule.id}
                  </span>
                  <div>
                    <p className="font-medium text-[#171717]">{rule.label}</p>
                    <p className="mt-0.5 text-[#666666]">{rule.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-[#EAEAE7] bg-white p-6">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-[#929292]" />
            <p className="text-xs text-[#666666]">
              Administration sections (system health, user roles, reference imports and
              configuration) are only visible to SUPER_ADMIN users and are enforced by the server.
            </p>
          </div>
        </section>
      )}
    </motion.div>
  );
}
