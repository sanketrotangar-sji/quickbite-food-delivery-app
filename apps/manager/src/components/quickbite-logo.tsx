import { cn } from "@/lib/utils";

export function QuickBiteLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center", className)} aria-label="QuickBite">
      <img
        src="/logo2.png"
        alt="QuickBite"
        className={cn("w-auto object-contain", compact ? "h-14" : "h-16")}
      />
    </span>
  );
}
