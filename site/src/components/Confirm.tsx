import { useEffect, useRef } from "react";

/** In-page confirmation. Native confirm() dialogs are avoided so nothing blocks the page. */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      aria-labelledby="confirm-title"
      style={{
        border: "2px solid var(--ink)",
        background: "var(--panel)",
        color: "var(--ink)",
        maxWidth: 480,
        padding: 24,
      }}
    >
      <h3 id="confirm-title" style={{ marginTop: 0 }}>
        {title}
      </h3>
      {children}
      <div className="row" style={{ marginTop: 16 }}>
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
