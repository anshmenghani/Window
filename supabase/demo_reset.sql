-- Demo helpers for HackGT. Run ONE block at a time in the Supabase SQL Editor.
-- Change the username in quotes first. Usernames become <name>@users.windowapp.dev.
-- These only touch demo data; they never change tables, rules or accounts.


-- 1) "Let me send again today"
-- Each person can send one window per pen pal per day. This deletes the windows a
-- user sent TODAY (their translations and wall pins go with them), so they can send again.
delete from public.windows
where sender_id = (select id from auth.users where email = 'sid' || '@users.windowapp.dev')
  and local_date >= current_date - 1;


-- 2) "Free up Aiko for the next judge"
-- Everyone has at most one pen pal. This ends every current match for a user, so the
-- next person who picks their city can be matched with them.
update public.matches set status = 'ended'
where status in ('active', 'paused')
  and (select id from auth.users where email = 'aiko' || '@users.windowapp.dev') in (user_a, user_b);


-- 3) Check who is matched with whom right now
select m.city, m.status, a.name as person_a, b.name as person_b, m.created_at
from public.matches m
left join public.profiles a on a.id = m.user_a
left join public.profiles b on b.id = m.user_b
where m.status in ('active', 'paused')
order by m.created_at desc;
