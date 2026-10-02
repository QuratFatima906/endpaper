-- Endpaper schema. Rows mirror the client's IndexedDB records 1:1.
-- Every table: owner-only RLS (R-ACC-2), plus narrow public-read policies for shared content.
-- `server_updated_at` is stamped by the server and drives the sync pull cursor.

create or replace function stamp_server_updated_at() returns trigger language plpgsql as $$
begin new.server_updated_at := clock_timestamp(); return new; end $$;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  bio text not null default '',
  profile_hidden boolean not null default false,
  theme text not null default 'system',
  text_size text not null default 'm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table books (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  author text not null default '',
  isbn text,
  cover_url text,
  description text,
  status text not null default 'reading' check (status in ('reading','finished','set_aside')),
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  slug text not null,
  share jsonb not null default '{"reflection":false,"passages":false,"words":false,"pages":false,"mood":false}',
  started_at timestamptz,
  finished_at timestamptz,
  source text not null default 'manual',
  goodreads_rating int,
  goodreads_review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table passages (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid references books on delete cascade,
  image_id uuid,
  text text not null default '',
  alt text not null default '',
  page text not null default '',
  mark text check (mark in ('key','loved','confusing','disagree','glossary')),
  note text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table words (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid not null references books on delete cascade,
  passage_id uuid references passages on delete set null,
  word text not null default '',
  definition text not null default '',
  page text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table checkins (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid not null references books on delete cascade,
  mood text not null,
  understanding int not null check (understanding between 1 and 5),
  minutes int,
  pages text not null default '',
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table reflections (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid not null unique references books on delete cascade,
  takeaway text not null default '',
  understood text not null default '',
  unsure text not null default '',
  recommend text not null default '',
  verdict text check (verdict in ('loved','liked','not_for_me')),
  ratings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table essays (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid not null unique references books on delete cascade,
  title text not null default '',
  body text not null default '',
  slug text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table pages (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid not null references books on delete cascade,
  position int not null default 0,
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

-- Reports from public pages (R-PUB-13). Insert-only for everyone; read by service role.
create table reports (
  id bigint generated always as identity primary key,
  url text not null check (length(url) < 500),
  reason text not null default '' check (length(reason) < 2000),
  created_at timestamptz not null default now()
);

-- Anonymous aggregate only (R-AUTH-6): no personal data survives deletion.
create table deletion_log (
  id bigint generated always as identity primary key,
  deleted_on date not null default current_date
);

do $$ declare t text; begin
  foreach t in array array['profiles','books','passages','words','checkins','reflections','essays','pages'] loop
    execute format('create trigger stamp before insert or update on %I for each row execute function stamp_server_updated_at()', t);
    execute format('alter table %I enable row level security', t);
    if t = 'profiles' then
      execute 'create policy owner on profiles for all using (id = auth.uid()) with check (id = auth.uid())';
      execute 'create index profiles_sync on profiles (id, server_updated_at)';
    else
      execute format('create policy owner on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
      execute format('create index %I on %I (user_id, server_updated_at)', t || '_sync', t);
    end if;
  end loop;
end $$;
alter table reports enable row level security;
alter table deletion_log enable row level security;
create policy anyone_reports on reports for insert with check (true);

-- ---- Public reads (read-only, R-PUB-11/14) -------------------------------

create policy public_read on profiles for select using (not profile_hidden and deleted_at is null);

create policy public_read on books for select
  using (visibility <> 'private' and deleted_at is null);

create or replace function book_shares(b uuid, section text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from books where id = b and visibility <> 'private'
                 and deleted_at is null and coalesce((share ->> section)::boolean, false))
$$;

create policy public_read on passages for select
  using (deleted_at is null and not hidden and book_shares(book_id, 'passages'));
create policy public_read on words for select
  using (deleted_at is null and book_shares(book_id, 'words'));
create policy public_read on reflections for select
  using (deleted_at is null and book_shares(book_id, 'reflection'));
create policy public_read on pages for select
  using (deleted_at is null and book_shares(book_id, 'pages'));
create policy public_read on essays for select
  using (deleted_at is null and published_at is not null
         and exists (select 1 from books where books.id = book_id and visibility <> 'private' and deleted_at is null));

-- Mood line exposes only mood + understanding + date, never check-in free text.
create or replace function public_mood_line(b uuid)
returns table (created_at timestamptz, mood text, understanding int)
language sql stable security definer set search_path = public as $$
  select c.created_at, c.mood, c.understanding from checkins c
  where c.book_id = b and c.deleted_at is null and book_shares(b, 'mood')
  order by c.created_at
$$;

-- Username check without exposing hidden profiles.
create or replace function username_available(name text, self uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(name) and id is distinct from self)
$$;

grant execute on function public_mood_line(uuid) to anon, authenticated;
grant execute on function username_available(text, uuid) to anon, authenticated;
revoke execute on function book_shares(uuid, text) from public;
grant execute on function book_shares(uuid, text) to anon, authenticated;

-- ---- Storage: private bucket, one folder per user (R-ENG-2) ---------------
insert into storage.buckets (id, name, public) values ('passages', 'passages', false)
  on conflict (id) do nothing;

create policy "own images" on storage.objects for all to authenticated
  using (bucket_id = 'passages' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'passages' and (storage.foldername(name))[1] = auth.uid()::text);
