import os, uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from supabase import create_client, Client
from dotenv import load_dotenv
from email_service import send_email

load_dotenv()
app = FastAPI(title="Ugo E Kloh Foundation API", version="1.0.0")
origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["GET","POST","OPTIONS"], allow_headers=["*"])
SUPABASE_URL=os.getenv("SUPABASE_URL","")
SUPABASE_SERVICE_ROLE_KEY=os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
PAYSTACK_SECRET_KEY=os.getenv("PAYSTACK_SECRET_KEY","")
PAYSTACK_CALLBACK_URL=os.getenv("PAYSTACK_CALLBACK_URL","")
db: Optional[Client] = create_client(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else None

class DonationRequest(BaseModel):
    amount: Decimal = Field(gt=0, le=Decimal("10000000"))
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=30)
    method: str = "paystack"
    programme_id: Optional[str] = None

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


@app.on_event("startup")
def initialize_database_and_admin():
    # Render redeploys safely apply only migration files not yet recorded.
    from migration_runner import setup_database
    setup_database()

@app.get("/api/health")
def health(): return {"status":"ok","service":"ugo-ekloh-foundation-api"}

@app.get("/api/public/home")
def home():
    if not db: return {"programmes":[],"impact":{}}
    programs=db.table("programmes").select("id,title,slug,category,description,image_path,goal_amount,amount_raised").eq("status","published").in_("slug",["fire-safety-in-the-home","children-and-fire-management-at-home"]).order("created_at").execute().data
    return {"programmes":programs or [],"impact":{}}

@app.get("/api/public/programmes")
def public_programmes():
    if not db:return {"items":[]}
    items=db.table("programmes").select("id,title,slug,category,description,goal_amount,amount_raised,image_path,status").eq("status","published").order("created_at").execute().data
    return {"items":items or []}

@app.post("/api/public/contact")
async def contact(payload: ContactRequest):
    client=database()
    result=client.table("contact_messages").insert(payload.model_dump()).execute()
    mail_result=await send_email(client,to=str(payload.email),subject="We received your message",heading="Thank you for contacting us",message="Your message has been received. Our team will review it and respond using the contact details you provided.",category="contact_acknowledgement")
    admin_to=os.getenv("EMAIL_ADMIN_NOTIFY_TO","")
    if admin_to:
        await send_email(client,to=admin_to,subject="New foundation contact message",heading="New contact message received",message=f"A new message was submitted by {payload.name}. Please review it in the Admin Dashboard.",category="contact_admin_notification")
    return {"ok":True,"id":result.data[0]["id"] if result.data else None,"email_sent":bool(mail_result.get("sent"))}

@app.post("/api/public/volunteer")
async def volunteer(payload: VolunteerRequest):
    client=database()
    result=client.table("volunteer_applications").insert(payload.model_dump()).execute()
    mail_result=await send_email(client,to=str(payload.email),subject="Volunteer application received",heading="Thank you for offering your time",message="Your volunteer application has been received. The foundation team will review it and contact you if further information is needed.",category="volunteer_acknowledgement")
    admin_to=os.getenv("EMAIL_ADMIN_NOTIFY_TO","")
    if admin_to:
        await send_email(client,to=admin_to,subject="New volunteer application",heading="A new volunteer application was received",message=f"A volunteer application from {payload.name} is ready for review in the Admin Dashboard.",category="volunteer_admin_notification")
    return {"ok":True,"id":result.data[0]["id"] if result.data else None,"email_sent":bool(mail_result.get("sent"))}

@app.post("/api/donations/initialize")
async def initialize_donation(payload: DonationRequest):
    client=database()
    if payload.method != "paystack":
        raise HTTPException(422,"Only secure online payment is accepted.")
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(503,"Secure online donations are temporarily unavailable. Please try again later.")
    if payload.programme_id:
        selected=client.table("programmes").select("id").eq("id",payload.programme_id).eq("status","published").maybe_single().execute().data
        if not selected: raise HTTPException(404,"That programme is no longer available. Please choose another destination.")

    amount_pesewas=int((payload.amount*100).quantize(Decimal("1")))
    ref="UEKF-"+uuid.uuid4().hex[:18].upper()
    metadata={"donor_name":payload.name,"donor_phone":payload.phone,"programme_id":payload.programme_id,"donation_destination":"programme" if payload.programme_id else "foundation"}
    row={"reference":ref,"amount":float(payload.amount),"currency":"GHS","donor_name":payload.name,"donor_email":str(payload.email),"donor_phone":payload.phone,"status":"pending","programme_id":payload.programme_id,"payment_method":"paystack"}
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
        await send_email(client,to=donation["donor_email"],subject="Your donation has been received",heading="Thank you for your donation",message=f"Thank you {donation.get('donor_name') or 'for your support'}. Your donation of GHS {Decimal(str(donation['amount'])):.2f} has been verified successfully.",category="donation_confirmation")
    sent_log=client.table("email_delivery_logs").select("id").eq("recipient",donation["donor_email"]).eq("category","donation_confirmation").eq("status","sent").limit(1).execute().data or []
    return {"status":"paid","reference":reference,"email_sent":bool(sent_log)}

