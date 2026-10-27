"""KAT OS JSON API (Flask). The Next.js app in ../web calls these routes under /api."""
from flask import Flask, request, session, send_file, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import joinedload, selectinload
from werkzeug.exceptions import HTTPException, BadRequest, Unauthorized, Forbidden, Conflict
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime, date, timedelta, timezone
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from dotenv import load_dotenv
from markupsafe import escape
import os, json, urllib.request, urllib.error

API_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(API_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env.local")); load_dotenv(os.path.join(API_DIR, ".env.local"))

# instance_path stays at the repo root so the existing local SQLite file (instance/kat_os.db) keeps working.
app = Flask(__name__, instance_path=os.path.join(ROOT_DIR, "instance"))
app.config["SECRET_KEY"] = os.getenv("KAT_SECRET_KEY", "CHANGE-ME-IN-PRODUCTION")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("KAT_COOKIE_SECURE") == "1"
database_url = os.getenv("KAT_DATABASE_URL", os.getenv("DATABASE_URL", "sqlite:///kat_os.db"))
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
if database_url.startswith("postgresql://"):  # use psycopg 3 (the driver in requirements.txt) explicitly
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
# Cloud databases (Neon) and mobile/NAT networks drop idle connections: test each connection before use,
# replace connections older than ~4 minutes, and send TCP keepalives so idle ones stay open.
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True, "pool_recycle": 240}
if database_url.startswith("postgresql"):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"]["connect_args"] = {"connect_timeout": 15, "keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10, "keepalives_count": 3}
db = SQLAlchemy(app)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("KAT_EMAIL_FROM", "Kigali Apple Tech <notifications@kigaliappletech.com>")
EMAIL_REPLY_TO = os.getenv("KAT_EMAIL_REPLY_TO", "")
SHOP_PHONE = "0788 882 114"

STATUSES = ["Received","Diagnosing","Waiting for Approval","Repairing","Ready","Collected","Cancelled"]
ROLES = ["General Manager","Receptionist","Technician"]
MANAGER_ROLES = ["Admin","General Manager"]
# What a staff member may use. The General Manager always has everything (plus Users, Branches and Audit Log, which only managers get).
# Other staff get their role's defaults, which the manager can change per person.
PERMISSIONS = [
    {"key":"clients","label":"Clients & devices","description":"Register clients, add notes and devices, scan IMEI / serial","group":"Daily work"},
    {"key":"repairs","label":"Repairs","description":"Create and update repair tickets, payments and parts used","group":"Daily work"},
    {"key":"inventory","label":"Inventory","description":"See stock, add stock, check in and check out, receipts","group":"Daily work"},
    {"key":"documents","label":"Documents","description":"Print invoices, quotations, receipts and warranty cards","group":"Daily work"},
    {"key":"services","label":"Services & prices","description":"Add services and change prices","group":"Daily work"},
    {"key":"notifications","label":"Notifications","description":"See and send client messages","group":"Daily work"},
    {"key":"reports","label":"Reports","description":"Repair and revenue reports","group":"Daily work"},
    {"key":"finance","label":"Sales & profit","description":"Today's sales, costs and profit on the dashboard","group":"Management"},
    {"key":"products","label":"Products","description":"Add, edit and delete products","group":"Management"},
    {"key":"expenses","label":"Expenses","description":"Record and see expenses","group":"Management"},
]
PERMISSION_KEYS = [p["key"] for p in PERMISSIONS]
DAILY_WORK = [p["key"] for p in PERMISSIONS if p["group"]=="Daily work"]
ROLE_PERMISSIONS = {"General Manager":PERMISSION_KEYS,"Receptionist":DAILY_WORK,"Technician":DAILY_WORK}
DEVICE_CATEGORIES = ["iPhone","MacBook","iPad"]
PART_CATEGORIES = ["Screen","Battery","Back Glass","Flex Cable","Other"]
EXPENSE_CATEGORIES = ["Courier / Carrier","Money Transfer Fee","Transport","Customs","Rent","Salary","Utilities","Stock Expense","Other"]
PAYMENT_METHODS = ["Cash","Mobile Money","Bank","Card","Other"]
PRODUCT_TYPES = ["Finished","Semi-finished","Raw material"]
CHECK_IN_REASONS = ["Received from supplier","Returned by customer","Found / stock count","Other"]
CHECK_OUT_REASONS = ["Sold","Used in repair","Damaged","Returned to supplier","Lost / stock count","Other"]
DOCUMENT_TYPES = ["Invoice","Proforma Invoice","Quotation / Estimate","Receipt","Warranty Card","Appointment Card","Repair Intake / Job Card","Device Collection / Delivery Card"]
TERMS = {
"Screen Replacement":["Screen tested before delivery.","Warranty covers touch/display defects only.","Broken, cracked, pressure marks, lines after impact, or liquid damage are not covered.","Opening device elsewhere voids warranty.","Face ID / fingerprint / True Tone performance depends on device condition and part compatibility."],
"Battery Replacement":["Battery calibrated and tested before delivery.","Battery life depends on usage habits, software, and charging pattern.","Swelling, overheating from misuse, impact damage, or liquid contact not covered.","Opening elsewhere voids warranty."],
"Charging Problem":["Charging function tested on pickup.","Use of poor-quality chargers/cables after repair may cause failure.","Liquid damage, physical force on port, or power surge damage not covered.","Hidden board charging faults may appear later."],
"Water Damage":["Water damage repair has no guaranteed long-term stability.","Hidden corrosion may cause future faults.","Some functions may fail later.","Limited / no warranty depending on diagnosis."],
"Camera Problem":["Camera tested before delivery.","Focus, stabilization, Face ID / flash functions depend on full system health.","Physical shock or liquid damage voids warranty."],
"Speaker / Microphone":["Sound tested before handover.","Dust, liquid, or impact damage after repair not covered."],
"Board / No Power / Dead Phone":["Advanced repair carries technical risk.","Hidden faults may exist.","Device may fail completely due to pre-existing damage.","Data recovery is not guaranteed.","Limited warranty only."],
"Software / Flashing / Unlocking":["Customer should back up data.","Data loss may occur during software repair.","Device lock/restriction from manufacturer/server is not guaranteed removable.","No liability for account lockouts such as Apple ID / Google account issues."],
"Back Glass / Housing Repair":["Cosmetic repair improves appearance/function only.","Waterproof seal may reduce after opening.","Small marks from dismantling may occur on previously damaged devices."],
"Display Green/White Lines / OLED Damage":["Internal display damage may worsen over time.","Temporary repair options are not guaranteed permanent.","Full screen replacement may be required."],
"Other Repair":["Repair is performed according to diagnosis and customer approval.","Pre-existing or hidden faults are not covered unless specifically included on the ticket.","Opening or repair by another party after collection voids KAT repair warranty."]
}

# ---------- Models (unchanged from the Flask/Jinja version, so existing databases keep working) ----------
class Branch(db.Model):
    id=db.Column(db.Integer,primary_key=True); name=db.Column(db.String(100),nullable=False); location=db.Column(db.String(180)); phone=db.Column(db.String(40)); active=db.Column(db.Boolean,default=True)
class User(db.Model):
    id=db.Column(db.Integer,primary_key=True); full_name=db.Column(db.String(120),nullable=False); username=db.Column(db.String(80),unique=True,nullable=False); password_hash=db.Column(db.String(255),nullable=False); role=db.Column(db.String(30),default="Technician"); work_email=db.Column(db.String(120)); branch_id=db.Column(db.Integer,db.ForeignKey("branch.id")); active=db.Column(db.Boolean,default=True)
    permissions=db.Column(db.Text)  # comma-separated keys from PERMISSIONS; empty column = the role's defaults
    branch=db.relationship("Branch")
class Client(db.Model):
    id=db.Column(db.Integer,primary_key=True); full_name=db.Column(db.String(120),nullable=False); phone=db.Column(db.String(30),nullable=False,index=True); email=db.Column(db.String(120)); address=db.Column(db.String(180)); created_at=db.Column(db.DateTime,default=datetime.utcnow)
    repairs=db.relationship("Repair",backref="client",lazy=True)
    notes=db.relationship("ClientNote",backref="client",lazy=True,cascade="all, delete-orphan")
class ClientNote(db.Model):
    id=db.Column(db.Integer,primary_key=True); client_id=db.Column(db.Integer,db.ForeignKey("client.id"),nullable=False); note=db.Column(db.Text,nullable=False); author=db.Column(db.String(120)); created_at=db.Column(db.DateTime,default=datetime.utcnow)
class Device(db.Model):
    id=db.Column(db.Integer,primary_key=True); client_id=db.Column(db.Integer,db.ForeignKey("client.id"),nullable=False); category=db.Column(db.String(30),default="iPhone"); model=db.Column(db.String(120)); serial_imei=db.Column(db.String(100),index=True); current_owner=db.Column(db.Boolean,default=True); created_at=db.Column(db.DateTime,default=datetime.utcnow)
    client=db.relationship("Client",backref="devices")
class OwnershipHistory(db.Model):
    id=db.Column(db.Integer,primary_key=True); device_id=db.Column(db.Integer,db.ForeignKey("device.id"),nullable=False); previous_client_id=db.Column(db.Integer); new_client_id=db.Column(db.Integer); changed_by=db.Column(db.String(120)); changed_at=db.Column(db.DateTime,default=datetime.utcnow)
class Expense(db.Model):
    id=db.Column(db.Integer,primary_key=True); category=db.Column(db.String(80),nullable=False); amount=db.Column(db.Integer,nullable=False); description=db.Column(db.String(250)); created_by=db.Column(db.String(120)); created_at=db.Column(db.DateTime,default=datetime.utcnow)
class Service(db.Model):
    id=db.Column(db.Integer,primary_key=True); name=db.Column(db.String(120),unique=True,nullable=False); price=db.Column(db.Integer,default=0); warranty_days=db.Column(db.Integer,default=21); active=db.Column(db.Boolean,default=True)
