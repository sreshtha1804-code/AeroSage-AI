create table if not exists profiles(
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  name text not null,
  type text not null check (type in ('child','elderly','worker','adult')),
  created_at timestamptz default now());
create index on profiles(device_id);
alter table profiles enable row level security; -- no public policies: only the server's service key can access