@app.post("/api/payments/paystack/webhook")
async def paystack_webhook(request: Request):
    # Verify authenticity using Paystack's HMAC SHA-512 signature.
    import hmac, hashlib
    body=await request.body()
    signature=request.headers.get("x-paystack-signature","")
    expected=hmac.new(PAYSTACK_SECRET_KEY.encode(),body,hashlib.sha512).hexdigest() if PAYSTACK_SECRET_KEY else ""
    if not signature or not hmac.compare_digest(signature,expected): raise HTTPException(401,"Invalid webhook signature.")
    event=await request.json()
    if event.get("event")=="charge.success":
        tx=event.get("data",{}); ref=tx.get("reference")
        if ref and db:
            donation=db.table("donations").select("id,amount,currency,status,donor_email,donor_name").eq("reference",ref).maybe_single().execute().data
            if donation and tx.get("status")=="success" and tx.get("currency")=="GHS" and int(tx.get("amount",0))==int(Decimal(str(donation["amount"]))*100):
                if donation.get("status") != "paid":
                    db.table("donations").update({"status":"paid","provider_transaction_id":str(tx.get("id"))}).eq("reference",ref).execute()
                    await send_email(db,to=donation["donor_email"],subject="Your donation has been received",heading="Thank you for your donation",message=f"Thank you {donation.get('donor_name') or 'for your support'}. Your donation of GHS {Decimal(str(donation['amount'])):.2f} has been verified successfully.",category="donation_confirmation")
    return {"received":True}


class StaffCreateRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2,max_length=120)
    role: str = Field(pattern="^(admin|editor|finance|case_worker|staff)$")
    password: str = Field(min_length=12,max_length=128)

class NewsletterRequest(BaseModel):
    email: EmailStr

class EmailSettingsUpdate(BaseModel):
    enabled: bool
    provider: str = Field(pattern='^(gmail|sendpulse)
def require_super_admin(request: Request):
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
    profile=client.table("staff_profiles").select("role,is_active").eq("user_id",user.id).maybe_single().execute().data
    if not profile or profile.get("role") not in ("super_admin","admin") or not profile.get("is_active"):
        raise HTTPException(403,"Only an active administrator can create staff accounts.")
    return user


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
    client.table("email_settings").upsert({"id":1,"enabled":payload.enabled,"provider":payload.provider,"updated_by":actor.id}).execute()
    client.table("audit_logs").insert({"actor":actor.id,"action":"email_settings_updated","entity":"email_settings","entity_id":"1","details":{"enabled":payload.enabled,"provider":payload.provider}}).execute()
    return {"ok":True,"enabled":payload.enabled,"provider":payload.provider}

@app.post("/api/admin/email/test")
async def test_email(payload: EmailTestRequest, request: Request):
    require_super_admin(request)
    client=database()
    settings=client.table("email_settings").select("enabled").eq("id",1).maybe_single().execute().data or {}
    if not settings.get("enabled"):
        raise HTTPException(409,"Turn email mode ON before sending a test email.")
    result=await send_email(client,to=str(payload.recipient),subject="Ugo E Kloh Foundation email test",heading="Email delivery is working",message="This is a test message from the foundation administration portal.",category="admin_test")
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

@app.get("/api/public/settings")
def public_settings():
    if not db:return {}
    try:
        result=db.table("foundation_settings").select("foundation_name,contact_email,contact_phone,call_line,address,default_currency").eq("id",1).maybe_single().execute()
        return (result.data or {}) if result is not None else {}
    except Exception:
        # Public contact settings are optional; never let an empty settings
        # table break the public site footer or settings endpoint.
        return {}

@app.post("/api/public/newsletter")
async def newsletter(payload: NewsletterRequest):
    client=database()
    client.table("newsletter_subscribers").upsert({"email":str(payload.email),"status":"subscribed"},on_conflict="email").execute()
    mail_result=await send_email(client,to=str(payload.email),subject="You are subscribed to foundation updates",heading="Thank you for subscribing",message="You will receive foundation news and updates. You can unsubscribe at any time using the link in a newsletter.",category="newsletter_welcome")
    return {"ok":True,"message":"You are subscribed to foundation updates.","email_sent":bool(mail_result.get("sent"))}

@app.post("/api/admin/staff")
def create_staff(payload: StaffCreateRequest, request: Request):
    actor=require_super_admin(request)
    client=database()
    try:
        created=client.auth.admin.create_user({"email":payload.email,"password":payload.password,"email_confirm":True,"user_metadata":{"full_name":payload.full_name}})
        user=created.user
        if not user: raise HTTPException(502,"The identity provider did not return a new user.")
        client.table("staff_profiles").insert({"user_id":user.id,"full_name":payload.full_name,"role":payload.role,"is_active":True}).execute()
        client.table("audit_logs").insert({"actor":actor.id,"action":"staff_created","entity":"staff_profiles","entity_id":user.id,"details":{"role":payload.role,"email":payload.email}}).execute()
        mail_result=await send_email(client,to=str(payload.email),subject="Your foundation staff account is ready",heading="Welcome to the foundation team",message=f"Your staff account has been created with the role {payload.role.replace('_',' ')}. Contact the administrator through the agreed secure channel for your temporary sign-in details. You will be asked to update your password when that control is enabled.",category="staff_invitation")
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
    if assigned_to:
        try:
            staff_user=client.auth.admin.get_user_by_id(assigned_to).user
            if staff_user and staff_user.email:
                await send_email(client,to=staff_user.email,subject="A child-support case has been assigned to you",heading="New case assignment",message=f"Case reference {case.get('case_reference') or case_id} has been assigned to you. Sign in to the secure staff workspace to review the case. Do not share case details outside approved channels.",category="case_assignment")
        except Exception:
            pass
    return {"ok":True,"assigned_to":assigned_to}

@app.post('/api/public/partnerships')
async def create_partnership(payload: dict):
    required=['organization_name','contact_name','email','message']
    if any(not str(payload.get(k,'')).strip() for k in required):
        raise HTTPException(422,'Organization, contact name, email and message are required.')
    safe={k:str(payload.get(k,''))[:4000] for k in ['organization_name','contact_name','email','phone','partnership_type','message']}
    client=database()
    result=client.table('partnership_applications').insert(safe).execute()
    mail_result=await send_email(client,to=safe['email'],subject="Partnership enquiry received",heading="Thank you for your interest",message="Your partnership enquiry has been received. Our team will review the information and contact you.",category="partnership_acknowledgement")
    admin_to=os.getenv("EMAIL_ADMIN_NOTIFY_TO","")
    if admin_to:
        await send_email(client,to=admin_to,subject="New partnership enquiry",heading="A new partnership enquiry was received",message=f"A partnership enquiry from {safe['organization_name']} is ready for review in the Admin Dashboard.",category="partnership_admin_notification")
    return {'ok':True,'message':'Thank you. Your partnership enquiry has been received.','email_sent':bool(mail_result.get('sent'))}
)

