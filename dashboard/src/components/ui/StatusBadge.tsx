type Status = "success" | "error";

interface StatusBadgeProps {
  status: Status;
}

const statusConfig = {
  success: {
    text: "OK",
    className: "bg-success/10 text-success",
  },
  error: {
    text: "ERR",
    className: "bg-error/10 text-error",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${config.className}`}>
      {config.text}
    </span>
  );
}
