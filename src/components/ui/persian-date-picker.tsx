"use client";

import * as React from "react";
import DatePicker, { type DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/jalali";

function dateObjectToIso(dateObject: DateObject): string {
  const g = dateObject.convert(gregorian, gregorian_en);
  return `${g.year}-${String(g.month.number).padStart(2, "0")}-${String(g.day).padStart(2, "0")}`;
}

interface PersianDatePickerProps {
  value?: string | null;
  onChange?: (iso: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PersianDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  disabled,
  className,
}: PersianDatePickerProps) {
  return (
    <DatePicker
      calendar={persian}
      locale={persian_fa}
      value={value ? new Date(`${value}T00:00:00`) : undefined}
      disabled={disabled}
      onChange={(dateObject) => {
        if (!dateObject || Array.isArray(dateObject)) {
          onChange?.(undefined);
          return;
        }
        onChange?.(dateObjectToIso(dateObject));
      }}
      render={(inputValue, openCalendar) => (
        <button
          type="button"
          disabled={disabled}
          onClick={openCalendar}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
            className
          )}
        >
          <span className={cn(!inputValue && "text-muted-foreground")}>
            {inputValue ? toPersianDigits(inputValue) : placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    />
  );
}
