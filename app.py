from flask import Flask, render_template, request, redirect, url_for, flash, session, send_file
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime, date, timedelta
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("KAT_SECRET_KEY", "CHANGE-ME-IN-PRODUCTION")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///kat_os.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

STATUSES = ["Received","Diagnosing","Waiting for Approval","Repairing","Ready","Collected","Cancelled"]
ROLES = ["General Manager","Receptionist","Technician"]
DEVICE_CATEGORIES = ["iPhone","MacBook","iPad"]
PART_CATEGORIES = ["Screen","Battery","Back Glass","Flex Cable","Other"]
EXPENSE_CATEGORIES = ["Courier / Carrier","Money Transfer Fee","Transport","Customs","Rent","Salary","Utilities","Stock Expense","Other"]
PAYMENT_METHODS = ["Cash","Mobile Money","Bank","Card","Other"]
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

class Branch(db.Model):
    id=db.Column(db.Integer,primary_key=True); name=db.Column(db.String(100),nullable=False); location=db.Column(db.String(180)); phone=db.Column(db.String(40)); active=db.Column(db.Boolean,default=True)
class User(db.Model):
    id=db.Column(db.Integer,primary_key=True); full_name=db.Column(db.String(120),nullable=False); username=db.Column(db.String(80),unique=True,nullable=False); password_hash=db.Column(db.String(255),nullable=False); role=db.Column(db.String(30),default="Technician"); work_email=db.Column(db.String(120)); branch_id=db.Column(db.Integer,db.ForeignKey("branch.id")); active=db.Column(db.Boolean,default=True)
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
class AuditLog(db.Model):
    id=db.Column(db.Integer,primary_key=True); user_name=db.Column(db.String(120)); action=db.Column(db.String(180)); entity=db.Column(db.String(80)); entity_id=db.Column(db.Integer); created_at=db.Column(db.DateTime,default=datetime.utcnow)

def current_user():
    return User.query.get(session.get("user_id")) if session.get("user_id") else None
def login_required(fn):
    @wraps(fn)
    def w(*a,**k):
        if not current_user(): return redirect(url_for("login"))
        return fn(*a,**k)
    return w
def admin_required(fn):
    @wraps(fn)
    def w(*a,**k):
        u=current_user()
        if not u or u.role not in ["Admin","General Manager"]:
            flash("General Manager access required.","error"); return redirect(url_for("dashboard"))
        return fn(*a,**k)
    return w
def audit(action,entity="",entity_id=None):
    u=current_user(); db.session.add(AuditLog(user_name=u.full_name if u else "System",action=action,entity=entity,entity_id=entity_id))
def ticket_from_number(n):
    block=(n-1)//100; num=((n-1)%100)+1; letters=""; x=block
    while True:
        letters=chr(ord("a")+(x%26))+letters; x=x//26-1
        if x<0: break
    return f"KAT{num:03d}{letters}"
def next_ticket():
    last=Repair.query.order_by(Repair.id.desc()).first()
    return ticket_from_number((last.id if last else 0)+1)
def total_paid(r): return sum(p.amount for p in r.payments)
def queue_status_notification(r):
    msg=f"Kigali Apple Tech: {r.ticket_code} ({r.device}) status is now {r.status}."
    db.session.add(Notification(repair_id=r.id,channel="SMS/WhatsApp",recipient=r.client.phone,message=msg,status="Queued"))
def send_real_notification_if_configured(n):
    # Production hook: connect Twilio/Meta WhatsApp/email provider here using environment credentials.
    # Until credentials are configured, notifications remain safely queued and visible in KAT OS.
    return False

@app.context_processor
def inject():
    return dict(me=current_user(),total_paid=total_paid,today=date.today())

@app.route("/login",methods=["GET","POST"])
def login():
    if request.method=="POST":
        u=User.query.filter_by(username=request.form["username"].strip()).first()
        if u and u.active and check_password_hash(u.password_hash,request.form["password"]):
            session["user_id"]=u.id; audit("Logged in","User",u.id); db.session.commit(); return redirect(url_for("dashboard"))
        flash("Invalid login.","error")
    return render_template("login.html")
@app.route("/logout")
def logout(): session.clear(); return redirect(url_for("login"))

