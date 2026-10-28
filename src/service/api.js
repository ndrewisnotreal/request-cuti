import { removeEncryptedItem } from '@/utils/encryption';
import { publicPath } from '@/utils/publicPath';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const APP_KEY = import.meta.env.VITE_APP_KEY || '';

export const SESSION_KEYS = ['sicuti_auth', 'sicuti_user_menus', 'sicuti_abilities'];

export const LOGOUT_NOTICE_KEY = 'sicuti_logout_notice';

try {
    localStorage.removeItem('sicuti_token');
    sessionStorage.removeItem('sicuti_token');
} catch {}

export function assetUrl(p) {
    if (!p) return null;
    return /^https?:\/\//.test(p) ? p : `${API_BASE}${p}`;
}

export function clearAuth() {
    SESSION_KEYS.forEach(removeEncryptedItem);
    forgetSharedGets();
}

function buildUrl(endpoint, params) {
    let url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    if (params && typeof params === 'object') {
        const query = new URLSearchParams();
        for (const [key, val] of Object.entries(params)) {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, String(val));
            }
        }
        const qs = query.toString();
        if (qs) {
            url += (url.includes('?') ? '&' : '?') + qs;
        }
    }
    return url;
}

async function request(endpoint, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const hasJsonBody = !isFormData && options.body !== undefined;
    const headers = {
        ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
        'x-api-key': APP_KEY,
        ...(options.headers || {})
    };

    const url = buildUrl(endpoint, options.params);

    const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });

    if (res.status === 401) {
        const body = await res.json().catch(() => null);
        clearAuth();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
            try {
                if (body?.message) sessionStorage.setItem(LOGOUT_NOTICE_KEY, body.message);
            } catch {}
            window.location.href = publicPath('auth/login');
        }
        const err = new Error(body?.error || body?.message || 'Sesi berakhir, silakan login kembali');
        err.status = 401;
        err.data = body;
        throw err;
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
        const message = (data && typeof data === 'object' && (data.error || data.message)) || res.statusText || 'Request failed';
        const err = new Error(message);
        err.status = res.status;
        err.data = data;
        throw err;
    }

    return data;
}

async function requestBlob(endpoint, params) {
    const res = await fetch(buildUrl(endpoint, params), { headers: { 'x-api-key': APP_KEY }, credentials: 'include' });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = new Error(body?.error || body?.message || res.statusText || 'Berkas tidak bisa diambil');
        err.status = res.status;
        throw err;
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return { blob: await res.blob(), filename: match ? decodeURIComponent(match[1]) : '' };
}

export function saveBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const RECENT_GET_MS = 2000;
const sharedGets = new Map();
const copyOf = (data) => (data && typeof data === 'object' ? structuredClone(data) : data);

function forgetSharedGets() {
    sharedGets.clear();
}

function forgetFinishedGets() {
    for (const [key, entry] of sharedGets) if (entry.doneAt) sharedGets.delete(key);
}
if (typeof window !== 'undefined') {
    for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, forgetFinishedGets, { capture: true, passive: true });
}

function sharedGet(url, params) {
    const key = buildUrl(url, params);
    const hit = sharedGets.get(key);
    if (hit && (!hit.doneAt || Date.now() - hit.doneAt < RECENT_GET_MS)) return hit.promise.then(copyOf);
    const entry = { doneAt: 0 };
    const drop = () => sharedGets.get(key) === entry && sharedGets.delete(key);
    entry.promise = request(url, { method: 'GET', params }).then(
        (data) => {
            entry.doneAt = Date.now();
            setTimeout(drop, RECENT_GET_MS);
            return data;
        },
        (err) => {
            drop();
            throw err;
        }
    );
    sharedGets.set(key, entry);
    return entry.promise.then(copyOf);
}

function write(url, options) {
    forgetSharedGets();
    return request(url, options).finally(forgetSharedGets);
}

export const api = {
    get: (url, params) => sharedGet(url, params),
    blob: (url, params) => requestBlob(url, params),
    post: (url, data) => {
        const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
        return write(url, {
            method: 'POST',
            body: isFormData ? data : (data !== undefined ? JSON.stringify(data) : undefined)
        });
    },
    upload: (url, formData) => write(url, { method: 'POST', body: formData }),
    put: (url, data) => {
        const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
        return write(url, {
            method: 'PUT',
            body: isFormData ? data : (data !== undefined ? JSON.stringify(data) : undefined)
        });
    },
    delete: (url, data) => write(url, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined })
};

export default api;
