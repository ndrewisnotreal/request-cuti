import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { API_BASE, LOGOUT_NOTICE_KEY, SESSION_KEYS, assetUrl, clearAuth } from '@/service/api';
import { setEncryptedItem } from '@/utils/encryption';

function mockFetch(status, body) {
    const fn = vi.fn().mockResolvedValue({
        status,
        ok: status >= 200 && status < 300,
        statusText: '',
        headers: { get: () => 'application/json' },
        json: async () => body
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

describe('api', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('memakai prefix /api dan mengubah path berkas jadi URL lewat proxy', () => {
        expect(API_BASE).toBe('/api');
        expect(assetUrl('/uploads/avatars/a.png')).toBe('/api/uploads/avatars/a.png');
        expect(assetUrl('https://cdn.example/x.png')).toBe('https://cdn.example/x.png');
        expect(assetUrl(null)).toBeNull();
    });

    it('mengirim x-api-key dan cookie, tanpa header Authorization', async () => {
        const fetchMock = mockFetch(200, { success: true, data: [] });
        await api.get('/sicuti/holiday', { year: 2026, kosong: '' });
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/sicuti/holiday?year=2026');
        expect(opts.credentials).toBe('include');
        expect(opts.headers).toHaveProperty('x-api-key');
        expect(opts.headers).not.toHaveProperty('Authorization');
        expect(opts.headers).not.toHaveProperty('Content-Type');
    });

    it('401 di tengah sesi: alasan disimpan untuk ditampilkan di halaman login (QA #11)', async () => {
        const msg = 'Izin login untuk peran Anda sudah dinonaktifkan. Hubungi admin.';
        const loc = { pathname: '/leave/history', href: '/leave/history' };
        vi.stubGlobal('location', loc);
        mockFetch(401, { success: false, message: msg, error: msg });
        await expect(api.get('/sicuti/leave-request/mine')).rejects.toMatchObject({ status: 401 });
        expect(sessionStorage.getItem(LOGOUT_NOTICE_KEY)).toBe(msg);
        expect(loc.href).toBe('/auth/login');
        sessionStorage.clear();
    });

    it('meneruskan pesan error backend beserta data-nya', async () => {
        mockFetch(400, { success: false, error: 'kd_role wajib diisi', data: { code: 'X' } });
        await expect(api.get('/master/permission/action_edit')).rejects.toMatchObject({ message: 'kd_role wajib diisi', status: 400 });
    });

    it('clearAuth menghapus seluruh sesi lokal', () => {
        SESSION_KEYS.forEach((k) => setEncryptedItem(k, { a: 1 }));
        clearAuth();
        SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    });
});
