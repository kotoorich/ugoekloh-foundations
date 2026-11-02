import React,{useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,Heart,ShieldCheck,HandHeart} from 'lucide-react';
import {apiUrl,mediaUrl} from '../lib/supabase';

export default function DonatePage(){
  const [amount,setAmount]=useState('100');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [destinationType,setDestinationType]=useState(()=>{const type=new URLSearchParams(window.location.search).get('type');return type==='campaign'||type==='programme'?type:'foundation';});
  const [destinationId,setDestinationId]=useState(()=>new URLSearchParams(window.location.search).get('id')||'');
  const [campaigns,setCampaigns]=useState([]);
  const [programmes,setProgrammes]=useState([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [loadingDestinations,setLoadingDestinations]=useState(true);

  useEffect(()=>{
    let active=true;
    Promise.all([
      fetch(apiUrl+'/api/public/campaigns').then(r=>r.ok?r.json():{items:[]}),
      fetch(apiUrl+'/api/public/programmes').then(r=>r.ok?r.json():{items:[]})
    ]).then(([campaignData,programmeData])=>{
      if(!active)return;
      setCampaigns(campaignData.items||[]);
      setProgrammes(programmeData.items||[]);
    }).catch(()=>{if(active)setStatus('We could not load current campaigns and programmes. You can still support the foundation generally.');})
      .finally(()=>{if(active)setLoadingDestinations(false);});
    return()=>{active=false;};
  },[]);

  const destinations=destinationType==='campaign'?campaigns:programmes;
  const selected=useMemo(()=>destinations.find(item=>item.id===destinationId),[destinations,destinationId]);
  function chooseType(type){setDestinationType(type);setDestinationId('');setStatus('');}

  async function submit(e){
    e.preventDefault();
    if(destinationType!=='foundation'&&!destinationId){setStatus('Please choose the '+destinationType+' you want to support.');return;}
    setBusy(true);setStatus('');
    try{
      const payload={amount:Number(amount),name,email,phone,method:'paystack',campaign_id:destinationType==='campaign'?destinationId:null,programme_id:destinationType==='programme'?destinationId:null};
      const response=await fetch(apiUrl+'/api/donations/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||'Unable to start your donation.');
      if(data.authorization_url){window.location.href=data.authorization_url;return;}
      setStatus(data.message||'Your payment has not been confirmed. Please check your payment status before trying again.');
    }catch(error){setStatus(error.message||'Please try again.');}
    finally{setBusy(false);}
  }

  return <>
    <section className="page-intro"><div className="container"><span className="eyebrow">MAKE A DONATION</span><h1>Help a child recover from a burn injury.</h1><p>Choose one destination for your donation: the foundation generally, a specific campaign, or a specific programme. All donations are completed securely online.</p></div></section>
    <section className="section"><div className="container donate-layout">
      <form className="donate-form donation-flow" onSubmit={submit}>
        <div className="donation-form-heading"><span className="donation-icon"><Heart/></span><div><span className="eyebrow">YOUR CONTRIBUTION</span><h2>Make your contribution</h2><p>Select one destination for this donation.</p></div></div>
        <fieldset className="destination-options"><legend>Where would you like your donation to go?</legend>
          <label className={destinationType==='foundation'?'destination-option selected':'destination-option'}><input type="radio" name="destination" checked={destinationType==='foundation'} onChange={()=>chooseType('foundation')}/><span><strong>General foundation support</strong><small>Support the foundation's overall work and most urgent needs.</small></span></label>
          <label className={destinationType==='campaign'?'destination-option selected':'destination-option'}><input type="radio" name="destination" checked={destinationType==='campaign'} onChange={()=>chooseType('campaign')}/><span><strong>Support a campaign</strong><small>Direct your donation to one specific fundraising campaign.</small></span></label>
          <label className={destinationType==='programme'?'destination-option selected':'destination-option'}><input type="radio" name="destination" checked={destinationType==='programme'} onChange={()=>chooseType('programme')}/><span><strong>Support a programme</strong><small>Direct your donation to one specific foundation programme.</small></span></label>
        </fieldset>
        {destinationType!=='foundation'&&<div className="destination-picker">
          <label htmlFor="donation-destination">Choose {destinationType==='campaign'?'a campaign':'a programme'}</label>
          <select id="donation-destination" value={destinationId} onChange={e=>setDestinationId(e.target.value)} required>
            <option value="">{loadingDestinations?'Loading options…':'Select one'}</option>
            {destinations.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
          {!loadingDestinations&&destinations.length===0&&<small>No active {destinationType}s are available right now. Please choose another destination.</small>}
          {selected&&<div className="selected-destination">{selected.image_path&&<img src={mediaUrl(selected.image_path)} alt=""/>}<div><strong>{selected.title}</strong><p>{selected.description}</p>{destinationType==='campaign'&&<small>Goal: GHS {Number(selected.goal_amount||0).toLocaleString('en-GH')}</small>}{destinationType==='programme'&&<small>GHS {Number(selected.amount_raised||0).toLocaleString('en-GH')} raised for this programme</small>}</div></div>}
        </div>}
        <div className="donation-section-divider"/>
        <label>Choose an amount (GHS)</label>
        <div className="amounts">{['50','100','200','500'].map(value=><button type="button" className={amount===value?'amount active':'amount'} onClick={()=>setAmount(value)} key={value}>{value}</button>)}</div>
        <input type="number" min="1" max="10000000" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} aria-label="Donation amount in Ghana cedis"/>
        <div className="donor-fields"><label>Your name<input required maxLength="120" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Phone number<input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 024 000 0000"/></label></div>
        <div className="online-payment-note"><ShieldCheck size={18}/><span><strong>Secure online payment only</strong><small>Continue to Paystack to complete your donation by the available secure payment options.</small></span></div>
        <button className="button button-full" disabled={busy||(destinationType!=='foundation'&&!loadingDestinations&&destinations.length===0)}>{busy?'Please wait…':'Continue to secure payment'} <ArrowRight size={16}/></button>
        {status&&<p className="form-status" role="status">{status}</p>}
        <small>Never share your PIN or mobile money password. The foundation will never ask you for them.</small>
      </form>
      <aside className="donate-aside donation-aside"><span className="eyebrow">TRANSPARENT GIVING</span><h2>Your choice matters.</h2><p>When you select a campaign or programme, the donation is linked to that specific destination. General foundation support remains separate.</p><div className="donation-assurance"><ShieldCheck/><div><strong>Tracked responsibly</strong><p>Only verified, successful payments count toward campaign and programme totals. Pending online payments are not treated as money received.</p></div></div><div className="donation-assurance"><HandHeart/><div><strong>Give with confidence</strong><p>Online payments are verified by the payment provider. Your donation is counted only after the online payment provider confirms it.</p></div></div><Link to="/campaigns" className="text-link">Explore active campaigns <ArrowRight size={15}/></Link><Link to="/programmes" className="text-link">Explore programmes <ArrowRight size={15}/></Link></aside>
    </div></section>
  </>;
}
