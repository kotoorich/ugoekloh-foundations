import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, HandHeart, Info, ShieldCheck } from 'lucide-react';
import { apiUrl, mediaUrl, money } from '../lib/supabase';

const PRESET_AMOUNTS = ['50', '100', '200', '500'];

const FALLBACK_PROGRAMME_IMAGE =
  'https://images.pexels.com/photos/34185202/pexels-photo-34185202.jpeg?auto=compress&cs=tinysrgb&w=1000';

/** A programme card showing what the money supports and how far it has come. */
function ProgrammeCard({ programme, selected, onSelect }) {
  const goal = Number(programme.goal_amount || 0);
  const raised = Number(programme.amount_raised || 0);
  const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 1000) / 10) : 0;

  return (
    <button
      type="button"
      className={selected ? 'destination-card selected' : 'destination-card'}
      onClick={() => onSelect(programme.id)}
      aria-pressed={selected}
    >
      <span className="destination-card-image">
        <img
          src={programme.image_path ? mediaUrl(programme.image_path) : FALLBACK_PROGRAMME_IMAGE}
          alt=""
          loading="lazy"
        />
        {selected && <span className="destination-card-tick" aria-hidden="true">✓</span>}
      </span>
      <span className="destination-card-body">
        <strong>{programme.title}</strong>
        {programme.category && <small className="destination-card-category">{programme.category}</small>}
        <span className="destination-card-text">{programme.description}</span>
        {goal > 0 && (
          <span className="destination-card-progress">
            <span className="destination-card-progress-track">
              <span style={{ width: `${percent}%` }} />
            </span>
            <span className="destination-card-progress-text">
              <strong>{money(raised)}</strong> raised of {money(goal)}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

/** A published child case. Only consented, publicly visible cases arrive here. */
function CaseCard({ childCase, selected, onSelect }) {
  return (
    <button
      type="button"
      className={selected ? 'destination-card selected' : 'destination-card'}
      onClick={() => onSelect(childCase.id)}
      aria-pressed={selected}
    >
      <span className="destination-card-image">
        {childCase.image_path
          ? <img src={mediaUrl(childCase.image_path)} alt="" loading="lazy" />
          : <span className="destination-card-placeholder" aria-hidden="true"><Heart size={26} /></span>}
        {selected && <span className="destination-card-tick" aria-hidden="true">✓</span>}
        {childCase.is_critical && <span className="destination-card-flag">Urgent</span>}
      </span>
      <span className="destination-card-body">
        <strong>{childCase.display_name}</strong>
        {childCase.support_need && <small className="destination-card-category">{childCase.support_need}</small>}
        {childCase.story && <span className="destination-card-text">{childCase.story}</span>}
        {childCase.target_amount > 0 && (
          <span className="destination-card-progress">
            <span className="destination-card-progress-track">
              <span style={{ width: `${childCase.progress}%` }} />
            </span>
            <span className="destination-card-progress-text">
              <strong>{money(childCase.amount_raised)}</strong> raised of {money(childCase.target_amount)}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

export default function DonatePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [destinationType, setDestinationType] = useState(() => {
    const type = params.get('type');
    if (type === 'programme') return 'programme';
    if (type === 'case') return 'case';
    return 'foundation';
  });
  const [destinationId, setDestinationId] = useState(() => params.get('id') || '');
  const [programmes, setProgrammes] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('100');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${apiUrl}/api/public/programmes`).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch(`${apiUrl}/api/public/cases`).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
    ])
      .then(([programmeData, caseData]) => {
        if (!active) return;
        setProgrammes(programmeData.items || []);
        setCases(caseData.items || []);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedProgramme = programmes.find((item) => item.id === destinationId);
  const selectedCase = cases.find((item) => item.id === destinationId);

  function chooseType(type) {
    setDestinationType(type);
    setDestinationId('');
    setStatus('');
  }

  async function submit(event) {
    event.preventDefault();
    if (destinationType === 'programme' && !destinationId) { setStatus('Please choose the programme you want to support.'); return; }
    if (destinationType === 'case' && !destinationId) { setStatus('Please choose the child case you want to support.'); return; }
    setBusy(true);
    setStatus('');
    try {
      const payload = {
        amount: Number(amount),
        name,
        email,
        phone,
        method: 'paystack',
        programme_id: destinationType === 'programme' ? destinationId : null,
        beneficiary_id: destinationType === 'case' ? destinationId : null,
      };
      const response = await fetch(`${apiUrl}/api/donations/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to start your donation.');
      if (data.authorization_url) { window.location.href = data.authorization_url; return; }
      setStatus(data.message || 'Your payment has not been confirmed. Please check your payment status before trying again.');
    } catch (error) {
      setStatus(error.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const nothingToChoose = destinationType === 'programme' ? programmes.length === 0
    : destinationType === 'case' ? cases.length === 0
    : false;

  return (
    <>
      <section className="page-intro">
        <div className="container">
          <span className="eyebrow">MAKE A DONATION</span>
          <h1>Help a child recover from a burn injury.</h1>
          <p>Choose where your gift goes: the foundation’s general work, a specific programme, or a child case that has been shared with consent.</p>
        </div>
      </section>

      <section className="section">
        <div className="container donate-layout">
          <form className="donate-form donation-flow" onSubmit={submit}>
            <div className="donation-form-heading">
              <span className="donation-icon"><Heart /></span>
              <div>
                <span className="eyebrow">YOUR CONTRIBUTION</span>
                <h2>Choose what you are supporting</h2>
                <p>Pick one destination, then enter your details.</p>
              </div>
            </div>

            <fieldset className="destination-options">
              <legend>Where would you like your donation to go?</legend>
              <label className={destinationType === 'foundation' ? 'destination-option selected' : 'destination-option'}>
                <input type="radio" name="destination" checked={destinationType === 'foundation'} onChange={() => chooseType('foundation')} />
                <span>
                  <strong>General foundation support</strong>
                  <small>Supports the foundation’s overall work and its most urgent needs.</small>
                </span>
              </label>
              <label className={destinationType === 'programme' ? 'destination-option selected' : 'destination-option'}>
                <input type="radio" name="destination" checked={destinationType === 'programme'} onChange={() => chooseType('programme')} />
                <span>
                  <strong>Support a programme</strong>
                  <small>Direct your gift to one of the foundation’s programmes.</small>
                </span>
              </label>
              <label className={destinationType === 'case' ? 'destination-option selected' : 'destination-option'}>
                <input type="radio" name="destination" checked={destinationType === 'case'} onChange={() => chooseType('case')} />
                <span>
                  <strong>Support a child case</strong>
                  <small>Help one child whose family has agreed to share their story.</small>
                </span>
              </label>
            </fieldset>

            {destinationType === 'programme' && (
              <div className="destination-picker">
                <h3>Choose a programme</h3>
                {loading ? <p className="muted">Loading programmes…</p> : programmes.length === 0 ? (
                  <p className="muted">No programmes are open for donation right now. Please choose general support.</p>
                ) : (
                  <div className="destination-card-grid">
                    {programmes.map((programme) => (
                      <ProgrammeCard
                        key={programme.id}
                        programme={programme}
                        selected={destinationId === programme.id}
                        onSelect={setDestinationId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {destinationType === 'case' && (
              <div className="destination-picker">
                <h3>Choose a child case</h3>
                <p className="destination-picker-note">
                  <Info size={15} aria-hidden="true" />
                  <span>Only children whose guardians have given written consent appear here, and only their chosen display name is shown. Cases are managed privately by our caseworkers.</span>
                </p>
                {loading ? <p className="muted">Loading child cases…</p> : cases.length === 0 ? (
                  <p className="muted">No child cases are open for donation right now. Please choose general support.</p>
                ) : (
                  <div className="destination-card-grid">
                    {cases.map((childCase) => (
                      <CaseCard
                        key={childCase.id}
                        childCase={childCase}
                        selected={destinationId === childCase.id}
                        onSelect={setDestinationId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {(selectedProgramme || selectedCase) && (
              <div className="donation-selection-summary">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>
                  Your gift is linked to <strong>{selectedProgramme?.title || selectedCase?.display_name}</strong>.
                  It is recorded against that destination and counted only once your payment is confirmed.
                </span>
              </div>
            )}

            <div className="donation-section-divider" />

            <label className="donation-amount-label">Choose an amount (GHS)</label>
            <div className="amounts">
              {PRESET_AMOUNTS.map((value) => (
                <button type="button" className={amount === value ? 'amount active' : 'amount'} onClick={() => setAmount(value)} key={value}>{value}</button>
              ))}
            </div>
            <input
              type="number" min="1" max="10000000" step="0.01" required value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label="Donation amount in Ghana cedis"
            />

            <div className="donor-fields">
              <label>Your name<input required maxLength="120" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
              <label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
              <label>Phone number<input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 024 000 0000" /></label>
            </div>

            <div className="online-payment-note">
              <ShieldCheck size={18} />
              <span>
                <strong>Secure online payment only</strong>
                <small>You will continue to Paystack to complete your donation using the secure options available there.</small>
              </span>
            </div>

            <button className="button button-full" disabled={busy || nothingToChoose}>
              {busy ? 'Please wait…' : 'Continue to secure payment'} <ArrowRight size={16} />
            </button>
            {status && <p className="form-status" role="status">{status}</p>}
            <small>Never share your PIN or mobile money password. The foundation will never ask you for them.</small>
          </form>

          <aside className="donate-aside donation-aside">
            <span className="eyebrow">TRANSPARENT GIVING</span>
            <h2>Your choice is recorded.</h2>
            <p>Whichever destination you choose, the foundation records where your gift was directed and reports on it.</p>
            <div className="donation-assurance">
              <ShieldCheck />
              <div>
                <strong>Counted only once confirmed</strong>
                <p>Only payments the provider confirms count toward a destination’s total. Pending payments are not treated as money received.</p>
              </div>
            </div>
            <div className="donation-assurance">
              <HandHeart />
              <div>
                <strong>Child cases are protected</strong>
                <p>A child case is only ever shown here when the guardian has agreed in writing. The child’s full name, family details and medical notes are never published.</p>
              </div>
            </div>
            <Link to="/programmes" className="text-link">Explore programmes <ArrowRight size={15} /></Link>
          </aside>
        </div>
      </section>
    </>
  );
}
