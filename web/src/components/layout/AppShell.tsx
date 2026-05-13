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

/**
 * Two-column content region: a fixed-width left sidebar + a fluid main area.
 * Collapses to single column below `lg`.
 *
 * Usage:
 *   <SidebarLayout sidebar={<Facets />}>
 *     <ResultGrid />
 *   </SidebarLayout>
 */
export function SidebarLayout({
  sidebar,
  children,
  sidebarWidth = "w-64 lg:w-72",
  className = "",
}: {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarWidth?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-8 lg:flex-row lg:items-start ${className}`}>
      <aside
        className={`${sidebarWidth} shrink-0`}
        data-region="sidebar"
      >
        {sidebar}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Page-level header area — title, subtitle, and an optional action slot.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && (
        <p className="text-sm text-text-muted">{subtitle}</p>
      )}
    </header>
  );
}
