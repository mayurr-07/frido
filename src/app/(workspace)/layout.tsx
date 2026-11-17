import type { ReactNode } from "react";
import { FridoStoreProvider } from "@/context/FridoStoreContext";
import { MainLayout } from "@/components/layout/MainLayout";

export const dynamic = "force-dynamic";

/**
 * Workspace shell. Access control lives in the API layer (`requireUser` /
 * `requireAdmin`); the login screen was removed for this single-user stage.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <FridoStoreProvider>
      <MainLayout>{children}</MainLayout>
    </FridoStoreProvider>
  );
}
