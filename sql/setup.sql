-- 彌榮家ざいこさん / Supabase setup
-- 注意：既存の categories / items / history テーブルがある場合は削除して作り直します。
-- はじめて使うプロジェクト、またはこのアプリ専用プロジェクトで実行してください。

create extension if not exists pgcrypto;

drop table if exists public.history cascade;
drop table if exists public.items cascade;
drop table if exists public.categories cascade;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reading text not null,
  stock text not null default '1',
  category_id uuid not null references public.categories(id) on delete restrict,
  memo text not null default '',
  updated_by text not null default '未記入',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.history (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  item_name text not null default '',
  before_stock text not null default '',
  after_stock text not null default '',
  updated_by text not null default '未記入',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index idx_items_category_id on public.items(category_id);
create index idx_items_reading on public.items(reading);
create index idx_items_pinned on public.items(pinned);
create index idx_categories_sort_order on public.categories(sort_order);
create index idx_history_created_at on public.history(created_at desc);

alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.history enable row level security;

-- URLを知っている人は全員、閲覧・追加・修正・削除ができる設定です。
-- より安全にしたい場合は、後で authenticated のみに変更してください。
create policy "public read categories" on public.categories for select to anon, authenticated using (true);
create policy "public insert categories" on public.categories for insert to anon, authenticated with check (true);
create policy "public update categories" on public.categories for update to anon, authenticated using (true) with check (true);
create policy "public delete categories" on public.categories for delete to anon, authenticated using (true);

create policy "public read items" on public.items for select to anon, authenticated using (true);
create policy "public insert items" on public.items for insert to anon, authenticated with check (true);
create policy "public update items" on public.items for update to anon, authenticated using (true) with check (true);
create policy "public delete items" on public.items for delete to anon, authenticated using (true);

create policy "public read history" on public.history for select to anon, authenticated using (true);
create policy "public insert history" on public.history for insert to anon, authenticated with check (true);
create policy "public update history" on public.history for update to anon, authenticated using (true) with check (true);
create policy "public delete history" on public.history for delete to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.categories to anon, authenticated;
grant select, insert, update, delete on public.items to anon, authenticated;
grant select, insert, update, delete on public.history to anon, authenticated;

insert into public.categories (name, sort_order) values
('調味料', 0),
('野菜', 1),
('スパイス', 2),
('粉物', 3),
('乾物', 4);

insert into public.items (name, reading, stock, category_id, memo, updated_by, pinned)
select 'ふじもと醤油', 'ふじもとしょうゆ', '1', id, '', 'もっピー', true from public.categories where name = '調味料'
union all
select '純米調理酒', 'じゅんまいちょうりしゅ', '0', id, '', 'もっピー', false from public.categories where name = '調味料'
union all
select 'オリーブ油', 'おりーぶゆ', '1/2', id, '', 'あきと', false from public.categories where name = '調味料'
union all
select 'マスタード', 'ますたーど', '0', id, '', 'あきと', false from public.categories where name = '調味料'
union all
select '薄力粉', 'はくりきこ', '1/4', id, '', 'もっピー', false from public.categories where name = '粉物'
union all
select '片栗粉', 'かたくりこ', '1', id, '', 'あきと', false from public.categories where name = '粉物'
union all
select 'にんじん', 'にんじん', '2', id, '', 'もっピー', false from public.categories where name = '野菜'
union all
select '玉ねぎ', 'たまねぎ', '1', id, '', 'あきと', false from public.categories where name = '野菜'
union all
select '黒こしょう', 'くろこしょう', '1/4', id, '', 'もっピー', true from public.categories where name = 'スパイス'
union all
select 'カレー粉', 'curry powder', '3/4', id, '', 'あきと', false from public.categories where name = 'スパイス'
union all
select '昆布', 'こんぶ', '0', id, '', 'あきと', false from public.categories where name = '乾物'
union all
select '干ししいたけ', 'hoshi shiitake', '1', id, '', 'もっピー', false from public.categories where name = '乾物';