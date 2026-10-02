-- The public mood line labels its lowest point with that sitting's pages (e.g. "ch. 7").
-- Still never exposes check-in free text.
drop function if exists public_mood_line(uuid);
create function public_mood_line(b uuid)
returns table (created_at timestamptz, mood text, understanding int, pages text)
language sql stable security definer set search_path = public as $$
  select c.created_at, c.mood, c.understanding, c.pages from checkins c
  where c.book_id = b and c.deleted_at is null and book_shares(b, 'mood')
  order by c.created_at
$$;
grant execute on function public_mood_line(uuid) to anon, authenticated;
