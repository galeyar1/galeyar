import { describe, it, expect } from "vitest";
import {
  SPECIES_LABELS,
  ANIMAL_TYPES_BY_SPECIES,
  BIRTH_OFFSPRING_TYPE,
  animalTypeLabel,
  ageLabel,
} from "@/lib/animal-labels";

describe("species/animal-type coverage", () => {
  it("has a label for every supported species, including horse", () => {
    expect(Object.keys(SPECIES_LABELS).sort()).toEqual(
      ["camel", "cattle", "goat", "horse", "sheep"].sort()
    );
  });

  it("defines a birth-offspring animal_type for every species", () => {
    for (const species of Object.keys(SPECIES_LABELS) as (keyof typeof SPECIES_LABELS)[]) {
      const offspringType = BIRTH_OFFSPRING_TYPE[species];
      expect(offspringType.male).toBeTruthy();
      expect(offspringType.female).toBeTruthy();
      // The offspring type must actually be a selectable type for that species.
      const values = ANIMAL_TYPES_BY_SPECIES[species].map((t) => t.value);
      expect(values).toContain(offspringType.male);
      expect(values).toContain(offspringType.female);
    }
  });
});

describe("animalTypeLabel", () => {
  it("finds a type's label regardless of which species list it came from", () => {
    expect(animalTypeLabel("ewe_lamb")).toBe("بره ماده");
    expect(animalTypeLabel("male_foal")).toBe("کره اسب نر");
  });

  it("falls back to the raw code for an unknown type", () => {
    expect(animalTypeLabel("something_unknown")).toBe("something_unknown");
  });

  it("returns null for a null animal_type", () => {
    expect(animalTypeLabel(null)).toBeNull();
  });
});

describe("ageLabel", () => {
  it("returns نامشخص for a missing birth date", () => {
    expect(ageLabel(null)).toBe("نامشخص");
  });

  it("reports months for an animal under a year old", () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    expect(ageLabel(twoMonthsAgo.toISOString().slice(0, 10))).toMatch(/ماه$/);
  });

  it("reports years for an animal over a year old", () => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    expect(ageLabel(threeYearsAgo.toISOString().slice(0, 10))).toMatch(/سال/);
  });
});
