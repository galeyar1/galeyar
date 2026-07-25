import { describe, it, expect } from "vitest";
import {
  hasFeature,
  requiredPlanForFeature,
  lockedFeatureMessage,
  planLimits,
  isAtAnimalLimit,
  isAtFarmLimit,
  nextPlan,
  daysRemaining,
  isExpired,
  PLAN_LABELS,
} from "@/lib/subscription-plans";

describe("hasFeature", () => {
  it("free has none of the gated features", () => {
    expect(hasFeature("free", "reports")).toBe(false);
    expect(hasFeature("free", "ai_assistant")).toBe(false);
    expect(hasFeature("free", "genetic_intelligence")).toBe(false);
  });

  it("silver has reports and feed management but not AI", () => {
    expect(hasFeature("silver", "reports")).toBe(true);
    expect(hasFeature("silver", "feed_management")).toBe(true);
    expect(hasFeature("silver", "ai_assistant")).toBe(false);
  });

  it("gold has AI but not genetic intelligence", () => {
    expect(hasFeature("gold", "ai_assistant")).toBe(true);
    expect(hasFeature("gold", "advanced_reports")).toBe(true);
    expect(hasFeature("gold", "genetic_intelligence")).toBe(false);
  });

  it("professional has everything", () => {
    expect(hasFeature("professional", "genetic_intelligence")).toBe(true);
    expect(hasFeature("professional", "pedigree")).toBe(true);
    expect(hasFeature("professional", "marketplace_access")).toBe(true);
    expect(hasFeature("professional", "financial_intelligence")).toBe(true);
  });
});

describe("requiredPlanForFeature / lockedFeatureMessage", () => {
  it("finds the cheapest plan unlocking a feature", () => {
    expect(requiredPlanForFeature("reports")).toBe("silver");
    expect(requiredPlanForFeature("ai_assistant")).toBe("gold");
    expect(requiredPlanForFeature("genetic_intelligence")).toBe("professional");
  });

  it("renders the spec's exact locked-feature message for a professional-only feature", () => {
    expect(lockedFeatureMessage("marketplace_access")).toBe(
      `این قابلیت فقط در پلن ${PLAN_LABELS.professional} در دسترس است.`
    );
  });
});

describe("plan limits", () => {
  it("matches the spec's animal/farm caps", () => {
    expect(planLimits("free")).toEqual({ maxAnimals: 30, maxFarms: 1 });
    expect(planLimits("silver")).toEqual({ maxAnimals: 200, maxFarms: 1 });
    expect(planLimits("gold")).toEqual({ maxAnimals: 1000, maxFarms: 3 });
    expect(planLimits("professional")).toEqual({ maxAnimals: null, maxFarms: null });
  });

  it("isAtAnimalLimit / isAtFarmLimit respect the cap and unlimited plans", () => {
    expect(isAtAnimalLimit("free", 30)).toBe(true);
    expect(isAtAnimalLimit("free", 29)).toBe(false);
    expect(isAtAnimalLimit("professional", 1_000_000)).toBe(false);
    expect(isAtFarmLimit("gold", 3)).toBe(true);
    expect(isAtFarmLimit("gold", 2)).toBe(false);
  });
});

describe("nextPlan", () => {
  it("steps through the upgrade ladder and stops at professional", () => {
    expect(nextPlan("free")).toBe("silver");
    expect(nextPlan("silver")).toBe("gold");
    expect(nextPlan("gold")).toBe("professional");
    expect(nextPlan("professional")).toBeNull();
  });
});

describe("daysRemaining / isExpired", () => {
  it("counts whole days until expiration", () => {
    expect(daysRemaining("2026-08-01", "2026-07-25")).toBe(7);
  });

  it("is null when there's no expiration date", () => {
    expect(daysRemaining(null, "2026-07-25")).toBeNull();
  });

  it("isExpired is true once the expiration date has passed", () => {
    expect(isExpired("2026-07-01", "2026-07-25")).toBe(true);
    expect(isExpired("2026-08-01", "2026-07-25")).toBe(false);
    expect(isExpired(null, "2026-07-25")).toBe(false);
  });
});
