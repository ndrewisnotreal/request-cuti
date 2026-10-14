import { removeEncryptedItem } from '@/utils/encryption';

// Sama seperti template-vuejs: semua request lewat VITE_API_BASE_URL (/api), lalu proxy Vite
// meneruskannya ke backend dengan awalan /api dibuang. Berlaku juga dari HP/laptop lain di jaringan.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Header x-api-key; harus sama dengan API_TOKEN backend.
export const APP_KEY = import.meta.env.VITE_APP_KEY || '';

// Sesi lokal (terenkripsi dengan VITE_ENCRYPTION_SECRET_KEY). Token login tidak disimpan di sini:
// backend memasangnya sebagai cookie httpOnly yang tidak bisa dibaca JavaScript.
export const SESSION_KEYS = ['sicuti_auth', 'sicuti_user_menus', 'sicuti_abilities'];

/** sessionStorage: alasan sesi diputus (401), ditampilkan sekali di halaman login. */
export const LOGOUT_NOTICE_KEY = 'sicuti_logout_notice';

// Versi lama menyimpan JWT apa adanya di storage; hapus agar tidak tertinggal di browser.
try {
    localStorage.removeItem('sicuti_token');
    sessionStorage.removeItem('sicuti_token');
} catch {}

// Path berkas dari backend (mis. /uploads/avatars/x.png) → URL lengkap
export function assetUrl(p) {
    if (!p) return null;
    return /^https?:\/\//.test(p) ? p : `${API_BASE}${p}`;
}

export function clearAuth() {
    SESSION_KEYS.forEach(removeEncryptedItem);
}

async function request(endpoint, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    // Header JSON hanya bila ada body: Fastify menolak (400) JSON kosong, mis. POST /auth/logout
    const hasJsonBody = !isFormData && options.body !== undefined;
    const headers = {
        ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
        'x-api-key': APP_KEY,
        ...(options.headers || {})
    };

    let url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    if (options.params && typeof options.params === 'object') {
        const query = new URLSearchParams();
        for (const [key, val] of Object.entries(options.params)) {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, String(val));
            }
        }
        const qs = query.toString();
        if (qs) {
            url += (url.includes('?') ? '&' : '?') + qs;
        }
    }

    // Cookie login (httpOnly) ikut terkirim, seperti withCredentials di template
    const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });

    if (res.status === 401) {
        // Pesan backend (mis. "Username atau password salah", "Akun tidak aktif") tetap diteruskan
        const body = await res.json().catch(() => null);
        clearAuth();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
            // Alasan sesi diputus (mis. izin login dicabut) ditampilkan di halaman login
            try {
                if (body?.message) sessionStorage.setItem(LOGOUT_NOTICE_KEY, body.message);
            } catch {}
            window.location.href = '/auth/login';
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

/**
 * Ambil berkas (lampiran, CSV) dengan header & cookie login yang sama seperti request lain.
 * Hasil: { blob, filename } — filename dari Content-Disposition bila ada.
 */
async function requestBlob(endpoint, params) {
    let url = `${API_BASE}${endpoint}`;
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params || {})) {
        if (val !== undefined && val !== null && val !== '') query.append(key, String(val));
    }
    if (query.toString()) url += (url.includes('?') ? '&' : '?') + query.toString();
    const res = await fetch(url, { headers: { 'x-api-key': APP_KEY }, credentials: 'include' });
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

/** Simpan blob sebagai berkas unduhan. */
export function saveBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export const api = {
    get: (url, params) => request(url, { method: 'GET', params }),
    blob: (url, params) => requestBlob(url, params),
    post: (url, data) => {
        const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
        return request(url, {
            method: 'POST',
            body: isFormData ? data : (data !== undefined ? JSON.stringify(data) : undefined)
        });
    },
    upload: (url, formData) => request(url, { method: 'POST', body: formData }),
    put: (url, data) => {
        const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
        return request(url, {
            method: 'PUT',
            body: isFormData ? data : (data !== undefined ? JSON.stringify(data) : undefined)
        });
    },
    delete: (url, data) => request(url, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined })
};

export default api;
