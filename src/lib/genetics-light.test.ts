import { describe, it, expect } from "vitest";
import { offspringCount, geneticScore, bestByGender, mostOffspring } from "@/lib/genetics-light";
import type { PedigreeAnimal } from "@/lib/pedigree";

function animal(
  id: string,
  ear_tag: string,
  gender: "male" | "female",
  father_id: string | null = null,
  mother_id: string | null = null
): PedigreeAnimal {
  return { id, ear_tag, name: null, gender, father_id, mother_id };
}

describe("offspringCount", () => {
  it("counts animals referencing this id as either parent", () => {
    const ram = animal("ram", "RAM", "male");
    const all = [ram, animal("c1", "C1", "female", "ram"), animal("c2", "C2", "male", "ram")];
    expect(offspringCount("ram", all)).toBe(2);
  });
});

describe("geneticScore / bestByGender / mostOffspring", () => {
  it("ranks the animal with more offspring higher", () => {
    const ram1 = animal("ram1", "RAM1", "male");
    const ram2 = animal("ram2", "RAM2", "male");
    const all = [
      ram1,
      ram2,
      animal("c1", "C1", "female", "ram1"),
      animal("c2", "C2", "female", "ram1"),
      animal("c3", "C3", "female", "ram2"),
    ];
    const best = bestByGender(all, "male");
    expect(best?.animal.id).toBe("ram1");
    expect(best?.offspringCount).toBe(2);

    const most = mostOffspring(all);
    expect(most?.animal.id).toBe("ram1");
  });

  it("returns null when no animal of that gender exists", () => {
    expect(bestByGender([animal("a", "A", "female")], "male")).toBeNull();
  });

  it("computes a composite score from offspring count and diversity", () => {
    const result = geneticScore(animal("solo", "SOLO", "male"), [animal("solo", "SOLO", "male")]);
    expect(result.offspringCount).toBe(0);
    expect(result.score).toBe(0);
  });
});
