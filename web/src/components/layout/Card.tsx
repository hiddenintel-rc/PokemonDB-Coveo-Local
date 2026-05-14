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
    surfaceClasses = "bg-surface-base border-border-default";
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

