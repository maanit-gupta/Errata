-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill users created before this migration
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;
