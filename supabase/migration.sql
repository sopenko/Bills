-- Bill Tracker Database Migration
-- Run this in the Supabase SQL Editor

create table bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null,
  due_date date not null,
  category text not null,
  type text not null default 'one-time',
  paid boolean not null default false,
  notes text,
  created_at timestamptz default now()
);

-- Create an index on due_date for faster queries
create index idx_bills_due_date on bills(due_date);

-- Create an index on paid status for filtering
create index idx_bills_paid on bills(paid);

-- Enable Row Level Security (optional, but recommended for production)
-- alter table bills enable row level security;

-- Create a policy to allow all operations (adjust for your auth needs)
-- create policy "Allow all" on bills for all using (true);
