import type { ReactNode } from "react";
import { pokemonTypeCardClass, pokemonTypeAccentClass } from "@/lib/pokemonTypeStyles";

type CardSize = "sm" | "md" | "lg";
type CardVariant = "default" | "type-tinted" | "flat";

interface CardProps {
  children: ReactNode;
  /** Visual style variant */
  variant?: CardVariant;
  /** Primary Pokémon type — used when variant is "type-tinted" */
  typeName?: string;
  /** Controls padding scale */
  size?: CardSize;
  /** Hover elevation effect */
  hoverable?: boolean;
  /** Additional class names */
  className?: string;
  /** data-region for CSS targeting */
  region?: string;
}

const SIZE_PADDING: Record<CardSize, string> = {
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

const SIZE_RADIUS: Record<CardSize, string> = {
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-2xl",
};

export function Card({
  children,
  variant = "default",
  typeName,
  size = "md",
  hoverable = false,
  className = "",
  region,
}: CardProps) {
  const baseClasses = [
    "overflow-hidden border",
    SIZE_RADIUS[size],
    SIZE_PADDING[size],
    "shadow-sm",
    hoverable
      ? "transition-[border-color,box-shadow] hover:shadow-md"
      : "",
  ];

  let surfaceClasses: string;
  if (variant === "type-tinted" && typeName) {
    surfaceClasses = [
      pokemonTypeCardClass(typeName),
      pokemonTypeAccentClass(typeName),
    ].join(" ");
  } else if (variant === "flat") {
    surfaceClasses = "bg-surface-raised border-border-subtle";
  } else {
    surfaceClasses =
      "bg-surface-base border-border-default dark:bg-zinc-950 dark:border-zinc-800";
  }

  return (
    <div
      className={[...baseClasses, surfaceClasses, className]
        .filter(Boolean)
        .join(" ")}
      {...(region ? { "data-region": region } : {})}
    >
      {children}
    </div>
  );
}

/**
 * A labelled section inside a Card — thin top border separator with a heading.
 * Use to break a card into scannable chunks without nesting another card.
 */
export function CardSection({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-t border-zinc-200 pt-4 dark:border-zinc-200 ${className}`}
    >
      {label && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          {label}
        </h3>
      )}
      {children}
    </section>
  );
}