@app.route("/")
@login_required
def dashboard():
    today=date.today(); q=Repair.query; u=current_user()
    common=dict(total=q.count(),open_repairs=q.filter(Repair.status.notin_(["Collected","Cancelled"])).count(),ready=q.filter_by(status="Ready").count(),overdue=q.filter(Repair.deadline.isnot(None),Repair.deadline<today,Repair.status.notin_(["Ready","Collected","Cancelled"])).count(),recent=q.order_by(Repair.created_at.desc()).limit(12).all(),low_stock=InventoryItem.query.filter(InventoryItem.quantity<=InventoryItem.reorder_level).count(),queued=Notification.query.filter_by(status="Queued").count())
    if u.role in ["Admin","General Manager"]:
        start=datetime.combine(today,datetime.min.time()); end=datetime.combine(today+timedelta(days=1),datetime.min.time())
        payments=Payment.query.filter(Payment.paid_at>=start,Payment.paid_at<end).all(); sales=sum(x.amount for x in payments)
        used=RepairPart.query.filter(RepairPart.used_at>=start,RepairPart.used_at<end).all(); parts_cost=sum(x.quantity*x.item.cost_price for x in used)
        expenses=sum(x.amount for x in Expense.query.filter(Expense.created_at>=start,Expense.created_at<end).all())
        common.update(show_finance=True,today_sales=sales,today_cost=parts_cost,today_expenses=expenses,today_profit=sales-parts_cost-expenses)
    else: common.update(show_finance=False)
    return render_template("dashboard.html",**common)

@app.route("/clients")
@login_required
def clients():
    q=request.args.get("q","").strip()
    rows=Client.query
    if q:
        ids=[x.client_id for x in Device.query.filter(db.or_(Device.serial_imei.ilike(f"%{q}%"),Device.model.ilike(f"%{q}%"))).all()]
        repair_ids=[x.client_id for x in Repair.query.filter(db.or_(Repair.ticket_code.ilike(f"%{q}%"),Repair.serial_imei.ilike(f"%{q}%"))).all()]
        rows=rows.filter(db.or_(Client.full_name.ilike(f"%{q}%"),Client.phone.ilike(f"%{q}%"),Client.id.in_(ids+repair_ids)))
    return render_template("clients.html",clients=rows.order_by(Client.created_at.desc()).all(),q=q)
@app.route("/clients/new",methods=["GET","POST"])
@login_required
def new_client():
    if request.method=="POST":
        c=Client(full_name=request.form["full_name"].strip(),phone=request.form["phone"].strip(),email=request.form.get("email","").strip(),address=request.form.get("address","").strip())
        db.session.add(c); db.session.flush(); audit("Registered client","Client",c.id); db.session.commit(); flash("Client registered.","success"); return redirect(url_for("new_repair",client_id=c.id))
    return render_template("client_form.html")

@app.route("/clients/<int:client_id>")
@login_required
def client_detail(client_id):
    return render_template("client_detail.html",client=Client.query.get_or_404(client_id))

@app.route("/clients/<int:client_id>/note",methods=["POST"])
@login_required
def add_client_note(client_id):
    c=Client.query.get_or_404(client_id); note=request.form.get("note","").strip()
    if note:
        db.session.add(ClientNote(client_id=c.id,note=note,author=current_user().full_name)); audit("Added client note","Client",c.id); db.session.commit()
    return redirect(url_for("client_detail",client_id=c.id))

@app.route("/device/scan")
@login_required
def device_scan():
    q=request.args.get("q","").strip(); device=None
    if q: device=Device.query.filter(Device.serial_imei.ilike(q)).first()
    return render_template("device_scan.html",device=device,q=q)

@app.route("/clients/<int:client_id>/device",methods=["POST"])
@login_required
def add_device(client_id):
    c=Client.query.get_or_404(client_id); code=request.form.get("serial_imei","").strip()
    existing=Device.query.filter_by(serial_imei=code).first() if code else None
    if existing: flash("This IMEI/serial already exists. Existing owner opened.","error"); return redirect(url_for("client_detail",client_id=existing.client_id))
    d=Device(client_id=c.id,category=request.form.get("category","iPhone"),model=request.form.get("model",""),serial_imei=code); db.session.add(d); db.session.flush(); audit("Added device","Device",d.id); db.session.commit(); return redirect(url_for("client_detail",client_id=c.id))

@app.route("/devices/<int:device_id>/transfer",methods=["POST"])
@admin_required
def transfer_device(device_id):
    d=Device.query.get_or_404(device_id); old=d.client_id; new=int(request.form["new_client_id"]); d.client_id=new
    db.session.add(OwnershipHistory(device_id=d.id,previous_client_id=old,new_client_id=new,changed_by=current_user().full_name)); audit("Transferred device ownership","Device",d.id); db.session.commit(); return redirect(url_for("client_detail",client_id=new))

