
## 1. Shrink the user dashboard cards (`src/pages/app/Dashboard.tsx`)

**Balance card** (currently `p-5`, 56px avatar, `text-4xl md:text-5xl` balance, big footer):
- Reduce padding from `p-5` → `p-4`.
- Avatar from `w-14 h-14` → `w-10 h-10`.
- Balance from `text-4xl md:text-5xl` → `text-2xl md:text-3xl`, top margin `mt-5` → `mt-3`.
- Divider margin `my-4` → `my-3`.
- Account No. / Status footer text scaled down to `text-sm` / smaller pill.

**Notification cards** (KYC, Card, ATC banners — currently `p-4` with `text-sm` body and separate CTA row):
- Reduce padding to `p-3`.
- Title from default → `text-sm font-medium`; body copy to `text-xs`.
- Shrink icons (`w-5 h-5` → `w-4 h-4`).
- Buttons already `size="sm"`; tighten top margin `mt-3` → `mt-2`.

No logic changes — visual/spacing only.

## 2. Admin dashboard wiring (verification, no code change needed)

Confirmed the admin app is already wired to real user data via the personal Supabase project:
- `src/pages/admin/Overview.tsx` — live counts of users, pending KYC, pending approvals across `transfer_requests`, `deposit_requests`, `loan_requests`, `card_requests`, `atc_requests`, plus total deposits. Subscribes to realtime `postgres_changes` on all those tables.
- `src/pages/admin/Approvals.tsx` — lists pending items per tab (transfers/deposits/loans/cards/ATC) with Approve/Reject buttons, refreshing live.
- `src/pages/admin/Users.tsx` — lists every profile with KYC badge, "Manage" opens a dialog with Approve KYC / Reject / Freeze / Unfreeze.
- All actions call the `admin-action` edge function, which updates the correct request table (`status = approved|rejected`), posts the transaction via `post_transaction` RPC, and emails the user.

If the admin console currently shows empty/stale data, the cause is that **`admin-action` is not yet deployed to your Supabase project**, not missing wiring. Deploy step below.

## 3. Where to credit / debit a user

The credit & debit controls live inside **Admin → Users & KYC → click "Manage" on any user**. In the dialog scroll to the "Credit / Debit account" section:
1. Pick the account (checking/savings) from the dropdown.
2. Enter a positive amount.
3. Enter an optional description.
4. Click **Credit** to add funds, **Debit** to remove funds (allows negative balance).

This calls `admin-action` with `kind: "adjustment"` which posts a real transaction and emails the user a `balance-adjusted` notification.

## 4. Transactional emails — deployment checklist

All email templates already exist in `supabase/functions/send-transactional-email/index.ts` (welcome, KYC approved/rejected, deposit/transfer/withdrawal/loan/card/ATC approved & rejected, balance-adjusted, frozen/unfrozen, etc.). They only work once you:

1. **Deploy the function** to your project:
   ```bash
   supabase functions deploy send-transactional-email
   supabase functions deploy admin-action
   supabase functions deploy internal-transfer
   ```
2. **Set the Resend secret** in Supabase Dashboard → Project Settings → Edge Functions → Secrets:
   - `RESEND_API_KEY` = your Resend key
3. **Verify the sender domain** `Lyncrestdigital.online` in your Resend dashboard so `noreply@Lyncrestdigital.online` can send. Until verified, Resend will only deliver to your own account owner email.
4. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — do not set manually.

No code changes are needed for email — the wiring is already there. If emails still don't arrive after deploy, share the Resend logs or the edge function logs and I'll debug.

## Technical notes
- Balance card gradient and semantic tokens preserved — only sizing utilities change.
- No schema, RLS, or edge function code touched in this plan.
