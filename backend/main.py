import os, uuid
from decimal import Decimal, InvalidOperation
from typing import Optional
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from supabase import create_client, Client
from dotenv import load_dotenv

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
    campaign_id: Optional[str] = None

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

@app.get("/api/health")
def health(): return {"status":"ok","service":"ugo-ekloh-foundation-api"}

@app.get("/api/public/home")
def home():
    if not db: return {"programmes":[],"campaigns":[],"impact":{}}
    programs=db.table("programmes").select("id,title,category,description,image_path").eq("status","published").limit(3).execute().data
    campaigns=db.table("campaigns").select("id,title,description,goal_amount,amount_raised,image_path").eq("status","published").limit(2).execute().data
    return {"programmes":programs or [],"campaigns":campaigns or [],"impact":{}}

@app.get("/api/public/campaigns")
def campaigns():
    if not db:return {"items":[]}
    items=db.table("campaigns").select("id,title,description,goal_amount,amount_raised,image_path,status").eq("status","published").order("created_at",desc=True).execute().data
    return {"items":items or []}

@app.post("/api/public/contact")
def contact(payload: ContactRequest):
    client=database()
    result=client.table("contact_messages").insert(payload.model_dump()).execute()
    return {"ok":True,"id":result.data[0]["id"] if result.data else None}

@app.post("/api/public/volunteer")
def volunteer(payload: VolunteerRequest):
    client=database()
    result=client.table("volunteer_applications").insert(payload.model_dump()).execute()
    return {"ok":True,"id":result.data[0]["id"] if result.data else None}

@app.post("/api/donations/initialize")
async def initialize_donation(payload: DonationRequest):
    client=database()
    amount_pesewas=int((payload.amount*100).quantize(Decimal("1")))
    ref="UEKF-"+uuid.uuid4().hex[:18].upper()
    row={"reference":ref,"amount":float(payload.amount),"currency":"GHS","donor_name":payload.name,"donor_email":payload.email,"donor_phone":payload.phone,"status":"pending","campaign_id":payload.campaign_id,"payment_method":payload.method}
    client.table("donations").insert(row).execute()
    if payload.method=="paystack" and PAYSTACK_SECRET_KEY:
        async with httpx.AsyncClient(timeout=25) as http:
            response=await http.post("https://api.paystack.co/transaction/initialize",headers={"Authorization":f"Bearer {PAYSTACK_SECRET_KEY}","Content-Type":"application/json"},json={"email":payload.email,"amount":amount_pesewas,"currency":"GHS","reference":ref,"callback_url":PAYSTACK_CALLBACK_URL,"metadata":{"donor_name":payload.name,"donor_phone":payload.phone,"campaign_id":payload.campaign_id}})
        data=response.json()
        if response.status_code>=400 or not data.get("status"):
            raise HTTPException(502,"The online payment provider is temporarily unavailable. You can submit a manual donation pledge instead.")
        return {"ok":True,"reference":ref,"authorization_url":data["data"]["authorization_url"]}
    # Explicit fallback: pending pledge, never mark paid from the browser.
    return {"ok":True,"reference":ref,"message":"Online card/mobile checkout is currently unavailable. Your pledge has been recorded as PENDING. The foundation team will contact you with verified bank or mobile-money instructions. No payment has been received yet."}

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
    donation=client.table("donations").select("id,amount,currency").eq("reference",reference).maybe_single().execute().data
    if not donation: raise HTTPException(404,"Donation reference not found.")
    expected=int(Decimal(str(donation["amount"]))*100)
    if int(tx.get("amount",0))!=expected or tx.get("currency")!="GHS": raise HTTPException(400,"Transaction amount or currency does not match.")
    client.table("donations").update({"status":"paid","provider_transaction_id":str(tx.get("id"))}).eq("reference",reference).execute()
    return {"status":"paid","reference":reference}

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
            donation=db.table("donations").select("id,amount,currency").eq("reference",ref).maybe_single().execute().data
            if donation and tx.get("status")=="success" and tx.get("currency")=="GHS" and int(tx.get("amount",0))==int(Decimal(str(donation["amount"]))*100):
                db.table("donations").update({"status":"paid","provider_transaction_id":str(tx.get("id"))}).eq("reference",ref).execute()
    return {"received":True}
