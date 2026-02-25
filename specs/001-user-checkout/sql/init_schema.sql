-- 初期スキーマ: ユーザーチェックアウト機能
-- 実行: Supabase Console > SQL Editor にコピーして実行してください
-- 目的: products, payments, discord_notifications の作成 + RLS ポリシー

-- 拡張: pgcrypto を使用して UUID を生成
create extension if not exists pgcrypto;

-- Products テーブル
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  amount_jpy integer not null check (amount_jpy > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- インデックス
create index if not exists idx_products_created_at on public.products(created_at desc);

-- Payments テーブル
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  user_id uuid not null,
  user_name text not null,
  product_name text not null,
  amount_jpy integer not null check (amount_jpy > 0),
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_created_at on public.payments(created_at desc);
create index if not exists idx_payments_transaction_id on public.payments(transaction_id);

-- Discord Notifications テーブル
create table if not exists public.discord_notifications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','sending','sent','retrying','failed')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_discord_notifications_payment_id on public.discord_notifications(payment_id);

-- RLS: products (public read)
alter table public.products enable row level security;
create policy public_read_products on public.products for select using (true);

-- RLS: payments (users see own records; service role can insert)
alter table public.payments enable row level security;
create policy users_read_own_payments on public.payments for select using (auth.uid() = user_id);
-- Service role (server-side) should use Service Role key to bypass RLS when inserting.
create policy service_insert_payments on public.payments for insert with check (true);

-- RLS: discord_notifications (users can view notifications for their payments)
alter table public.discord_notifications enable row level security;
create policy users_view_own_notifications on public.discord_notifications for select using (
  payment_id in (select id from public.payments where user_id = auth.uid())
);

-- 初期データ: products
insert into public.products (product_name, amount_jpy)
values
  ('スタータープラン - ¥1,000', 1000),
  ('プロプラン - ¥2,500', 2500),
  ('エンタープライズプラン - ¥5,000', 5000)
on conflict do nothing;

-- NOTE:
-- - このスクリプトは Supabase Console の SQL Editor で実行してください。
-- - `SUPABASE_SERVICE_ROLE_KEY` を使用する処理（外部ジョブや Server Action 内）は、
--   サービスロールキーでサーバーサイドで実行してください（クライアントに公開しないでください）。
