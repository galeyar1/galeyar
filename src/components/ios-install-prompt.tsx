"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";

import { isIos, isInStandaloneMode } from "@/lib/pwa";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";

const DISMISS_KEY = "galeyar-ios-install-dismissed-at";
const RESHOW_AFTER_DAYS = 14;

function shouldShow(): boolean {
  if (!isIos() || isInStandaloneMode()) return false;
  const stored = localStorage.getItem(DISMISS_KEY);
  if (!stored) return true;
  const dismissedAt = Number(stored);
  if (Number.isNaN(dismissedAt)) return true;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince >= RESHOW_AFTER_DAYS;
}

/**
 * Safari on iOS/iPadOS has no beforeinstallprompt API — the only install
 * path is the manual Share -> Add to Home Screen flow, so this only ever
 * guides the user through those taps, never triggers anything
 * programmatically. Shown on the login page; dismissal is remembered in
 * localStorage and the guide won't reappear for RESHOW_AFTER_DAYS.
 */
export function IosInstallPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(shouldShow());
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && dismiss()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>گله‌یار را به صفحه اصلی اضافه کنید</SheetTitle>
          <SheetDescription>
            برای دسترسی سریع‌تر و استفاده مثل یک اپلیکیشن واقعی، گله‌یار را به صفحه اصلی آیفون خود اضافه کنید.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-2">
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">۱</span>
            <span className="flex items-center gap-1.5 text-sm">
              روی دکمه‌ی <Share className="size-4 shrink-0" /> (اشتراک‌گذاری) در نوار Safari ضربه بزنید.
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">۲</span>
            <span className="flex items-center gap-1.5 text-sm">
              گزینه‌ی <SquarePlus className="size-4 shrink-0" /> «افزودن به صفحه اصلی» را انتخاب کنید.
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">۳</span>
            <span className="text-sm">روی «افزودن» ضربه بزنید.</span>
          </div>
        </div>

        <SheetClose asChild>
          <Button variant="outline" className="mx-4 mb-4">
            <X className="size-4" /> متوجه شدم
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
