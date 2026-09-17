-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('manager', 'operator', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PERSONNEL table (pre-created by admin, matched on signup)
create table public.personnel (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  full_name text not null,
  role text not null default 'operator' check (role in ('manager', 'operator', 'admin')),
  department text,
  is_active boolean default true,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- JOB_CARDS table
create table public.job_cards (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  location text not null,
  observed_at timestamp with time zone not null,
  required_actions text not null,
  departments text[] not null default '{}',
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'started', 'in_progress', 'completed', 'overdue')),
  created_by uuid references public.profiles(id) not null,
  due_date timestamp with time zone,
  estimated_time text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  completion_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- JOB_PHOTOS table
create table public.job_photos (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.job_cards(id) on delete cascade not null,
  url text not null,
  type text not null check (type in ('issue', 'completion')),
  file_name text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- JOB_ASSIGNMENTS table
create table public.job_assignments (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.job_cards(id) on delete cascade not null,
  personnel_id uuid references public.personnel(id) on delete cascade not null,
  profile_id uuid references public.profiles(id),
  status text not null default 'unopened' check (status in ('unopened', 'opened', 'started', 'completed')),
  opened_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(job_id, personnel_id)
);

-- JOB_COMMENTS / COMMITS table (plan of action, previous commits)
create table public.job_commits (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.job_cards(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  message text not null,
  estimated_time text,
  type text not null default 'comment' check (type in ('plan', 'comment', 'status_update')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.personnel enable row level security;
alter table public.job_cards enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_commits enable row level security;

-- Policies (open for authenticated users for MVP, tighten later)
-- PROFILES
create policy "Allow all for authenticated" on public.profiles for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow read for all" on public.profiles for select using (true);
create policy "Allow insert during signup" on public.profiles for insert with check (true);

-- PERSONNEL
create policy "Allow all for authenticated personnel" on public.personnel for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow read for all personnel" on public.personnel for select using (true);
create policy "Allow insert personnel" on public.personnel for insert with check (true);

-- JOB_CARDS
create policy "Allow all for authenticated job_cards" on public.job_cards for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow read job_cards" on public.job_cards for select using (true);
create policy "Allow insert job_cards" on public.job_cards for insert with check (true);

-- JOB_PHOTOS
create policy "Allow all job_photos" on public.job_photos for all using (true) with check (true);

-- JOB_ASSIGNMENTS
create policy "Allow all job_assignments" on public.job_assignments for all using (true) with check (true);

-- JOB_COMMITS
create policy "Allow all job_commits" on public.job_commits for all using (true) with check (true);

-- Storage bucket for job photos
insert into storage.buckets (id, name, public) values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public read job-photos" on storage.objects for select using (bucket_id = 'job-photos');
create policy "Authenticated upload job-photos" on storage.objects for insert with check (bucket_id = 'job-photos' and auth.role() = 'authenticated');
create policy "Authenticated update job-photos" on storage.objects for update using (bucket_id = 'job-photos' and auth.role() = 'authenticated');
create policy "Authenticated delete job-photos" on storage.objects for delete using (bucket_id = 'job-photos' and auth.role() = 'authenticated');

-- Function to handle new user signup - auto match personnel
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  personnel_record public.personnel%rowelement;
begin
  -- Try to find matching personnel by email
  select * into personnel_record from public.personnel where email = new.email limit 1;

  if found then
    -- Insert profile with matched personnel data
    insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, personnel_record.full_name, personnel_record.role);

    -- Link personnel to profile
    update public.personnel set id = personnel_record.id where id = personnel_record.id;
    -- Update job_assignments to link profile_id
    update public.job_assignments set profile_id = new.id where personnel_id = personnel_record.id;
  else
    -- No personnel match, create profile with email prefix as name, default to manager for first user or operator
    insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, split_part(new.email, '@', 1), 'manager')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- Trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles before update on public.profiles for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_job_cards before update on public.job_cards for each row execute procedure public.handle_updated_at();
