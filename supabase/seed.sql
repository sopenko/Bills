-- Bill Tracker Seed Data
-- Run this in the Supabase SQL Editor after running migration.sql
-- Adjust dates as needed for your testing

insert into bills (name, amount, due_date, category, type, paid, notes) values
  ('Rent', 1500.00, current_date + interval '12 days', 'housing', 'recurring', false, 'Monthly apartment rent'),
  ('Electric Bill', 120.50, current_date + interval '6 days', 'utilities', 'recurring', false, 'Power company'),
  ('Netflix', 15.99, current_date + interval '1 day', 'subscriptions', 'recurring', false, 'Standard plan'),
  ('Car Insurance', 180.00, current_date + interval '9 days', 'insurance', 'recurring', false, 'Quarterly payment'),
  ('Student Loan', 350.00, current_date - interval '2 days', 'loan', 'recurring', false, 'Federal loan payment - OVERDUE'),
  ('Gym Membership', 49.99, current_date - interval '5 days', 'other', 'recurring', true, 'Annual fee paid');
