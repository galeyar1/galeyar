"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Building2 } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";

/** Current Farm Indicator (everyone) that doubles as the Farm Switcher entry point (owner only). */
export function FarmSwitcher() {
  const { profile } = useAuth();
  const [farmName, setFarmName] = useState<string | null>(null);
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!profile?.farm_id) {
      setFarmName(null);
      return;
    }
    supabase
      .from("farms")
      .select("farm_name")
      .eq("id", profile.farm_id)
      .single()
      .then(({ data }) => setFarmName(data?.farm_name ?? null));
  }, [profile?.farm_id]);

  if (!farmName) return null;

  if (!isOwner) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Building2 className="size-3.5" />
        {farmName}
      </span>
    );
  }

  return (
    <Link href="/farms" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Building2 className="size-3.5" />
      {farmName}
      <ChevronDown className="size-3.5" />
    </Link>
  );
}
