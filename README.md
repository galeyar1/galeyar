# گله‌یار (Galeyar)

دستیار هوشمند مدیریت دامداری — یک Progressive Web App آفلاین‌محور برای دامداران ایرانی (گوسفند، بز، گاو، شتر).

این مخزن پایه (foundation) نسخه ۲ گله‌یار است: احراز هویت، مزارع، کاربران، دام‌ها و داشبورد به‌صورت کامل پیاده‌سازی شده‌اند؛ ماژول‌های شیر/وزن/بیماری/تولد/درمان/خوراک روی همان الگوی آماده (RLS + Dexie + Sync Engine) قابل تکمیل‌اند.

## پشته فنی

| لایه | فناوری |
|---|---|
| Frontend | Next.js 15 (App Router, **static export**), TypeScript, Tailwind v4, shadcn/ui |
| ذخیره‌سازی آفلاین | IndexedDB از طریق Dexie |
| بک‌اند | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| نمودارها | Recharts |
| فونت | Vazirmatn (self-hosted از طریق next/font) |
| تقویم | شمسی/جلالی (jalaali-js + react-multi-date-picker) |
| هاستینگ | Cloudflare Pages |
| پیامک OTP | Kavenegar (از طریق Supabase Auth `send_sms` hook) |

## چرا Static Export به‌جای SSR؟

Next.js 15 روی Cloudflare Pages با آداپتور `@cloudflare/next-on-pages` محدودیت‌های زیادی دارد. چون بک‌اند واقعی این پروژه Supabase است (نه API routeهای Next.js)، کل اپ با `output: "export"` به فایل‌های استاتیک تبدیل می‌شود؛ کلاینت مستقیم با `supabase-js` صحبت می‌کند و امنیت را **Row Level Security** در پستگرس تضمین می‌کند، نه پنهان‌کاری کلید. نتیجه: دیپلوی تضمینی و ساده روی Cloudflare Pages، بدون هیچ کانفیگ ویژه‌ای.

## ساختار پروژه

```
src/
  app/
    auth/login, auth/verify      ورود با شماره موبایل + کد یک‌بار مصرف
    onboarding/farm              ثبت مزرعه برای کاربر جدید (owner)
    (app)/dashboard, (app)/animals   بخش‌های اصلی پس از ورود
  components/ui/                 کامپوننت‌های shadcn + تقویم شمسی سفارشی
  lib/
    supabase/                    کلاینت + تایپ‌های دیتابیس
    db/schema.ts                 اسکیمای Dexie (IndexedDB)
    sync/                        موتور همگام‌سازی آفلاین (repository.ts + engine.ts)
    auth/                        AuthProvider + اعتبارسنجی شماره موبایل ایرانی
    jalali.ts                    تبدیل و فرمت تاریخ شمسی
supabase/
  migrations/                    اسکیمای کامل + RLS + Storage policies
  functions/
    send-sms-hook/                Auth Hook که OTP را از طریق Kavenegar ارسال می‌کند
    generate-ai-insights/         Job زمان‌بندی‌شده برای پیش‌بینی‌های دستیار هوشمند
scripts/
  generate-icons.mjs              تولید آیکون‌های PWA از SVG منبع
  build-sw.mjs                   تولید Service Worker با Workbox بعد از هر build
```

## معماری همگام‌سازی آفلاین

هر نوشتن (ثبت دام، شیر، وزن، ...) این مسیر را طی می‌کند:

1. نوشتن فوری در IndexedDB با شناسه UUID تولیدشده در کلاینت → UI بلافاصله به‌روز می‌شود (بدون انتظار شبکه).
2. اضافه‌شدن یک رکورد به صف همگام‌سازی محلی (`sync_queue`).
3. هروقت اتصال برقرار باشد (رویداد `online`، بازگشت به تب، یا تایمر ۶۰ ثانیه‌ای — چون iOS Safari از Background Sync API پشتیبانی نمی‌کند)، موتور همگام‌سازی صف را به Supabase ارسال و تغییرات جدید سرور را دریافت می‌کند.
4. تعارض‌ها با Last-Write-Wins بر اساس `updated_at` سرور حل می‌شوند.

نمایش دائمی برای این وضعیت با هوک `useSyncStatus` (در `src/lib/sync/use-sync-status.ts`) در دسترس است.

## متغیرهای محیطی

فایل `.env.local.example` را کپی کنید:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