@app.route("/repairs")
@login_required
def repairs():
    q=request.args.get("q","").strip(); rows=Repair.query.join(Client)
    if q: rows=rows.filter(db.or_(Repair.ticket_code.ilike(f"%{q}%"),Repair.serial_imei.ilike(f"%{q}%"),Repair.device.ilike(f"%{q}%"),Client.phone.ilike(f"%{q}%"),Client.full_name.ilike(f"%{q}%")))
    return render_template("repairs.html",repairs=rows.order_by(Repair.created_at.desc()).all(),q=q)
@app.route("/repairs/new",methods=["GET","POST"])
@login_required
def new_repair():
    clients=Client.query.order_by(Client.full_name).all(); techs=User.query.filter_by(active=True).filter(User.role.in_(["Technician","Admin","General Manager"])).all(); branches=Branch.query.filter_by(active=True).all()
    if request.method=="POST":
        cat=request.form["problem_category"]; d=request.form.get("deadline")
        r=Repair(ticket_code=next_ticket(),client_id=int(request.form["client_id"]),branch_id=int(request.form["branch_id"]) if request.form.get("branch_id") else None,device=request.form["device"].strip(),serial_imei=request.form.get("serial_imei","").strip(),device_passcode=request.form.get("device_passcode","").strip(),accessories=request.form.get("accessories","").strip(),condition_in=request.form.get("condition_in","").strip(),problem_category=cat,problem_notes=request.form.get("problem_notes","").strip(),technician_id=int(request.form["technician_id"]) if request.form.get("technician_id") else None,quoted_price=int(request.form.get("quoted_price") or 0),deadline=datetime.strptime(d,"%Y-%m-%d").date() if d else None,terms_snapshot="\n".join("• "+x for x in TERMS.get(cat,[])),customer_acceptance=request.form.get("customer_acceptance","").strip(),warranty_days=21)
        db.session.add(r); db.session.flush(); audit("Created repair ticket","Repair",r.id); queue_status_notification(r); db.session.commit(); flash(f"{r.ticket_code} created.","success"); return redirect(url_for("repair_detail",repair_id=r.id))
    return render_template("repair_form.html",clients=clients,techs=techs,branches=branches,terms=TERMS,selected=request.args.get("client_id",type=int))
@app.route("/repairs/<int:repair_id>",methods=["GET","POST"])
@login_required
def repair_detail(repair_id):
    r=Repair.query.get_or_404(repair_id); techs=User.query.filter_by(active=True).all()
    if request.method=="POST":
        old=r.status; r.status=request.form["status"]; r.technician_id=int(request.form["technician_id"]) if request.form.get("technician_id") else None; r.quoted_price=int(request.form.get("quoted_price") or 0); r.diagnosis=request.form.get("diagnosis",""); r.work_done=request.form.get("work_done",""); r.approved=bool(request.form.get("approved"))
        if r.status=="Collected" and not r.warranty_until: r.warranty_until=date.today()+timedelta(days=r.warranty_days)
        if old!=r.status: queue_status_notification(r)
        audit(f"Updated repair: {old} → {r.status}","Repair",r.id); db.session.commit(); flash("Repair updated.","success"); return redirect(url_for("repair_detail",repair_id=r.id))
    return render_template("repair_detail.html",repair=r,statuses=STATUSES,techs=techs,inventory=InventoryItem.query.filter(InventoryItem.quantity>0).order_by(InventoryItem.name).all())
@app.route("/repairs/<int:repair_id>/payment",methods=["POST"])
@login_required
def add_payment(repair_id):
    r=Repair.query.get_or_404(repair_id); amt=int(request.form.get("amount") or 0)
    if amt>0:
        p=Payment(repair_id=r.id,amount=amt,method=request.form.get("method"),reference=request.form.get("reference",""),received_by=current_user().full_name); db.session.add(p); db.session.flush(); audit("Recorded payment","Payment",p.id); db.session.commit(); flash("Payment recorded.","success")
    return redirect(url_for("repair_detail",repair_id=r.id))
@app.route("/repairs/<int:repair_id>/part",methods=["POST"])
@login_required
def use_part(repair_id):
    r=Repair.query.get_or_404(repair_id); item=InventoryItem.query.get_or_404(int(request.form["item_id"])); qty=max(1,int(request.form.get("quantity") or 1))
    if item.quantity<qty: flash("Not enough stock.","error")
    else:
        item.quantity-=qty; rp=RepairPart(repair_id=r.id,item_id=item.id,quantity=qty); db.session.add(rp); db.session.flush(); audit(f"Used {qty} × {item.name}","Repair",r.id); db.session.commit(); flash("Part deducted from inventory.","success")
    return redirect(url_for("repair_detail",repair_id=r.id))
