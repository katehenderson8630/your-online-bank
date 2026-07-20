
-- Enums
create type public.app_role as enum ('admin','customer');
create type public.kyc_status as enum ('pending','approved','rejected','frozen');
create type public.account_type as enum ('checking','savings');
create type public.tx_type as enum ('deposit','withdrawal','transfer_in','transfer_out','adjustment','reversal','bill_payment','card_purchase','fee','interest');
create type public.tx_status as enum ('pending','approved','completed','rejected','reversed','failed');
create type public.request_status as enum ('pending','approved','rejected');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  address text,
  date_of_birth date,
  avatar_url text,
  kyc_status public.kyc_status not null default 'pending',
  kyc_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = 'admin')
$$;

-- Accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_number text not null unique,
  account_type public.account_type not null,
  balance numeric(18,2) not null default 0,
  currency text not null default 'USD',
  is_frozen boolean not null default false,
  created_at timestamptz not null default now()
);

-- Transactions (ledger)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.tx_type not null,
  status public.tx_status not null default 'completed',
  amount numeric(18,2) not null,
  balance_after numeric(18,2),
  description text,
  counterparty text,
  related_tx_id uuid references public.transactions(id),
  reference text not null default substr(replace(gen_random_uuid()::text,'-',''),1,12),
  created_at timestamptz not null default now()
);
create index on public.transactions(account_id, created_at desc);
create index on public.transactions(user_id, created_at desc);

-- Transfer requests
create table public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id),
  to_account_id uuid references public.accounts(id),
  external_account_number text,
  external_routing_number text,
  external_recipient_name text,
  amount numeric(18,2) not null check (amount > 0),
  memo text,
  is_external boolean not null default false,
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Deposit requests
create table public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  amount numeric(18,2) not null check (amount > 0),
  check_image_url text,
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Withdrawal requests
create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  amount numeric(18,2) not null check (amount > 0),
  method text not null default 'bank_transfer',
  status public.request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Cards
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  card_number text not null unique,
  cardholder_name text not null,
  expiry_month int not null,
  expiry_year int not null,
  cvv text not null,
  is_frozen boolean not null default false,
  spending_limit numeric(18,2),
  created_at timestamptz not null default now()
);

-- Payees
create table public.payees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_number text not null,
  category text,
  created_at timestamptz not null default now()
);

-- Bill payments
create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  payee_id uuid not null references public.payees(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  scheduled_for date not null,
  recurring text,
  status public.tx_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Audit log
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_user_id uuid,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile + customer role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Account number generator
create or replace function public.gen_account_number() returns text language sql as $$
  select lpad((floor(random()*1e10))::bigint::text, 10, '0')
$$;

-- Money movement RPC: atomic transfer/deposit/withdraw/adjustment
create or replace function public.post_transaction(
  _account_id uuid,
  _type public.tx_type,
  _amount numeric,
  _description text default null,
  _counterparty text default null,
  _related_tx_id uuid default null,
  _allow_negative boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  _delta numeric;
  _new_balance numeric;
  _user uuid;
  _tx_id uuid;
  _frozen boolean;
begin
  select user_id, is_frozen into _user, _frozen from public.accounts where id = _account_id for update;
  if _user is null then raise exception 'Account not found'; end if;
  if _frozen and not _allow_negative then raise exception 'Account is frozen'; end if;

  _delta := case
    when _type in ('deposit','transfer_in','interest','reversal','adjustment') then _amount
    else -_amount
  end;

  update public.accounts set balance = balance + _delta where id = _account_id returning balance into _new_balance;

  if _new_balance < 0 and not _allow_negative then
    raise exception 'Insufficient funds';
  end if;

  insert into public.transactions(account_id, user_id, type, status, amount, balance_after, description, counterparty, related_tx_id)
  values (_account_id, _user, _type, 'completed', _amount, _new_balance, _description, _counterparty, _related_tx_id)
  returning id into _tx_id;

  return _tx_id;
end $$;

-- Internal transfer RPC (atomic dual leg)
create or replace function public.execute_internal_transfer(
  _from uuid, _to uuid, _amount numeric, _memo text
) returns uuid language plpgsql security definer set search_path = public as $$
declare _out uuid; _in uuid; _to_user uuid; _from_user uuid;
begin
  if _amount <= 0 then raise exception 'Amount must be positive'; end if;
  select user_id into _from_user from public.accounts where id = _from;
  select user_id into _to_user from public.accounts where id = _to;
  _out := public.post_transaction(_from,'transfer_out',_amount,_memo,_to_user::text);
  _in := public.post_transaction(_to,'transfer_in',_amount,_memo,_from_user::text,_out);
  update public.transactions set related_tx_id = _in where id = _out;
  return _out;
end $$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.transfer_requests enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.cards enable row level security;
alter table public.payees enable row level security;
alter table public.bill_payments enable row level security;
alter table public.admin_audit_log enable row level security;

-- Profiles policies
create policy "users view own profile" on public.profiles for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "admins update any profile" on public.profiles for update using (public.is_admin(auth.uid()));
create policy "system inserts profile" on public.profiles for insert with check (auth.uid() = id);

-- User roles
create policy "users view own roles" on public.user_roles for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "admins manage roles" on public.user_roles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Accounts
create policy "users view own accounts" on public.accounts for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "admins manage accounts" on public.accounts for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Transactions
create policy "users view own tx" on public.transactions for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "admins insert tx" on public.transactions for insert with check (public.is_admin(auth.uid()));

-- Transfer requests
create policy "users view own tr" on public.transfer_requests for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "users create tr" on public.transfer_requests for insert with check (auth.uid() = user_id);
create policy "admins update tr" on public.transfer_requests for update using (public.is_admin(auth.uid()));

-- Deposit requests
create policy "users view own dr" on public.deposit_requests for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "users create dr" on public.deposit_requests for insert with check (auth.uid() = user_id);
create policy "admins update dr" on public.deposit_requests for update using (public.is_admin(auth.uid()));

-- Withdrawal requests
create policy "users view own wr" on public.withdrawal_requests for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "users create wr" on public.withdrawal_requests for insert with check (auth.uid() = user_id);
create policy "admins update wr" on public.withdrawal_requests for update using (public.is_admin(auth.uid()));

-- Cards
create policy "users view own cards" on public.cards for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "users insert own cards" on public.cards for insert with check (auth.uid() = user_id);
create policy "users update own cards" on public.cards for update using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "users delete own cards" on public.cards for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Payees
create policy "users manage own payees" on public.payees for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins view payees" on public.payees for select using (public.is_admin(auth.uid()));

-- Bill payments
create policy "users manage own bp" on public.bill_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins view bp" on public.bill_payments for select using (public.is_admin(auth.uid()));

-- Audit log
create policy "admins view audit" on public.admin_audit_log for select using (public.is_admin(auth.uid()));
create policy "admins insert audit" on public.admin_audit_log for insert with check (public.is_admin(auth.uid()));

-- Storage buckets
insert into storage.buckets (id, name, public) values ('kyc-selfies','kyc-selfies', false), ('deposit-checks','deposit-checks', false);

-- Storage policies (path: {user_id}/filename)
create policy "users upload own selfie" on storage.objects for insert with check (
  bucket_id = 'kyc-selfies' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "users read own selfie" on storage.objects for select using (
  bucket_id = 'kyc-selfies' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()))
);
create policy "users update own selfie" on storage.objects for update using (
  bucket_id = 'kyc-selfies' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users upload own check" on storage.objects for insert with check (
  bucket_id = 'deposit-checks' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "users read own check" on storage.objects for select using (
  bucket_id = 'deposit-checks' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()))
);
