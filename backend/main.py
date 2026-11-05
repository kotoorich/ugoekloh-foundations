import os, uuid, base64, binascii, threading, time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional
import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from supabase import create_client, Client
from dotenv import load_dotenv
from email_service import send_email

load_dotenv()
app = FastAPI(title="Ugoekloh Foundations API", version="1.0.0")
origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"], allow_headers=["*"])
SUPABASE_URL=os.getenv("SUPABASE_URL","")
SUPABASE_SERVICE_ROLE_KEY=os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
PAYSTACK_SECRET_KEY=os.getenv("PAYSTACK_SECRET_KEY","")
PAYSTACK_CALLBACK_URL=os.getenv("PAYSTACK_CALLBACK_URL","")
db: Optional[Client] = create_client(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else None

class DonationRequest(BaseModel):
    amount: Decimal = Field(gt=0, le=Decimal("10000000"), decimal_places=2)
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=30)
    method: str = "paystack"
    programme_id: Optional[str] = None
    beneficiary_id: Optional[str] = None

class ContactRequest(BaseModel):
    name: str = Field(min_length=2,max_length=120)
    email: EmailStr
    subject: str = Field(default="",max_length=180)
    message: str = Field(min_length=5,max_length=5000)

class VolunteerRequest(BaseModel):
    name: str = Field(min_length=2,max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7,max_length=30)
    skills: str = Field(min_length=2,max_length=300)
    message: str = Field(default="",max_length=2000)

def database():
    if not db: raise HTTPException(503,"Database service is not configured.")
    return db

# --- Public form abuse control -------------------------------------------
# The unauthenticated write endpoints (contact, volunteer, newsletter,
# partnership, donation start) were open to unlimited automated submissions.
# A fixed-window counter per client address is deliberately simple: it needs no
# extra dependency, survives a single-instance Render deployment, and its only
# job is to stop a script filling the database and the mail quota. Counters live
# in memory, so a multi-instance deployment would apply the limit per instance.
_RATE_WINDOWS: dict = {}
_RATE_LOCK = threading.Lock()
RATE_LIMIT_WINDOW_SECONDS = 60

