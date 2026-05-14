import type { ReactNode } from "react";

type AppShellWidth = "sm" | "md" | "lg" | "xl" | "full";

interface AppShellProps {
  children: ReactNode;
  /** Max-width of the content area */
  maxWidth?: AppShellWidth;
  /** Vertical padding preset */
  spacing?: "compact" | "default" | "loose";
  className?: string;
}

const MAX_WIDTH: Record<AppShellWidth, string> = {
  sm:   "max-w-3xl",
  md:   "max-w-5xl",
  lg:   "max-w-7xl",
  xl:   "max-w-screen-xl",
  full: "max-w-none",
};

const SPACING: Record<"compact" | "default" | "loose", string> = {
  compact: "px-4 py-6",
  default: "px-4 py-8 md:py-10",
  loose:   "px-4 py-12 md:py-16",
};

/**
 * Outer page wrapper — centers content, constrains width, adds consistent
 * horizontal padding and vertical rhythm.
 *
 * Usage:
 *   <AppShell maxWidth="lg">…page content…</AppShell>
 */
export function AppShell({
  children,
  maxWidth = "lg",
  spacing = "default",
  className = "",
}: AppShellProps) {
  return (
    <div
      className={`mx-auto w-full ${MAX_WIDTH[maxWidth]} ${SPACING[spacing]} ${className}`}
    >
      {children}
    </div>
  );
}

