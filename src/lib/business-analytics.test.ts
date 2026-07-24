import { describe, it, expect } from "vitest";
import {
  mostProfitableAnimal,
  mostExpensiveAnimal,
  highestProducingAnimal,
  bestFarm,
  worstFarm,
} from "@/lib/business-analytics";

describe("mostProfitableAnimal / mostExpensiveAnimal", () => {
  const summaries = [
    { animalId: "a", revenue: 1000, expense: 200 }, // profit 800
    { animalId: "b", revenue: 500, expense: 600 }, // profit -100
    { animalId: "c", revenue: 300, expense: 900 }, // most expensive
  ];

  it("ranks by revenue minus expense", () => {
    expect(mostProfitableAnimal(summaries)?.animalId).toBe("a");
  });

  it("ranks by total expense", () => {
    expect(mostExpensiveAnimal(summaries)?.animalId).toBe("c");
  });

  it("returns null for an empty list", () => {
    expect(mostProfitableAnimal([])).toBeNull();
  });
});

describe("highestProducingAnimal", () => {
  it("picks the highest milk total", () => {
    const result = highestProducingAnimal([
      { animalId: "a", value: 10 },
      { animalId: "b", value: 25 },
    ]);
    expect(result?.animalId).toBe("b");
  });
});

describe("bestFarm / worstFarm", () => {
  const farms = [
    { farmId: "1", farmName: "یک", score: 70 },
    { farmId: "2", farmName: "دو", score: 90 },
    { farmId: "3", farmName: "سه", score: 40 },
  ];

  it("finds the highest and lowest scoring farms", () => {
    expect(bestFarm(farms)?.farmId).toBe("2");
    expect(worstFarm(farms)?.farmId).toBe("3");
  });
});
