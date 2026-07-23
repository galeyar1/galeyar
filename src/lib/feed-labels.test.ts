import { describe, it, expect } from "vitest";
import { FEED_TYPE_LABELS, feedLabel } from "@/lib/feed-labels";

describe("feedLabel", () => {
  it("uses the fixed Persian label for a known feed type", () => {
    expect(feedLabel({ feed_type: "hay", custom_label: null })).toBe(FEED_TYPE_LABELS.hay);
    expect(feedLabel({ feed_type: "barley", custom_label: null })).toBe("جو");
  });

  it("uses the custom_label for a custom feed type", () => {
    expect(feedLabel({ feed_type: "custom", custom_label: "کنجاله پنبه‌دانه" })).toBe("کنجاله پنبه‌دانه");
  });

  it("falls back to the generic سایر label when custom has no name", () => {
    expect(feedLabel({ feed_type: "custom", custom_label: null })).toBe(FEED_TYPE_LABELS.custom);
  });
});
