-- Notification Center upgrade: the notifications table already existed
-- (farm_id, type, message, is_read) but was only ever surfaced in a small
-- "unread" list on the dashboard — this adds what a real notification
-- center needs, reusing the existing table/RLS pattern rather than a
-- parallel system. AI (generate-ai-insights) and admin (admin.galeyar.ir's
-- Notification Center/User 360/Segments broadcast, already inserting into
-- this exact table) both become real producers via the new `source` column.

alter type public.notification_type add value if not exists 'announcement';
alter type public.notification_type add value if not exists 'health';
alter type public.notification_type add value if not exists 'vaccination';
alter type public.notification_type add value if not exists 'breeding';
alter type public.notification_type add value if not exists 'lambing';
alter type public.notification_type add value if not exists 'feeding';
alter type public.notification_type add value if not exists 'inventory';
alter type public.notification_type add value if not exists 'financial';
alter type public.notification_type add value if not exists 'ai_insight';

alter table public.notifications
  add column title text,
  add column source text not null default 'system' check (source in ('admin', 'ai', 'system')),
  add column animal_id uuid references public.animals (id) on delete set null,
  add column target_url text,
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent'));

-- The only existing producer (generate-ai-insights edge function) inserts
-- type='feed_low' rows — backfill their true source now that the column
-- exists, edge function itself is updated to set it explicitly going forward.
update public.notifications set source = 'ai' where type = 'feed_low';

-- Read state (is_read) has always been one shared flag per farm, not
-- per-user — reused as-is here rather than introducing a per-user
-- read-tracking table, since every existing farm-scoped notification
-- consumer (the dashboard's unread list) already relies on that shape and
-- most farms are single-owner-operated. notifications_update_owner (0003)
-- only let the owner flip it, while notifications_select_owner_consultant
-- already let a consultant read it — widened to match, so a consultant
-- opening the new notification center can actually mark things read
-- instead of the update silently affecting 0 rows.
drop policy "notifications_update_owner" on public.notifications;
create policy "notifications_update_owner_consultant" on public.notifications
  for update using (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'consultant'));

-- Lets the new notification bell subscribe to postgres_changes instead of
-- polling — table-level opt-in, RLS still applies to what a subscriber
-- actually receives.
alter publication supabase_realtime add table public.notifications;
