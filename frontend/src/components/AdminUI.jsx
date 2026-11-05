import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Search, X } from 'lucide-react';
import { mediaUrl } from '../lib/supabase';

/* ---------------------------------------------------------------- toasts -- */

const ToastContext = React.createContext(() => {});
export const useToast = () => useContext(ToastContext);

/**
 * Success and failure need to look different. The previous admin reused one
 * error paragraph for both, so a successful save was shown in red.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((message, tone = 'success') => {
    if (!message) return;
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
  }, [dismiss]);

  const value = useMemo(() => ({
    success: (message) => push(message, 'success'),
    error: (message) => push(message, 'error'),
    info: (message) => push(message, 'info'),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'error' ? AlertTriangle : toast.tone === 'info' ? Info : CheckCircle2;
          return (
            <div className={`toast toast-${toast.tone}`} key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <Icon size={18} aria-hidden="true" />
              <p>{toast.message}</p>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------- primitives -- */

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="admin-page-head">
      <div>
        {eyebrow && <span className="admin-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </header>
  );
}

/**
 * Every section carries a short operator guide. The dashboard is handed to
 * someone who is not a developer, so the explanation lives next to the work
 * rather than in a separate manual.
 */
export function GuidePanel({ title, steps, note }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="guide-panel">
      <button type="button" className="guide-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Info size={16} aria-hidden="true" />
        <span>How this section works</span>
        <span className="guide-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="guide-body">
          {title && <strong>{title}</strong>}
          {steps?.length > 0 && (
            <ol>
              {steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          )}
          {note && <p className="guide-note">{note}</p>}
        </div>
      )}
    </aside>
  );
}

export function StatCard({ label, value, hint, icon: Icon, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="stat-card" {...(onClick ? { type: 'button', onClick } : {})}>
      {Icon && <span className="stat-icon" aria-hidden="true"><Icon size={18} /></span>}
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </Tag>
  );
}

export function ProgressBar({ value, target, label }) {
  const goal = Number(target || 0);
  const raised = Number(value || 0);
  const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 1000) / 10) : 0;
  return (
    <div className="funding-progress">
      <div className="funding-progress-head">
        <span>{label || 'Funding progress'}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="funding-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Funding progress'}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="admin-empty">
      {Icon && <span className="admin-empty-icon" aria-hidden="true"><Icon size={26} /></span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-block skeleton-thumb" />
          <div>
            <span className="skeleton-block skeleton-line" />
            <span className="skeleton-block skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <p className="admin-loading" role="status">
      <Loader2 size={17} className="spin" aria-hidden="true" /> {label}
    </p>
  );
}

/**
 * Destructive actions get a real dialog rather than window.confirm, so the
 * consequence can be spelled out and the action can be styled as dangerous.
 */
export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onCancel, busy }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        {description && <p>{description}</p>}
        <div className="admin-dialog-actions">
          <button type="button" className="button button-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={tone === 'danger' ? 'button button-danger' : 'button'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ open, title, eyebrow, description, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={wide ? 'admin-modal admin-modal-wide' : 'admin-modal'} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="admin-modal-head">
          <div>
            {eyebrow && <span className="admin-eyebrow">{eyebrow}</span>}
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = 'Search records…' }) {
  return (
    <label className="admin-search">
      <Search size={16} aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search"><X size={14} /></button>}
    </label>
  );
}

/* ------------------------------------------------------------ data table -- */

/**
 * A real table on wide screens and a card list on narrow ones. Sorting and
 * paging happen here so each module does not reimplement them.
 */
export function DataTable({ columns, rows, emptyState, pageSize = 25, rowKey = (row) => row.id }) {
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [rows.length]);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const column = columns.find((item) => item.key === sort.key);
    const accessor = column?.sortValue || ((row) => row[sort.key]);
    return [...rows].sort((a, b) => {
      const left = accessor(a);
      const right = accessor(b);
      if (left == null) return 1;
      if (right == null) return -1;
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (!rows.length) return emptyState || null;

  function toggleSort(key) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align ? `align-${column.align}` : undefined}>
                {column.sortable === false ? (
                  column.label
                ) : (
                  <button type="button" onClick={() => toggleSort(column.key)} aria-label={`Sort by ${column.label}`}>
                    {column.label}
                    <span className="sort-marker" aria-hidden="true">
                      {sort.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label} className={column.align ? `align-${column.align}` : undefined}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pageCount > 1 && (
        <div className="data-table-pager">
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>Previous</button>
          <span>Page {safePage + 1} of {pageCount} · {sorted.length} records</span>
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1}>Next</button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- image field -- */

/**
 * One image control used by every module: preview, replace, remove, progress
 * and validation. Images are served through mediaUrl() so both database-backed
 * and bucket-backed references render identically.
 */
export function ImageField({ label, value, onChange, onUpload, hint, aspect = 'wide' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = `image-${label.replace(/\W+/g, '-').toLowerCase()}`;

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const reference = await onUpload(file);
      onChange(reference);
    } catch (uploadError) {
      setError(uploadError.message || 'The image could not be uploaded.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="image-field">
      <span className="image-field-label">{label}</span>
      <div className={`image-field-preview image-field-${aspect}`}>
        {value
          ? <img src={mediaUrl(value)} alt="Selected image preview" />
          : <span className="image-field-placeholder">No image selected</span>}
      </div>
      <div className="image-field-actions">
        <label className="button button-outline button-small" htmlFor={inputId}>
          {busy ? 'Uploading…' : value ? 'Replace image' : 'Choose image'}
          <input id={inputId} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml" disabled={busy} onChange={choose} />
        </label>
        {value && <button type="button" className="button-text" onClick={() => onChange('')} disabled={busy}>Remove</button>}
      </div>
      {hint && <small className="image-field-hint">{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </div>
  );
}

/* --------------------------------------------------------------- fields -- */

export function TextField({ label, value, onChange, type = 'text', hint, required, placeholder, min, max, step, error }) {
  const id = `text-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label className="admin-field" htmlFor={id}>
      <span>{label}{required && <em aria-hidden="true"> *</em>}</span>
      <input
        id={id} type={type} value={value ?? ''} required={required} placeholder={placeholder}
        min={min} max={max} step={step} aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <small>{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </label>
  );
}

export function TextArea({ label, value, onChange, rows = 4, hint, required, placeholder }) {
  const id = `area-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label className="admin-field" htmlFor={id}>
      <span>{label}{required && <em aria-hidden="true"> *</em>}</span>
      <textarea id={id} rows={rows} value={value ?? ''} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SelectField({ label, value, onChange, options, hint }) {
  const id = `select-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label className="admin-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function CheckField({ label, checked, onChange, hint, warning }) {
  return (
    <label className={`admin-check${warning ? ' admin-check-warning' : ''}`}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function StatusPill({ status }) {
  const tone = ['published', 'paid', 'approved', 'active', 'subscribed', 'verified', 'processed'].includes(status) ? 'ok'
    : ['pending', 'in_review', 'unread', 'new', 'draft'].includes(status) ? 'wait'
    : ['failed', 'declined', 'refunded', 'archived', 'unsubscribed', 'needs-attention'].includes(status) ? 'bad'
    : 'neutral';
  return <span className={`status-pill status-${tone}`}>{(status || 'unknown').replaceAll('_', ' ')}</span>;
}
