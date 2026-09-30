alter table public.four_squads add column if not exists artwork_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('four-photos','four-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create index if not exists idx_four_members_photo_url
on public.four_members(photo_url)
where photo_url is not null;