"use client";

import { useRouter } from "next/navigation";
import { FarmForm } from "@/components/farm-form";

export default function NewFarmPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">ساخت مزرعه جدید</h1>
      <p className="text-sm text-muted-foreground">
        بعد از ثبت، به‌طور خودکار به این مزرعه جدید سوییچ می‌کنید.
      </p>
      <FarmForm submitLabel="ساخت مزرعه" onSuccess={() => router.push("/dashboard")} />
    </div>
  );
}
