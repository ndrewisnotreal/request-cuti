import { describe, expect, it } from 'vitest';
import { roleDeleteBlock } from '@/utils/permissionRules';

describe('roleDeleteBlock (tombol Hapus Peran)', () => {
    it('peran buatan sendiri yang tidak dipakai boleh dihapus', () => {
        expect(roleDeleteBlock({ nm_role: 'Staff HRD', built_in: false, user_count: 0 })).toBeNull();
    });

    it('Admin Super App, peran bawaan, dan peran yang masih dipakai tidak bisa dihapus (dengan alasan)', () => {
        expect(roleDeleteBlock({ nm_role: 'Admin Super App', is_super: true, built_in: true, user_count: 1 })).toBe('Admin Super App tidak dapat dihapus.');
        expect(roleDeleteBlock({ nm_role: 'Staff IT', built_in: true, user_count: 0 })).toBe('Staff IT adalah peran bawaan sistem dan tidak dapat dihapus.');
        expect(roleDeleteBlock({ nm_role: 'PIC Approval', built_in: false, user_count: 1 })).toBe(
            'PIC Approval masih dipakai 1 pengguna. Pindahkan pengguna ke peran lain di Manajemen Akun dulu.'
        );
        expect(roleDeleteBlock(null)).toBe('Pilih peran terlebih dahulu.');
    });
});
