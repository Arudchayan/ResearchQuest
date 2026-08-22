create or replace function public.save_idea_with_links(
  p_user_id uuid,
  p_idea_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_stage text default 'Seed',
  p_linked_note_ids text[] default null,
  p_linked_paper_ids text[] default null
)
returns public.ideas
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_title text;
  cleaned_description text;
  next_stage text;
  result public.ideas;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_user_id != auth.uid() then
    raise exception 'permission denied';
  end if;

  cleaned_title := trim(coalesce(p_title, ''));
  if cleaned_title = '' then
    raise exception 'title is required';
  end if;

  cleaned_description := nullif(trim(coalesce(p_description, '')), '');
  next_stage := coalesce(nullif(trim(coalesce(p_stage, '')), ''), 'Seed');

  if next_stage not in ('Seed', 'Developing', 'Supported', 'Mature') then
    raise exception 'invalid idea stage: %', next_stage;
  end if;

  if p_idea_id is null then
    insert into public.ideas (
      user_id,
      title,
      description,
      stage,
      linked_note_ids,
      linked_paper_ids,
      updated_at
    )
    values (
      p_user_id,
      cleaned_title,
      cleaned_description,
      next_stage,
      coalesce(p_linked_note_ids, '{}'),
      coalesce(p_linked_paper_ids, '{}'),
      now()
    )
    returning * into result;
  else
    update public.ideas
    set
      title = cleaned_title,
      description = cleaned_description,
      stage = next_stage,
      linked_note_ids = coalesce(p_linked_note_ids, public.ideas.linked_note_ids),
      linked_paper_ids = coalesce(p_linked_paper_ids, public.ideas.linked_paper_ids),
      updated_at = now()
    where id = p_idea_id
      and user_id = p_user_id
    returning * into result;

    if not found then
      raise exception 'Idea % not found for user %', p_idea_id, p_user_id;
    end if;
  end if;

  return result;
end;
$$;

grant execute on function public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) to authenticated;

comment on function public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[])
  is 'Creates or updates an idea row while keeping related array fields consistent within a transaction.';
