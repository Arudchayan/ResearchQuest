-- Migration: atomic XP increment RPC (PR15 item 36)
-- Created at: 1764802000
--
-- Collapses the gamification profile read-modify-write (select + update)
-- into a single atomic UPDATE so concurrent XP awards (e.g. bulk paper
-- imports) cannot lose increments to a lost-update race. The level is
-- recomputed server-side with the same formula as the client
-- (level = floor(total_xp / 500) + 1). Streak/count/token fields are absolute
-- writes; NULL means "leave unchanged" so callers only send what changed.

create or replace function public.increment_xp(
  p_user_id uuid,
  p_xp_earned integer,
  p_current_streak integer default null,
  p_longest_streak integer default null,
  p_last_activity_date date default null,
  p_notes_count integer default null,
  p_papers_count integer default null,
  p_tasks_completed_count integer default null,
  p_papers_with_insights_count integer default null,
  p_streak_freeze_tokens integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_user_id != auth.uid() then
    raise exception 'permission denied';
  end if;

  if coalesce(p_xp_earned, 0) < 0 then
    raise exception 'xp_earned must be non-negative';
  end if;

  update public.user_profiles
  set
    total_xp = coalesce(total_xp, 0) + coalesce(p_xp_earned, 0),
    current_level = (coalesce(total_xp, 0) + coalesce(p_xp_earned, 0)) / 500 + 1,
    current_streak = coalesce(p_current_streak, current_streak),
    longest_streak = coalesce(p_longest_streak, longest_streak),
    last_activity_date = coalesce(p_last_activity_date, last_activity_date),
    notes_count = coalesce(p_notes_count, notes_count),
    papers_count = coalesce(p_papers_count, papers_count),
    tasks_completed_count = coalesce(p_tasks_completed_count, tasks_completed_count),
    papers_with_insights_count = coalesce(p_papers_with_insights_count, papers_with_insights_count),
    streak_freeze_tokens = coalesce(p_streak_freeze_tokens, streak_freeze_tokens),
    updated_at = now()
  where id = p_user_id
  returning jsonb_build_object(
    'total_xp', total_xp,
    'current_level', current_level,
    'current_streak', current_streak
  ) into result;

  if result is null then
    raise exception 'profile not found for user %', p_user_id;
  end if;

  return result;
end;
$$;

grant execute on function public.increment_xp(uuid, integer, integer, integer, date, integer, integer, integer, integer, integer) to authenticated;

comment on function public.increment_xp(uuid, integer, integer, integer, date, integer, integer, integer, integer, integer)
  is 'Atomically increments a user profile XP total and folds streak/count updates into one write (PR15 XP batching).';
