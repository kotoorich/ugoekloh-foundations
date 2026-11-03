"""Centralised transactional email delivery for Ugoekloh Foundations."""
import base64
import os
from email.message import EmailMessage
from typing import Any
import httpx

def _template(heading: str, message: str) -> tuple[str, str]:
    safe_heading=heading.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    safe_message=message.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    html=f"""<!doctype html><html><body style="margin:0;background:#f5f7f6;font-family:Arial,sans-serif;color:#20302a"><div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;padding:32px"><p style="color:#47735e;font-weight:bold">UGOEKLOH FOUNDATIONS</p><h2>{safe_heading}</h2><p style="line-height:1.7">{safe_message}</p><hr style="border:0;border-top:1px solid #e5eae7;margin:28px 0"><p style="font-size:12px;color:#66736c">Thank you for supporting children with care, healing and opportunity.</p></div></body></html>"""
    return html,message

def _record(db: Any, recipient: str, subject: str, provider: str, status: str, category: str, error: str|None=None, message_id: str|None=None):
    try:
        db.table("email_delivery_logs").insert({"recipient":recipient,"subject":subject,"provider":provider,"status":status,"category":category,"error_message":(error or "")[:1000] or None,"provider_message_id":message_id}).execute()
    except Exception:
        pass

async def _gmail_send(to: str, subject: str, text: str, html: str) -> str:
    client_id=os.getenv("GOOGLE_CLIENT_ID",""); secret=os.getenv("GOOGLE_CLIENT_SECRET","")
    refresh=os.getenv("GOOGLE_REFRESH_TOKEN",""); sender=os.getenv("GMAIL_SENDER_EMAIL","")
    if not all([client_id,secret,refresh,sender]): raise RuntimeError("Gmail API credentials are incomplete in Render.")
    async with httpx.AsyncClient(timeout=25) as client:
        token=await client.post("https://oauth2.googleapis.com/token",data={"client_id":client_id,"client_secret":secret,"refresh_token":refresh,"grant_type":"refresh_token"})
        token.raise_for_status()
        msg=EmailMessage(); msg["To"]=to
        msg["From"]=f"{os.getenv('EMAIL_SENDER_NAME','Ugoekloh Foundations')} <{sender}>"
        msg["Subject"]=subject; msg.set_content(text); msg.add_alternative(html,subtype="html")
        raw=base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii").rstrip("=")
        sent=await client.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",headers={"Authorization":"Bearer "+token.json()["access_token"]},json={"raw":raw})
        sent.raise_for_status()
        return str(sent.json().get("id",""))

async def _sendpulse_send(to: str, subject: str, text: str, html: str) -> str:
    client_id=os.getenv("SENDPULSE_CLIENT_ID",""); secret=os.getenv("SENDPULSE_CLIENT_SECRET",""); sender=os.getenv("SENDPULSE_SENDER_EMAIL","")
    if not all([client_id,secret,sender]): raise RuntimeError("SendPulse credentials are incomplete in Render.")
    async with httpx.AsyncClient(timeout=25) as client:
        token=await client.post("https://api.sendpulse.com/oauth/access_token",json={"grant_type":"client_credentials","client_id":client_id,"client_secret":secret})
        token.raise_for_status()
        sent=await client.post("https://api.sendpulse.com/smtp/emails",headers={"Authorization":"Bearer "+token.json()["access_token"]},json={"email":{"html":base64.b64encode(html.encode()).decode(),"text":text,"subject":subject,"from":{"name":os.getenv("EMAIL_SENDER_NAME","Ugoekloh Foundations"),"email":sender},"to":[{"email":to}]}})
        sent.raise_for_status(); data=sent.json()
        if data.get("result") is False: raise RuntimeError(str(data.get("message","SendPulse rejected the email.")))
        return str(data.get("id") or data.get("message_id") or "")

async def send_email(db: Any, *, to: str, subject: str, heading: str, message: str, category: str) -> dict:
    settings=db.table("email_settings").select("enabled,provider").eq("id",1).maybe_single().execute().data or {}
    provider=settings.get("provider") or "gmail"
    if not settings.get("enabled"):
        _record(db,to,subject,provider,"skipped",category,"Email mode is OFF.")
        return {"sent":False,"skipped":True}
    html,text=_template(heading,message)
    try:
        message_id=await (_gmail_send(to,subject,text,html) if provider=="gmail" else _sendpulse_send(to,subject,text,html))
        _record(db,to,subject,provider,"sent",category,message_id=message_id)
        return {"sent":True,"provider":provider}
    except Exception as exc:
        _record(db,to,subject,provider,"failed",category,str(exc))
        return {"sent":False,"failed":True}
