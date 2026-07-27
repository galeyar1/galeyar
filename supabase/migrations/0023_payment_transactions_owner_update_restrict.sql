-- payment_transactions_update_owner (0015) let an owner UPDATE any column
-- on their own payment row with no WITH CHECK at all — meaning a farm
-- owner could set status: 'success' on their own pending transaction
-- directly from the browser. Nothing currently auto-grants a plan off
-- payment_transactions.status (plan changes only happen via a separate
-- admin action), so this isn't exploitable today, but it's exactly the
-- gap that would matter the moment a real gateway callback path is wired
-- up. Restricting it now, before that day, to the only legitimate
-- self-service action: cancelling your own still-pending payment.
drop policy "payment_transactions_update_owner" on public.payment_transactions;

create policy "payment_transactions_owner_cancel_pending" on public.payment_transactions
  for update using (
    farm_id = public.current_farm_id()
    and public.current_role() = 'owner'
    and status = 'pending'
  )
  with check (
    farm_id = public.current_farm_id()
    and status = 'failed'
  );

-- Marking a transaction "success" (or any other transition) now requires
-- public.is_platform_admin(), matching payment_transactions_select_platform_admin
-- (0015) and every other admin-bypass policy added this session — real
-- gateway verification, once built, should run under a service-role edge
-- function rather than this policy, same as delete-user.
create policy "payment_transactions_update_platform_admin" on public.payment_transactions
  for update using (public.is_platform_admin());
