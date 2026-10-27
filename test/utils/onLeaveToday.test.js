import { describe, expect, it } from 'vitest';
import { localIsoDate, onLeaveToday, shortDate } from '@/utils/onLeaveToday';

const TODAY = '2026-10-13';
const leave = (over) => ({
    id_request: 'REQ-SIT-0001/2026',
    nama: 'Karyawan',
    status: 'approved',
    start_date: '2026-10-12',
    end_date: '2026-10-14',
    ...over
});

describe('onLeaveToday (kartu Sedang Cuti Hari Ini)', () => {
    it('hanya cuti yang sudah disetujui (approved/completed), bukan yang masih menunggu', () => {
        const list = onLeaveToday(
            [
                leave({ id_request: 'A', status: 'approved' }),
                leave({ id_request: 'B', status: 'completed' }),
                leave({ id_request: 'C', status: 'submitted' }),
                leave({ id_request: 'D', status: 'pending_validation' })
            ],
            TODAY
        );
        expect(list.map((l) => l.id_request)).toEqual(['A', 'B']);
    });

    it('hanya yang rentang cutinya mencakup hari ini (hari pertama & terakhir ikut)', () => {
        const list = onLeaveToday(
            [
                leave({ id_request: 'mulai-hari-ini', start_date: TODAY, end_date: '2026-10-20' }),
                leave({ id_request: 'selesai-hari-ini', start_date: '2026-10-08', end_date: TODAY }),
                leave({ id_request: 'selesai-kemarin', start_date: '2026-10-08', end_date: '2026-10-12' }),
                leave({ id_request: 'mulai-besok', start_date: '2026-10-14', end_date: '2026-10-15' })
            ],
            TODAY
        );
        expect(list.map((l) => l.id_request).sort()).toEqual(['mulai-hari-ini', 'selesai-hari-ini']);
    });

    it('urut dari yang paling cepat selesai, lalu nama', () => {
        const list = onLeaveToday(
            [
                leave({ nama: 'Zaki', end_date: '2026-10-20' }),
                leave({ nama: 'Budi', end_date: '2026-10-15' }),
                leave({ nama: 'Andi', end_date: '2026-10-15' })
            ],
            TODAY
        );
        expect(list.map((l) => l.nama)).toEqual(['Andi', 'Budi', 'Zaki']);
    });

    it('data kosong aman', () => {
        expect(onLeaveToday(null, TODAY)).toEqual([]);
    });
});

describe('localIsoDate', () => {
    it('memakai tanggal lokal, bukan UTC (lewat tengah malam tetap hari ini)', () => {
        expect(localIsoDate(new Date(2026, 9, 13, 0, 30))).toBe('2026-10-13');
        expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });
});

describe('shortDate (kolom kartu yang sempit)', () => {
    it('tanggal singkat berbahasa Indonesia', () => {
        expect(shortDate('2026-10-15')).toBe('15 Okt');
        expect(shortDate('2026-05-01')).toBe('1 Mei');
        expect(shortDate('')).toBe('-');
    });
});
