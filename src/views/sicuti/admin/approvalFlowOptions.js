// Pilihan di halaman Alur Approval: approver per tingkat dan anggota templat.

/** Nama tingkat lain di templat ini yang sudah memakai akun tersebut (satu akun satu tingkat). */
function usedElsewhere(flows, editingFlowId) {
    const used = new Map();
    for (const f of flows || []) {
        if (f.id_flow === editingFlowId) continue;
        for (const a of f.approvers || []) used.set(a.uid_user_system, f.nm_flow);
    }
    return used;
}

/**
 * Opsi approver dialog tingkat: semua akun berizin approve. Diredupkan bila sudah di tingkat lain
 * templat ini, atau dari departemen lain (approver SIT hanya di templat SIT; akun tanpa departemen boleh).
 */
export function approverChoices(eligible, flows, editingFlowId, templateDept) {
    const used = usedElsewhere(flows, editingFlowId);
    return (eligible || []).map((u) => {
        const where = used.get(u.uid_user_system);
        const otherDept = Boolean(templateDept && u.kd_dept && u.kd_dept !== templateDept);
        const note = otherDept ? ` · departemen ${u.kd_dept}` : where ? ` · sudah di tingkat ${where}` : '';
        return {
            value: u.uid_user_system,
            label: `${u.nama} · ${u.nm_role || u.kd_role}${note}`,
            disabled: otherDept || Boolean(where)
        };
    });
}

/** Isi awal tingkat baru: pemegang peran sedepartemen templat (akun tanpa departemen ikut). */
export function defaultApprovers(eligible, flows, kdRole, kdDept) {
    if (!kdRole) return [];
    const used = usedElsewhere(flows, null);
    return (eligible || [])
        .filter((u) => u.kd_role === kdRole && (!kdDept || !u.kd_dept || u.kd_dept === kdDept) && !used.has(u.uid_user_system))
        .map((u) => u.uid_user_system);
}

/**
 * Opsi Tambah Anggota: satu karyawan satu templat, dan hanya dari departemen templat (akun tanpa
 * departemen boleh), jadi anggota templat lain dan karyawan departemen lain tidak bisa dipilih.
 */
export function memberChoices(candidates, templateDept) {
    return (candidates || []).map((u) => {
        const otherDept = Boolean(templateDept && u.kd_dept && u.kd_dept !== templateDept);
        const note = otherDept ? ` · departemen ${u.kd_dept}` : u.nm_template ? ` · sudah di ${u.nm_template}` : '';
        return {
            value: u.uid_user_system,
            label: `${u.nama} · ${u.nm_role || u.kd_role}${note}${u.is_approver ? ' · approver' : ''}`,
            disabled: otherDept || Boolean(u.nm_template)
        };
    });
}

/** Validasi dialog tingkat: peran selalu wajib; approver wajib saat menambah tingkat baru. */
export function flowFormProblem(form) {
    if (!form?.assigned_role) return 'Pilih peran untuk tingkat ini';
    if (!form.id_flow && !(form.users || []).length) return 'Pilih minimal satu approver untuk tingkat baru';
    return null;
}
