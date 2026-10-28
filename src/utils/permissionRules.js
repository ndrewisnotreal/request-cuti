export function roleDeleteBlock(role) {
    if (!role) return 'Pilih peran terlebih dahulu.';
    if (role.is_super) return 'Admin Super App tidak dapat dihapus.';
    if (role.built_in) return `${role.nm_role} adalah peran bawaan sistem dan tidak dapat dihapus.`;
    if (Number(role.user_count) > 0) {
        return `${role.nm_role} masih dipakai ${role.user_count} pengguna. Pindahkan pengguna ke peran lain di Manajemen Akun dulu.`;
    }
    return null;
}
