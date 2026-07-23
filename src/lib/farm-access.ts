/**
 * Client-side mirror of the guard_users_privilege_escalation Postgres
 * trigger's farm-switch rule (supabase/migrations/0007_*.sql) — used to
 * decide whether to show a farm as switchable before round-tripping to the
 * server, which still enforces the real rule regardless of what the UI does.
 */

export interface FarmMembershipLike {
  farm_id: string;
  user_id: string;
}

export function canSwitchToFarm(
  memberships: FarmMembershipLike[],
  userId: string,
  targetFarmId: string
): boolean {
  return memberships.some((m) => m.user_id === userId && m.farm_id === targetFarmId);
}
