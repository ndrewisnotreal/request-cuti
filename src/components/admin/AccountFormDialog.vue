<script setup>
import { ref, computed, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { STATUS_REASON_OPTIONS, statusFormProblem } from '@/service/statusReason';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    isEditing: {
        type: Boolean,
        default: false
    },
    userData: {
        type: Object,
        default: null
    },
    roles: {
        type: Array,
        default: () => []
    },
    departments: {
        type: Array,
        default: () => []
    },
    users: {
        type: Array,
        default: () => []
    },
    adminDivision: {
        type: String,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const formErrors = ref({});
const saving = ref(false);

const form = ref({
    uid_user_system: '',
    username: '',
    email: '',
    nama: '',
    namecode: '',
    kd_dept: '',
    position: '',
    supervisor_id: null,
    kd_role: '',
    join_date: null,
    employment_status: '',
    password: '',
    status: 'A',
    original_status: 'A',
    status_reason: null,
    status_note: '',
    is_super: false
});

const EMPLOYMENT_OPTIONS = [
    { label: 'Belum diisi', value: '' },
    { label: 'Tetap', value: 'Tetap' },
    { label: 'Kontrak', value: 'Kontrak' },
    { label: 'Outsourcing', value: 'Outsourcing' }
];

function isAdminRole(kdRole) {
    const r = (props.roles || []).find((x) => x.kd_role === kdRole);
    return Boolean(r && (r.is_super || (Number(r.level) > 0 && Number(r.level) <= 15)));
}

const toIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined);
const fromIso = (iso) => {
    const p = String(iso || '').slice(0, 10).split('-').map(Number);
    return p.length === 3 && p.every(Boolean) ? new Date(p[0], p[1] - 1, p[2]) : null;
};

const deptSelectOptions = computed(() => {
    if (props.adminDivision) {
        return (props.departments || []).filter((d) => d.kd_dept === props.adminDivision);
    }
    return props.departments || [];
});

const supervisorOptions = computed(() => {
    const list = (props.users || []).filter((u) => {
        if (props.isEditing && u.uid_user_system === form.value.uid_user_system) return false;
        return true;
    });
    return [
        { label: 'Tidak Ada Atasan', value: null },
        ...list.map((u) => ({
            label: `${u.nama || u.username} (${u.namecode || u.username} - ${u.position || u.kd_role || '-'})`,
            value: u.uid_user_system
        }))
    ];
});

const roleOptions = computed(() =>
    (props.roles || []).map((r) => ({
        label: r.nm_role || r.kd_role,
        value: r.kd_role
    }))
);

const deactivating = computed(() => props.isEditing && form.value.original_status !== 'N' && form.value.status === 'N');

watch(
    () => props.visible,
    (isOpen) => {
        if (!isOpen) return;
        formErrors.value = {};
        if (props.isEditing && props.userData) {
            const u = props.userData;
            form.value = {
                uid_user_system: u.uid_user_system,
                username: u.username || '',
                email: u.email || '',
                nama: u.nama || '',
                namecode: u.namecode || '',
                kd_dept: u.kd_dept || props.adminDivision || '',
                position: u.position || '',
                supervisor_id: u.supervisor_id || null,
                kd_role: u.kd_role || '',
                join_date: fromIso(u.join_date),
                employment_status: u.employment_status || '',
                password: '',
                status: u.status_user || u.status || 'A',
                original_status: u.status_user || u.status || 'A',
                status_reason: null,
                status_note: '',
                is_super: Boolean(u.is_super)
            };
        } else {
            const defaultDept = props.adminDivision || props.departments?.[0]?.kd_dept || '';
            form.value = {
                uid_user_system: '',
                username: '',
                email: '',
                nama: '',
                namecode: '',
                kd_dept: defaultDept,
                position: '',
                supervisor_id: null,
                kd_role: roleOptions.value.find((o) => o.value === 'staff_it')?.value || roleOptions.value[0]?.value || '',
                join_date: null,
                employment_status: '',
                password: '',
                status: 'A',
                original_status: 'A',
                status_reason: null,
                status_note: '',
                is_super: false
            };
        }
    }
);

function validateForm() {
    const errs = {};
    const nik = form.value.namecode?.trim() || '';
    if (!form.value.username?.trim() && nik) form.value.username = nik;
    if (!isAdminRole(form.value.kd_role)) {
        const nikPattern = form.value.kd_role === 'staff_it' ? /^OS\d{8}$/ : /^\d{8}$/;
        if (!nik) errs.namecode = 'NIK wajib diisi';
        else if (!nikPattern.test(nik)) {
            errs.namecode = form.value.kd_role === 'staff_it' ? 'NIK Staff IT: OS diikuti 8 angka' : 'NIK harus 8 angka';
        }
    }
    if (!form.value.username?.trim()) errs.username = 'Username wajib diisi';
    if (!form.value.nama?.trim()) errs.nama = 'Nama lengkap wajib diisi';
    if (!form.value.kd_role) errs.kd_role = 'Peran wajib dipilih';
    if (!form.value.kd_dept) errs.kd_dept = 'Departemen wajib dipilih';

    if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
        errs.email = 'Format email tidak valid';
    }

    if (!props.isEditing) {
        if (!form.value.password) {
            errs.password = 'Password wajib diisi untuk akun baru';
        } else if (form.value.password.length < 8) {
            errs.password = 'Password minimal 8 karakter';
        }
    } else if (form.value.password && form.value.password.length < 8) {
        errs.password = 'Password minimal 8 karakter';
    }

    if (deactivating.value) {
        const problem = statusFormProblem({ reason: form.value.status_reason, note: form.value.status_note });
        if (problem) errs.status_reason = problem;
    }

    formErrors.value = errs;
    return Object.keys(errs).length === 0;
}

