import { describe, expect, it } from 'vitest';
import { hasOpenableMenu } from '@/layout/composables/sidebarMenu';

describe('hasOpenableMenu', () => {
    const dashboard = { label: 'Menu Utama', items: [{ label: 'Dashboard', to: '/' }] };

    it('hanya Dashboard → sidebar disembunyikan', () => {
        expect(hasOpenableMenu([dashboard])).toBe(false);
    });

    it('semua menu lain redup (tanpa izin) → sidebar disembunyikan', () => {
        const approval = {
            label: 'Approval',
            items: [
                { label: 'Validasi Pengajuan', to: '/approval/pending', disabled: true },
                { label: 'Riwayat Approval', to: '/approval/history', disabled: true }
            ]
        };
        expect(hasOpenableMenu([dashboard, approval])).toBe(false);
    });

    it('ada satu menu yang bisa dibuka → sidebar tampil (menu lain tetap redup)', () => {
        const pengajuan = {
            label: 'Pengajuan',
            items: [
                { label: 'Pengajuan Cuti', to: '/leave/history', disabled: true },
                { label: 'Saldo Cuti', to: '/leave/balance' }
            ]
        };
        expect(hasOpenableMenu([dashboard, pengajuan])).toBe(true);
        expect(hasOpenableMenu([{ label: 'Menu Utama', items: [{ to: '/' }, { label: 'Kalender Cuti', to: '/calendar' }] }])).toBe(true);
    });
});
