import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

const styles = {
  success: "bg-success/10 border-success text-success",
  error: "bg-error/10 border-error text-error",
  info: "bg-accent/10 border-accent text-accent",
};

export function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`px-4 py-3 rounded-lg border ${styles[type]} shadow-lg flex items-center gap-3`}
      >
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
