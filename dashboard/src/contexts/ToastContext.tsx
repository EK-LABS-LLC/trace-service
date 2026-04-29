import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Toast } from "../components/ui/Toast";
import type { ToastType } from "../components/ui/Toast";
import { ToastContext, type ToastItem } from "./toast-context";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [nextId, setNextId] = useState(0);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = nextId;
      setNextId((prev) => prev + 1);
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [nextId],
  );

  const showSuccess = useCallback(
    (message: string) => {
      showToast(message, "success");
    },
    [showToast],
  );

  const showError = useCallback(
    (message: string) => {
      showToast(message, "error");
    },
    [showToast],
  );

  const showInfo = useCallback(
    (message: string) => {
      showToast(message, "info");
    },
    [showToast],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showInfo }}
    >
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
}
