import { RequestStatus } from "@prisma/client";
import { IconClock, IconCircleCheck, IconCircleX, IconCloudDown, IconAlertTriangle, IconMusic } from "./icons";

const statusConfig: Record<RequestStatus, { bg: string; border: string; text: string; glow?: string; icon: React.ReactNode }> = {
  PENDING: {
    bg: "bg-amber-500/15",
    border: "border-amber-400/30",
    text: "text-amber-200",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.25)]",
    icon: <IconClock className="h-3 w-3" />
  },
  APPROVED: {
    bg: "bg-sky-500/15",
    border: "border-sky-400/30",
    text: "text-sky-200",
    glow: "shadow-[0_0_12px_rgba(56,189,248,0.2)]",
    icon: <IconCircleCheck className="h-3 w-3" />
  },
  REJECTED: {
    bg: "bg-rose-500/12",
    border: "border-rose-400/25",
    text: "text-rose-200",
    icon: <IconCircleX className="h-3 w-3" />
  },
  SUBMITTED: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-400/30",
    text: "text-emerald-200",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.2)]",
    icon: <IconCloudDown className="h-3 w-3" />
  },
  FAILED: {
    bg: "bg-rose-500/12",
    border: "border-rose-400/25",
    text: "text-rose-200",
    icon: <IconAlertTriangle className="h-3 w-3" />
  },
  ALREADY_EXISTS: {
    bg: "bg-slate-500/12",
    border: "border-slate-400/20",
    text: "text-slate-300",
    icon: <IconMusic className="h-3 w-3" />
  }
};

type Props = {
  status: RequestStatus;
};

export function StatusBadge({ status }: Props) {
  const config = statusConfig[status];
  const isPending = status === "PENDING";

  return (
    <span
      className={`
        relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide
        ${config.bg} ${config.border} ${config.text}
        ${config.glow || ""}
        ${isPending ? "animate-pulse-glow" : ""}
      `}
    >
      {config.icon}
      <span className="relative">{status.replaceAll("_", " ")}</span>
    </span>
  );
}
