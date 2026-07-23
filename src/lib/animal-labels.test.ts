import { describe, it, expect } from "vitest";
import {
  SPECIES_LABELS,
  ANIMAL_TYPES_BY_SPECIES,
  animalTypeLabel,
  ageLabel,
  isJuvenile,
  effectiveAnimalType,
  juvenileAnimalType,
  portfolioColor,
  breedOptionsFor,
  SHEEP_BREEDS,
  GOAT_BREEDS,
} from "@/lib/animal-labels";

const ALL_SPECIES = Object.keys(SPECIES_LABELS) as (keyof typeof SPECIES_LABELS)[];

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

describe("species/animal-type coverage", () => {
  it("has a label for every supported species, including horse", () => {
    expect(Object.keys(SPECIES_LABELS).sort()).toEqual(
      ["camel", "cattle", "goat", "horse", "sheep"].sort()
    );
  });

  it("defines exactly one adult and one juvenile type per gender, for every species", () => {
    for (const species of ALL_SPECIES) {
      const options = ANIMAL_TYPES_BY_SPECIES[species];
      for (const gender of ["male", "female"] as const) {
        const forGender = options.filter((o) => o.gender === gender);
        expect(forGender).toHaveLength(2);
        expect(forGender.filter((o) => o.isJuvenile)).toHaveLength(1);
        expect(forGender.filter((o) => !o.isJuvenile)).toHaveLength(1);
      }
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
    expect(ageLabel(monthsAgoIso(2))).toMatch(/ماه$/);
  });

  it("reports years for an animal over a year old", () => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    expect(ageLabel(threeYearsAgo.toISOString().slice(0, 10))).toMatch(/سال/);
  });
});

describe("isJuvenile", () => {
  it("returns null for an unknown birth date", () => {
    expect(isJuvenile(null)).toBeNull();
  });

  it("is true under 4 months and false at/over 4 months", () => {
    expect(isJuvenile(monthsAgoIso(2))).toBe(true);
    expect(isJuvenile(monthsAgoIso(4))).toBe(false);
    expect(isJuvenile(monthsAgoIso(12))).toBe(false);
  });
});

describe("effectiveAnimalType", () => {
  it("classifies a young sheep as a lamb and an older one as an adult", () => {
    expect(effectiveAnimalType("sheep", "male", monthsAgoIso(2))?.value).toBe("ram_lamb");
    expect(effectiveAnimalType("sheep", "male", monthsAgoIso(6))?.value).toBe("ram");
    expect(effectiveAnimalType("sheep", "female", monthsAgoIso(2))?.value).toBe("ewe_lamb");
    expect(effectiveAnimalType("sheep", "female", monthsAgoIso(6))?.value).toBe("ewe");
  });

  it("automatically reclassifies right at the threshold, without any stored animal_type input", () => {
    // The whole point: the stored animal_type never has to be touched —
    // the same birth_date crossing 4 months just changes what this returns.
    expect(effectiveAnimalType("goat", "male", monthsAgoIso(3))?.isJuvenile).toBe(true);
    expect(effectiveAnimalType("goat", "male", monthsAgoIso(4))?.isJuvenile).toBe(false);
  });

  it("defaults to adult when birth date is unknown, rather than a permanent newborn", () => {
    expect(effectiveAnimalType("horse", "female", null)?.value).toBe("mare");
  });

  it("returns null when gender is unknown", () => {
    expect(effectiveAnimalType("cattle", null, monthsAgoIso(1))).toBeNull();
  });
});

describe("juvenileAnimalType", () => {
  it("returns the correct juvenile designation used by birth auto-creation", () => {
    expect(juvenileAnimalType("camel", "male").value).toBe("male_camel_calf");
    expect(juvenileAnimalType("camel", "female").value).toBe("female_camel_calf");
  });
});

describe("portfolioColor", () => {
  it("uses soft pink for juvenile females and light blue for juvenile males, regardless of species", () => {
    for (const species of ALL_SPECIES) {
      expect(portfolioColor(species, "female", true)).toBe("#F8BBD0");
      expect(portfolioColor(species, "male", true)).toBe("#BBDEFB");
    }
  });

  it("gives every species a distinct adult male and adult female color", () => {
    const maleColors = new Set(ALL_SPECIES.map((s) => portfolioColor(s, "male", false)));
    const femaleColors = new Set(ALL_SPECIES.map((s) => portfolioColor(s, "female", false)));
    expect(maleColors.size).toBe(ALL_SPECIES.length);
    expect(femaleColors.size).toBe(ALL_SPECIES.length);
  });

  it("never uses the same color for an adult male and an adult female of the same species", () => {
    for (const species of ALL_SPECIES) {
      expect(portfolioColor(species, "male", false)).not.toBe(portfolioColor(species, "female", false));
    }
  });
});

describe("breedOptionsFor", () => {
  it("returns a closed dropdown list for sheep and goat", () => {
    expect(breedOptionsFor("sheep")).toBe(SHEEP_BREEDS);
    expect(breedOptionsFor("goat")).toBe(GOAT_BREEDS);
  });

  it("returns null (free text) for horse, camel, and cattle", () => {
    expect(breedOptionsFor("horse")).toBeNull();
    expect(breedOptionsFor("camel")).toBeNull();
    expect(breedOptionsFor("cattle")).toBeNull();
  });
});
