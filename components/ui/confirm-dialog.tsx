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

const FOCUSABLE_SELECTORS = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(", ");

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
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }

    // Trap focus within dialog
    if (e.key === "Tab" && dialogRef.current) {
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      // Store the previously focused element to restore later
      previousActiveElement.current = document.activeElement as HTMLElement;

      dialog.showModal();
      dialog.addEventListener("keydown", handleKeyDown);

      // Focus the cancel button (less destructive action) after opening
      // Use setTimeout to ensure dialog is rendered and focusable
      const timer = window.setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 0);

      return () => {
        clearTimeout(timer);
        dialog.removeEventListener("keydown", handleKeyDown);

        // Return focus to the previously focused element
        if (previousActiveElement.current && previousActiveElement.current.focus) {
          previousActiveElement.current.focus();
        }
      };
    }
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
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="m-auto rounded-2xl border border-[var(--edge)] bg-panel p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-fade-in"
    >
      <div className="p-6">
        <h2 id="confirm-dialog-title" className="mb-2 font-display text-xl font-semibold tracking-tight text-text">{title}</h2>
        <p id="confirm-dialog-message" className="mb-6 text-sm text-muted">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            className="rounded-xl border border-[var(--edge)] bg-white/5 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
              variant === "danger"
                ? "bg-danger text-white hover:bg-danger/80"
                : "bg-accent text-[var(--btn-primary-text)] hover:bg-accent/80"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
