import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-brass px-5 py-3 text-black shadow-[0_0_0_1px_rgba(212,175,55,0.16),0_18px_40px_rgba(212,175,55,0.25)] hover:-translate-y-0.5 hover:bg-[#e6c55a]",
        outline:
          "border border-[rgba(212,175,55,0.28)] bg-transparent px-5 py-3 text-foreground hover:border-brass hover:bg-[rgba(212,175,55,0.08)]",
        ghost: "px-4 py-2 text-muted hover:text-foreground"
      },
      size: {
        default: "h-11",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
