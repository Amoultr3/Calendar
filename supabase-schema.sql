create table if not exists public.calendar_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.calendar_items enable row level security;

create policy "Users can read their own calendar items"
on public.calendar_items for select using (auth.uid() = user_id);

create policy "Users can add their own calendar items"
on public.calendar_items for insert with check (auth.uid() = user_id);

create policy "Users can update their own calendar items"
on public.calendar_items for update using (auth.uid() = user_id);

create policy "Users can delete their own calendar items"
on public.calendar_items for delete using (auth.uid() = user_id);
