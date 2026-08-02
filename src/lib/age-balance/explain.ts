import { toPersianDigits } from "@/lib/jalali";
import { confidenceQualifier } from "@/lib/age-balance/confidence";
import type { AgeBalanceResult } from "@/lib/age-balance/engine";

/**
 * Turns the deterministic AgeBalanceResult into Persian sentences. This
 * layer never computes a number — it only reads what engine.ts already
 * produced (spec section 42/43: the "AI" here is an explanation of a
 * deterministic result, not a model that invents the score).
 */

export type AlertPriority = "info" | "attention" | "warning" | "critical";

export interface AgeBalanceAlert {
  id: "herd_aging" | "herd_too_young" | "replacement_shortage" | "excess_replacements";
  priority: AlertPriority;
  title: string;
  message: string;
}

const PRIORITY_LABELS: Record<AlertPriority, string> = {
  info: "اطلاع‌رسانی",
  attention: "قابل توجه",
  warning: "هشدار",
  critical: "بحرانی",
};

export { PRIORITY_LABELS };

export function generateAgeBalanceAlerts(result: AgeBalanceResult): AgeBalanceAlert[] {
  if (result.confidence === "insufficient" || result.totalBreedingFemales === 0) return [];

  const alerts: AgeBalanceAlert[] = [];
  const { shares, replacement } = result;

  // Herd Aging — spec section 23: only when multiple indicators agree.
  const agingSignals = [
    shares.seniorBreedingFemalePercent >= 25,
    replacement.coveragePercent !== null && replacement.coveragePercent < 90,
    replacement.expectedExits12m > 0 && replacement.expectedExits12m >= replacement.eligibleReplacementFemales,
  ].filter(Boolean).length;

  if (agingSignals >= 2) {
    const severe = shares.seniorBreedingFemalePercent >= 35 && (replacement.coveragePercent ?? 100) < 70;
    alerts.push({
      id: "herd_aging",
      priority: severe ? "warning" : "attention",
      title: "گله در حال پیر شدن است",
      message: `${toPersianDigits(shares.seniorBreedingFemalePercent)}٪ ماده‌های مولد در گروه سنی بالاتر قرار دارند و تعداد ماده‌های جایگزین برای حفظ جمعیت فعلی ${
        (replacement.coveragePercent ?? 0) < 90 ? "کافی نیست" : "در مرز کفایت است"
      }.`,
    });
  }

  // Herd Too Young — spec section 24: large not-yet-breeding share + low active breeding share.
  if (shares.notYetBreedingPercent >= 35 && shares.activeBreedingFemalePercent < 35) {
    alerts.push({
      id: "herd_too_young",
      priority: "attention",
      title: "ساختار گله بیش از حد جوان است",
      message: `${toPersianDigits(shares.notYetBreedingPercent)}٪ دام‌های ماده هنوز وارد مرحله مولدی نشده‌اند و سهم مولدهای فعال (${toPersianDigits(
        shares.activeBreedingFemalePercent
      )}٪ از کل گله) پایین است — ظرفیت تولیدمثلی فعلی گله محدود خواهد بود.`,
    });
  }

  // Replacement Shortage — spec section 25.
  if (replacement.replacementNeed > 0 && replacement.coveragePercent !== null && replacement.coveragePercent < 70) {
    alerts.push({
      id: "replacement_shortage",
      priority: replacement.coveragePercent < 40 ? "critical" : "warning",
      title: "کمبود دام جایگزین",
      message: `بر اساس ساختار فعلی، طی ۱۲ ماه آینده حدود ${toPersianDigits(
        replacement.replacementNeed
      )} ماده مولد ممکن است نیازمند خروج از چرخه مولدی باشند، اما فقط ${toPersianDigits(
        replacement.eligibleReplacementFemales
      )} ماده جایگزین مناسب شناسایی شده است (پوشش ${toPersianDigits(replacement.coveragePercent)}٪).`,
    });
  }

  // Excess Replacements — spec section 26: informational only, never a sale suggestion by itself.
  if (replacement.replacementNeed > 0 && replacement.coveragePercent !== null && replacement.coveragePercent >= 160) {
    alerts.push({
      id: "excess_replacements",
      priority: "info",
      title: "ذخیره جایگزینی بیش از نیاز پیش‌بینی‌شده",
      message: `تعداد ماده‌های جایگزین (${toPersianDigits(
        replacement.eligibleReplacementFemales
      )} رأس) بیشتر از نیاز پیش‌بینی‌شده (${toPersianDigits(
        replacement.replacementNeed
      )} رأس) است. پیش از هر تصمیمی، ژنتیک، رشد، سلامت و شجره‌نامه‌ی این دام‌ها را بررسی کنید — این صرفاً یک مشاهده است، نه پیشنهاد فروش.`,
    });
  }

  return alerts;
}

/** One short deterministic paragraph, built entirely from the structured result — never a free-form LLM guess. */
export function explainAgeBalance(result: AgeBalanceResult): string {
  const q = confidenceQualifier(result.confidence);

  if (result.confidence === "insufficient" || result.ageBalanceScore === null) {
    return "داده کافی برای تحلیل دقیق ساختار سنی گله وجود ندارد.";
  }

  const parts: string[] = [];

  if (result.shares.seniorBreedingFemalePercent >= 25) {
    parts.push(
      `${q}ساختار سنی گله در حال حرکت به سمت سنین بالاتر است. در ۱۲ ماه آینده حدود ${toPersianDigits(
        result.replacement.expectedExits12m
      )} ماده مولد وارد گروه سنی بالاتر خواهند شد، در حالی که ${toPersianDigits(
        result.replacement.eligibleReplacementFemales
      )} ماده جایگزین مناسب شناسایی شده است.`
    );
  } else if (result.shares.notYetBreedingPercent >= 35) {
    parts.push(`${q}سهم بالایی از گله هنوز به سن مولدی نرسیده‌اند؛ ظرفیت تولیدمثلی فعلی گله محدودتر از پتانسیل آینده آن است.`);
  } else {
    parts.push(`${q}ساختار سنی گله در محدوده‌ی نسبتاً متعادلی قرار دارد.`);
  }

  const weakest = (Object.entries(result.components) as [string, number | null][])
    .filter(([, v]) => v !== null)
    .sort((a, b) => (a[1] as number) - (b[1] as number))[0];
  const strongest = (Object.entries(result.components) as [string, number | null][])
    .filter(([, v]) => v !== null)
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0];

  const componentLabel: Record<string, string> = {
    breedingStructure: "ساختار جمعیت مولد",
    replacementCoverage: "پوشش جایگزینی",
    ageRisk: "ریسک سنی",
    reproductiveSustainability: "پایداری تولیدمثلی",
  };

  if (weakest && strongest && weakest[0] !== strongest[0]) {
    parts.push(`امتیاز کلی ${weakest[1]! < 60 ? "متوسط" : "مناسب"} است، اما ${componentLabel[weakest[0]]} نسبت به سایر بخش‌ها ضعیف‌تر است.`);
  }

  return parts.join(" ");
}
