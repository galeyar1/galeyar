import type { UserRole } from "@/lib/supabase/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "مالک دامداری",
  operator: "اپراتور",
  vet: "دامپزشک",
  consultant: "مشاور",
};
