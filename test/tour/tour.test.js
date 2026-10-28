import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { currentUser } from '@/service/sicutiService';
import { userAbilities } from '@/service/authService';
import { getTourPersona } from '@/tour/persona';
import { hasSeenTour, markTourSeen, tourSeenTick } from '@/tour/tourStore';
import { ALL_TOURS, loadTourSteps, tourById, tourForRoute, welcomeTour } from '@/tour/tours';
import { buildSteps } from '@/tour/useTour';

const userOf = (role, id = role) => ({ id, role, kd_role: role });

describe('getTourPersona', () => {
    afterEach(() => {
        currentUser.value = null;
        userAbilities.value = [];
    });

    it.each([
        ['staff_it', 'karyawan'],
        ['staff_seksi', 'karyawan'],
        ['staff_approval', 'approval'],
        ['kepala_it', 'kepala'],
        ['kepala_dept', 'kepala'],
        ['admin_sit', 'admin'],
        ['admin_sis', 'admin'],
        ['admin_super_app', 'superadmin']
    ])('%s → %s', (role, persona) => {
        expect(getTourPersona(userOf(role))).toBe(persona);
    });

    it('role approver kustom (mis. pic_approval) dibaca sebagai approval lewat izinnya', () => {
        currentUser.value = userOf('pic_approval', 'USR301');
        userAbilities.value = ['approval.view_requests', 'approval.validate'];
        expect(getTourPersona(currentUser.value)).toBe('approval');
    });

    it('tanpa user tidak ada persona', () => {
        expect(getTourPersona(null)).toBe(null);
    });
});

describe('buildSteps', () => {
    const tour = {
        id: 't',
        steps: [
            { title: 'Pembuka', text: 'tengah layar' },
            { element: 'ada', title: 'A', text: 'a', side: 'right' },
            { element: 'tidak-ada', title: 'B', text: 'b' },
            { element: 'ada', title: 'Admin saja', text: 'c', personas: ['admin'] },
            { element: 'ada', ifHidden: 'tombol', title: 'Cadangan', text: 'd' }
        ]
    };
    const el = { nodeName: 'DIV' };

    it('melewati langkah yang elemennya tidak tampil atau bukan untuk persona ini', () => {
        const steps = buildSteps(tour, 'karyawan', (key) => (key === 'ada' ? el : null));
        expect(steps.map((s) => s.popover.title)).toEqual(['Pembuka', 'A', 'Cadangan']);
        expect(steps[0].element).toBeUndefined();
        expect(steps[1]).toEqual({ element: el, popover: { title: 'A', description: 'a', side: 'right' } });
    });

    it('langkah cadangan hilang bila elemen pengganti tampil', () => {
        const steps = buildSteps(tour, 'karyawan', (key) => (key === 'ada' || key === 'tombol' ? el : null));
        expect(steps.map((s) => s.popover.title)).not.toContain('Cadangan');
    });
});

describe('tourStore', () => {
    beforeEach(() => localStorage.clear());

    it('menyimpan status per user dan versi tour', () => {
        const tour = { id: 'karyawan.saldo', version: 1 };
        const tick = tourSeenTick.value;
        expect(hasSeenTour('U1', tour)).toBe(false);
        markTourSeen('U1', tour);
        expect(hasSeenTour('U1', tour)).toBe(true);
        expect(hasSeenTour('U2', tour)).toBe(false);
        expect(hasSeenTour('U1', { ...tour, version: 2 })).toBe(false);
        expect(tourSeenTick.value).toBe(tick + 1);
    });
});

describe('registri tour', () => {
    it('mencari tour sesuai halaman dan persona', () => {
        expect(tourForRoute('/leave/history', 'karyawan')?.id).toBe('karyawan.pengajuan');
        expect(tourForRoute('/leave/balance', 'karyawan')?.id).toBe('karyawan.saldo');
        expect(tourForRoute('/leave/history', 'admin')).toBe(null);
        expect(welcomeTour('karyawan')?.id).toBe('karyawan.pengenalan');
        expect(tourById('karyawan.formulir', 'karyawan')?.kind).toBe('dialog');
        expect(tourById('karyawan.formulir', 'approval')).toBe(null);
    });

    it('Approval dan Kepala memakai tour yang sama', () => {
        for (const persona of ['approval', 'kepala']) {
            expect(welcomeTour(persona)?.id).toBe('approval.pengenalan');
            expect(tourForRoute('/approval/pending', persona)?.id).toBe('approval.validasi');
            expect(tourForRoute('/approval/history', persona)?.id).toBe('approval.riwayat');
            expect(tourById('approval.proses', persona)?.kind).toBe('dialog');
        }
        expect(tourForRoute('/approval/pending', 'karyawan')).toBe(null);
    });

    it('Admin Seksi punya tur pengenalan dan tour di setiap halaman admin', () => {
        expect(welcomeTour('admin')?.id).toBe('admin.pengenalan');
        const routes = ['/admin/monitoring', '/admin/create-leave', '/admin/balances', '/admin/employees', '/admin/leave-types', '/admin/policy', '/admin/holidays', '/admin/approval-flow', '/admin/reports', '/admin/audit-trail'];
        for (const route of routes) expect(tourForRoute(route, 'admin')?.route).toBe(route);
        expect(tourForRoute('/admin/monitoring', 'approval')).toBe(null);
    });

    it('Super Admin: tur pengenalan sendiri, halaman Keamanan, dan memakai tour halaman admin', async () => {
        expect(welcomeTour('superadmin')?.id).toBe('super.pengenalan');
        expect(tourForRoute('/admin/accounts', 'superadmin')?.id).toBe('super.akun');
        expect(tourForRoute('/admin/permissions', 'superadmin')?.id).toBe('super.hak-akses');
        expect(tourForRoute('/admin/accounts', 'admin')).toBe(null);
        const monitoring = tourForRoute('/admin/monitoring', 'superadmin');
        expect(monitoring?.id).toBe('admin.pemantauan');

        const stepDefs = await loadTourSteps(monitoring);
        const textsFor = (persona) =>
            buildSteps({ ...monitoring, steps: stepDefs }, persona, () => ({})).map((s) => s.popover.description);
        expect(textsFor('superadmin').join(' ')).toContain('seluruh divisi');
        expect(textsFor('superadmin').join(' ')).not.toContain('divisi Anda');
        expect(textsFor('admin').join(' ')).toContain('divisi Anda');
    });

    it('tour Kalender tersedia untuk semua peran yang bisa membuka kalender', () => {
        for (const persona of ['karyawan', 'approval', 'kepala', 'admin', 'superadmin']) {
            expect(tourForRoute('/calendar', persona)?.id).toBe('kalender');
        }
    });

    it('setiap tour punya id unik, versi, dan isi langkah berjudul (dimuat terpisah)', async () => {
        const ids = ALL_TOURS.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const t of ALL_TOURS) {
            expect(t.version).toBeGreaterThan(0);
            const steps = await loadTourSteps(t);
            expect(steps.length).toBeGreaterThan(0);
            for (const s of steps) {
                expect(s.title).toBeTruthy();
                expect(s.text).toBeTruthy();
            }
        }
    });
});
