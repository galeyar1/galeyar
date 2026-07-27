"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  /** Defaults preserve the original delete-dialog look; pass these to reuse this dialog for non-destructive confirmations (deactivate, reactivate, etc). */
  confirmLabel?: string;
  confirmBusyLabel?: string;
  confirmVariant?: "destructive" | "default";
  showIcon?: boolean;
}

/** Standard "آیا از حذف این مورد مطمئن هستید؟" confirmation used before every delete action — extended with optional confirm-label/variant so it also covers non-destructive confirmations. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = "حذف این مورد",
  description = "آیا از حذف این مورد مطمئن هستید؟ این عملیات قابل بازگشت نیست.",
  onConfirm,
  confirmLabel = "حذف",
  confirmBusyLabel = "در حال حذف…",
  confirmVariant = "destructive",
  showIcon = true,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            انصراف
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={busy}>
            {showIcon && <Trash2 className="size-4" />}
            {busy ? confirmBusyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteIconButtonProps {
  onDelete: () => void | Promise<void>;
  title?: string;
  description?: string;
}

/** Trash icon button + wired-up confirm dialog, for use in list rows. */
export function DeleteIconButton({ onDelete, title, description }: DeleteIconButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="حذف"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title={title} description={description} onConfirm={onDelete} />
    </>
  );
}
