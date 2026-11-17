"use client";

import React, {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { FridoLogo } from "@/components/shared/FridoLogo";
import { useFridoStore } from "@/context/FridoStoreContext";

export const SESSION_KEY = "frido_intro_seen";
export const INTRO_DURATION_MS = 2400;
export const INTRO_REDUCED_DURATION_MS = 800;
export const MAX_INTRO_MS = 6000;

export interface IntroDiagnostics {
  alreadySeen: boolean | null;
  storageAvailable: boolean;
  mode: "logo-animation" | "static-fallback";
  outcome: "pending" | "completed" | "skipped";
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: () => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class IntroErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Intro animation error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback();
    }
    return this.props.children;
  }
}

/**
 * Frido brand introduction — first launch only.
 *
 * Primary: Polished Framer Motion Frido logo animation on signature yellow background.
 * Fallback: Clean static Frido logo screen if animation initialization fails.
 *
 * Safety: Hard timeout ceiling, skip button, Escape key, reduced-motion aware,
 * session storage guarded against private/blocked storage.
 */
export function IntroLoader() {
  const { introReplayNonce } = useFridoStore();

  return (
    <IntroErrorBoundary
      key={`intro-error-boundary-${introReplayNonce}`}
      fallback={() => <StaticLogoFallback />}
    >
      <IntroStage key={`intro-${introReplayNonce}`} />
    </IntroErrorBoundary>
  );
}

function IntroStage() {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [alreadySeen, setAlreadySeen] = useState<boolean | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [outcome, setOutcome] = useState<IntroDiagnostics["outcome"]>("pending");
  const [dismissed, setDismissed] = useState(false);
  const completedRef = useRef(false);

  const dismiss = useCallback((reason: "completed" | "skipped") => {
    if (completedRef.current) return;
    completedRef.current = true;
    setOutcome(reason);
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage unavailable (private mode / blocked): intro replays safely next load.
    }
    setVisible(false);
  }, []);

  // Session gate. Runs after mount, tolerates blocked/private-mode storage.
  useEffect(() => {
    let seen = false;
    let available = true;
    try {
      seen = Boolean(sessionStorage.getItem(SESSION_KEY));
    } catch {
      available = false;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- one-time synchronisation from sessionStorage */
    setStorageAvailable(available);
    setAlreadySeen(seen);
    if (!seen) {
      setVisible(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Automatic transition after animation duration
  useEffect(() => {
    if (!visible) return;
    const duration = prefersReducedMotion ? INTRO_REDUCED_DURATION_MS : INTRO_DURATION_MS;
    const timer = window.setTimeout(() => {
      dismiss("completed");
    }, duration);

    return () => window.clearTimeout(timer);
  }, [visible, prefersReducedMotion, dismiss]);

  // Absolute ceiling so the intro never blocks the workspace indefinitely
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      dismiss("completed");
    }, MAX_INTRO_MS);

    return () => window.clearTimeout(timer);
  }, [visible, dismiss]);

  // Escape key handler to skip
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss("skipped");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, dismiss]);

  const diagnostics: IntroDiagnostics = {
    alreadySeen,
    storageAvailable,
    mode: "logo-animation",
    outcome,
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="frido-intro"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: {
                duration: prefersReducedMotion ? 0.15 : 0.5,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#FCD10C] select-none"
            role="dialog"
            aria-modal="true"
            aria-label="Frido brand introduction"
            data-intro-asset="logo"
          >
            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-11 items-center justify-center rounded-lg bg-[#080808] px-1.5 shadow-sm">
                  <FridoLogo variant="badge" height={14} />
                </div>
                <span className="text-[10.5px] font-semibold tracking-[0.18em] text-[#080808]/75 uppercase">
                  Product Intelligence
                </span>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => dismiss("skipped")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#080808]/20 bg-[#080808]/10 px-3.5 py-1.5 text-xs font-semibold text-[#080808] backdrop-blur-sm transition-colors hover:bg-[#080808]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#080808]"
                aria-label="Skip intro"
              >
                Skip intro
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Central brand reveal */}
            <div className="flex flex-col items-center justify-center px-6 text-center">
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0.2 : 0.6,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <FridoLogo variant="wordmark" height={66} className="sm:h-[84px]" />
              </motion.div>
              <motion.p
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.25, duration: 0.5 }}
                className="mt-5 max-w-md text-[11px] font-semibold tracking-[0.24em] text-[#080808]/85 uppercase sm:text-xs"
              >
                Freedom to live life your way
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: 0.4 }}
                className="mt-2 text-[11px] text-[#080808]/60"
              >
                Walk · Sit · Sleep
              </motion.p>
            </div>

            {/* Progress indicator */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center pb-8 sm:pb-10">
              <div className="h-1 w-44 overflow-hidden rounded-full bg-[#080808]/15">
                <motion.div
                  className="h-full rounded-full bg-[#080808]/75"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: prefersReducedMotion ? 0.6 : 2.0,
                    ease: "linear",
                  }}
                />
              </div>
              <span className="mt-3 text-[10.5px] font-medium tracking-wide text-[#080808]/50">
                Prize sticker verification workspace
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Development-only diagnostics */}
      {process.env.NODE_ENV !== "production" && (visible || alreadySeen !== null) && (
        <IntroDiagnosticsPanel diagnostics={diagnostics} dismissed={dismissed} />
      )}
    </>
  );
}

/** Fallback static Frido logo screen if animation initialization fails */
function StaticLogoFallback() {
  const [visible, setVisible] = useState(true);

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // safe fallback
    }
    setVisible(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(dismiss, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FCD10C] px-6 text-center select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Frido brand introduction fallback"
    >
      <FridoLogo variant="wordmark" height={66} className="sm:h-[84px]" />
      <p className="mt-5 max-w-md text-[11px] font-semibold tracking-[0.24em] text-[#080808]/85 uppercase sm:text-xs">
        Freedom to live life your way
      </p>
      <p className="mt-2 text-[11px] text-[#080808]/60">
        Walk · Sit · Sleep
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-6 rounded-full border border-[#080808]/20 bg-[#080808]/10 px-4 py-2 text-xs font-semibold text-[#080808] transition-colors hover:bg-[#080808]/20"
      >
        Continue to workspace
      </button>
    </div>
  );
}

function IntroDiagnosticsPanel({
  diagnostics,
  dismissed,
}: {
  diagnostics: IntroDiagnostics;
  dismissed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rows: Array<[string, string]> = [
    ["already seen", String(diagnostics.alreadySeen)],
    ["storage ok", String(diagnostics.storageAvailable)],
    ["mode", diagnostics.mode],
    ["outcome", dismissed ? diagnostics.outcome : "running"],
  ];

  return (
    <div className="fixed right-3 bottom-3 z-[130] max-w-[min(22rem,90vw)] font-mono text-[10.5px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-[#FCD10C] bg-[#171717] px-2 py-1 font-semibold text-[#FCD10C] shadow-lg"
      >
        intro debug {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 rounded-md border border-[#FCD10C]/60 bg-[#171717]/95 p-2 text-white/85 shadow-xl">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <span className="text-white/50">{label}</span>
              <span className="truncate text-right">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
