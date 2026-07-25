import { describe, it, expect } from "vitest";
import { matchesFilters } from "@/lib/marketplace";

const listing = { province: "فارس", price: 5_000_000, attributes: { species: "sheep", breed: "رومانوف" } };

describe("matchesFilters", () => {
  it("passes with no filters", () => {
    expect(matchesFilters(listing, {})).toBe(true);
  });

  it("filters by species/breed/province", () => {
    expect(matchesFilters(listing, { species: "sheep" })).toBe(true);
    expect(matchesFilters(listing, { species: "goat" })).toBe(false);
    expect(matchesFilters(listing, { breed: "رومانوف" })).toBe(true);
    expect(matchesFilters(listing, { breed: "بوئر" })).toBe(false);
    expect(matchesFilters(listing, { province: "فارس" })).toBe(true);
    expect(matchesFilters(listing, { province: "تهران" })).toBe(false);
  });

  it("filters by max price, excluding listings with no price", () => {
    expect(matchesFilters(listing, { maxPrice: 6_000_000 })).toBe(true);
    expect(matchesFilters(listing, { maxPrice: 4_000_000 })).toBe(false);
    expect(matchesFilters({ ...listing, price: null }, { maxPrice: 6_000_000 })).toBe(false);
  });
});
