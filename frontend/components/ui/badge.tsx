import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-brass",
        className
      )}
      {...props}
    />
  );
}
