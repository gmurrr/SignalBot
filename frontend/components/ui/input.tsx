import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
