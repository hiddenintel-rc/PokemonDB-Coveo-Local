"use client";

import type { ReactNode } from "react";
import { useState, useId } from "react";

interface SidePanelProps {
  /** The main content region (left/full area) */
  children: ReactNode;
  /** What to render inside the slide-out panel */
  panel: ReactNode;
  /** Panel heading shown in the panel header bar */
  panelTitle?: string;
  /** Open by default on first render */
  defaultOpen?: boolean;
  /** Render the toggle button — pass false if you want external control */
  showToggle?: boolean;
  /** Label on the button that opens the panel */
  toggleLabel?: string;
  /** Controlled open state — pair with onOpenChange for external control */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * SidePanel — a collapsible right-side data panel.
 *
 * Layout (desktop, panel open):
 * ┌──────────────────────────┬────────────────┐
 * │  children (flex-1)       │  panel (18rem) │
 * └──────────────────────────┴────────────────┘
 *
 * On mobile (<lg) the panel renders below the main content as a stacked
 * collapsible section rather than a side column.
 *
 * The component can be either uncontrolled (defaultOpen) or controlled
 * (open + onOpenChange).
 */
export function SidePanel({
  children,
  panel,
  panelTitle,
  defaultOpen = false,
  showToggle = true,
  toggleLabel = "Details",
  open: controlledOpen,
  onOpenChange,
  className = "",
}: SidePanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const panelId = useId();

  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {showToggle && (
        <div className="flex justify-end">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setOpen(!isOpen)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm outline-none ring-sky-500/30 transition-colors hover:bg-zinc-50 dark:border-zinc-200 dark:!bg-white dark:text-zinc-700 dark:hover:bg-zinc-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {isOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M15 3v18" />
                </>
              )}
            </svg>
            {isOpen ? "Close" : toggleLabel}
          </button>
        </div>
      )}

      {/* Desktop: side-by-side grid */}
      <div
        className="hidden lg:grid"
        style={{
          gridTemplateColumns: isOpen ? `1fr var(--side-panel-width)` : "1fr 0px",
          transition: "grid-template-columns 260ms ease",
          gap: isOpen ? "1.5rem" : "0",
        }}
      >
        <div className="min-w-0">{children}</div>

        <div
          id={panelId}
          className="overflow-hidden"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
          aria-hidden={!isOpen}
        >
          <div className="w-[var(--side-panel-width)] min-w-0">
            <PanelShell title={panelTitle}>{panel}</PanelShell>
          </div>
        </div>
      </div>

      {/* Mobile: stacked collapsible */}
      <div className="flex flex-col gap-4 lg:hidden">
        {children}
        {isOpen && (
          <div id={`${panelId}-mobile`}>
            <PanelShell title={panelTitle}>{panel}</PanelShell>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelShell({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-200 dark:!bg-white"
      data-region="side-panel"
    >
      {title && (
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          {title}
        </h2>
      )}
      {children}
    </aside>
  );
}
