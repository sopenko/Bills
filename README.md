# Bill Tracker

A modern bill tracking web application built with React, Vite, Tailwind CSS, and Supabase. Features AI-powered PDF invoice parsing using the Anthropic Claude API.

## Features

- **Dashboard** - Summary cards showing total unpaid, overdue bills, due in 7 days, and paid this month
- **Due Soon Panel** - Color-coded list of bills due within 7 days (red=overdue, amber=3 days, green=7 days)
- **Bills List** - Filterable and sortable bill list with mark paid, edit, and delete actions
- **Add/Edit Bills** - Modal form for managing bills with support for recurring bills
- **Monthly Overview** - Charts showing spending by category and paid vs unpaid breakdown
- **PDF Invoice Import** - AI-powered extraction of bill data from PDF invoices

## Tech Stack

- **Frontend**: React + Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API (via Vercel serverless function)
- **Deployment**: Vercel

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd bill-tracker
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration:

```sql
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
```

3. (Optional) Seed with example data:

```sql
insert into bills (name, amount, due_date, category, type, paid, notes) values
  ('Rent', 1500.00, '2024-05-01', 'housing', 'recurring', false, 'Monthly apartment rent'),
  ('Electric Bill', 120.50, '2024-04-25', 'utilities', 'recurring', false, 'Power company'),
  ('Netflix', 15.99, '2024-04-20', 'subscriptions', 'recurring', true, 'Standard plan'),
  ('Car Insurance', 180.00, '2024-04-28', 'insurance', 'recurring', false, 'Quarterly payment'),
  ('Student Loan', 350.00, '2024-05-05', 'loan', 'recurring', false, 'Federal loan payment'),
  ('Gym Membership', 49.99, '2024-04-15', 'other', 'recurring', true, 'Annual fee paid');
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Fill in your credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and import your repository
2. Add the following environment variables in Project Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (no VITE_ prefix - server-side only)

3. Deploy:

```bash
vercel deploy
```

Or use the Vercel dashboard to deploy automatically on push.

## Usage

### Adding Bills

1. Click "Add Bill" in the header
2. Fill in the bill details
3. For recurring bills, select "Recurring" as the type

### Importing from PDF

1. Click "Import Invoice" in the header
2. Select a PDF invoice file
3. The AI will extract bill information and pre-fill the form
4. Review and edit the extracted data, then save

### Marking Bills as Paid

- Click "Mark Paid" on any unpaid bill
- For recurring bills, a new bill will automatically be created for the next month

## Project Structure

```
bill-tracker/
├── api/
│   └── parse-invoice.js    # Vercel serverless function for PDF parsing
├── src/
│   ├── components/
│   │   ├── BillForm.jsx    # Add/Edit bill modal
│   │   ├── BillsList.jsx   # Bills table with filtering
│   │   ├── Dashboard.jsx   # Summary cards
│   │   ├── DueSoon.jsx     # Due soon panel
│   │   ├── MonthlyOverview.jsx  # Charts
│   │   └── PdfImport.jsx   # PDF import button
│   ├── hooks/
│   │   └── useBills.js     # Bills data hook
│   ├── lib/
│   │   └── supabase.js     # Supabase client
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── vercel.json
└── README.md
```

## License

MIT
