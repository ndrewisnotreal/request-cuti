import { describe, expect, it } from 'vitest';
import { buildCsv } from '@/utils/csv';

// QA #8: Data Karyawan diekspor ke CSV (pengganti impor)
describe('buildCsv', () => {
    const columns = [
        { header: 'NIK', value: (r) => r.nik },
        { header: 'Nama', value: (r) => r.nama },
        { header: 'Atasan', value: (r) => r.atasan }
    ];

    it('menulis header lalu satu baris per data, dipisah koma, dengan BOM agar Excel membaca UTF-8', () => {
        const csv = buildCsv(columns, [{ nik: '24010002', nama: 'Raka', atasan: 'Jabbar' }]);
        expect(csv).toBe('﻿NIK,Nama,Atasan\r\n24010002,Raka,Jabbar');
    });

    it('mengutip nilai berisi koma, kutip, atau baris baru; nilai kosong jadi sel kosong', () => {
        const csv = buildCsv(columns, [{ nik: '1', nama: 'Daeng "DM", Anwar', atasan: null }]);
        expect(csv.split('\r\n')[1]).toBe('1,"Daeng ""DM"", Anwar",');
    });

    it('NIK berawalan nol tetap teks (tidak dibulatkan Excel)', () => {
        const csv = buildCsv([{ header: 'NIK', value: (r) => r.nik, text: true }], [{ nik: '0012' }]);
        expect(csv.split('\r\n')[1]).toBe('="0012"');
    });
});