def rate_limit(request: Request, bucket: str, limit: int) -> None:
    """Reject the request with 429 once `limit` calls arrive in a minute.

    Keyed by client address and bucket, so a burst against one form cannot lock
    a donor out of another. Behind a proxy the first X-Forwarded-For entry is the
    real client; Render sets this header.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    address = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    now = time.monotonic()
    key = (address, bucket)
    with _RATE_LOCK:
        hits = [t for t in _RATE_WINDOWS.get(key, []) if now - t < RATE_LIMIT_WINDOW_SECONDS]
        if len(hits) >= limit:
            raise HTTPException(429, "Too many submissions from this connection. Please wait a minute and try again.")
        hits.append(now)
        _RATE_WINDOWS[key] = hits
        # Keep the table from growing without bound on a long-lived instance.
        if len(_RATE_WINDOWS) > 5000:
            for stale in [k for k, v in _RATE_WINDOWS.items() if not v or now - max(v) >= RATE_LIMIT_WINDOW_SECONDS]:
                _RATE_WINDOWS.pop(stale, None)

# Populated by the startup hook so /api/health can report schema-setup problems
# without the API ever refusing to boot because of them.
#
# `state` is deliberately three-valued. "starting" must stay a 200: Render polls
# /api/health while the container comes up, and migrations legitimately take a
# few seconds, so reporting failure during that window would restart-loop the
# service. Only a settled "failed" is a real, actionable error.
STARTUP_STATE = {"database_ready": False, "database_error": None, "state": "starting"}


@app.on_event("startup")
def initialize_database_and_admin():
    # Schema setup is best-effort and runs off the startup path: a missing or
    # unreachable database must not delay or stop the API from serving (the
    # public site and health check stay up). Render redeploys safely apply only
    # migration files not yet recorded, serialised by an advisory lock.
    import threading

    def run():
        from migration_runner import setup_database
        try:
            setup_database()
            STARTUP_STATE["database_ready"] = True
            STARTUP_STATE["database_error"] = None
            STARTUP_STATE["state"] = "ready"
        except Exception as exc:
            STARTUP_STATE["database_ready"] = False
            STARTUP_STATE["database_error"] = str(exc)
            STARTUP_STATE["state"] = "failed"
            print(f"[database] Schema setup skipped: {exc}")

    threading.Thread(target=run, name="database-setup", daemon=True).start()

@app.get("/api/health")
def health():
    """Liveness and readiness in one endpoint.

    Returns 503 only once setup has definitively failed, so that an uptime check
    notices a database that never came up. Previously this always returned 200
    with `status: ok`, which meant a deployment whose schema never applied looked
    healthy while every write silently failed.
    """
    state = STARTUP_STATE["state"]
    body = {
        "status": "ok" if state == "ready" else ("degraded" if state == "failed" else "starting"),
        "service": "ugoekloh-foundations-api",
        "database_configured": db is not None,
        "database_ready": STARTUP_STATE["database_ready"],
        "database_state": state,
        "database_error": STARTUP_STATE["database_error"],
    }
    return JSONResponse(body, status_code=503 if state == "failed" else 200)

@app.get("/api/public/home")
def home():
    if not db: return {"programmes":[],"impact":{}}
    # The two most recently published programmes, so a programme created in the
    # dashboard reaches the homepage without a code change. Previously this
    # filtered on two hard-coded slugs, which silently hid every new programme.
    programs=db.table("programmes").select("id,title,slug,category,description,image_path,goal_amount,amount_raised").eq("status","published").order("created_at",desc=True).limit(2).execute().data
    return {"programmes":programs or [],"impact":{}}

@app.get("/api/public/programmes")
def public_programmes():
    if not db:return {"items":[]}
    items=db.table("programmes").select("id,title,slug,category,description,goal_amount,amount_raised,image_path,status").eq("status","published").order("created_at").execute().data
    return {"items":items or []}

@app.post("/api/public/contact")
async def contact(payload: ContactRequest, request: Request):
    rate_limit(request, "contact", 5)
    client=database()
    result=client.table("contact_messages").insert(payload.model_dump()).execute()
    mail_result=await send_email(client,to=str(payload.email),subject="We received your message",heading="Thank you for contacting us",message="Your message has been received. Our team will review it and respond using the contact details you provided.",category="contact_acknowledgement")
    admin_to=os.getenv("EMAIL_ADMIN_NOTIFY_TO","")
    if admin_to:
        await send_email(client,to=admin_to,subject="New foundation contact message",heading="New contact message received",message=f"A new message was submitted by {payload.name}. Please review it in the Admin Dashboard.",category="contact_admin_notification")
    return {"ok":True,"id":result.data[0]["id"] if result.data else None,"email_sent":bool(mail_result.get("sent"))}

@app.post("/api/public/volunteer")
async def volunteer(payload: VolunteerRequest, request: Request):
    rate_limit(request, "volunteer", 5)
    client=database()
    result=client.table("volunteer_applications").insert(payload.model_dump()).execute()
    mail_result=await send_email(client,to=str(payload.email),subject="Volunteer application received",heading="Thank you for offering your time",message="Your volunteer application has been received. The foundation team will review it and contact you if further information is needed.",category="volunteer_acknowledgement")
    admin_to=os.getenv("EMAIL_ADMIN_NOTIFY_TO","")
    if admin_to:
        await send_email(client,to=admin_to,subject="New volunteer application",heading="A new volunteer application was received",message=f"A volunteer application from {payload.name} is ready for review in the Admin Dashboard.",category="volunteer_admin_notification")
    return {"ok":True,"id":result.data[0]["id"] if result.data else None,"email_sent":bool(mail_result.get("sent"))}

@app.post("/api/donations/initialize")
async def initialize_donation(payload: DonationRequest, request: Request):
    rate_limit(request, "donation", 10)
    client=database()
    if payload.method != "paystack":
        raise HTTPException(422,"Only secure online payment is accepted.")
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(503,"Secure online donations are temporarily unavailable. Please try again later.")
    if payload.programme_id and payload.beneficiary_id:
        raise HTTPException(422,"Please choose a single destination for your donation.")
    if payload.programme_id:
        selected=client.table("programmes").select("id").eq("id",payload.programme_id).eq("status","published").maybe_single().execute().data
        if not selected: raise HTTPException(404,"That programme is no longer available. Please choose another destination.")
    if payload.beneficiary_id:
        # Only cases an administrator has published, with recorded guardian
        # consent, may receive public donations.
        selected=client.table("beneficiaries").select("id").eq("id",payload.beneficiary_id).eq("is_public",True).eq("consent_to_publish",True).is_("archived_at","null").maybe_single().execute().data
        if not selected: raise HTTPException(404,"That child's support page is no longer available. Please choose another destination.")

    destination = "beneficiary" if payload.beneficiary_id else ("programme" if payload.programme_id else "foundation")
    amount_pesewas=int((payload.amount*100).quantize(Decimal("1")))
    ref="UEKF-"+uuid.uuid4().hex[:18].upper()
    metadata={"donor_name":payload.name,"donor_phone":payload.phone,"programme_id":payload.programme_id,"beneficiary_id":payload.beneficiary_id,"donation_destination":destination}
    row={"reference":ref,"amount":float(payload.amount),"currency":"GHS","donor_name":payload.name,"donor_email":str(payload.email),"donor_phone":payload.phone,"status":"pending","programme_id":payload.programme_id,"beneficiary_id":payload.beneficiary_id,"payment_method":"paystack"}
    try:
        client.table("donations").insert(row).execute()
    except Exception as exc:
        raise HTTPException(503,"We could not create your donation record. No payment session was started. Please try again.") from exc
    try:
        async with httpx.AsyncClient(timeout=25) as http:
            response=await http.post(
                "https://api.paystack.co/transaction/initialize",
                headers={"Authorization":f"Bearer {PAYSTACK_SECRET_KEY}","Content-Type":"application/json"},
                json={"email":payload.email,"amount":amount_pesewas,"currency":"GHS","reference":ref,"callback_url":PAYSTACK_CALLBACK_URL,"metadata":metadata},
            )
        data=response.json()
        if response.status_code>=400 or not data.get("status"):
            client.table("donations").update({"status":"failed"}).eq("reference",ref).execute()
            raise HTTPException(502,"We could not start your secure payment. No donation has been recorded as received. Please try again.")
    except HTTPException:
        raise
    except Exception as exc:
        client.table("donations").update({"status":"failed"}).eq("reference",ref).execute()
        raise HTTPException(502,"We could not connect to the payment provider. No donation has been recorded as received. Please try again.") from exc
    return {"ok":True,"reference":ref,"authorization_url":data["data"]["authorization_url"]}

@app.get("/api/donations/verify/{reference}")
async def verify_donation(reference: str):
    if not PAYSTACK_SECRET_KEY: raise HTTPException(503,"Online payment verification is not configured.")
    async with httpx.AsyncClient(timeout=25) as http:
        response=await http.get(f"https://api.paystack.co/transaction/verify/{reference}",headers={"Authorization":f"Bearer {PAYSTACK_SECRET_KEY}"})
    data=response.json()
    if response.status_code>=400 or not data.get("status"): raise HTTPException(400,"Unable to verify this transaction.")
    tx=data["data"]
    if tx.get("status")!="success" or tx.get("reference")!=reference: return {"status":"pending","message":"Payment is not confirmed."}
    client=database()
    donation=client.table("donations").select("id,amount,currency,status,donor_email,donor_name").eq("reference",reference).maybe_single().execute().data
    if not donation: raise HTTPException(404,"Donation reference not found.")
    expected=int(Decimal(str(donation["amount"]))*100)
    if int(tx.get("amount",0))!=expected or tx.get("currency")!="GHS": raise HTTPException(400,"Transaction amount or currency does not match.")
    if donation.get("status") != "paid":
        client.table("donations").update({"status":"paid","provider_transaction_id":str(tx.get("id"))}).eq("reference",reference).execute()
    email_subject=f"Your donation has been received ({reference})"
    sent_log=client.table("email_delivery_logs").select("id").eq("recipient",donation["donor_email"]).eq("subject",email_subject).eq("status","sent").limit(1).execute().data or []
    email_sent=bool(sent_log)
    if not email_sent:
        mail_result=await send_email(client,to=donation["donor_email"],subject=email_subject,heading="Thank you for your donation",message=f"Thank you {donation.get('donor_name') or 'for your support'}. Your donation of GHS {Decimal(str(donation['amount'])):.2f} has been verified successfully.",category="donation_confirmation")
        email_sent=bool(mail_result.get("sent"))
    return {"status":"paid","reference":reference,"email_sent":email_sent}


@app.post("/api/admin/donations/{reference}/refund")
async def refund_donation(reference: str, request: Request):
    require_super_admin(request)
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(503,"Paystack refund service is not configured.")
    client=database()
    donation=client.table("donations").select("id,status,provider_transaction_id,amount").eq("reference",reference).maybe_single().execute().data
    if not donation:
        raise HTTPException(404,"Donation reference not found.")
    if donation.get("status")=="refunded":
        return {"ok":True,"status":"refunded","already_refunded":True}
    if donation.get("status")!="paid":
        raise HTTPException(409,"Only verified paid donations can be refunded.")
    if donation.get("refund_status") in ("pending","processing","needs-attention"):
        raise HTTPException(409,"A Paystack refund is already being processed for this donation.")
    actor=require_super_admin(request)
    payload={"transaction":donation.get("provider_transaction_id") or reference}
    async with httpx.AsyncClient(timeout=30) as http:
        response=await http.post("https://api.paystack.co/refund",headers={"Authorization":f"Bearer {PAYSTACK_SECRET_KEY}","Content-Type":"application/json"},json=payload)
    data=response.json()
    if response.status_code>=400 or not data.get("status"):
        raise HTTPException(502,"Paystack did not accept the refund request. The donation remains recorded as paid.")
    refund=data.get("data") or {}
    refund_status=refund.get("status") or "pending"
    updates={"refund_status":refund_status,"provider_refund_id":str(refund.get("id") or "") or None}
    if refund_status=="processed":
        updates.update({"status":"refunded","refunded_at":datetime.now(timezone.utc).isoformat()})
    client.table("donations").update(updates).eq("reference",reference).execute()
    client.table("audit_logs").insert({"actor":actor.id,"action":"donation_refund_requested","entity":"donations","entity_id":donation["id"],"details":{"reference":reference,"provider":"paystack","refund_status":refund_status}}).execute()
    return {"ok":True,"status":refund_status,"message":data.get("message") or "Refund request submitted to Paystack."}

@app.post("/api/payments/paystack/webhook")
async def paystack_webhook(request: Request):
    # Verify authenticity using Paystack's HMAC SHA-512 signature.
    import hmac, hashlib
    body=await request.body()
    signature=request.headers.get("x-paystack-signature","")
    expected=hmac.new(PAYSTACK_SECRET_KEY.encode(),body,hashlib.sha512).hexdigest() if PAYSTACK_SECRET_KEY else ""
    if not signature or not hmac.compare_digest(signature,expected): raise HTTPException(401,"Invalid webhook signature.")
    event=await request.json()
    if event.get("event") in ("refund.pending","refund.processing","refund.needs-attention","refund.failed","refund.processed"):
        refund_data=event.get("data",{})
        ref=refund_data.get("transaction_reference")
        if ref and db:
            current=db.table("donations").select("id,status,donor_email,donor_name,amount").eq("reference",ref).maybe_single().execute().data
            if current:
                refund_status=event["event"].split(".",1)[1]
                updates={"refund_status":refund_status}
                if refund_status=="processed":
                    updates.update({"status":"refunded","refunded_at":datetime.now(timezone.utc).isoformat()})
                elif refund_status=="failed":
                    updates.update({"status":"paid","refunded_at":None})
                db.table("donations").update(updates).eq("reference",ref).execute()
                db.table("audit_logs").insert({"action":"paystack_refund_status_updated","entity":"donations","entity_id":current["id"],"details":{"reference":ref,"refund_status":refund_status}}).execute()
                if refund_status=="processed" and current.get("donor_email"):
                    refund_subject=f"Your donation refund has been processed ({ref})"
                    sent=db.table("email_delivery_logs").select("id").eq("recipient",current["donor_email"]).eq("subject",refund_subject).eq("status","sent").limit(1).execute().data or []
                    if not sent:
                        await send_email(db,to=current["donor_email"],subject=refund_subject,heading="Your refund has been processed",message=f"Hello {current.get('donor_name') or 'there'}, Paystack has confirmed that the refund for your GHS {Decimal(str(current['amount'])):.2f} donation has been processed. Your bank or payment provider may take additional time to reflect the funds.",category="refund_confirmation")
    elif event.get("event")=="charge.success":
        tx=event.get("data",{}); ref=tx.get("reference")
        if ref and db:
            donation=db.table("donations").select("id,amount,currency,status,donor_email,donor_name").eq("reference",ref).maybe_single().execute().data
            if donation and tx.get("status")=="success" and tx.get("currency")=="GHS" and int(tx.get("amount",0))==int(Decimal(str(donation["amount"]))*100):
                if donation.get("status") != "paid":
                    db.table("donations").update({"status":"paid","provider_transaction_id":str(tx.get("id"))}).eq("reference",ref).execute()
                email_subject=f"Your donation has been received ({ref})"
                sent_log=db.table("email_delivery_logs").select("id").eq("recipient",donation["donor_email"]).eq("subject",email_subject).eq("status","sent").limit(1).execute().data or []
                if not sent_log:
                    await send_email(db,to=donation["donor_email"],subject=email_subject,heading="Thank you for your donation",message=f"Thank you {donation.get('donor_name') or 'for your support'}. Your donation of GHS {Decimal(str(donation['amount'])):.2f} has been verified successfully.",category="donation_confirmation")
    return {"received":True}


class PasswordChangeRequest(BaseModel):
    new_password: str = Field(min_length=12,max_length=128)

class StaffCreateRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2,max_length=120)
    role: str = Field(pattern="^(admin|editor|finance|case_worker|staff)$")
    password: str = Field(min_length=12,max_length=128)

class PartnershipRequest(BaseModel):
    organization_name: str = Field(min_length=2,max_length=180)
    contact_name: str = Field(min_length=2,max_length=120)
    email: EmailStr
    phone: str = Field(default="",max_length=40)
    partnership_type: str = Field(default="General partnership",max_length=120)
    message: str = Field(min_length=5,max_length=4000)

class NewsletterRequest(BaseModel):
    email: EmailStr

class EmailSettingsUpdate(BaseModel):
    enabled: bool
    provider: str = Field(pattern="^(gmail|sendpulse)$")

class EmailTestRequest(BaseModel):
    recipient: EmailStr

def require_staff(request: Request, roles: Optional[tuple] = None):
    """Authenticate the bearer token and return (user, profile).

    Pass `roles` to restrict the action to specific staff roles. Any active
    staff member is accepted when `roles` is omitted.
    """
    client=database()
    header=request.headers.get("authorization","")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401,"Sign in is required.")
    token=header.split(" ",1)[1]
    try:
        user=client.auth.get_user(token).user
    except Exception:
        raise HTTPException(401,"Your session is invalid or expired.")
    if not user:
        raise HTTPException(401,"Your session is invalid or expired.")
    profile=client.table("staff_profiles").select("role,is_active,full_name").eq("user_id",user.id).maybe_single().execute().data
    if not profile or not profile.get("is_active"):
        raise HTTPException(403,"Your staff account is not active. Contact an administrator.")
    if roles and profile.get("role") not in roles:
        raise HTTPException(403,"Your role does not allow this action.")
    return user, profile


def require_super_admin(request: Request):
    user, _ = require_staff(request, ("super_admin","admin"))
    return user


@app.get("/api/me")
def current_staff(request: Request):
    """The signed-in staff member, read through the service role.

    The browser reads staff_profiles directly for most things, but that read is
    subject to row-level security and to every column the account happens to
    have. This endpoint answers the one question the access guard depends on --
    "is this person an active member of staff, and with what role?" -- from a
    single authoritative place, so a missing optional column can never be
    mistaken for a missing or inactive account.
    """
    header=request.headers.get("authorization","")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401,"Sign in is required.")
    client=database()
    token=header.split(" ",1)[1]
    try:
        user=client.auth.get_user(token).user
    except Exception:
        raise HTTPException(401,"Your session is invalid or expired.")
    if not user:
        raise HTTPException(401,"Your session is invalid or expired.")
    profile=client.table("staff_profiles").select("*").eq("user_id",user.id).maybe_single().execute().data
    if not profile:
        return {"user_id":user.id,"email":getattr(user,"email",None),"found":False,
                "is_active":False,"role":None,"full_name":None,
                "must_change_password":False}
    return {
        "user_id": user.id,
        "email": getattr(user, "email", None),
        "found": True,
        "is_active": bool(profile.get("is_active")),
        "role": profile.get("role"),
        "full_name": profile.get("full_name"),
        "must_change_password": bool(profile.get("must_change_password")),
    }


@app.get("/api/admin/email/settings")
def get_email_settings(request: Request):
    require_super_admin(request)
    client=database()
    settings=client.table("email_settings").select("enabled,provider,updated_at").eq("id",1).maybe_single().execute().data or {"enabled":False,"provider":"gmail"}
    logs=client.table("email_delivery_logs").select("id,recipient,subject,provider,status,category,error_message,created_at").order("created_at",desc=True).limit(30).execute().data or []
    return {**settings,"logs":logs}

@app.put("/api/admin/email/settings")
def update_email_settings(payload: EmailSettingsUpdate, request: Request):
    actor=require_super_admin(request)
    client=database()
    client.table("email_settings").upsert({"id":1,"enabled":payload.enabled,"provider":payload.provider,"updated_by":actor.id,"updated_at":datetime.now(timezone.utc).isoformat()}).execute()
    client.table("audit_logs").insert({"actor":actor.id,"action":"email_settings_updated","entity":"email_settings","entity_id":"1","details":{"enabled":payload.enabled,"provider":payload.provider}}).execute()
    return {"ok":True,"enabled":payload.enabled,"provider":payload.provider}

@app.post("/api/admin/email/test")
async def test_email(payload: EmailTestRequest, request: Request):
    require_super_admin(request)
    client=database()
    settings=client.table("email_settings").select("enabled").eq("id",1).maybe_single().execute().data or {}
    if not settings.get("enabled"):
        raise HTTPException(409,"Turn email mode ON before sending a test email.")
    result=await send_email(client,to=str(payload.recipient),subject="Ugoekloh Foundations email test",heading="Email delivery is working",message="This is a test message from the foundation administration portal.",category="admin_test")
    if not result.get("sent"):
        raise HTTPException(502,"The selected email provider did not accept the test message. Check backend credentials and recent email activity.")
    return {"ok":True,"sent":True}

@app.get("/api/public/news")
def public_news():
    if not db:return {"items":[]}
    items=db.table("news").select("id,title,slug,excerpt,body,cover_image_path,published_at").eq("status","published").order("published_at",desc=True).limit(50).execute().data
    return {"items":items or []}

@app.get("/api/public/events")
def public_events():
    if not db:return {"items":[]}
    items=db.table("events").select("id,title,description,venue,starts_at,ends_at").eq("status","published").order("starts_at").limit(50).execute().data
    return {"items":items or []}

# Branding and contact fields shown on the public site. Kept as one list so a
# deployment whose database predates a column degrades to the older field set
# instead of failing the whole request.
PUBLIC_SETTINGS_FIELDS = (
    "foundation_name,contact_email,contact_phone,call_line,address,"
    "default_currency,logo_path,tagline,about_summary,"
    "facebook_url,instagram_url,x_url,linkedin_url"
)
PUBLIC_SETTINGS_FALLBACK = "foundation_name,contact_email,contact_phone,call_line,address,default_currency"


@app.get("/api/public/settings")
def public_settings():
    if not db:return {}
    for fields in (PUBLIC_SETTINGS_FIELDS, PUBLIC_SETTINGS_FALLBACK):
        try:
            result=db.table("foundation_settings").select(fields).eq("id",1).maybe_single().execute()
            return (result.data or {}) if result is not None else {}
        except Exception:
            # Public contact settings are optional; never let an empty settings
            # table break the public site footer or settings endpoint.
            continue
    return {}

@app.post("/api/public/newsletter")
async def newsletter(payload: NewsletterRequest, request: Request):
    rate_limit(request, "newsletter", 5)
    client=database()
    client.table("newsletter_subscribers").upsert({"email":str(payload.email),"status":"subscribed"},on_conflict="email").execute()
    mail_result=await send_email(client,to=str(payload.email),subject="You are subscribed to foundation updates",heading="Thank you for subscribing",message="You have been added to the foundation updates list. We will share news and information about the foundation.",category="newsletter_welcome")
    return {"ok":True,"message":"You are subscribed to foundation updates.","email_sent":bool(mail_result.get("sent"))}

@app.post("/api/account/change-password")
def change_own_password(payload: PasswordChangeRequest, request: Request):
    client=database()
    header=request.headers.get("authorization","")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401,"Sign in is required.")
    try:
        user=client.auth.get_user(header.split(" ",1)[1]).user
    except Exception:
        raise HTTPException(401,"Your session is invalid or expired.")
    if not user:
        raise HTTPException(401,"Your session is invalid or expired.")
    profile=client.table("staff_profiles").select("is_active,must_change_password").eq("user_id",user.id).maybe_single().execute().data
    if not profile or not profile.get("is_active"):
        raise HTTPException(403,"An active staff account is required.")
    # Any signed-in staff member may change their own password at any time.
    try:
        client.auth.admin.update_user_by_id(user.id,{"password":payload.new_password})
        client.table("staff_profiles").update({"must_change_password":False}).eq("user_id",user.id).execute()
        client.table("audit_logs").insert({"actor":user.id,"action":"password_changed","entity":"staff_profiles","entity_id":user.id,"details":{}}).execute()
    except Exception as exc:
        raise HTTPException(400,"The password could not be updated. Please try again.") from exc
    return {"ok":True}

@app.post("/api/admin/staff")
async def create_staff(payload: StaffCreateRequest, request: Request):
    actor=require_super_admin(request)
    client=database()
    try:
        created=client.auth.admin.create_user({"email":payload.email,"password":payload.password,"email_confirm":True,"user_metadata":{"full_name":payload.full_name}})
        user=created.user
        if not user: raise HTTPException(502,"The identity provider did not return a new user.")
        client.table("staff_profiles").insert({"user_id":user.id,"full_name":payload.full_name,"role":payload.role,"is_active":True,"must_change_password":True}).execute()
        client.table("audit_logs").insert({"actor":actor.id,"action":"staff_created","entity":"staff_profiles","entity_id":user.id,"details":{"role":payload.role,"email":payload.email}}).execute()
        mail_result=await send_email(client,to=str(payload.email),subject="Your foundation staff account is ready",heading="Welcome to the foundation team",message=f"Your staff account has been created with the role {payload.role.replace('_',' ')}. Contact the administrator through the agreed secure channel for your temporary sign-in details. You must change this temporary password the first time you sign in.",category="staff_invitation")
        return {"ok":True,"user_id":user.id,"email":payload.email,"role":payload.role,"email_sent":bool(mail_result.get("sent"))}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400,"Could not create the staff account. Check that the email is not already registered and the service configuration is valid.") from exc

@app.post("/api/admin/cases/{case_id}/assign")
async def assign_case(case_id: str, payload: dict, request: Request):
    actor=require_super_admin(request)
    client=database()
    assigned_to=payload.get("assigned_to") or None
    case=client.table("beneficiaries").select("id,case_reference,assigned_to").eq("id",case_id).maybe_single().execute().data
    if not case:
        raise HTTPException(404,"Case record not found.")
    if assigned_to:
        staff=client.table("staff_profiles").select("user_id,full_name,is_active").eq("user_id",assigned_to).maybe_single().execute().data
        if not staff or not staff.get("is_active"):
            raise HTTPException(422,"Choose an active staff member.")
    client.table("beneficiaries").update({"assigned_to":assigned_to,"assigned_at":datetime.now(timezone.utc).isoformat() if assigned_to else None}).eq("id",case_id).execute()
    client.table("audit_logs").insert({"actor":actor.id,"action":"case_assigned","entity":"beneficiaries","entity_id":case_id,"details":{"assigned_to":assigned_to}}).execute()
    email_sent=False
    if assigned_to:
        try:
            staff_user=client.auth.admin.get_user_by_id(assigned_to).user
            if staff_user and staff_user.email:
                mail_result=await send_email(client,to=staff_user.email,subject="A child-support case has been assigned to you",heading="New case assignment",message=f"Case reference {case.get('case_reference') or case_id} has been assigned to you. Sign in to the secure staff workspace to review the case. Do not share case details outside approved channels.",category="case_assignment")
                email_sent=bool(mail_result.get("sent"))
        except Exception:
            pass
    return {"ok":True,"assigned_to":assigned_to,"email_sent":email_sent}

@app.post('/api/public/partnerships')
async def create_partnership(payload: PartnershipRequest, request: Request):
    rate_limit(request, "partnership", 5)
    safe={k:str(v) for k,v in payload.model_dump().items()}
    client=database()
    result=client.table('partnership_applications').insert(safe).execute()
    mail_result=await send_email(client,to=safe['email'],subject="Partnership enquiry received",heading="Thank you for your interest",message="Your partnership enquiry has been received. Our team will review the information and contact you.",category="partnership_acknowledgement")
    admin_to=os.getenv("EMAIL_ADMIN_NOTIFY_TO","")
    if admin_to:
        await send_email(client,to=admin_to,subject="New partnership enquiry",heading="A new partnership enquiry was received",message=f"A partnership enquiry from {safe['organization_name']} is ready for review in the Admin Dashboard.",category="partnership_admin_notification")
    return {'ok':True,'message':'Thank you. Your partnership enquiry has been received.','email_sent':bool(mail_result.get('sent'))}


# ---------------------------------------------------------------------------
# Images stored in the database
#
# Administrators upload an image, the backend records it and returns a
# "db:<id>" token. That token is stored in the same image_path columns used by
# bucket-backed images, so a single resolver in the frontend can handle both.
# Only public images are served without authentication.
# ---------------------------------------------------------------------------

MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
}


class ImageUpload(BaseModel):
    data_url: str = Field(max_length=3_000_000)
    alt_text: Optional[str] = Field(default=None, max_length=300)
    is_public: bool = True


# SVG is markup, not a raster format. Stored SVG that can execute script would be
# served from our own origin, so active content is refused outright.
SVG_ACTIVE_MARKERS = (b"<script", b"javascript:", b"onload=", b"onerror=",
                      b"<iframe", b"<embed", b"<object", b"<use ")


def decode_image_data_url(data_url: str) -> tuple[str, bytes]:
    """Validate a data URL and return (mime_type, raw_bytes).

    Raises HTTPException with a message suitable for display to the operator.
    """
    if not data_url.startswith("data:"):
        raise HTTPException(422, "The image payload is not a data URL.")
    if "," not in data_url:
        raise HTTPException(422, "The image payload is malformed.")
    header, encoded = data_url.split(",", 1)
    mime = header[5:].split(";", 1)[0].strip().lower()
    if mime not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(422, "Upload a JPEG, PNG, WebP, AVIF or SVG image.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "The image data could not be decoded.")
    if not raw:
        raise HTTPException(422, "The image file is empty.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Images must be 2 MB or smaller. Resize the file and try again.")
    if mime == "image/svg+xml":
        lowered = raw.lower()
        for marker in SVG_ACTIVE_MARKERS:
            if marker in lowered:
                raise HTTPException(422, "This SVG contains active content and cannot be uploaded. Export it as a flat SVG or a PNG.")
    return mime, raw


def build_public_case(row: dict) -> dict:
    """Project a beneficiary row onto the fields that are safe to publish.

    Any field not named here is deliberately dropped, so guardian contact
    details, medical notes and internal references cannot leak through the
    public endpoint even if the query changes.
    """
    target = float(row.get("target_amount") or 0)
    raised = float(row.get("amount_raised") or 0)
    return {
        "id": row["id"],
        "reference": row.get("case_reference"),
        "display_name": row.get("public_display_name") or "A child in our care",
        "story": row.get("public_story"),
        "support_need": row.get("support_need"),
        "image_path": row.get("image_path"),
        "is_critical": bool(row.get("is_critical")),
        "target_amount": target,
        "amount_raised": raised,
        "progress": round(min(raised / target * 100, 100), 1) if target > 0 else 0,
    }


@app.post("/api/admin/images")
async def upload_database_image(payload: ImageUpload, request: Request):
    user, _ = require_staff(request)
    mime, raw = decode_image_data_url(payload.data_url)
    client = database()
    record = {
        "mime_type": mime,
        "byte_size": len(raw),
        "data": base64.b64encode(raw).decode("ascii"),
        "is_public": payload.is_public,
        "alt_text": payload.alt_text,
        "uploaded_by": user.id,
    }
    try:
        created = client.table("images").insert(record).execute().data
    except Exception as exc:
        raise HTTPException(502, "The image could not be stored. Please try again.") from exc
    if not created:
        raise HTTPException(502, "The image could not be stored. Please try again.")
    image_id = created[0]["id"]
    return {"ok": True, "token": f"db:{image_id}", "id": image_id, "mime_type": mime, "byte_size": len(raw)}


@app.get("/api/images/{image_id}")
def serve_database_image(image_id: str, request: Request):
    client = database()
    try:
        uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(404, "Image not found.")
    row = client.table("images").select("mime_type,data,is_public").eq("id", image_id).maybe_single().execute().data
    if not row:
        raise HTTPException(404, "Image not found.")
    if not row.get("is_public"):
        # Private imagery is casework material: only signed-in staff may read it.
        require_staff(request)
    try:
        raw = base64.b64decode(row["data"])
    except (binascii.Error, ValueError, KeyError):
        raise HTTPException(500, "The stored image is unreadable.")
    return Response(
        content=raw,
        media_type=row.get("mime_type") or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400" if row.get("is_public") else "private, max-age=300"},
    )


# ---------------------------------------------------------------------------
# Public child case feed
#
# Serves only the columns that are safe to publish. Guardian contact details,
# medical notes, internal references and documents are never selected, so a
# mistake in the UI cannot leak them.
# ---------------------------------------------------------------------------

PUBLIC_CASE_COLUMNS = (
    "id,case_reference,public_display_name,public_story,support_need,"
    "target_amount,amount_raised,image_path,is_critical,created_at"
)


@app.get("/api/public/cases")
def public_cases():
    client = database()
    try:
        rows = (client.table("beneficiaries")
                .select(PUBLIC_CASE_COLUMNS)
                .eq("is_public", True)
                .eq("consent_to_publish", True)
                .is_("archived_at", "null")
                .order("is_critical", desc=True)
                .order("created_at", desc=True)
                .limit(100)
                .execute().data) or []
    except Exception:
        return {"items": []}
    items = [build_public_case(row) for row in rows]
    return {"items": items}


# ---------------------------------------------------------------------------
# Allocation ledger
# ---------------------------------------------------------------------------

class AllocationRequest(BaseModel):
    destination_type: str = Field(pattern="^(programme|project|beneficiary|general)$")
    destination_id: Optional[str] = None
    amount: Decimal = Field(gt=0, le=Decimal("100000000"), decimal_places=2)
    note: Optional[str] = Field(default=None, max_length=500)


ALLOCATION_ROLES = ("super_admin", "admin", "finance")
ALLOCATION_DESTINATIONS = {
    "programme": "programmes",
    "project": "projects",
    "beneficiary": "beneficiaries",
}


@app.get("/api/admin/funds/summary")
def funds_summary(request: Request):
    require_staff(request, ALLOCATION_ROLES)
    client = database()
    summary = client.rpc("foundation_funds_summary").execute().data
    return summary or {"total_received": 0, "total_allocated": 0, "unallocated": 0}


@app.get("/api/admin/allocations")
def list_allocations(request: Request):
    require_staff(request, ALLOCATION_ROLES)
    client = database()
    rows = (client.table("allocations")
            .select("id,destination_type,destination_id,amount,note,created_at,allocated_by")
            .order("created_at", desc=True)
            .limit(500)
            .execute().data) or []

    # Resolve destination labels in one pass per type so the list is readable
    # without the frontend issuing a query per row.
    labels = {}
    for dest_type, table in ALLOCATION_DESTINATIONS.items():
        ids = list({r["destination_id"] for r in rows
                    if r["destination_type"] == dest_type and r.get("destination_id")})
        if not ids:
            continue
        title_column = "case_reference" if table == "beneficiaries" else "title"
        try:
            found = client.table(table).select(f"id,{title_column}").in_("id", ids).execute().data or []
        except Exception:
            found = []
        for row in found:
            labels[f"{dest_type}:{row['id']}"] = row.get(title_column) or "Unnamed"
    for row in rows:
        row["destination_label"] = labels.get(
            f"{row['destination_type']}:{row.get('destination_id')}", "General foundation support"
        )
    return {"items": rows, "summary": client.rpc("foundation_funds_summary").execute().data}


@app.post("/api/admin/allocations")
def create_allocation(payload: AllocationRequest, request: Request):
    user, _ = require_staff(request, ALLOCATION_ROLES)
    client = database()
    if payload.destination_type == "general":
        destination_id = None
    else:
        destination_id = payload.destination_id
        if not destination_id:
            raise HTTPException(422, "Choose the programme, project or child case to allocate to.")
        table = ALLOCATION_DESTINATIONS[payload.destination_type]
        exists = client.table(table).select("id").eq("id", destination_id).maybe_single().execute().data
        if not exists:
            raise HTTPException(404, "That destination no longer exists.")
    record = {
        "destination_type": payload.destination_type,
        "destination_id": destination_id,
        "amount": float(payload.amount),
        "note": payload.note,
        "allocated_by": user.id,
    }
    try:
        created = client.table("allocations").insert(record).execute().data
    except Exception as exc:
        # The database refuses an allocation that exceeds the unallocated
        # balance; surface that as a clear 409 rather than a generic failure.
        message = str(exc)
        if "exceeds the unallocated balance" in message:
            raise HTTPException(409, "That amount is more than the unallocated balance. Allocate less, or record the incoming donation first.") from exc
        raise HTTPException(502, "The allocation could not be recorded. Please try again.") from exc
    return {"ok": True, "allocation": (created or [None])[0], "summary": client.rpc("foundation_funds_summary").execute().data}


@app.delete("/api/admin/allocations/{allocation_id}")
def delete_allocation(allocation_id: str, request: Request):
    require_staff(request, ("super_admin", "admin"))
    client = database()
    try:
        uuid.UUID(allocation_id)
    except ValueError:
        raise HTTPException(404, "Allocation not found.")
    existing = client.table("allocations").select("id").eq("id", allocation_id).maybe_single().execute().data
    if not existing:
        raise HTTPException(404, "Allocation not found.")
    client.table("allocations").delete().eq("id", allocation_id).execute()
    return {"ok": True, "summary": client.rpc("foundation_funds_summary").execute().data}


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@app.get("/api/admin/reports/summary")
def reports_summary(request: Request, start: Optional[str] = None, end: Optional[str] = None):
    require_staff(request, ALLOCATION_ROLES)
    client = database()

    def in_range(query):
        if start:
            query = query.gte("created_at", start)
        if end:
            query = query.lte("created_at", end)
        return query

    donations = in_range(
        client.table("donations").select("amount,status,programme_id,beneficiary_id,created_at")
    ).limit(5000).execute().data or []
    allocations = in_range(
        client.table("allocations").select("amount,destination_type,destination_id,created_at")
    ).limit(5000).execute().data or []

    paid = [d for d in donations if d.get("status") == "paid"]
    received = sum(float(d["amount"] or 0) for d in paid)
    allocated = sum(float(a["amount"] or 0) for a in allocations)

    by_destination = {}
    for row in allocations:
        key = row["destination_type"]
        by_destination[key] = by_destination.get(key, 0) + float(row["amount"] or 0)

    return {
        "range": {"start": start, "end": end},
        "donations": {
            "count": len(paid),
            "received": received,
            "pending": len([d for d in donations if d.get("status") == "pending"]),
            "programme_directed": sum(float(d["amount"] or 0) for d in paid if d.get("programme_id")),
            "case_directed": sum(float(d["amount"] or 0) for d in paid if d.get("beneficiary_id")),
            "general": sum(float(d["amount"] or 0) for d in paid if not d.get("programme_id") and not d.get("beneficiary_id")),
        },
        "allocations": {
            "count": len(allocations),
            "allocated": allocated,
            "unallocated": received - allocated,
            "by_destination": by_destination,
        },
    }
