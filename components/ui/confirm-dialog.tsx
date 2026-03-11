"use client";

import { useEffect, useRef, useCallback } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
      dialog.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-auto rounded-2xl border border-white/[0.1] bg-panel p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-fade-in"
    >
      <div className="p-6">
        <h2 className="mb-2 font-display text-xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mb-6 text-sm text-muted">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/[0.1] bg-white/5 px-4 py-2 text-sm font-medium !text-white transition-colors hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              variant === "danger"
                ? "bg-danger !text-white hover:bg-danger/80"
                : "bg-accent !text-white hover:bg-accent/80"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