DOCUMENT_TYPES = ["Invoice","Proforma Invoice","Quotation / Estimate","Receipt","Warranty Card","Appointment Card","Repair Intake / Job Card","Device Collection / Delivery Card"]
@app.route("/documents")
@login_required
def documents():
    return render_template("documents.html",repairs=Repair.query.order_by(Repair.created_at.desc()).limit(100).all(),document_types=DOCUMENT_TYPES)

@app.route("/repairs/<int:repair_id>/document/<doc_type>.pdf")
@login_required
def repair_document_pdf(repair_id,doc_type):
    r=Repair.query.get_or_404(repair_id); title=doc_type.replace("-"," ").title(); buf=BytesIO(); doc=SimpleDocTemplate(buf,pagesize=A4,rightMargin=35,leftMargin=35,topMargin=35,bottomMargin=35); st=getSampleStyleSheet()
    balance=max(0,r.quoted_price-total_paid(r)); data=[["Client",r.client.full_name],["Phone",r.client.phone],["Ticket",r.ticket_code],["Device",r.device],["IMEI / Serial",r.serial_imei or "—"],["Problem",r.problem_category],["Status",r.status],["Amount",f"{r.quoted_price:,} RWF"],["Paid",f"{total_paid(r):,} RWF"],["Balance",f"{balance:,} RWF"],["Warranty until",str(r.warranty_until or "—")],["Date",datetime.now().strftime("%d %b %Y")]]
    t=Table(data,colWidths=[120,350]); t.setStyle(TableStyle([("GRID",(0,0),(-1,-1),.4,colors.grey),("BACKGROUND",(0,0),(0,-1),colors.HexColor("#E8F7FC")),("PADDING",(0,0),(-1,-1),7)]))
    story=[Paragraph(f"KIGALI APPLE TECH — {title.upper()}",st["Title"]),Spacer(1,10),t,Spacer(1,18),Paragraph("Client signature: ____________________",st["BodyText"]),Paragraph("Authorized by KAT: ____________________",st["BodyText"]),Spacer(1,12),Paragraph("Kigali Apple Tech • Kigali, Rwanda • 0788 882 114",st["BodyText"])]; doc.build(story); buf.seek(0); return send_file(buf,mimetype="application/pdf",as_attachment=True,download_name=f"{r.ticket_code}-{doc_type}.pdf")

@app.route("/repairs/<int:repair_id>/ticket.pdf")
@login_required
def ticket_pdf(repair_id):
    r=Repair.query.get_or_404(repair_id); buf=BytesIO(); doc=SimpleDocTemplate(buf,pagesize=A4,rightMargin=35,leftMargin=35,topMargin=35,bottomMargin=35); st=getSampleStyleSheet()
    story=[Paragraph("KIGALI APPLE TECH — REPAIR TICKET",st["Title"]),Paragraph(f"<b>Ticket:</b> {r.ticket_code}",st["Heading2"]),Spacer(1,8)]
    data=[["Client",r.client.full_name],["Phone",r.client.phone],["Device",r.device],["IMEI / Serial",r.serial_imei or "—"],["Problem",r.problem_category],["Status",r.status],["Technician",r.technician.full_name if r.technician else "—"],["Quoted price",f"{r.quoted_price:,} RWF"],["Paid",f"{total_paid(r):,} RWF"],["Balance",f"{max(0,r.quoted_price-total_paid(r)):,} RWF"],["Deadline",str(r.deadline or "—")]]
    t=Table(data,colWidths=[120,350]); t.setStyle(TableStyle([("GRID",(0,0),(-1,-1),.4,colors.grey),("BACKGROUND",(0,0),(0,-1),colors.HexColor("#E8F7FC")),("PADDING",(0,0),(-1,-1),7)])); story += [t,Spacer(1,12),Paragraph("<b>Terms & Conditions</b>",st["Heading3"]),Paragraph((r.terms_snapshot or "").replace("\n","<br/>"),st["BodyText"]),Spacer(1,12),Paragraph(f"Customer acceptance: {r.customer_acceptance or '________________'}",st["BodyText"]),Paragraph("Kigali Apple Tech • Kigali, Rwanda • 0788 882 114",st["BodyText"])]
    doc.build(story); buf.seek(0); return send_file(buf,mimetype="application/pdf",as_attachment=True,download_name=f"{r.ticket_code}.pdf")

