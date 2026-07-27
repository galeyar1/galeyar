"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeleteFarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName: string;
  onConfirm: () => void | Promise<void>;
}

/**
 * A stronger confirmation than the shared ConfirmDialog/DeleteIconButton
 * (single "are you sure") — farm deletion cascades through every farm_id-
 * linked table (animals, health/breeding records, financials, etc, see
 * farms_delete_owner in supabase/migrations/0009), so this requires typing
 * the farm's exact name before the destructive button even enables.
 */
export function DeleteFarmDialog({ open, onOpenChange, farmName, onConfirm }: DeleteFarmDialogProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = input.trim() === farmName;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setInput("");
  }

  async function handleConfirm() {
    if (!matches) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف مزرعه</DialogTitle>
          <DialogDescription>
            این عملیات می‌تواند غیرقابل بازگشت باشد — همه‌ی داده‌های «{farmName}» شامل دام‌ها، رکوردهای سلامت، تولیدمثل، مالی و سایر اطلاعات مرتبط برای همیشه حذف می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground">
            برای تأیید حذف، نام مزرعه («{farmName}») را دقیقاً وارد کنید.
          </label>
          <Input value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            انصراف
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={busy || !matches}>
            {busy ? "در حال حذف…" : "حذف مزرعه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
