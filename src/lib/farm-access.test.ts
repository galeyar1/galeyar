import { describe, it, expect } from "vitest";
import { canSwitchToFarm } from "@/lib/farm-access";

describe("canSwitchToFarm", () => {
  const memberships = [
    { farm_id: "farm-a", user_id: "owner-1" },
    { farm_id: "farm-b", user_id: "owner-1" },
    { farm_id: "farm-c", user_id: "owner-2" },
  ];

  it("allows switching to a farm the user is a member of", () => {
    expect(canSwitchToFarm(memberships, "owner-1", "farm-a")).toBe(true);
    expect(canSwitchToFarm(memberships, "owner-1", "farm-b")).toBe(true);
  });

  it("blocks switching to a farm owned by someone else", () => {
    expect(canSwitchToFarm(memberships, "owner-1", "farm-c")).toBe(false);
  });

  it("blocks switching to a farm that doesn't exist in memberships at all", () => {
    expect(canSwitchToFarm(memberships, "owner-1", "farm-does-not-exist")).toBe(false);
  });

  it("returns false for an empty membership list", () => {
    expect(canSwitchToFarm([], "owner-1", "farm-a")).toBe(false);
  });
});
