import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const isConfigured = Boolean(supabase);

export const MEDIA_BUCKET = 'foundation-media';

/**
 * Resolve a stored image reference to something an <img> tag can load.
 *
 * Two storage strategies coexist:
 *   "db:<uuid>"  an image held in the database, served by the backend
 *   "<path>"     an object in the public Supabase storage bucket
 *
 * Both live in the same image_path columns, so callers never need to know
 * which one they are holding.
 */
export function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('db:')) return `${apiUrl}/api/images/${path.slice(3)}`;
  return supabase?.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl || '';
}

/** True when the reference points at a database-backed image. */
export function isDatabaseImage(path) {
  return Boolean(path && path.startsWith('db:'));
}

/**
 * Reduce a chosen file to something small enough to store sensibly.
 *
 * Phone photographs are routinely 4-8 MB. Resizing to 1600px on the long edge
 * and re-encoding keeps the database small without visible loss at web sizes.
 * SVG is markup and is passed through untouched.
 */
export function compressImage(file, { maxDimension = 1600, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result, bytes: file.size });
      reader.onerror = () => reject(new Error('That file could not be read.'));
      reader.readAsDataURL(file);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);
      // PNG keeps transparency; everything else is smaller as JPEG.
      const isPng = file.type === 'image/png';
      const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ dataUrl, bytes: Math.round(base64.length * 0.75) });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That file is not a readable image.'));
    };
    image.src = objectUrl;
  });
}

/**
 * Upload an image and return the reference to store in an image_path column.
 *
 * Small, fixed foundation imagery is held in the database; anything larger
 * goes to the storage bucket. Both return a value that mediaUrl() understands.
 */
export async function uploadImage(file, accessToken, { bucketUpload } = {}) {
  if (!file) throw new Error('Choose an image first.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];
  if (!allowed.includes(file.type)) {
    throw new Error('Upload a JPEG, PNG, WebP, AVIF or SVG image.');
  }

  const { dataUrl, bytes } = await compressImage(file);
  const shouldUseBucket = bucketUpload ?? bytes > 400 * 1024;

  if (shouldUseBucket) {
    if (!supabase) throw new Error('Image storage is not configured.');
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const objectPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, blob, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(error.message || 'The image could not be uploaded.');
    return objectPath;
  }

  const result = await fetch(`${apiUrl}/api/admin/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ data_url: dataUrl, is_public: true }),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.detail || 'The image could not be uploaded.');
  return payload.token;
}

/**
 * Call a protected backend endpoint with the current session token.
 * Throws an Error carrying the server's message so callers can show it.
 *
 * A 401 means the Supabase session is no longer valid. Without a signal the
 * caller just renders "The request could not be completed." and the operator is
 * stuck on a dead screen, so the event is broadcast for the admin shell to act
 * on and the message says what to do.
 */
export async function apiFetch(path, accessToken, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('foundation:session-expired'));
    }
    const error = new Error(
      response.status === 401
        ? 'Your session has expired. Sign in again to continue.'
        : payload.detail || payload.message || 'The request could not be completed.'
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

/** Format an amount as Ghana cedis. */
export function money(value) {
  return `GHS ${Number(value || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Percentage of a target that has been reached, capped at 100. */
export function progressPercent(raised, target) {
  const goal = Number(target || 0);
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((Number(raised || 0) / goal) * 1000) / 10);
}

/** A short, human-readable date. */
export function shortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