@app.route("/inventory",methods=["GET","POST"])
@login_required
def inventory():
    if request.method=="POST":
        item=InventoryItem(sku=request.form["sku"].strip(),name=request.form["name"].strip(),category=request.form.get("category",""),device_category=request.form.get("device_category","iPhone"),supplier=request.form.get("supplier",""),compatible_models=request.form.get("compatible_models",""),quantity=int(request.form.get("quantity") or 0),reorder_level=int(request.form.get("reorder_level") or 2),cost_price=int(request.form.get("cost_price") or 0),selling_price=int(request.form.get("selling_price") or 0),branch_id=int(request.form["branch_id"]) if request.form.get("branch_id") else None)
        db.session.add(item); db.session.flush(); audit("Added inventory item","InventoryItem",item.id); db.session.commit(); flash("Stock item added.","success"); return redirect(url_for("inventory"))
    return render_template("inventory.html",items=InventoryItem.query.order_by(InventoryItem.name).all(),branches=Branch.query.all())
@app.route("/inventory/<int:item_id>/adjust",methods=["POST"])
@login_required
def adjust_stock(item_id):
    i=InventoryItem.query.get_or_404(item_id); delta=int(request.form.get("delta") or 0); i.quantity=max(0,i.quantity+delta); audit(f"Stock adjustment {delta:+d}","InventoryItem",i.id); db.session.commit(); return redirect(url_for("inventory"))

@app.route("/expenses",methods=["GET","POST"])
@admin_required
def expenses():
    if request.method=="POST":
        e=Expense(category=request.form["category"],amount=int(request.form.get("amount") or 0),description=request.form.get("description",""),created_by=current_user().full_name); db.session.add(e); db.session.flush(); audit("Recorded expense","Expense",e.id); db.session.commit(); return redirect(url_for("expenses"))
    return render_template("expenses.html",expenses=Expense.query.order_by(Expense.created_at.desc()).limit(300).all(),categories=EXPENSE_CATEGORIES)

@app.route("/services",methods=["GET","POST"])
@login_required
def services():
    if request.method=="POST":
        s=Service(name=request.form["name"].strip(),price=int(request.form.get("price") or 0),warranty_days=int(request.form.get("warranty_days") or 21)); db.session.add(s); db.session.commit(); flash("Service added.","success"); return redirect(url_for("services"))
    return render_template("services.html",services=Service.query.order_by(Service.name).all())
@app.route("/terms")
@login_required
def terms_library(): return render_template("terms.html",terms=TERMS)
@app.route("/notifications")
@login_required
def notifications(): return render_template("notifications.html",notifications=Notification.query.order_by(Notification.created_at.desc()).limit(200).all())
@app.route("/reports")
@login_required
def reports():
    repairs=Repair.query.all(); paid=sum(total_paid(r) for r in repairs); quoted=sum(r.quoted_price for r in repairs); return render_template("reports.html",total=len(repairs),collected=sum(1 for r in repairs if r.status=="Collected"),revenue=paid,outstanding=max(0,quoted-paid),warranty=sum(1 for r in repairs if r.warranty_until and r.warranty_until>=date.today()))
@app.route("/admin/users",methods=["GET","POST"])
@admin_required
def users():
    if request.method=="POST":
        u=User(full_name=request.form["full_name"],username=request.form["username"],password_hash=generate_password_hash(request.form["password"]),role=request.form["role"],work_email=request.form.get("work_email",""),branch_id=int(request.form["branch_id"]) if request.form.get("branch_id") else None); db.session.add(u); db.session.commit(); flash("User created.","success"); return redirect(url_for("users"))
    return render_template("users.html",users=User.query.all(),roles=ROLES,branches=Branch.query.all())
@app.route("/admin/branches",methods=["GET","POST"])
@admin_required
def branches():
    if request.method=="POST":
        b=Branch(name=request.form["name"],location=request.form.get("location",""),phone=request.form.get("phone","")); db.session.add(b); db.session.commit(); return redirect(url_for("branches"))
    return render_template("branches.html",branches=Branch.query.all())
@app.route("/admin/audit")
@admin_required
def audit_logs(): return render_template("audit.html",logs=AuditLog.query.order_by(AuditLog.created_at.desc()).limit(300).all())

def seed():
    if not Branch.query.first(): db.session.add(Branch(name="Kigali Apple Tech - Main",location="Kigali, Rwanda",phone="0788 882 114"))
    db.session.commit()
    if not User.query.first():
        db.session.add(User(full_name="Christian DUSHIMIMANA",username="christian",password_hash=generate_password_hash("ChangeMe123!"),role="General Manager",work_email="christian@kat.com",branch_id=Branch.query.first().id)); db.session.commit()

with app.app_context():
    db.create_all(); seed()

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.getenv("PORT","5000")),debug=os.getenv("FLASK_DEBUG")=="1")
