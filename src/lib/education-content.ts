import type { Species } from "@/lib/supabase/types";

export type EducationType = "video" | "article" | "guide" | "faq";

export interface EducationEntry {
  id: string;
  type: EducationType;
  species: Species | "all";
  title: string;
  /** Full body for articles/guides/faq; a video URL for type "video" (left null until a real one is supplied). */
  body: string | null;
  videoUrl: string | null;
}

export const EDUCATION_TYPE_LABELS: Record<EducationType, string> = {
  video: "ویدیو",
  article: "مقاله",
  guide: "راهنما",
  faq: "سوالات متداول",
};

export const SPECIES_FILTER_LABELS: Record<Species | "all", string> = {
  all: "همه گونه‌ها",
  sheep: "گوسفند",
  goat: "بز",
  cattle: "گاو",
  camel: "شتر",
  horse: "اسب",
};

/**
 * Real, self-contained short guides — no video hosting/CMS backend exists
 * yet, so "video" entries are placeholders (videoUrl: null) until the user
 * supplies real footage/links; everything else here is genuine content.
 */
export const EDUCATION_ENTRIES: EducationEntry[] = [
  {
    id: "sheep-lambing-basics",
    type: "guide",
    species: "sheep",
    title: "آماده‌سازی برای فصل زایمان گوسفند",
    body: "حدود دو هفته قبل از زایش مورد انتظار، محل زایمان را تمیز و خشک نگه دارید و از تجمع گوسفندان جلوگیری کنید. علائم نزدیک شدن زایمان شامل بی‌قراری، شل‌شدن رباط‌های لگن و بزرگ‌شدن پستان است. در صورت طولانی‌شدن زایمان (بیش از یک ساعت تلاش بدون پیشرفت) حتماً با دامپزشک تماس بگیرید.",
    videoUrl: null,
  },
  {
    id: "goat-nutrition-lactation",
    type: "article",
    species: "goat",
    title: "تغذیه بز در دوران شیردهی",
    body: "بز شیرده به جیره‌ای با پروتئین و انرژی بالاتر نسبت به دوران خشکی نیاز دارد. افزایش تدریجی کنسانتره (حدود ۱۰۰ تا ۲۰۰ گرم در هفته) از دو هفته پیش از زایمان توصیه می‌شود تا شکمبه با تغییر جیره سازگار شود.",
    videoUrl: null,
  },
  {
    id: "cattle-vaccination-schedule",
    type: "guide",
    species: "cattle",
    title: "برنامه پیشنهادی واکسیناسیون گاو",
    body: "گوساله‌ها معمولاً واکسن‌های پایه (مانند آنتروتوکسمی) را در هفته‌های اول زندگی دریافت می‌کنند و یادآور آن پس از چند هفته تکرار می‌شود. برای برنامه دقیق‌تر متناسب با منطقه خود با دامپزشک مشورت کنید.",
    videoUrl: null,
  },
  {
    id: "camel-heat-management",
    type: "article",
    species: "camel",
    title: "مدیریت شتر در گرمای شدید",
    body: "شتر نسبت به گرما مقاوم است اما همچنان نیاز به آب کافی و سایه دارد، به‌خصوص در دوران شیردهی. کاهش ناگهانی مصرف آب می‌تواند نشانه بیماری باشد و باید بررسی شود.",
    videoUrl: null,
  },
  {
    id: "horse-hoof-care",
    type: "guide",
    species: "horse",
    title: "مراقبت پایه از سم اسب",
    body: "بازرسی روزانه سم برای یافتن سنگ‌ریزه، ترک یا بوی غیرعادی (نشانه احتمالی عفونت) باید بخشی از روتین روزانه باشد. نعل‌بندی و اصلاح سم باید هر ۴ تا ۸ هفته توسط فرد متخصص انجام شود.",
    videoUrl: null,
  },
  {
    id: "faq-quarantine",
    type: "faq",
    species: "all",
    title: "قرنطینه دام جدید چقدر باید طول بکشد؟",
    body: "برای دام‌های تازه‌خریداری‌شده، حداقل ۱۴ روز قرنطینه و دور نگه‌داشتن از بقیه گله توصیه می‌شود تا علائم بیماری‌های احتمالی (در صورت وجود) قبل از ورود به گله اصلی مشخص شود.",
    videoUrl: null,
  },
  {
    id: "faq-body-temperature",
    type: "faq",
    species: "all",
    title: "دمای بدن طبیعی دام چقدر است؟",
    body: "دمای طبیعی بدن اکثر نشخوارکنندگان اهلی معمولاً بین ۳۸ تا ۳۹.۵ درجه سانتی‌گراد است. دمای بالاتر از ۳۹.۵ می‌تواند نشانه تب و نیاز به بررسی دامپزشکی باشد.",
    videoUrl: null,
  },
  {
    id: "video-milking-technique",
    type: "video",
    species: "sheep",
    title: "روش صحیح دوشش دستی",
    body: null,
    videoUrl: null,
  },
];

export function filterEducationEntries(
  entries: EducationEntry[],
  species: Species | "all",
  type: EducationType | "all"
): EducationEntry[] {
  return entries.filter(
    (e) => (species === "all" || e.species === "all" || e.species === species) && (type === "all" || e.type === type)
  );
}