class EmailTestRequest(BaseModel):
    recipient: EmailStr

def require_super_admin(request: Request):
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
    profile=client.table("staff_profiles").select("role,is_active").eq("user_id",user.id).maybe_single().execute().data
    if not profile or profile.get("role") not in ("super_admin","admin") or not profile.get("is_active"):
        raise HTTPException(403,"Only an active administrator can create staff accounts.")
    return user

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

@app.get("/api/public/settings")
def public_settings():
    if not db:return {}
    try:
        result=db.table("foundation_settings").select("foundation_name,contact_email,contact_phone,call_line,address,default_currency").eq("id",1).maybe_single().execute()
        return (result.data or {}) if result is not None else {}
    except Exception:
        # Public contact settings are optional; never let an empty settings
        # table break the public site footer or settings endpoint.
        return {}

@app.post("/api/public/newsletter")
def newsletter(payload: NewsletterRequest):
    client=database()
    client.table("newsletter_subscribers").upsert({"email":payload.email,"status":"subscribed"},on_conflict="email").execute()
    return {"ok":True,"message":"You are subscribed to foundation updates."}

@app.post("/api/admin/staff")
def create_staff(payload: StaffCreateRequest, request: Request):
    actor=require_super_admin(request)
    client=database()
    try:
        created=client.auth.admin.create_user({"email":payload.email,"password":payload.password,"email_confirm":True,"user_metadata":{"full_name":payload.full_name}})
        user=created.user
        if not user: raise HTTPException(502,"The identity provider did not return a new user.")
        client.table("staff_profiles").insert({"user_id":user.id,"full_name":payload.full_name,"role":payload.role,"is_active":True}).execute()
        client.table("audit_logs").insert({"actor":actor.id,"action":"staff_created","entity":"staff_profiles","entity_id":user.id,"details":{"role":payload.role,"email":payload.email}}).execute()
        return {"ok":True,"user_id":user.id,"email":payload.email,"role":payload.role}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400,"Could not create the staff account. Check that the email is not already registered and the service configuration is valid.") from exc

@app.post('/api/public/partnerships')
def create_partnership(payload: dict):
    required=['organization_name','contact_name','email','message']
    if any(not str(payload.get(k,'')).strip() for k in required):
        raise HTTPException(422,'Organization, contact name, email and message are required.')
    safe={k:str(payload.get(k,''))[:4000] for k in ['organization_name','contact_name','email','phone','partnership_type','message']}
    result=database().table('partnership_applications').insert(safe).execute()
    return {'ok':True,'message':'Thank you. Your partnership enquiry has been received.'}
