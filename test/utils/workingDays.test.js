import { describe, expect, it } from 'vitest';
import { countWorkingDays } from '@/utils/workingDays';

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
