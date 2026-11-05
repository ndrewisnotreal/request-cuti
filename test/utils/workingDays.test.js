import { describe, expect, it } from 'vitest';
import { countWorkingDays, latestEndDate } from '@/utils/workingDays';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('latestEndDate', () => {
    it('mengembalikan null jika tanggal mulai kosong atau jenis cuti tanpa batas', () => {
        expect(latestEndDate(null, 90)).toBeNull();
        expect(latestEndDate('2026-11-04', null)).toBeNull();
        expect(latestEndDate('2026-11-04', 0)).toBeNull();
    });

    it('batas 2 hari kerja dari Senin berakhir di Selasa', () => {
        expect(iso(latestEndDate('2026-11-02', 2))).toBe('2026-11-03');
    });

    it('akhir pekan setelah hari terakhir masih boleh karena tidak menambah hari kerja', () => {
        expect(iso(latestEndDate('2026-11-05', 2))).toBe('2026-11-08');
    });

    it('hari libur tidak mengurangi jatah hari kerja', () => {
        expect(iso(latestEndDate('2026-11-02', 2, new Set(['2026-11-03'])))).toBe('2026-11-04');
    });

    it('mulai di akhir pekan tetap dihitung dari hari kerja pertama', () => {
        expect(iso(latestEndDate('2026-11-07', 1))).toBe('2026-11-09');
    });

    it('menerima input berupa objek Date JavaScript', () => {
        expect(iso(latestEndDate(new Date(2026, 10, 2), 2))).toBe('2026-11-03');
    });

    it('tanggal hasilnya tepat di batas: batas lolos, sehari kerja sesudahnya melebihi', () => {
        const holidays = new Set(['2026-12-25']);
        const max = latestEndDate('2026-11-04', 90, holidays);
        expect(countWorkingDays('2026-11-04', max, holidays)).toBe(90);
        const next = new Date(max.getFullYear(), max.getMonth(), max.getDate() + 1);
        expect(countWorkingDays('2026-11-04', next, holidays)).toBe(91);
    });
});

describe('countWorkingDays', () => {
    it('mengembalikan 0 jika startDate atau endDate kosong', () => {
        expect(countWorkingDays(null, '2025-06-05')).toBe(0);
        expect(countWorkingDays('2025-06-01', null)).toBe(0);
        expect(countWorkingDays('', '')).toBe(0);
    });

    it('mengembalikan 0 jika endDate lebih awal dari startDate', () => {
        expect(countWorkingDays('2025-06-10', '2025-06-05')).toBe(0);
    });

    it('menghitung hari kerja tanpa akhir pekan (Senin - Jumat)', () => {
        const days = countWorkingDays('2025-06-02', '2025-06-06');
        expect(days).toBe(5);
    });

    it('menghitung satu hari kerja (Senin)', () => {
        expect(countWorkingDays('2025-06-02', '2025-06-02')).toBe(1);
    });

    it('mengabaikan jika tanggal jatuh pada hari Sabtu atau Minggu', () => {
        expect(countWorkingDays('2025-06-07', '2025-06-07')).toBe(0);
        expect(countWorkingDays('2025-06-08', '2025-06-08')).toBe(0);
        expect(countWorkingDays('2025-06-07', '2025-06-08')).toBe(0);
    });

    it('menghitung rentang yang melintasi akhir pekan (Jumat ke Senin)', () => {
        expect(countWorkingDays('2025-06-06', '2025-06-09')).toBe(2);
    });

    it('mengurangi hari libur nasional yang jatuh di hari kerja', () => {
        const holidays = new Set(['2025-06-04']);
        expect(countWorkingDays('2025-06-02', '2025-06-06', holidays)).toBe(4);
    });

    it('tidak mengurangi ganda jika hari libur jatuh di akhir pekan', () => {
        const holidays = new Set(['2025-06-07']);
        expect(countWorkingDays('2025-06-06', '2025-06-09', holidays)).toBe(2);
    });

    it('menerima holidayDateStrings dalam bentuk Array', () => {
        const holidays = ['2025-06-03', '2025-06-04'];
        expect(countWorkingDays('2025-06-02', '2025-06-06', holidays)).toBe(3);
    });

    it('menerima input berupa objek Date JavaScript', () => {
        const start = new Date(2025, 5, 2);
        const end = new Date(2025, 5, 6);
        expect(countWorkingDays(start, end)).toBe(5);
    });
});
