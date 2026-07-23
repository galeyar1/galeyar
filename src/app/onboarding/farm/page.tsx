"use client";

import { useRouter } from "next/navigation";
import { FarmForm } from "@/components/farm-form";

export default function CreateFarmPage() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-primary">ثبت مزرعه شما</h1>
        <p className="text-muted-foreground">اطلاعات پایه دامداری را وارد کنید</p>
      </div>

      <FarmForm submitLabel="ثبت مزرعه و ادامه" onSuccess={() => router.push("/dashboard")} />
    </div>
  );
}