async function saveAccount() {
    if (!validateForm()) return;
    saving.value = true;
    try {
        const payload = {
            username: form.value.username.trim(),
            nama: form.value.nama.trim(),
            email: form.value.email?.trim() || undefined,
            namecode: form.value.namecode?.trim() || undefined,
            kd_dept: form.value.kd_dept,
            position: form.value.position?.trim() || undefined,
            supervisor_id: form.value.supervisor_id || undefined,
            kd_role: form.value.kd_role,
            join_date: toIso(form.value.join_date),
            employment_status: form.value.employment_status || '',
            status: form.value.status
        };

        if (form.value.password) {
            payload.password = form.value.password;
        }
        if (deactivating.value) {
            payload.status_reason = form.value.status_reason;
            payload.status_note = form.value.status_note?.trim() || undefined;
        }

        if (props.isEditing) {
            payload.uid_user_system = form.value.uid_user_system;
            await adminService.updateUser(payload);
            toast.add({
                severity: 'success',
                summary: 'Berhasil',
                detail: `Akun ${payload.nama} berhasil diperbarui`,
                life: 3000
            });
        } else {
            await adminService.createUser(payload);
            toast.add({
                severity: 'success',
                summary: 'Berhasil',
                detail: `Akun baru ${payload.nama} berhasil dibuat`,
                life: 3000
            });
        }

        emit('update:visible', false);
        emit('saved');
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Menyimpan',
            detail: err.message || 'Terjadi kesalahan saat menyimpan akun',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="isEditing ? 'Ubah Akun & Hak Akses Pengguna' : 'Tambah Akun Pengguna Baru'"
        :breakpoints="{ '960px': '75vw', '640px': '92vw' }"
        :style="{ width: '540px' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-3.5 pt-2 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block font-medium mb-1">Username <span class="text-rose-500">*</span></label>
                    <InputText
                        v-model="form.username"
                        class="w-full text-xs"
                        placeholder="Kosongkan untuk memakai NIK"
                        :disabled="isEditing"
                    />
                    <small v-if="formErrors.username" class="text-rose-500 text-[11px]">{{ formErrors.username }}</small>
                </div>
                <div>
                    <label class="block font-medium mb-1">NIK / ID Pegawai</label>
                    <InputText v-model="form.namecode" class="w-full text-xs" placeholder="Contoh: 24011021 / OS24980032" />
                    <small v-if="formErrors.namecode" class="text-rose-500 text-[11px]">{{ formErrors.namecode }}</small>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block font-medium mb-1">Nama Lengkap <span class="text-rose-500">*</span></label>
                    <InputText v-model="form.nama" class="w-full text-xs" placeholder="Nama Lengkap" />
                    <small v-if="formErrors.nama" class="text-rose-500 text-[11px]">{{ formErrors.nama }}</small>
                </div>
                <div>
                    <label class="block font-medium mb-1">Email</label>
                    <InputText v-model="form.email" type="email" class="w-full text-xs" placeholder="nama@inalum.co.id" />
                    <small v-if="formErrors.email" class="text-rose-500 text-[11px]">{{ formErrors.email }}</small>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block font-medium mb-1">Departemen <span class="text-rose-500">*</span></label>
                    <Select
                        v-model="form.kd_dept"
                        :options="deptSelectOptions"
                        optionLabel="nm_dept"
                        optionValue="kd_dept"
                        :disabled="Boolean(adminDivision)"
                        placeholder="Pilih Departemen"
                        class="w-full text-xs"
                    />
                    <small v-if="formErrors.kd_dept" class="text-rose-500 text-[11px]">{{ formErrors.kd_dept }}</small>
                </div>
                <div>
                    <label class="block font-medium mb-1">Jabatan / Posisi</label>
                    <InputText v-model="form.position" class="w-full text-xs" placeholder="Staff IT / Analis" />
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label for="account-join" class="block font-medium mb-1">Tanggal Masuk</label>
                    <DatePicker v-model="form.join_date" inputId="account-join" dateFormat="dd M yy" showIcon iconDisplay="input" placeholder="Pilih tanggal" fluid />
                </div>
                <div>
                    <label for="account-employment" class="block font-medium mb-1">Status Kepegawaian</label>
                    <Select
                        v-model="form.employment_status"
                        inputId="account-employment"
                        :options="EMPLOYMENT_OPTIONS"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full text-xs"
                    />
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block font-medium mb-1">Peran Pengguna <span class="text-rose-500">*</span></label>
                    <Select
                        v-model="form.kd_role"
                        :options="roleOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Pilih Peran"
                        class="w-full text-xs"
                    />
                    <small v-if="formErrors.kd_role" class="text-rose-500 text-[11px]">{{ formErrors.kd_role }}</small>
                </div>
                <div>
                    <label class="block font-medium mb-1">Atasan Langsung</label>
                    <Select
                        v-model="form.supervisor_id"
                        :options="supervisorOptions"
                        optionLabel="label"
                        optionValue="value"
                        filter
                        placeholder="Pilih Atasan"
                        class="w-full text-xs"
                    />
                    <p class="text-[11px] text-muted-color mt-1">Informasi struktur saja; approver cuti diatur di menu Alur Approval.</p>
                </div>
            </div>

            <div>
                <label class="block font-medium mb-1">
                    {{ isEditing ? 'Password Baru (kosongkan jika tidak ingin mengubah)' : 'Password Akun *' }}
                </label>
                <InputText
                    v-model="form.password"
                    type="password"
                    class="w-full text-xs"
                    placeholder="Minimal 8 karakter"
                />
                <small v-if="formErrors.password" class="text-rose-500 text-[11px]">{{ formErrors.password }}</small>
            </div>

            <div v-if="!form.is_super" class="flex items-center gap-2 pt-1">
                <input
                    type="checkbox"
                    id="formStatus"
                    :checked="form.status === 'A'"
                    @change="form.status = $event.target.checked ? 'A' : 'N'"
                    class="cursor-pointer rounded text-primary focus:ring-primary"
                />
                <label for="formStatus" class="font-medium cursor-pointer">
                    Status Akun Aktif
                </label>
            </div>

            <div v-if="deactivating" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label for="form-status-reason" class="block font-medium mb-1">Alasan Nonaktif <span class="text-rose-500">*</span></label>
                    <Select
                        inputId="form-status-reason"
                        v-model="form.status_reason"
                        :options="STATUS_REASON_OPTIONS"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Pilih alasan"
                        class="w-full text-xs"
                    />
                </div>
                <div>
                    <label class="block font-medium mb-1">Keterangan<span v-if="form.status_reason === 'LAINNYA'" class="text-rose-500"> *</span></label>
                    <InputText v-model="form.status_note" class="w-full text-xs" placeholder="Mis. kontrak berakhir 30 Sep 2026" />
                </div>
                <small v-if="formErrors.status_reason" class="sm:col-span-2 text-rose-500 text-[11px]">{{ formErrors.status_reason }}</small>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Batal"
                    severity="secondary"
                    size="small"
                    text
                    @click="emit('update:visible', false)"
                />
                <Button
                    :label="isEditing ? 'Simpan Perubahan' : 'Buat Akun'"
                    severity="primary"
                    size="small"
                    class="font-bold"
                    :loading="saving"
                    @click="saveAccount"
                />
            </div>
        </template>
    </Dialog>
</template>