class InventoryItem(db.Model):
    id=db.Column(db.Integer,primary_key=True); sku=db.Column(db.String(60),unique=True,nullable=False); name=db.Column(db.String(150),nullable=False); category=db.Column(db.String(80)); device_category=db.Column(db.String(30),default="iPhone"); supplier=db.Column(db.String(150)); compatible_models=db.Column(db.String(250)); quantity=db.Column(db.Integer,default=0); reorder_level=db.Column(db.Integer,default=2); cost_price=db.Column(db.Integer,default=0); selling_price=db.Column(db.Integer,default=0); branch_id=db.Column(db.Integer,db.ForeignKey("branch.id"))
    # Stock lines created by Check In belong to a product and count either pieces or boxes.
    product_id=db.Column(db.Integer,db.ForeignKey("product.id"),index=True); unit=db.Column(db.String(10),nullable=False,default="piece",server_default="piece"); items_per_box=db.Column(db.Integer)
    branch=db.relationship("Branch")
class Repair(db.Model):
    id=db.Column(db.Integer,primary_key=True); ticket_code=db.Column(db.String(30),unique=True,nullable=False,index=True); client_id=db.Column(db.Integer,db.ForeignKey("client.id"),nullable=False); branch_id=db.Column(db.Integer,db.ForeignKey("branch.id")); device=db.Column(db.String(120),nullable=False); serial_imei=db.Column(db.String(80),index=True); device_passcode=db.Column(db.String(80)); accessories=db.Column(db.String(180)); condition_in=db.Column(db.Text); problem_category=db.Column(db.String(120),nullable=False); problem_notes=db.Column(db.Text); diagnosis=db.Column(db.Text); work_done=db.Column(db.Text); status=db.Column(db.String(50),default="Received"); technician_id=db.Column(db.Integer,db.ForeignKey("user.id")); quoted_price=db.Column(db.Integer,default=0); approved=db.Column(db.Boolean,default=False); deadline=db.Column(db.Date); terms_snapshot=db.Column(db.Text); customer_acceptance=db.Column(db.String(120)); warranty_days=db.Column(db.Integer,default=21); warranty_until=db.Column(db.Date); created_at=db.Column(db.DateTime,default=datetime.utcnow); updated_at=db.Column(db.DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
    technician=db.relationship("User"); branch=db.relationship("Branch")
class Payment(db.Model):
    id=db.Column(db.Integer,primary_key=True); repair_id=db.Column(db.Integer,db.ForeignKey("repair.id"),nullable=False); amount=db.Column(db.Integer,nullable=False); method=db.Column(db.String(40)); reference=db.Column(db.String(100)); paid_at=db.Column(db.DateTime,default=datetime.utcnow); received_by=db.Column(db.String(120))
    repair=db.relationship("Repair",backref="payments")
class RepairPart(db.Model):
    id=db.Column(db.Integer,primary_key=True); repair_id=db.Column(db.Integer,db.ForeignKey("repair.id"),nullable=False); item_id=db.Column(db.Integer,db.ForeignKey("inventory_item.id"),nullable=False); quantity=db.Column(db.Integer,default=1); used_at=db.Column(db.DateTime,default=datetime.utcnow)
    item=db.relationship("InventoryItem"); repair=db.relationship("Repair",backref="parts_used")
class Notification(db.Model):
    id=db.Column(db.Integer,primary_key=True); repair_id=db.Column(db.Integer,db.ForeignKey("repair.id")); channel=db.Column(db.String(30)); recipient=db.Column(db.String(120)); message=db.Column(db.Text); status=db.Column(db.String(30),default="Queued"); created_at=db.Column(db.DateTime,default=datetime.utcnow)
class Product(db.Model):
    # Products the shop sells, managed by the General Manager.
    id=db.Column(db.Integer,primary_key=True); name=db.Column(db.String(150),unique=True,nullable=False); product_type=db.Column(db.String(30),nullable=False,default="Finished"); purchase_price=db.Column(db.Integer,nullable=False,default=0,server_default="0"); selling_price=db.Column(db.Integer,nullable=False,default=0,server_default="0"); created_by=db.Column(db.String(120)); created_at=db.Column(db.DateTime,default=datetime.utcnow); updated_at=db.Column(db.DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
class StockMovement(db.Model):
    # Every change to a stock quantity: check-ins, check-outs, adjustments and parts used on repairs.
    id=db.Column(db.Integer,primary_key=True); item_id=db.Column(db.Integer,db.ForeignKey("inventory_item.id"),nullable=False,index=True); direction=db.Column(db.String(3),nullable=False); quantity=db.Column(db.Integer,nullable=False); reason=db.Column(db.String(60)); note=db.Column(db.String(250)); repair_id=db.Column(db.Integer,db.ForeignKey("repair.id")); balance_after=db.Column(db.Integer); created_by=db.Column(db.String(120)); created_at=db.Column(db.DateTime,default=datetime.utcnow,index=True)
    item=db.relationship("InventoryItem"); repair=db.relationship("Repair")
class StockCode(db.Model):
    # One scanned barcode / QR code of a piece or a box that was checked in.
    id=db.Column(db.Integer,primary_key=True); code=db.Column(db.String(120),unique=True,nullable=False); item_id=db.Column(db.Integer,db.ForeignKey("inventory_item.id"),nullable=False,index=True); movement_id=db.Column(db.Integer,db.ForeignKey("stock_movement.id")); created_by=db.Column(db.String(120)); created_at=db.Column(db.DateTime,default=datetime.utcnow)
    status=db.Column(db.String(10),nullable=False,default="in",server_default="in"); items_left=db.Column(db.Integer); checked_out_at=db.Column(db.DateTime)  # a box is "in" until its last item is taken
    item=db.relationship("InventoryItem")
class Sale(db.Model):
    # A receipt from Check Out: products sold, or used for a repair together with a service.
    id=db.Column(db.Integer,primary_key=True); purpose=db.Column(db.String(10),nullable=False); service_id=db.Column(db.Integer,db.ForeignKey("service.id")); service_name=db.Column(db.String(120)); service_price=db.Column(db.Integer,nullable=False,default=0); customer_name=db.Column(db.String(120)); customer_phone=db.Column(db.String(40)); payment_method=db.Column(db.String(40)); items_total=db.Column(db.Integer,nullable=False,default=0); total=db.Column(db.Integer,nullable=False,default=0); cost=db.Column(db.Integer,nullable=False,default=0); created_by=db.Column(db.String(120)); created_at=db.Column(db.DateTime,default=datetime.utcnow,index=True)
    lines=db.relationship("SaleLine",backref="sale",order_by="SaleLine.id",cascade="all, delete-orphan")
class SaleLine(db.Model):
    id=db.Column(db.Integer,primary_key=True); sale_id=db.Column(db.Integer,db.ForeignKey("sale.id"),nullable=False,index=True); item_id=db.Column(db.Integer,db.ForeignKey("inventory_item.id")); code=db.Column(db.String(120)); description=db.Column(db.String(200),nullable=False); quantity=db.Column(db.Integer,nullable=False); unit_price=db.Column(db.Integer,nullable=False); unit_cost=db.Column(db.Integer,nullable=False,default=0); amount=db.Column(db.Integer,nullable=False); device_serial=db.Column(db.String(120))
class AuditLog(db.Model):
    id=db.Column(db.Integer,primary_key=True); user_name=db.Column(db.String(120)); action=db.Column(db.String(180)); entity=db.Column(db.String(80)); entity_id=db.Column(db.Integer); created_at=db.Column(db.DateTime,default=datetime.utcnow)

# ---------- Helpers ----------
def current_user():
    uid=session.get("user_id")
    if not uid: return None
    u=db.session.get(User,uid)
    return u if u and u.active else None
def is_manager(u): return bool(u) and u.role in MANAGER_ROLES
def login_required(fn):
    @wraps(fn)
    def w(*a,**k):
        if not current_user(): raise Unauthorized("Please sign in.")
        return fn(*a,**k)
    return w
def permissions_of(u):
    if not u: return []
    if is_manager(u): return list(PERMISSION_KEYS)
    if u.permissions is None: return list(ROLE_PERMISSIONS.get(u.role,[]))
    return [k for k in PERMISSION_KEYS if k in u.permissions.split(",")]
def can(u,*keys): return any(k in permissions_of(u) for k in keys)
def permission_required(*keys):
    """The signed-in user needs at least one of these permissions."""
    labels=" or ".join(p["label"] for p in PERMISSIONS if p["key"] in keys)
    def deco(fn):
        @wraps(fn)
        def w(*a,**k):
            u=current_user()
            if not u: raise Unauthorized("Please sign in.")
            if not can(u,*keys): raise Forbidden(f"You do not have access to {labels}. Ask the General Manager.")
            return fn(*a,**k)
        return w
    return deco
def admin_required(fn):
    @wraps(fn)
    def w(*a,**k):
        u=current_user()
        if not u: raise Unauthorized("Please sign in.")
        if not is_manager(u): raise Forbidden("General Manager access required.")
        return fn(*a,**k)
    return w
def body():
    return request.get_json(silent=True) or {}
def text(data,key,default=""):
    v=data.get(key); return default if v is None else str(v).strip()
def required(data,key,label):
    v=text(data,key)
    if not v: raise BadRequest(f"{label} is required.")
    return v
def num(data,key,default=0):
    v=data.get(key)
    if v is None or str(v).strip()=="": return default
    try: return int(str(v).strip())
    except ValueError: raise BadRequest(f"{key.replace('_',' ').capitalize()} must be a whole number.")
def optional_id(data,key):
    return num(data,key,None)
# Times are stored in UTC; the shop's day runs midnight to midnight in Kigali (UTC+2, no summer time).
KIGALI = timezone(timedelta(hours=2))
def kigali_today(): return datetime.now(KIGALI).date()
def kigali_day_start_utc(d):
    """Midnight in Kigali at the start of day d, as a naive UTC time like the stored timestamps."""
    return datetime.combine(d,datetime.min.time(),KIGALI).astimezone(timezone.utc).replace(tzinfo=None)
def parse_date(v):
    if not v: return None
    try: return datetime.strptime(str(v),"%Y-%m-%d").date()
    except ValueError: raise BadRequest("Dates must be in YYYY-MM-DD format.")
def iso(v): return v.isoformat() if v else None
def audit(action,entity="",entity_id=None):
    u=current_user(); db.session.add(AuditLog(user_name=u.full_name if u else "System",action=action,entity=entity,entity_id=entity_id))
def ticket_from_number(n):
    block=(n-1)//100; num_=((n-1)%100)+1; letters=""; x=block
    while True:
        letters=chr(ord("a")+(x%26))+letters; x=x//26-1
        if x<0: break
    return f"KAT{num_:03d}{letters}"
def next_ticket():
    last=Repair.query.order_by(Repair.id.desc()).first()
    return ticket_from_number((last.id if last else 0)+1)
def total_paid(r): return sum(p.amount for p in r.payments)
def move_stock(item,direction,qty,reason,note="",repair=None):
    """Change a stock quantity and record it in the movement history (caller commits)."""
    if qty<=0: raise BadRequest("Quantity must be at least 1.")
    if direction=="out" and qty>item.quantity: raise BadRequest(f"Only {item.quantity} × {item.name} in stock.")
    item.quantity+=qty if direction=="in" else -qty
    m=StockMovement(item_id=item.id,direction=direction,quantity=qty,reason=reason,note=note[:250],repair_id=repair.id if repair else None,balance_after=item.quantity,created_by=current_user().full_name if current_user() else "System")
    db.session.add(m); return m
def status_email_text(r):
    balance=max(0,r.quoted_price-total_paid(r))
    lines={
        "Received":f"We have received your {r.device} for repair. Your ticket number is {r.ticket_code}. We will keep you updated as the repair progresses.",
        "Diagnosing":f"Our technicians are now diagnosing your {r.device} (ticket {r.ticket_code}).",
        "Waiting for Approval":f"We have finished diagnosing your {r.device} (ticket {r.ticket_code}). The quoted price is {r.quoted_price:,} RWF. Please contact us to approve the repair.",
        "Repairing":f"Your {r.device} (ticket {r.ticket_code}) is now being repaired.",
        "Ready":f"Good news! Your {r.device} (ticket {r.ticket_code}) is ready for pickup."+(f" Balance to pay: {balance:,} RWF." if balance else ""),
        "Collected":f"Thank you for choosing Kigali Apple Tech. Your {r.device} (ticket {r.ticket_code}) has been collected."+(f" Your warranty is valid until {r.warranty_until.strftime('%d %b %Y')}." if r.warranty_until else ""),
        "Cancelled":f"The repair of your {r.device} (ticket {r.ticket_code}) has been cancelled. Please contact us if you have any questions.",
    }
    return f"Hello {r.client.full_name},\n\n{lines.get(r.status, f'Your {r.device} (ticket {r.ticket_code}) status is now {r.status}.')}\n\nKigali Apple Tech • Kigali, Rwanda • {SHOP_PHONE}"
def email_html(text_):
    body_="".join(f'<p style="margin:0 0 14px">{escape(p).replace(chr(10),"<br>")}</p>' for p in text_.split("\n\n"))
    return f'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222;font-size:15px;line-height:1.5"><div style="background:#0b7fab;color:#fff;padding:14px 20px;font-size:18px;font-weight:bold;border-radius:8px 8px 0 0">Kigali Apple Tech</div><div style="border:1px solid #e3e3e3;border-top:0;padding:20px;border-radius:0 0 8px 8px">{body_}</div></div>'
def send_email(to,subject,text_):
    if not RESEND_API_KEY: return False,"Email is not configured (RESEND_API_KEY missing)."
    payload={"from":EMAIL_FROM,"to":[to],"subject":subject,"html":email_html(text_),"text":text_}
    if EMAIL_REPLY_TO: payload["reply_to"]=EMAIL_REPLY_TO
    req=urllib.request.Request("https://api.resend.com/emails",data=json.dumps(payload).encode(),method="POST",headers={"Authorization":f"Bearer {RESEND_API_KEY}","Content-Type":"application/json","User-Agent":"kat-os/1.0"})
    try:
        with urllib.request.urlopen(req,timeout=10) as resp: return True,json.loads(resp.read() or b"{}").get("id","")
    except urllib.error.HTTPError as e:
        raw=e.read().decode(errors="replace")
        try: detail=json.loads(raw).get("message",raw)
        except ValueError: detail=raw
        return False,f"Email provider error {e.code}: {detail[:200]}"
    except Exception as e: return False,f"Email sending failed: {str(e)[:200]}"
def queue_status_notification(r):
    msg=f"Kigali Apple Tech: {r.ticket_code} ({r.device}) status is now {r.status}."
    db.session.add(Notification(repair_id=r.id,channel="SMS/WhatsApp",recipient=r.client.phone,message=msg,status="Queued"))
    if r.client.email:
        n=Notification(repair_id=r.id,channel="Email",recipient=r.client.email,message=status_email_text(r),status="Queued"); db.session.add(n)
        send_real_notification_if_configured(n)
def send_real_notification_if_configured(n):
    # Email is sent through Resend. SMS/WhatsApp stay queued until a provider is connected.
    if n.channel!="Email": return False,"Only email delivery is connected."
    if not RESEND_API_KEY: return False,"Email is not configured (RESEND_API_KEY missing)."
    r=db.session.get(Repair,n.repair_id) if n.repair_id else None
    ok,info=send_email(n.recipient,f"Update on your repair {r.ticket_code}" if r else "Kigali Apple Tech",n.message)
    n.status="Sent" if ok else "Failed"
    return ok,info

# ---------- JSON shapes ----------
def user_json(u): return {"id":u.id,"full_name":u.full_name,"username":u.username,"role":u.role,"work_email":u.work_email,"branch_id":u.branch_id,"branch":u.branch.name if u.branch else None,"active":u.active,"is_manager":is_manager(u),"permissions":permissions_of(u),"custom_permissions":u.permissions is not None and not is_manager(u)}
def branch_json(b): return {"id":b.id,"name":b.name,"location":b.location,"phone":b.phone,"active":b.active}
def client_json(c,lookup=False):
    out={"id":c.id,"full_name":c.full_name,"phone":c.phone,"email":c.email,"address":c.address,"created_at":iso(c.created_at),"repair_count":len(c.repairs)}
    if lookup:  # lets the clients page search by device IMEI/serial/model and KAT ticket
        out.update(open_repairs=sum(1 for r in c.repairs if r.status not in ("Collected","Cancelled")),
            devices=[{"serial_imei":d.serial_imei,"model":d.model} for d in c.devices],tickets=[r.ticket_code for r in c.repairs],repair_serials=[r.serial_imei for r in c.repairs if r.serial_imei])
    return out
def device_json(d): return {"id":d.id,"client_id":d.client_id,"category":d.category,"model":d.model,"serial_imei":d.serial_imei,"created_at":iso(d.created_at)}
def item_json(i): return {"id":i.id,"sku":i.sku,"name":i.name,"category":i.category,"device_category":i.device_category,"supplier":i.supplier,"compatible_models":i.compatible_models,"quantity":i.quantity,"reorder_level":i.reorder_level,"cost_price":i.cost_price,"selling_price":i.selling_price,"branch_id":i.branch_id,"branch":i.branch.name if i.branch else None,"product_id":i.product_id,"unit":i.unit or "piece","items_per_box":i.items_per_box,"opened_boxes":getattr(i,"_opened",None),"checked_in":getattr(i,"_in",None),"checked_out":getattr(i,"_out",None),"available_items":getattr(i,"_items",None)}
def repair_json(r,full=False):
    paid=total_paid(r)
    out={"id":r.id,"ticket_code":r.ticket_code,"client_id":r.client_id,"client_name":r.client.full_name,"client_phone":r.client.phone,"device":r.device,"serial_imei":r.serial_imei,"problem_category":r.problem_category,"status":r.status,"technician_id":r.technician_id,"technician":r.technician.full_name if r.technician else None,"deadline":iso(r.deadline),"created_at":iso(r.created_at),
        "branch_id":r.branch_id,"branch":r.branch.name if r.branch else None,"quoted_price":r.quoted_price,"paid":paid,"balance":r.quoted_price-paid}
    if full:
        out.update(device_passcode=r.device_passcode,accessories=r.accessories,condition_in=r.condition_in,problem_notes=r.problem_notes,diagnosis=r.diagnosis,work_done=r.work_done,approved=r.approved,terms_snapshot=r.terms_snapshot,customer_acceptance=r.customer_acceptance,warranty_days=r.warranty_days,warranty_until=iso(r.warranty_until),updated_at=iso(r.updated_at),
            payments=[{"id":p.id,"amount":p.amount,"method":p.method,"reference":p.reference,"paid_at":iso(p.paid_at),"received_by":p.received_by} for p in r.payments],
            parts_used=[{"id":p.id,"item_id":p.item_id,"item_name":p.item.name,"quantity":p.quantity,"used_at":iso(p.used_at)} for p in r.parts_used])
    return out
def with_repair_details(query):
    # Load each repair's client, technician, branch and payments together (one round trip per table, not per row).
    return query.options(joinedload(Repair.client),joinedload(Repair.technician),joinedload(Repair.branch),selectinload(Repair.payments))

# ---------- Errors: always JSON ----------
@app.errorhandler(HTTPException)
def http_error(e): return jsonify(error=e.description),e.code
def reset_session():
    # Rolling back can itself fail when the connection is already dead; the session is discarded either way.
    try: db.session.rollback()
    except Exception: pass
    db.session.remove()
@app.errorhandler(IntegrityError)
def integrity_error(e):
    reset_session()
    return jsonify(error="That record already exists (duplicate username, SKU, service name or ticket)."),409
@app.errorhandler(OperationalError)
def database_unavailable(e):
    # The connection dropped mid-request. Discard pooled connections so the next request reconnects.
    app.logger.warning("Database connection lost: %s", str(e).splitlines()[0])
    reset_session(); db.engine.dispose()
    return jsonify(error="Lost the connection to the database. Please try again."),503
@app.errorhandler(Exception)
def unexpected_error(e):
    if isinstance(e,HTTPException): return http_error(e)
    app.logger.exception("Unexpected error")
    reset_session()
    return jsonify(error="Something went wrong on the server. Please try again."),500

# ---------- Auth ----------
@app.post("/api/auth/login")
def login():
    data=body(); u=User.query.filter_by(username=text(data,"username")).first()
    if u and u.active and check_password_hash(u.password_hash,str(data.get("password") or "")):
        session.clear(); session["user_id"]=u.id; audit("Logged in","User",u.id); db.session.commit()
        return jsonify(user=user_json(u))
    raise Unauthorized("Invalid login.")
@app.post("/api/auth/logout")
def logout(): session.clear(); return jsonify(ok=True)
@app.get("/api/auth/me")
@login_required
def me(): return jsonify(user=user_json(current_user()))
@app.get("/healthz")  # kept for uptime monitors that use the old address
@app.get("/api/healthz")
def healthz():
    db.session.execute(db.text("select 1"))
    return {"status":"ok","database":db.engine.dialect.name}
@app.get("/api/meta")
@login_required
def meta():
    return jsonify(statuses=STATUSES,roles=ROLES,device_categories=DEVICE_CATEGORIES,part_categories=PART_CATEGORIES,expense_categories=EXPENSE_CATEGORIES,payment_methods=PAYMENT_METHODS,document_types=DOCUMENT_TYPES,terms=TERMS,shop_phone=SHOP_PHONE)

# ---------- Dashboard ----------
@app.get("/api/dashboard")
@login_required
def dashboard():
    today=kigali_today(); q=Repair.query; u=current_user()
    out=dict(total=q.count(),open_repairs=q.filter(Repair.status.notin_(["Collected","Cancelled"])).count(),ready=q.filter_by(status="Ready").count(),overdue=q.filter(Repair.deadline.isnot(None),Repair.deadline<today,Repair.status.notin_(["Ready","Collected","Cancelled"])).count(),recent=[repair_json(r) for r in with_repair_details(Repair.query).order_by(Repair.created_at.desc()).limit(12).all()],low_stock=InventoryItem.query.filter(InventoryItem.quantity<=InventoryItem.reorder_level).count(),queued=Notification.query.filter_by(status="Queued").count(),finance=None)
    if can(u,"finance"):
        # Money for the chosen days (?from=YYYY-MM-DD&to=YYYY-MM-DD, both included). Default: today.
        try:
            first=date.fromisoformat(request.args["from"]) if request.args.get("from") else today
            last=date.fromisoformat(request.args["to"]) if request.args.get("to") else first
        except ValueError: raise BadRequest("Dates must look like 2026-10-26.")
        if last<first: first,last=last,first
        start=kigali_day_start_utc(first); end=kigali_day_start_utc(last+timedelta(days=1))
        sales=sum(x.amount for x in Payment.query.filter(Payment.paid_at>=start,Payment.paid_at<end).all())
        parts_cost=sum(x.quantity*x.item.cost_price for x in RepairPart.query.options(joinedload(RepairPart.item)).filter(RepairPart.used_at>=start,RepairPart.used_at<end).all())
        receipts=Sale.query.filter(Sale.created_at>=start,Sale.created_at<end).all()
        sales+=sum(x.total for x in receipts); parts_cost+=sum(x.cost for x in receipts)
        expenses_=sum(x.amount for x in Expense.query.filter(Expense.created_at>=start,Expense.created_at<end).all())
        out["finance"]=dict(sales=sales,parts_cost=parts_cost,expenses=expenses_,profit=sales-parts_cost-expenses_,**{"from":first.isoformat(),"to":last.isoformat()})
    return jsonify(out)

# ---------- Clients & devices ----------
@app.get("/api/clients")
@permission_required("clients","repairs")
def clients():
    q=request.args.get("q","").strip(); rows=Client.query.options(selectinload(Client.repairs),selectinload(Client.devices))
    if q:
        ids=[x.client_id for x in Device.query.filter(db.or_(Device.serial_imei.ilike(f"%{q}%"),Device.model.ilike(f"%{q}%"))).all()]
        repair_ids=[x.client_id for x in Repair.query.filter(db.or_(Repair.ticket_code.ilike(f"%{q}%"),Repair.serial_imei.ilike(f"%{q}%"))).all()]
        rows=rows.filter(db.or_(Client.full_name.ilike(f"%{q}%"),Client.phone.ilike(f"%{q}%"),Client.id.in_(ids+repair_ids)))
    return jsonify(clients=[client_json(c,lookup=True) for c in rows.order_by(Client.created_at.desc()).all()])
@app.post("/api/clients")
@permission_required("clients","repairs")
def new_client():
    data=body()
    c=Client(full_name=required(data,"full_name","Full name"),phone=required(data,"phone","Phone"),email=text(data,"email"),address=text(data,"address"))
    db.session.add(c); db.session.flush(); audit("Registered client","Client",c.id); db.session.commit()
    return jsonify(client=client_json(c)),201
@app.get("/api/clients/<int:client_id>")
@permission_required("clients","repairs")
def client_detail(client_id):
    c=db.get_or_404(Client,client_id,description="Client not found.")
    return jsonify(client=client_json(c),
        notes=[{"id":n.id,"note":n.note,"author":n.author,"created_at":iso(n.created_at)} for n in sorted(c.notes,key=lambda n:n.created_at or datetime.min,reverse=True)],
        devices=[device_json(d) for d in c.devices],repairs=[repair_json(r) for r in with_repair_details(Repair.query.filter_by(client_id=c.id)).order_by(Repair.created_at.desc()).all()])
@app.post("/api/clients/<int:client_id>/notes")
@permission_required("clients")
def add_client_note(client_id):
    c=db.get_or_404(Client,client_id,description="Client not found."); note=required(body(),"note","Note")
    db.session.add(ClientNote(client_id=c.id,note=note,author=current_user().full_name)); audit("Added client note","Client",c.id); db.session.commit()
    return jsonify(ok=True),201
@app.post("/api/clients/<int:client_id>/devices")
@permission_required("clients")
def add_device(client_id):
    c=db.get_or_404(Client,client_id,description="Client not found."); data=body(); code=text(data,"serial_imei")
    existing=Device.query.filter_by(serial_imei=code).first() if code else None
    if existing: return jsonify(error="This IMEI/serial already exists. Existing owner opened.",existing_client_id=existing.client_id),409
    d=Device(client_id=c.id,category=text(data,"category","iPhone") or "iPhone",model=required(data,"model","Model"),serial_imei=code)
    db.session.add(d); db.session.flush(); audit("Added device","Device",d.id); db.session.commit()
    return jsonify(device=device_json(d)),201
@app.get("/api/devices/scan")
@permission_required("clients","repairs")
def device_scan():
    q=request.args.get("q","").strip(); d=Device.query.filter(Device.serial_imei.ilike(q)).first() if q else None
    return jsonify(device=device_json(d) if d else None)
@app.post("/api/devices/<int:device_id>/transfer")
@admin_required
def transfer_device(device_id):
    d=db.get_or_404(Device,device_id,description="Device not found."); new=num(body(),"new_client_id",None)
    if not new or not db.session.get(Client,new): raise BadRequest("Choose a valid new owner.")
    old=d.client_id; d.client_id=new
    db.session.add(OwnershipHistory(device_id=d.id,previous_client_id=old,new_client_id=new,changed_by=current_user().full_name)); audit("Transferred device ownership","Device",d.id); db.session.commit()
    return jsonify(device=device_json(d))

# ---------- Search everything (top bar) ----------
@app.get("/api/search")
@login_required
def search_everything():
    q=request.args.get("q","").strip()
    if len(q)<2: return jsonify(clients=[],repairs=[],devices=[],items=[])
    like=f"%{q}%"
    repairs_=with_repair_details(Repair.query.join(Client)).filter(db.or_(Repair.ticket_code.ilike(like),Repair.serial_imei.ilike(like),Repair.device.ilike(like),Client.full_name.ilike(like),Client.phone.ilike(like))).order_by(Repair.created_at.desc()).limit(8).all()
    clients_=Client.query.options(selectinload(Client.repairs)).filter(db.or_(Client.full_name.ilike(like),Client.phone.ilike(like),Client.email.ilike(like))).order_by(Client.full_name).limit(6).all()
    devices_=Device.query.options(joinedload(Device.client)).filter(db.or_(Device.serial_imei.ilike(like),Device.model.ilike(like))).limit(6).all()
    items_=InventoryItem.query.options(joinedload(InventoryItem.branch)).filter(db.or_(InventoryItem.sku.ilike(like),InventoryItem.name.ilike(like),InventoryItem.compatible_models.ilike(like))).order_by(InventoryItem.name).limit(6).all()
    u=current_user(); people=can(u,"clients","repairs")  # only show what this person may open
    return jsonify(repairs=[repair_json(r) for r in repairs_] if can(u,"repairs") else [],clients=[client_json(c) for c in clients_] if people else [],
        devices=[dict(device_json(d),client_name=d.client.full_name) for d in devices_] if people else [],items=[item_json(i) for i in items_] if can(u,"inventory") else [])

# ---------- Repairs ----------
@app.get("/api/repairs")
@permission_required("repairs")
def repairs():
    q=request.args.get("q","").strip(); rows=with_repair_details(Repair.query.join(Client))
    if q: rows=rows.filter(db.or_(Repair.ticket_code.ilike(f"%{q}%"),Repair.serial_imei.ilike(f"%{q}%"),Repair.device.ilike(f"%{q}%"),Client.phone.ilike(f"%{q}%"),Client.full_name.ilike(f"%{q}%")))
    return jsonify(repairs=[repair_json(r) for r in rows.order_by(Repair.created_at.desc()).all()])
@app.get("/api/repairs/options")
@permission_required("repairs")
def repair_options():
    techs=User.query.filter_by(active=True).filter(User.role.in_(["Technician"]+MANAGER_ROLES)).all()
    return jsonify(clients=[{"id":c.id,"full_name":c.full_name,"phone":c.phone} for c in Client.query.order_by(Client.full_name).all()],
        technicians=[{"id":t.id,"full_name":t.full_name} for t in techs],branches=[branch_json(b) for b in Branch.query.filter_by(active=True).all()],terms=TERMS)
@app.post("/api/repairs")
@permission_required("repairs")
def new_repair():
    data=body(); cat=required(data,"problem_category","Problem category"); client_id=num(data,"client_id",None)
    if not client_id or not db.session.get(Client,client_id): raise BadRequest("Choose a client.")
    r=Repair(ticket_code=next_ticket(),client_id=client_id,branch_id=optional_id(data,"branch_id"),device=required(data,"device","Device"),serial_imei=text(data,"serial_imei"),device_passcode=text(data,"device_passcode"),accessories=text(data,"accessories"),condition_in=text(data,"condition_in"),problem_category=cat,problem_notes=text(data,"problem_notes"),technician_id=optional_id(data,"technician_id"),quoted_price=num(data,"quoted_price"),deadline=parse_date(data.get("deadline")),terms_snapshot="\n".join("• "+x for x in TERMS.get(cat,[])),customer_acceptance=text(data,"customer_acceptance"),warranty_days=21)
    db.session.add(r); db.session.flush(); audit("Created repair ticket","Repair",r.id); queue_status_notification(r); db.session.commit()
    return jsonify(repair=repair_json(r)),201
@app.get("/api/repairs/<int:repair_id>")
@permission_required("repairs")
def repair_detail(repair_id):
    r=db.get_or_404(Repair,repair_id,description="Repair not found.")
    return jsonify(repair=repair_json(r,full=True),statuses=STATUSES,payment_methods=PAYMENT_METHODS,
        technicians=[{"id":t.id,"full_name":t.full_name} for t in User.query.filter_by(active=True).all()],
        inventory=[{"id":i.id,"name":i.name,"quantity":i.quantity} for i in InventoryItem.query.filter(InventoryItem.quantity>0).order_by(InventoryItem.name).all()])
@app.patch("/api/repairs/<int:repair_id>")
@permission_required("repairs")
def update_repair(repair_id):
    r=db.get_or_404(Repair,repair_id,description="Repair not found."); data=body()
    status=required(data,"status","Status")
    if status not in STATUSES: raise BadRequest("Unknown status.")
    old=r.status; r.status=status; r.technician_id=optional_id(data,"technician_id"); r.quoted_price=num(data,"quoted_price"); r.diagnosis=text(data,"diagnosis"); r.work_done=text(data,"work_done"); r.approved=bool(data.get("approved"))
    if r.status=="Collected" and not r.warranty_until: r.warranty_until=date.today()+timedelta(days=r.warranty_days)
    if old!=r.status: queue_status_notification(r)
    audit(f"Updated repair: {old} → {r.status}","Repair",r.id); db.session.commit()
    return jsonify(repair=repair_json(r,full=True))
@app.post("/api/repairs/<int:repair_id>/payments")
@permission_required("repairs")
def add_payment(repair_id):
    r=db.get_or_404(Repair,repair_id,description="Repair not found."); data=body(); amt=num(data,"amount")
    if amt<=0: raise BadRequest("Amount must be greater than zero.")
    p=Payment(repair_id=r.id,amount=amt,method=text(data,"method"),reference=text(data,"reference"),received_by=current_user().full_name)
    db.session.add(p); db.session.flush(); audit("Recorded payment","Payment",p.id); db.session.commit()
    return jsonify(ok=True),201
@app.post("/api/repairs/<int:repair_id>/parts")
@permission_required("repairs")
def use_part(repair_id):
    r=db.get_or_404(Repair,repair_id,description="Repair not found."); data=body()
    item=db.get_or_404(InventoryItem,num(data,"item_id"),description="Stock item not found."); qty=max(1,num(data,"quantity",1))
    if item.quantity<qty: raise BadRequest("Not enough stock.")
    move_stock(item,"out",qty,"Used in repair",repair=r); db.session.add(RepairPart(repair_id=r.id,item_id=item.id,quantity=qty)); audit(f"Used {qty} × {item.name}","Repair",r.id); db.session.commit()
    return jsonify(ok=True),201

# ---------- Documents (PDF) ----------
def pdf_table(data):
    t=Table(data,colWidths=[120,350]); t.setStyle(TableStyle([("GRID",(0,0),(-1,-1),.4,colors.grey),("BACKGROUND",(0,0),(0,-1),colors.HexColor("#E8F7FC")),("PADDING",(0,0),(-1,-1),7)])); return t
def pdf_response(story,filename):
    buf=BytesIO(); SimpleDocTemplate(buf,pagesize=A4,rightMargin=35,leftMargin=35,topMargin=35,bottomMargin=35).build(story); buf.seek(0)
    return send_file(buf,mimetype="application/pdf",as_attachment=True,download_name=filename)
@app.get("/api/documents")
@permission_required("documents")
def documents():
    return jsonify(repairs=[repair_json(r) for r in with_repair_details(Repair.query).order_by(Repair.created_at.desc()).all()],document_types=DOCUMENT_TYPES)
@app.get("/api/repairs/<int:repair_id>/documents/<doc_type>.pdf")
@permission_required("documents")
def repair_document_pdf(repair_id,doc_type):
    r=db.get_or_404(Repair,repair_id,description="Repair not found."); title=doc_type.replace("-"," ").title(); st=getSampleStyleSheet(); paid=total_paid(r)
    data=[["Client",r.client.full_name],["Phone",r.client.phone],["Ticket",r.ticket_code],["Device",r.device],["IMEI / Serial",r.serial_imei or "—"],["Problem",r.problem_category],["Status",r.status],["Amount",f"{r.quoted_price:,} RWF"],["Paid",f"{paid:,} RWF"],["Balance",f"{max(0,r.quoted_price-paid):,} RWF"],["Warranty until",str(r.warranty_until or "—")],["Date",datetime.now().strftime("%d %b %Y")]]
    story=[Paragraph(f"KIGALI APPLE TECH — {escape(title.upper())}",st["Title"]),Spacer(1,10),pdf_table(data),Spacer(1,18),Paragraph("Client signature: ____________________",st["BodyText"]),Paragraph("Authorized by KAT: ____________________",st["BodyText"]),Spacer(1,12),Paragraph(f"Kigali Apple Tech • Kigali, Rwanda • {SHOP_PHONE}",st["BodyText"])]
    return pdf_response(story,f"{r.ticket_code}-{doc_type}.pdf")
@app.get("/api/repairs/<int:repair_id>/ticket.pdf")
@permission_required("repairs","documents")
def ticket_pdf(repair_id):
    r=db.get_or_404(Repair,repair_id,description="Repair not found."); st=getSampleStyleSheet(); paid=total_paid(r)
    data=[["Client",r.client.full_name],["Phone",r.client.phone],["Device",r.device],["IMEI / Serial",r.serial_imei or "—"],["Problem",r.problem_category],["Status",r.status],["Technician",r.technician.full_name if r.technician else "—"],["Quoted price",f"{r.quoted_price:,} RWF"],["Paid",f"{paid:,} RWF"],["Balance",f"{max(0,r.quoted_price-paid):,} RWF"],["Deadline",str(r.deadline or "—")]]
    story=[Paragraph("KIGALI APPLE TECH — REPAIR TICKET",st["Title"]),Paragraph(f"<b>Ticket:</b> {r.ticket_code}",st["Heading2"]),Spacer(1,8),pdf_table(data),Spacer(1,12),Paragraph("<b>Terms & Conditions</b>",st["Heading3"]),Paragraph(str(escape(r.terms_snapshot or "")).replace("\n","<br/>"),st["BodyText"]),Spacer(1,12),Paragraph(f"Customer acceptance: {escape(r.customer_acceptance or '________________')}",st["BodyText"]),Paragraph(f"Kigali Apple Tech • Kigali, Rwanda • {SHOP_PHONE}",st["BodyText"])]
    return pdf_response(story,f"{r.ticket_code}.pdf")

# ---------- Inventory, expenses, services ----------
@app.get("/api/inventory")
@permission_required("inventory")
def inventory():
    items=InventoryItem.query.options(joinedload(InventoryItem.branch)).order_by(InventoryItem.name).all()
    # Opened boxes (some items already taken out): how many and how many items are left in them.
    opened=db.session.query(StockCode.item_id,db.func.count(StockCode.id),db.func.sum(StockCode.items_left)).join(InventoryItem).filter(StockCode.status=="in",InventoryItem.unit=="box",StockCode.items_left<InventoryItem.items_per_box).group_by(StockCode.item_id).all()
    by_item={iid:{"count":n,"items_left":int(left or 0)} for iid,n,left in opened}
    # Totals checked in / out per stock line (in its unit: pieces or boxes), from the movement history.
    moved={(iid,d):int(q or 0) for iid,d,q in db.session.query(StockMovement.item_id,StockMovement.direction,db.func.sum(StockMovement.quantity)).group_by(StockMovement.item_id,StockMovement.direction).all()}
    # Items still in boxes that are in stock (full boxes + what is left in opened ones).
    box_items={iid:int(n or 0) for iid,n in db.session.query(StockCode.item_id,db.func.sum(StockCode.items_left)).filter(StockCode.status=="in").group_by(StockCode.item_id).all()}
    for i in items:
        i._opened=by_item.get(i.id); i._in=moved.get((i.id,"in"),0); i._out=moved.get((i.id,"out"),0)
        i._items=(box_items.get(i.id,i.quantity*(i.items_per_box or 1)) if i.unit=="box" else i.quantity)
    return jsonify(items=[item_json(i) for i in items])
@app.post("/api/inventory")
@permission_required("inventory")
def add_inventory():
    data=body()
    opening=max(0,num(data,"quantity"))
    item=InventoryItem(sku=required(data,"sku","SKU"),name=required(data,"name","Part / Product"),category=text(data,"category"),device_category=text(data,"device_category","iPhone") or "iPhone",supplier=text(data,"supplier"),compatible_models=text(data,"compatible_models"),quantity=0,reorder_level=num(data,"reorder_level",2),cost_price=num(data,"cost_price"),selling_price=num(data,"selling_price"),branch_id=optional_id(data,"branch_id"))
    db.session.add(item); db.session.flush()
    if opening: move_stock(item,"in",opening,"Opening stock",text(data,"supplier"))
    audit("Added inventory item","InventoryItem",item.id); db.session.commit()
    return jsonify(item=item_json(item)),201
@app.post("/api/inventory/<int:item_id>/adjust")
@permission_required("inventory")
def adjust_stock(item_id):
    i=db.get_or_404(InventoryItem,item_id,description="Stock item not found."); delta=num(body(),"delta")
    if delta>0: move_stock(i,"in",delta,"Adjustment")
    elif delta<0 and i.quantity: move_stock(i,"out",min(-delta,i.quantity),"Adjustment")  # never below zero
    audit(f"Stock adjustment {delta:+d}","InventoryItem",i.id); db.session.commit()
    return jsonify(item=item_json(i))
def movement_json(m): return {"id":m.id,"item_id":m.item_id,"sku":m.item.sku,"item_name":m.item.name,"direction":m.direction,"quantity":m.quantity,"reason":m.reason,"note":m.note,"repair_id":m.repair_id,"ticket_code":m.repair.ticket_code if m.repair else None,"balance_after":m.balance_after,"created_by":m.created_by,"created_at":iso(m.created_at)}
@app.post("/api/inventory/check")
@permission_required("inventory")
def check_stock():
    """Check In (direction=in) or Check Out (direction=out) by SKU, e.g. from a barcode scan."""
    data=body(); direction=text(data,"direction")
    if direction not in ("in","out"): raise BadRequest("Choose Check In or Check Out.")
    sku=required(data,"sku","SKU")
    item=InventoryItem.query.filter(db.func.lower(InventoryItem.sku)==sku.lower()).first()
    if not item: raise BadRequest(f"No stock item with SKU {sku}. Add it with “Add Stock” first.")
    reasons=CHECK_IN_REASONS if direction=="in" else CHECK_OUT_REASONS
    reason=text(data,"reason") or reasons[0]
    if reason not in reasons: raise BadRequest("Unknown reason.")
    qty=num(data,"quantity",1); repair=None
    if direction=="out" and reason=="Used in repair":
        code=required(data,"ticket_code","Repair ticket")
        repair=Repair.query.filter(db.func.lower(Repair.ticket_code)==code.lower()).first()
        if not repair: raise BadRequest(f"No repair ticket {code}.")
    m=move_stock(item,direction,qty,reason,text(data,"note"),repair=repair)
    if repair: db.session.add(RepairPart(repair_id=repair.id,item_id=item.id,quantity=qty))  # counts in the repair's parts cost
    audit(f"Checked {'in' if direction=='in' else 'out'} {qty} × {item.name} ({reason})","InventoryItem",item.id); db.session.commit()
    return jsonify(item=item_json(item),movement=movement_json(m)),201
UNITS={"piece":"pieces","box":"boxes"}
def clean_codes(raw):
    codes=[str(c).strip() for c in (raw or []) if str(c).strip()]
    if not codes: raise BadRequest("Scan at least one code.")
    seen=set(); dupes=[]
    for c in codes:
        if c.lower() in seen: dupes.append(c)
        seen.add(c.lower())
    if dupes: raise BadRequest(f"Scanned twice: {', '.join(dupes[:5])}.")
    return codes
@app.post("/api/inventory/codes/lookup")
@permission_required("inventory")
def lookup_codes():
    """Which of these codes were already checked in (and when)? Used while scanning."""
    codes=[str(c).strip() for c in (body().get("codes") or []) if str(c).strip()][:500]
    if not codes: return jsonify(found=[])
    rows=StockCode.query.options(joinedload(StockCode.item)).filter(db.func.lower(StockCode.code).in_([c.lower() for c in codes])).all()
    return jsonify(found=[{"code":r.code,"item_name":r.item.name,"unit":r.item.unit,"checked_in_at":iso(r.created_at),"by":r.created_by} for r in rows])
@app.post("/api/inventory/checkin-scan")
@permission_required("inventory")
def checkin_scan():
    """Check In a product by scanning every piece or every box: adds the number scanned to current stock."""
    data=body()
    product=db.session.get(Product,num(data,"product_id",0) or 0)
    if not product: raise BadRequest("Choose a product from the list.")
    unit=text(data,"unit")
    if unit not in UNITS: raise BadRequest("Choose Pieces or Boxes.")
    per_box=None
    if unit=="box":
        per_box=num(data,"items_per_box",None)
        if not per_box or per_box<1: raise BadRequest("Enter how many items are in each box.")
    supplier=required(data,"supplier","Supplier")
    codes=clean_codes(data.get("codes"))
    already=StockCode.query.filter(db.func.lower(StockCode.code).in_([c.lower() for c in codes])).all()
    if already: return jsonify(error=f"Already checked in before: {', '.join(r.code for r in already[:5])}.",already=[r.code for r in already]),409
    item=InventoryItem.query.filter_by(product_id=product.id,unit=unit).first()
    if not item:  # first delivery of this product in this unit: open its stock line
        item=InventoryItem(sku=f"P{product.id}-{'BOX' if unit=='box' else 'PCS'}",name=product.name+(" (box)" if unit=="box" else ""),category=product.product_type,device_category="Other",supplier=supplier,quantity=0,product_id=product.id,unit=unit,
            cost_price=product.purchase_price*(per_box or 1),selling_price=product.selling_price*(per_box or 1))
        db.session.add(item); db.session.flush()
    before=item.quantity
    item.supplier=supplier
    if unit=="box": item.items_per_box=per_box
    note=f"{supplier} · {len(codes)} {UNITS[unit]}"+(f" × {per_box} per box = {len(codes)*per_box} items" if unit=="box" else "")
    if text(data,"note"): note+=f" · {text(data,'note')}"
    m=move_stock(item,"in",len(codes),"Received from supplier",note)
    db.session.flush()
    db.session.add_all(StockCode(code=c,item_id=item.id,movement_id=m.id,created_by=m.created_by,status="in",items_left=per_box or 1) for c in codes)
    audit(f"Checked in {len(codes)} {UNITS[unit]} of {product.name} from {supplier}","InventoryItem",item.id); db.session.commit()
    return jsonify(item=item_json(item),movement=movement_json(m),added=len(codes),before=before,after=item.quantity),201
def code_out_info(sc):
    """What a scanned code is, for Check Out (price per item comes from the product's selling price)."""
    it=sc.item; pr=db.session.get(Product,it.product_id) if it.product_id else None
    per_item=pr.selling_price if pr else (it.selling_price//(it.items_per_box or 1) if it.unit=="box" else it.selling_price)
    cost=pr.purchase_price if pr else (it.cost_price//(it.items_per_box or 1) if it.unit=="box" else it.cost_price)
    left=sc.items_left if sc.items_left is not None else (it.items_per_box or 1 if it.unit=="box" else 1)
    return {"code":sc.code,"item_id":it.id,"product_name":pr.name if pr else it.name,"unit":it.unit or "piece","items_per_box":it.items_per_box,"items_left":left,"opened":it.unit=="box" and left<(it.items_per_box or left),"price_per_item":per_item,"cost_per_item":cost,"status":sc.status,"checked_in_at":iso(sc.created_at),"checked_out_at":iso(sc.checked_out_at)}
def find_code(code):
    return StockCode.query.options(joinedload(StockCode.item)).filter(db.func.lower(StockCode.code)==code.strip().lower()).first()
@app.post("/api/inventory/codes/out-lookup")
@permission_required("inventory")
def out_lookup():
    code=required(body(),"code","Code"); sc=find_code(code)
    if not sc: return jsonify(error=f"{code} was never checked in."),404
    if sc.status!="in": return jsonify(error=f"{sc.code} was already checked out on {sc.checked_out_at:%d %b %Y %H:%M}." if sc.checked_out_at else f"{sc.code} is already checked out."),409
    return jsonify(code=code_out_info(sc))
def sale_json(sa): return {"id":sa.id,"number":f"RC{sa.id:05d}","purpose":sa.purpose,"service_name":sa.service_name,"service_price":sa.service_price,"customer_name":sa.customer_name,"customer_phone":sa.customer_phone,"payment_method":sa.payment_method,"items_total":sa.items_total,"total":sa.total,"created_by":sa.created_by,"created_at":iso(sa.created_at),
    "lines":[{"id":l.id,"code":l.code,"description":l.description,"quantity":l.quantity,"unit_price":l.unit_price,"amount":l.amount,"device_serial":l.device_serial} for l in sa.lines]}
@app.post("/api/sales")
@permission_required("inventory")
def create_sale():
    """Check Out by scanning: takes the scanned pieces / boxes / items out of stock and makes a receipt."""
    data=body(); purpose=text(data,"purpose")
    if purpose not in ("sale","repair"): raise BadRequest("Choose Sale or Repair.")
    service=None
    if purpose=="repair":
        service=db.session.get(Service,num(data,"service_id",0) or 0)
        if not service: raise BadRequest("Choose the repair service.")
    lines_in=data.get("lines") or []
    if not lines_in: raise BadRequest("Scan at least one item.")
    seen=set(); reason="Sold" if purpose=="sale" else "Used in repair"
    sale=Sale(purpose=purpose,service_id=service.id if service else None,service_name=service.name if service else None,service_price=service.price if service else 0,
        customer_name=text(data,"customer_name")[:120],customer_phone=text(data,"customer_phone")[:40],payment_method=text(data,"payment_method")[:40] or "Cash",created_by=current_user().full_name)
    db.session.add(sale); db.session.flush(); number=f"RC{sale.id:05d}"
    for raw in lines_in:
        code=str(raw.get("code") or "").strip()
        if not code: raise BadRequest("A line has no code.")
        if code.lower() in seen: raise BadRequest(f"{code} is scanned twice.")
        seen.add(code.lower())
        sc=find_code(code)
        if not sc: raise BadRequest(f"{code} was never checked in.")
        if sc.status!="in": raise BadRequest(f"{sc.code} is already checked out.")
        info=code_out_info(sc); it=sc.item; mode=str(raw.get("mode") or "")
        if info["unit"]=="piece": qty=1; what=info["product_name"]
        elif mode=="box": qty=info["items_left"]; what=f"{info['product_name']} — whole box"+(" (opened)" if info["opened"] else "")
        elif mode=="items":
            try: qty=int(raw.get("quantity") or 0)
            except (TypeError,ValueError): raise BadRequest(f"Enter how many items to take from box {code}.")
            if qty<1 or qty>info["items_left"]: raise BadRequest(f"Box {sc.code} has {info['items_left']} items left — take between 1 and {info['items_left']}.")
            what=f"{info['product_name']} — {qty} from box"
        else: raise BadRequest(f"Choose Whole box or Items from box for {code}.")
        sc.items_left=info["items_left"]-qty
        if sc.items_left<=0:  # the piece is gone / the box is empty: it leaves the stock count
            sc.status="out"; sc.checked_out_at=datetime.utcnow()
            move_stock(it,"out",1,reason,f"{number} · {sc.code}")
        sale.lines.append(SaleLine(item_id=it.id,code=sc.code,description=what,quantity=qty,unit_price=info["price_per_item"],unit_cost=info["cost_per_item"],amount=qty*info["price_per_item"],device_serial=str(raw.get("device_serial") or "").strip()[:120] or None))
    sale.items_total=sum(l.quantity for l in sale.lines)
    sale.total=sum(l.amount for l in sale.lines)+sale.service_price
    sale.cost=sum(l.quantity*l.unit_cost for l in sale.lines)
    audit(f"Checked out {sale.items_total} items — receipt {number} ({purpose}), {sale.total:,} RWF","Sale",sale.id); db.session.commit()
    return jsonify(sale=sale_json(sale)),201
@app.get("/api/sales")
@permission_required("inventory")
def sales_list():
    rows=Sale.query.options(selectinload(Sale.lines)).order_by(Sale.created_at.desc(),Sale.id.desc()).limit(2000).all()
    return jsonify(sales=[sale_json(sa) for sa in rows])
@app.get("/api/sales/<int:sale_id>/receipt.pdf")
@permission_required("inventory")
def receipt_pdf(sale_id):
    sa=db.get_or_404(Sale,sale_id,description="Receipt not found."); st=getSampleStyleSheet(); number=f"RC{sa.id:05d}"
    head=[["Receipt",number],["Date",sa.created_at.strftime("%d %b %Y %H:%M") if sa.created_at else "—"],["For","Sale" if sa.purpose=="sale" else "Repair"],["Served by",sa.created_by or "—"]]
    if sa.customer_name or sa.customer_phone: head.append(["Customer"," · ".join(x for x in (sa.customer_name,sa.customer_phone) if x)])
    head.append(["Payment",sa.payment_method or "—"])
    rows=[["#","Item","Serial number","Qty","Price / item","Amount"]]
    for n,l in enumerate(sa.lines,1): rows.append([str(n),Paragraph(escape(l.description),st["BodyText"]),l.device_serial or "—",str(l.quantity),f"{l.unit_price:,}",f"{l.amount:,}"])
    if sa.purpose=="repair": rows.append(["",Paragraph(f"<b>Service:</b> {escape(sa.service_name or '')}",st["BodyText"]),"—","1",f"{sa.service_price:,}",f"{sa.service_price:,}"])
    rows.append(["","Total items","",str(sa.items_total),"",""])
    rows.append(["","AMOUNT TO PAY (RWF)","","","",f"{sa.total:,}"])
    items=Table(rows,colWidths=[22,170,100,40,70,73],repeatRows=1)
    items.setStyle(TableStyle([("GRID",(0,0),(-1,-1),.4,colors.grey),("BACKGROUND",(0,0),(-1,0),colors.HexColor("#128AB2")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
        ("ALIGN",(3,1),(-1,-1),"RIGHT"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("BACKGROUND",(0,-1),(-1,-1),colors.HexColor("#E8F7FC")),("FONTNAME",(0,-2),(-1,-1),"Helvetica-Bold"),("PADDING",(0,0),(-1,-1),5)]))
    story=[Paragraph("KIGALI APPLE TECH — RECEIPT",st["Title"]),pdf_table(head),Spacer(1,12),items,Spacer(1,18),Paragraph("Thank you for your business.",st["BodyText"]),Paragraph(f"Kigali Apple Tech • Kigali, Rwanda • {SHOP_PHONE}",st["BodyText"])]
    return pdf_response(story,f"{number}.pdf")
@app.get("/api/inventory/movements")
@permission_required("inventory")
def stock_movements():
    rows=StockMovement.query.options(joinedload(StockMovement.item),joinedload(StockMovement.repair)).order_by(StockMovement.created_at.desc(),StockMovement.id.desc()).limit(2000).all()
    return jsonify(movements=[movement_json(m) for m in rows],check_in_reasons=CHECK_IN_REASONS,check_out_reasons=CHECK_OUT_REASONS)
@app.get("/api/expenses")
@permission_required("expenses")
def expenses():
    return jsonify(expenses=[{"id":e.id,"category":e.category,"amount":e.amount,"description":e.description,"created_by":e.created_by,"created_at":iso(e.created_at)} for e in Expense.query.order_by(Expense.created_at.desc()).limit(2000).all()],categories=EXPENSE_CATEGORIES)
@app.post("/api/expenses")
@permission_required("expenses")
def add_expense():
    data=body()
    e=Expense(category=required(data,"category","Category"),amount=num(data,"amount"),description=text(data,"description"),created_by=current_user().full_name)
    db.session.add(e); db.session.flush(); audit("Recorded expense","Expense",e.id); db.session.commit()
    return jsonify(ok=True),201
@app.get("/api/services")
@login_required
def services(): return jsonify(services=[{"id":s.id,"name":s.name,"price":s.price,"warranty_days":s.warranty_days,"active":s.active} for s in Service.query.order_by(Service.name).all()])
@app.post("/api/services")
@permission_required("services")
def add_service():
    data=body(); s=Service(name=required(data,"name","Service"),price=num(data,"price"),warranty_days=num(data,"warranty_days",21))
    db.session.add(s); db.session.commit()
    return jsonify(ok=True),201

# ---------- Notifications ----------
@app.get("/api/notifications")
@permission_required("notifications")
def notifications():
    return jsonify(notifications=[{"id":n.id,"repair_id":n.repair_id,"channel":n.channel,"recipient":n.recipient,"message":n.message,"status":n.status,"created_at":iso(n.created_at)} for n in Notification.query.order_by(Notification.created_at.desc()).limit(1000).all()],email_ready=bool(RESEND_API_KEY),email_from=EMAIL_FROM)
@app.post("/api/notifications/<int:notification_id>/send")
@permission_required("notifications")
def resend_notification(notification_id):
    n=db.get_or_404(Notification,notification_id,description="Notification not found."); ok,info=send_real_notification_if_configured(n)
    audit(f"Resent {n.channel} notification ({n.status})","Notification",n.id); db.session.commit()
    if not ok: raise BadRequest(info)
    return jsonify(ok=True,message="Email sent.")
@app.post("/api/notifications/test")
@admin_required
def test_email():
    to=required(body(),"to","Email address")
    ok,info=send_email(to,"KAT OS test email",f"Hello,\n\nThis is a test email from KAT OS. If you can read this, email notifications are working.\n\nKigali Apple Tech • Kigali, Rwanda • {SHOP_PHONE}")
    if not ok: raise BadRequest(info)
    return jsonify(ok=True,message=f"Test email sent to {to}.")

# ---------- Products (General Manager) ----------
def product_json(pr): return {"id":pr.id,"name":pr.name,"product_type":pr.product_type,"purchase_price":pr.purchase_price,"selling_price":pr.selling_price,"created_by":pr.created_by,"created_at":iso(pr.created_at),"updated_at":iso(pr.updated_at)}
def product_fields(data,current=None):
    name=required(data,"name","Product name")
    product_type=required(data,"product_type","Type")
    if product_type not in PRODUCT_TYPES: raise BadRequest("Type must be Finished, Semi-finished or Raw material.")
    prices=[]
    for key,label in (("purchase_price","Purchase price"),("selling_price","Selling price")):
        v=num(data,key,None)
        if v is None: raise BadRequest(f"{label} is required.")
        if v<0: raise BadRequest(f"{label} cannot be negative.")
        prices.append(v)
    clash=Product.query.filter(db.func.lower(Product.name)==name.lower()).first()
    if clash and clash is not current: raise Conflict(f"A product called “{clash.name}” already exists.")
    return name,product_type,prices[0],prices[1]
@app.get("/api/products")
@login_required
def products():
    return jsonify(products=[product_json(pr) for pr in Product.query.order_by(Product.name).all()],types=PRODUCT_TYPES)
@app.post("/api/products")
@permission_required("products")
def add_product():
    name,product_type,purchase_price,selling_price=product_fields(body())
    pr=Product(name=name,product_type=product_type,purchase_price=purchase_price,selling_price=selling_price,created_by=current_user().full_name)
    db.session.add(pr); db.session.flush(); audit(f"Added product {name}","Product",pr.id); db.session.commit()
    return jsonify(product=product_json(pr)),201
@app.patch("/api/products/<int:product_id>")
@permission_required("products")
def update_product(product_id):
    pr=db.get_or_404(Product,product_id,description="Product not found.")
    pr.name,pr.product_type,pr.purchase_price,pr.selling_price=product_fields(body(),current=pr)
    audit(f"Edited product {pr.name}","Product",pr.id); db.session.commit()
    return jsonify(product=product_json(pr))
@app.delete("/api/products/<int:product_id>")
@permission_required("products")
def delete_product(product_id):
    pr=db.get_or_404(Product,product_id,description="Product not found.")
    lines=InventoryItem.query.filter_by(product_id=pr.id).all()
    if lines: raise Conflict(f"“{pr.name}” has stock in the inventory ({', '.join(f'{i.quantity} {UNITS.get(i.unit,i.unit)}' for i in lines)}), so it cannot be deleted.")
    audit(f"Deleted product {pr.name}","Product",pr.id); db.session.delete(pr); db.session.commit()
    return jsonify(ok=True)

# ---------- Reports & admin ----------
@app.get("/api/reports")
@permission_required("reports")
def reports():
    rows=Repair.query.all(); paid=sum(total_paid(r) for r in rows); quoted=sum(r.quoted_price for r in rows)
    return jsonify(total=len(rows),collected=sum(1 for r in rows if r.status=="Collected"),revenue=paid,outstanding=max(0,quoted-paid),warranty=sum(1 for r in rows if r.warranty_until and r.warranty_until>=date.today()))
def read_permissions(data,role):
    """Permissions sent by the form. Stored only when they differ from the role's defaults, so later default changes still apply."""
    if role in MANAGER_ROLES: return None
    raw=data.get("permissions") or []
    if isinstance(raw,str): raw=[x for x in raw.split(",") if x]
    keys=[k for k in PERMISSION_KEYS if k in raw]
    return None if keys==list(ROLE_PERMISSIONS.get(role,[])) else ",".join(keys)
def check_username(username,current=None):
    clash=User.query.filter(db.func.lower(User.username)==username.lower()).first()
    if clash and clash is not current: raise Conflict(f"The username “{username}” is already taken.")
@app.get("/api/users")
@admin_required
def users(): return jsonify(users=[user_json(u) for u in User.query.options(joinedload(User.branch)).order_by(User.full_name).all()],roles=ROLES,permissions=PERMISSIONS,role_permissions=ROLE_PERMISSIONS)
@app.post("/api/users")
@admin_required
def add_user():
    data=body(); role=required(data,"role","Role")
    if role not in ROLES: raise BadRequest("Unknown role.")
    password=str(data.get("password") or "")
    if len(password)<6: raise BadRequest("The password needs at least 6 characters.")
    username=required(data,"username","Username"); check_username(username)
    u=User(full_name=required(data,"full_name","Full name"),username=username,password_hash=generate_password_hash(password),role=role,work_email=text(data,"work_email"),branch_id=optional_id(data,"branch_id"),permissions=read_permissions(data,role) if "permissions" in data else None)
    db.session.add(u); db.session.flush(); audit(f"Created staff user {u.username} ({role})","User",u.id); db.session.commit()
    return jsonify(user=user_json(u)),201
@app.patch("/api/users/<int:user_id>")
@admin_required
def edit_user(user_id):
    u=db.get_or_404(User,user_id,description="User not found."); data=body(); me=current_user()
    role=text(data,"role",u.role)
    if role not in ROLES and role!=u.role: raise BadRequest("Unknown role.")
    active=bool(data.get("active",u.active))
    if u.id==me.id and (not active or role not in MANAGER_ROLES): raise BadRequest("You cannot remove your own General Manager access or deactivate yourself.")
    if u.role in MANAGER_ROLES and u.active and (role not in MANAGER_ROLES or not active):
        others=User.query.filter(User.id!=u.id,User.active.is_(True),User.role.in_(MANAGER_ROLES)).count()
        if not others: raise BadRequest("There must be at least one active General Manager.")
    if "username" in data:
        username=required(data,"username","Username"); check_username(username,u); u.username=username
    if "full_name" in data: u.full_name=required(data,"full_name","Full name")
    if "work_email" in data: u.work_email=text(data,"work_email")
    if "branch_id" in data: u.branch_id=optional_id(data,"branch_id")
    password=str(data.get("password") or "")
    if password:
        if len(password)<6: raise BadRequest("The password needs at least 6 characters.")
        u.password_hash=generate_password_hash(password)
    if "permissions" in data: u.permissions=read_permissions(data,role)
    elif role!=u.role: u.permissions=None  # new role, no ticks sent: use the new role's defaults
    u.role=role; u.active=active
    audit(f"Updated staff user {u.username} ({role}{'' if active else ', deactivated'})","User",u.id); db.session.commit()
    return jsonify(user=user_json(u))
@app.get("/api/branches")
@login_required
def branches(): return jsonify(branches=[branch_json(b) for b in Branch.query.all()])
@app.post("/api/branches")
@admin_required
def add_branch():
    data=body(); b=Branch(name=required(data,"name","Branch name"),location=text(data,"location"),phone=text(data,"phone"))
    db.session.add(b); db.session.commit()
    return jsonify(branch=branch_json(b)),201
@app.get("/api/audit")
@admin_required
def audit_logs():
    return jsonify(logs=[{"id":l.id,"user_name":l.user_name,"action":l.action,"entity":l.entity,"entity_id":l.entity_id,"created_at":iso(l.created_at)} for l in AuditLog.query.order_by(AuditLog.created_at.desc()).limit(2000).all()])

def seed():
    if not Branch.query.first(): db.session.add(Branch(name="Kigali Apple Tech - Main",location="Kigali, Rwanda",phone=SHOP_PHONE))
    db.session.commit()
    if not User.query.first():
        username=os.getenv("KAT_ADMIN_USERNAME", "christian").strip()
        password=os.getenv("KAT_ADMIN_PASSWORD", "ChangeMe123!")
        full_name=os.getenv("KAT_ADMIN_NAME", "Christian DUSHIMIMANA").strip()
        db.session.add(User(full_name=full_name,username=username,password_hash=generate_password_hash(password),role="General Manager",work_email="christian@kat.com",branch_id=Branch.query.first().id)); db.session.commit()

def upgrade_schema():
    """Bring tables made by earlier versions up to date. Safe to run on every start (each step runs only once)."""
    insp=db.inspect(db.engine); tables=insp.get_table_names()
    if "product" in tables:
        cols={c["name"] for c in insp.get_columns("product")}
        if not ({"purchase_price","selling_price"}<=cols and "price" not in cols):
            with db.engine.begin() as conn:  # one transaction: all steps or none
                if "purchase_price" not in cols: conn.execute(db.text("ALTER TABLE product ADD COLUMN purchase_price INTEGER NOT NULL DEFAULT 0"))
                if "selling_price" not in cols:
                    conn.execute(db.text("ALTER TABLE product ADD COLUMN selling_price INTEGER NOT NULL DEFAULT 0"))
                    if "price" in cols: conn.execute(db.text("UPDATE product SET selling_price = price"))  # the old single price was the selling price
                if "price" in cols: conn.execute(db.text("ALTER TABLE product DROP COLUMN price"))
            app.logger.warning("Upgraded the product table: price -> purchase_price + selling_price.")
    if "inventory_item" in tables:
        cols={c["name"] for c in insp.get_columns("inventory_item")}
        missing=[(n,sql) for n,sql in (("product_id","INTEGER"),("unit","VARCHAR(10) NOT NULL DEFAULT 'piece'"),("items_per_box","INTEGER")) if n not in cols]
        if missing:
            with db.engine.begin() as conn:
                for n,sql in missing: conn.execute(db.text(f"ALTER TABLE inventory_item ADD COLUMN {n} {sql}"))
            app.logger.warning("Upgraded the inventory_item table: added %s.", ", ".join(n for n,_ in missing))
    if "user" in tables and "permissions" not in {c["name"] for c in insp.get_columns("user")}:
        with db.engine.begin() as conn: conn.execute(db.text('ALTER TABLE "user" ADD COLUMN permissions TEXT'))
        app.logger.warning("Upgraded the user table: added permissions.")
    if "stock_code" in tables:
        cols={c["name"] for c in insp.get_columns("stock_code")}
        missing=[(n,sql) for n,sql in (("status","VARCHAR(10) NOT NULL DEFAULT 'in'"),("items_left","INTEGER"),("checked_out_at","TIMESTAMP")) if n not in cols]
        if missing:
            with db.engine.begin() as conn:
                for n,sql in missing: conn.execute(db.text(f"ALTER TABLE stock_code ADD COLUMN {n} {sql}"))
                if "items_left" in dict(missing):  # codes checked in before: a piece has 1 item, a box is full
                    conn.execute(db.text("UPDATE stock_code SET items_left = COALESCE((SELECT CASE WHEN i.unit = 'box' THEN i.items_per_box ELSE 1 END FROM inventory_item i WHERE i.id = stock_code.item_id), 1) WHERE items_left IS NULL"))
            app.logger.warning("Upgraded the stock_code table: added %s.", ", ".join(n for n,_ in missing))

with app.app_context():
    db.create_all(); upgrade_schema(); seed()

if __name__=="__main__":
    # Local development (`python api/app.py`): restart automatically when this file changes.
    # Set KAT_RELOAD=0 to turn that off. Production runs under gunicorn and never reaches this block.
    app.run(host="0.0.0.0",port=int(os.getenv("PORT","5000")),debug=os.getenv("FLASK_DEBUG")=="1",use_reloader=os.getenv("KAT_RELOAD","1")=="1")
