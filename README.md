# KAT OS — Next.js + Python

Kigali Apple Tech repair and operations system.

- **Project root** (`app/`, `components/`, `lib/`, `package.json`): the Next.js (React) website that staff use in the browser.
- **`api/`**: Python (Flask) JSON API with all business logic, the database models and PDF documents (`api/app.py`, packages in `requirements.txt`).
- The database tables are the same as in the previous Flask version, so an existing SQLite or Neon database keeps working without a migration.

The browser only talks to one address. `/api/*` goes to the Python API, everything else to Next.js, so there is one login cookie.
On Vercel this split is done by `vercel.json` (the API runs as a Python function); locally and in Docker, Next.js forwards `/api/*` to the Flask server.

## Features
- Separate General Manager, Receptionist and Technician roles.
- General Manager-only daily sales, parts cost, expenses and profit/loss dashboard.
- Client registration without National ID.
- Universal client/device lookup by name, phone, IMEI/serial and KAT repair ticket.
- Dated client notes with staff author.
- IMEI/serial device lookup and duplicate detection; existing devices return to the linked client.
- Device ownership history and a manager transfer endpoint.
- iPhone, MacBook and iPad device categories; MacBook serial/IMEI is optional.
- Inventory by device category, with Screen, Battery, Back Glass, Flex Cable and Other part types.
- Supplier/source, purchase cost, selling price, stock quantity and reorder levels.
- Expenses: courier/carrier, money transfer, transport, customs, rent, salary, utilities, stock expense and other.
- Staff work email field and audit trail.
- Documents chamber: Invoice, Proforma, Quotation/Estimate, Receipt, Warranty Card, Appointment Card, Repair Intake/Job Card and Collection/Delivery Card (PDF).
- Repair workflow, T&C library, warranty, payments, email notifications, branches and reports.

## How the web app is built (components)

The interface uses **[shadcn/ui](https://ui.shadcn.com)** (free, MIT licence), which is built on Radix UI and Tailwind CSS, with **Lucide** icons. It is styled in the Kigali Apple Tech colours. Pages in `app/` are put together from components instead of raw HTML:

| Folder | Components |
|---|---|
| `components/ui/` | shadcn/ui base components (button, card, table, input, native-select, badge, sheet, dropdown-menu, sonner…). Add more with `npx shadcn@latest add <name>`. |
| `components/kat/` | KAT building blocks on top of shadcn/ui: `Button`, `LinkButton`, `Panel`, `PageHeader`, `TwoColumns`, `Detail`, `StatGrid`/`StatCard`, `DataTable`, `StatusBadge` (coloured by status), `Alert`, `Loading`, `Async`, `SearchBox`, and form parts: `ApiForm`, `SubmitButton`, `Field`, `TextAreaField`, `Select`, `SelectField`, `CheckboxField`. Import them from `@/components/kat`. |
| `components/layout/` | `Sidebar`, `TopBar` (account menu, slide-out menu on phones). The menu items are in `nav.ts`. |
| `components/repairs/` | `RepairInfo`, `RepairUpdateForm`, `PartsPanel`, `PaymentsPanel`, and `repairColumns` (shared table columns) |
| `components/clients/` | `ClientNotes`, `ClientDevices` |

`ApiForm` does the work every form needs: it sends the fields to the API, shows a spinner on the button while saving, and shows the success or error message as a pop-up. A form only lists its fields:

```tsx
<ApiForm layout="inline" action={(v) => api("/services", { body: v })} reset onSuccess={reload} success="Service added.">
  <Field label="Service" name="name" required />
  <SubmitButton>Add</SubmitButton>
</ApiForm>
```

The brand colours are the CSS variables at the top of `app/globals.css`.

## Run locally (development)

Requirements: Python 3.12 and Node.js 20 or newer.

From the project folder, once:
```
python -m venv .venv
.venv\Scripts\activate          (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
npm install
```
Then, every time:
```
npm run dev
```
This starts both the Python API (http://127.0.0.1:5000) and the website. Ctrl+C stops both.
(`npm run dev:web` starts only the website, `python api/app.py` only the API.)

Open **http://localhost:3000**.

### Which database is used
- If `.env.local` (in the project folder) has a Neon `DATABASE_URL`, the API uses Neon.
- To use the local SQLite file instead (`instance/kat_os.db`), set `KAT_DATABASE_URL=sqlite:///kat_os.db` before `python api/app.py`.

On a fresh database, the first General Manager account comes from `KAT_ADMIN_USERNAME`, `KAT_ADMIN_PASSWORD` and `KAT_ADMIN_NAME`. Set them before the first start. Also set `KAT_SECRET_KEY` in production.

## Deploy on Vercel
Push to `main`: Vercel builds the Next.js website and runs `api/app.py` as a Python function (settings in `vercel.json`).
Set these environment variables in the Vercel project: `DATABASE_URL` (Neon), `KAT_SECRET_KEY` (long random text), `KAT_COOKIE_SECURE=1`, and optionally `RESEND_API_KEY`, `KAT_EMAIL_FROM`.

## Deploy for free on your own server
See **[DEPLOY.md](DEPLOY.md)**. It covers an Oracle Cloud "Always Free" server (or a shop PC) with Docker, free HTTPS and a free DuckDNS address, at a total cost of 0 RWF.
