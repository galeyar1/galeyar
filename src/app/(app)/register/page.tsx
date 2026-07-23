"use client";

import Link from "next/link";
import { Milk, Weight, Stethoscope, Baby, Pill, Syringe } from "lucide-react";
import { AnimalNavIcon } from "@/components/animal-nav-icon";

const ITEMS: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { href: "/register/milk", label: "ثبت شیر", icon: Milk, color: "text-primary" },
  { href: "/register/weight", label: "ثبت وزن", icon: Weight, color: "text-primary" },
  { href: "/register/disease", label: "ثبت بیماری", icon: Stethoscope, color: "text-destructive" },
  { href: "/register/birth", label: "ثبت زایمان", icon: Baby, color: "text-success" },
  { href: "/register/treatment", label: "ثبت درمان", icon: Pill, color: "text-success" },
  { href: "/register/vaccination", label: "ثبت واکسیناسیون", icon: Syringe, color: "text-success" },
  { href: "/animals/new", label: "ثبت دام جدید", icon: AnimalNavIcon, color: "text-primary" },
];

export default function RegisterHubPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">ثبت گزارش جدید</h1>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-6 text-center"
          >
            <item.icon className={`size-8 ${item.color}`} />
            <span className="text-base font-semibold">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
