/**
 * Shared Buy / Consider / Skip verdict badge (BuyVsSkipResult styling).
 */

import {
  CheckCircle2Icon,
  CircleHelpIcon,
  XCircleIcon,
} from "lucide-react";

import type { BuyDecision } from "@/domain/acquisition";
import { cn } from "@/lib/utils";

const DECISION_STYLE: Record<
  BuyDecision,
  { label: string; className: string; icon: typeof CheckCircle2Icon }
> = {
  buy: {
    label: "Buy",
    className: "bg-emerald-600 text-white dark:bg-emerald-500",
    icon: CheckCircle2Icon,
  },
  consider: {
    label: "Consider",
    className: "bg-amber-500 text-white dark:bg-amber-500",
    icon: CircleHelpIcon,
  },
  skip: {
    label: "Skip",
    className: "bg-destructive text-white",
    icon: XCircleIcon,
  },
};

export function DecisionVerdictBadge({
  decision,
  className,
  size = "sm",
}: {
  decision: BuyDecision | string;
  className?: string;
  /** `sm` for cards; `lg` matches BuyVsSkipResult header pill. */
  size?: "sm" | "lg";
}) {
  const key =
    decision === "buy" || decision === "consider" || decision === "skip"
      ? decision
      : "consider";
  const style = DECISION_STYLE[key];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        size === "lg"
          ? "gap-2 rounded-full px-3 py-1 text-sm font-semibold"
          : "rounded-md px-2 py-0.5 text-xs",
        style.className,
        className,
      )}
    >
      <Icon
        className={size === "lg" ? "size-4" : "size-3.5"}
        aria-hidden
      />
      {style.label}
    </span>
  );
}

export { DECISION_STYLE };
