import { cn } from "@/lib/utils";

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.34),transparent)]", className)} />;
}
