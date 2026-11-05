import { describe, expect, it } from 'vitest';
import { formJenis } from '@/utils/leaveFormPrint';

describe('formJenis: centang jenis cuti di surat', () => {
    it('Cuti Melahirkan Perempuan mencentang Hamil', () => {
        expect(formJenis('Cuti Melahirkan Perempuan')).toBe('Hamil');
    });

    it('Cuti Melahirkan Laki-laki tidak mencentang Hamil, masuk ke Lainnya', () => {
        expect(formJenis('Cuti Melahirkan Laki-laki')).toBeNull();
    });
});
