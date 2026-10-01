# KAT OS — Final Integrated Build

Kigali Apple Tech repair and operations system.

## Included
- Separate General Manager, Receptionist and Technician roles.
- General Manager-only daily sales, parts cost, expenses and profit/loss dashboard.
- Client registration without National ID.
- Universal client/device lookup by name, phone, IMEI/serial and KAT repair ticket.
- Dated client notes with staff author.
- IMEI/serial device lookup and duplicate detection; existing devices return to the linked client.
- Device ownership model/history support and manager transfer endpoint.
- iPhone, MacBook and iPad device categories; MacBook serial/IMEI is optional.
- Inventory separated by device category, with Screen, Battery, Back Glass, Flex Cable and Other part types.
- Supplier/source, purchase cost, selling price, stock quantity and reorder levels.
- Expenses: courier/carrier, money transfer, transport, customs, rent, salary, utilities, stock expense and other.
- Staff work-email field and audit trail.
- Documents chamber: Invoice, Proforma, Quotation/Estimate, Receipt, Warranty Card, Appointment Card, Repair Intake/Job Card and Collection/Delivery Card.
- Existing repair workflow, T&C library, warranty, payments, notifications, branches and reports.

## Run
1. `python -m venv .venv`
2. Activate the environment.
3. `pip install -r requirements.txt`
4. `python app.py`
5. Open `http://127.0.0.1:5000`

Initial fresh-database login: `christian` / `ChangeMe123!`. Set `KAT_ADMIN_USERNAME`, `KAT_ADMIN_PASSWORD`, and `KAT_ADMIN_NAME` before first production deployment. Also set `KAT_SECRET_KEY` in production.

For Vercel, configure `DATABASE_URL` to a persistent PostgreSQL database (for example Neon, Supabase, or Vercel Postgres). Do not use the default SQLite database in production because Vercel's filesystem is temporary.

## Database note
This build adds tables/columns compared with v2. For an existing production database, use a proper migration before deploying. For a clean test, start with a fresh SQLite database.