⚠️ چون خروجی این پروژه استاتیک است، این مقادیر در **زمان build** داخل باندل جاسازی می‌شوند، نه در زمان اجرا. یعنی در Cloudflare Pages باید این دو متغیر را در تنظیمات پروژه (Settings → Environment variables) وارد کنید **قبل از** اجرای build.

## راه‌اندازی Supabase

1. یک پروژه جدید در [supabase.com](https://supabase.com) بسازید.
2. مایگریشن‌ها را اجرا کنید:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   (فایل‌های `supabase/migrations/*.sql` به ترتیب اجرا می‌شوند: اسکیما → توابع/تریگرها → RLS → Storage.)
3. **OTP پیامکی (Kavenegar):**
   - تابع `send-sms-hook` را دیپلوی کنید: `npx supabase functions deploy send-sms-hook`
   - Secrets لازم را ست کنید:
     ```bash
     npx supabase secrets set KAVENEGAR_API_KEY=... KAVENEGAR_OTP_TEMPLATE=... SEND_SMS_HOOK_SECRET=...
     ```
   - در Dashboard → Authentication → Hooks (یا بخش `[auth.hook.send_sms]` در `supabase/config.toml`)، این تابع را به‌عنوان **Send SMS Hook** معرفی کنید و `SEND_SMS_HOOK_SECRET` را با مقداری که Supabase هنگام فعال‌سازی هوک نشان می‌دهد هماهنگ کنید.
   - ⚠️ نحوه دقیق تنظیم Auth Hooks بین نسخه‌های CLI/Dashboard سوپابیس تغییر کرده؛ قبل از دیپلوی نهایی با مستندات فعلی Supabase تطبیق دهید.
4. **دستیار هوشمند:** تابع `generate-ai-insights` را دیپلوی و در Dashboard → Edge Functions → Cron روی اجرای روزانه تنظیم کنید.
5. باکت Storage به‌نام `disease-images` به‌صورت خودکار توسط مایگریشن `0004_storage.sql` ساخته می‌شود.

## توسعه محلی

```bash
npm install
cp .env.local.example .env.local   # مقادیر واقعی پروژه Supabase را وارد کنید
npm run dev
```

## دیپلوی روی Cloudflare Pages

**گزینه ۱ — اتصال مستقیم Git (ساده‌ترین حالت):**
1. در Cloudflare Dashboard → Pages → Create a project → Connect to Git → مخزن `galeyar` را انتخاب کنید.
2. Build command: `npm run build`
3. Build output directory: `out`
4. متغیرهای محیطی بخش قبل را در Settings → Environment variables اضافه کنید.
5. Deploy — به‌محض هر push به `main`، دیپلوی خودکار انجام می‌شود.

**گزینه ۲ — GitHub Actions (`.github/workflows/deploy.yml`):**
این workflow روی هر push به `main` بیلد و از طریق `wrangler pages deploy` منتشر می‌کند. Secrets لازم در GitHub repo settings:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

بعد از دیپلوی اول، دامنه‌ی خودتان (مثلاً `galeyar.ir`) را در Cloudflare Pages → Custom domains متصل کنید.

## نقش‌ها و دسترسی‌ها

نقش‌ها (`owner`, `operator`, `vet`, `consultant`) هم در UI و هم در سطح **Row Level Security** پایگاه‌داده اعمال می‌شوند (`supabase/migrations/0003_rls.sql`) — یعنی حتی درخواست مستقیم به API هم نمی‌تواند محدودیت‌ها را دور بزند. برای افزودن اعضای جدید به مزرعه، owner یک ردیف در `farm_invites` (شماره موبایل + نقش) می‌سازد؛ وقتی آن شماره برای اولین بار وارد شود، تابع تایید OTP سوپابیس به‌صورت خودکار او را به مزرعه و نقش تعیین‌شده متصل می‌کند.

## نکات تکمیل‌نشده / گام‌های بعدی

- ماژول‌های شیر، وزن، بیماری، تولد، درمان، مدیریت خوراک: الگوی کامل (RLS + Dexie table + repository) آماده است؛ فقط فرم/صفحه UI باقی مانده — از `src/app/(app)/animals` به‌عنوان نمونه استفاده کنید.
- ناوبری اختصاصی Operator (Home/Registration/History/Profile) و صفحه مدیریت کاربران owner.
- صفحه‌های Reports/Analytics کامل (داده‌ها آماده‌اند، فقط نمایش باقی مانده).
- Splash screenهای اختصاصی iOS برای هر سایز دستگاه (فعلاً روی رفتار پیش‌فرض iOS 16.4+ برای manifest تکیه شده).
