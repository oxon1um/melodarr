import { RequestStatus } from "@prisma/client";
import { IconClock, IconCircleCheck, IconCircleX, IconCloudDown, IconAlertTriangle, IconMusic } from "./icons";

const statusConfig: Record<RequestStatus, { className: string; icon: React.ReactNode }> = {
  PENDING: {
    className: "status-pending",
    icon: <IconClock className="h-3 w-3" aria-hidden="true" />
  },
  APPROVED: {
    className: "status-approved",
    icon: <IconCircleCheck className="h-3 w-3" aria-hidden="true" />
  },
  REJECTED: {
    className: "status-rejected",
    icon: <IconCircleX className="h-3 w-3" aria-hidden="true" />
  },
  SUBMITTED: {
    className: "status-submitted",
    icon: <IconCloudDown className="h-3 w-3" aria-hidden="true" />
  },
  COMPLETED: {
    className: "status-approved",
    icon: <IconCircleCheck className="h-3 w-3" aria-hidden="true" />
  },
  FAILED: {
    className: "status-failed",
    icon: <IconAlertTriangle className="h-3 w-3" aria-hidden="true" />
  },
  ALREADY_EXISTS: {
    className: "status-exists",
    icon: <IconMusic className="h-3 w-3" aria-hidden="true" />
  }
};

type Props = {
  status: RequestStatus;
};

export function StatusBadge({ status }: Props) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide
        ${config.className}
      `}
    >
      {config.icon}
      <span className="relative">{status.replaceAll("_", " ")}</span>
    </span>
  );
}
