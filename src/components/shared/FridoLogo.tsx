"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FridoLogoProps {
  variant?: "wordmark" | "badge";
  className?: string;
  height?: number;
}

export function FridoLogo({
  variant = "wordmark",
  className,
  height = 28,
}: FridoLogoProps) {
  if (variant === "badge") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- exact SVG wordmark must not be re-encoded
      <img
        src="/images/frido-logo-yellow.svg"
        alt="Frido"
        style={{ height, width: "auto" }}
        className={cn("select-none object-contain", className)}
        draggable={false}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- exact SVG wordmark must not be re-encoded
    <img
      src="/images/frido-logo.svg"
      alt="Frido"
      style={{ height, width: "auto" }}
      className={cn("select-none object-contain", className)}
      draggable={false}
    />
  );
}
