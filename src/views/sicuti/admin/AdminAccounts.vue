<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminService } from '@/service/adminService';
import { rbacService } from '@/service/rbacService';
import { currentUser, getAdminDivision, isSuperAdmin } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import {
    Plus,
    Pencil,
    Search,
    Shield,
    KeyRound,
    Lock,
    Unlock,
    ToggleLeft,
    ToggleRight,
    RefreshCw
} from 'lucide-vue-next';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const users = ref([]);
const roles = ref([]);
const departments = ref([]);
const searchQuery = ref('');
const departmentFilter = ref(null);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

// Dialog State
const dialogVisible = ref(false);
const isEditing = ref(false);
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
    status: 'A'
});

const EMPLOYMENT_OPTIONS = [
    { label: 'Belum diisi', value: '' },
    { label: 'Tetap', value: 'Tetap' },
    { label: 'Kontrak', value: 'Kontrak' },
    { label: 'Outsourcing', value: 'Outsourcing' }
];
// Peran admin (tanpa NIK karyawan) dikenali dari data peran backend, bukan daftar tetap
function isAdminRole(kdRole) {
    const r = roles.value.find((x) => x.kd_role === kdRole);
    return Boolean(r && (r.is_super || (Number(r.level) > 0 && Number(r.level) <= 15)));
}
const toIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined);
const fromIso = (iso) => {
    const p = String(iso || '').slice(0, 10).split('-').map(Number);
    return p.length === 3 && p.every(Boolean) ? new Date(p[0], p[1] - 1, p[2]) : null;
};

async function loadData() {
    loading.value = true;
    try {
        const [usersData, rolesData, deptsData] = await Promise.all([
            adminService.getUsers(),
            rbacService.getRoles().catch(() => []),
            adminService.getDepartments().catch(() => [])
        ]);

        users.value = Array.isArray(usersData) ? usersData : [];
        roles.value = Array.isArray(rolesData) ? rolesData : [];

        departments.value = Array.isArray(deptsData) ? deptsData : [];
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Data',
            detail: err.message || 'Gagal mengambil data akun & role',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

const deptSelectOptions = computed(() => {
    if (adminDivision.value) {
        return departments.value.filter((d) => d.kd_dept === adminDivision.value);
    }
    return departments.value;
});

const supervisorOptions = computed(() => {
    const list = users.value.filter((u) => {
        if (isEditing.value && u.uid_user_system === form.value.uid_user_system) return false;
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
    roles.value.map((r) => ({
        label: r.nm_role || r.kd_role,
        value: r.kd_role
    }))
);

const filteredUsers = computed(() => {
    return users.value.filter((u) => {
        const targetDept = adminDivision.value || departmentFilter.value;
        if (targetDept && u.kd_dept !== targetDept) return false;

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const name = (u.nama || '').toLowerCase();
            const uname = (u.username || '').toLowerCase();
            const nik = (u.namecode || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const role = (u.nm_role || u.kd_role || '').toLowerCase();
            if (!name.includes(q) && !uname.includes(q) && !nik.includes(q) && !email.includes(q) && !role.includes(q)) {
                return false;
            }
        }
        return true;
    });
});

function openCreate() {
    isEditing.value = false;
    formErrors.value = {};
    const defaultDept = adminDivision.value || departments.value[0]?.kd_dept || '';
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
        status: 'A'
    };
    dialogVisible.value = true;
}

function openEdit(u) {
    isEditing.value = true;
    formErrors.value = {};
    form.value = {
        uid_user_system: u.uid_user_system,
        username: u.username || '',
        email: u.email || '',
        nama: u.nama || '',
        namecode: u.namecode || '',
        kd_dept: u.kd_dept || adminDivision.value || '',
        position: u.position || '',
        supervisor_id: u.supervisor_id || null,
        kd_role: u.kd_role || '',
        join_date: fromIso(u.join_date),
        employment_status: u.employment_status || '',
        password: '',
        status: u.status_user || u.status || 'A',
        is_super: Boolean(u.is_super)
    };
    dialogVisible.value = true;
}

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

    if (!isEditing.value) {
        if (!form.value.password) {
            errs.password = 'Password wajib diisi untuk akun baru';
        } else if (form.value.password.length < 8) {
            errs.password = 'Password minimal 8 karakter';
        }
    } else if (form.value.password && form.value.password.length < 8) {
        errs.password = 'Password minimal 8 karakter';
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

        if (isEditing.value) {
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

        dialogVisible.value = false;
        await loadData();
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

// Menonaktifkan perlu konfirmasi (seperti hapus di halaman lain); mengaktifkan langsung
function toggleUserActive(u) {
    const nextStatus = (u.status_user === 'A' || u.status === 'A') ? 'N' : 'A';
    if (nextStatus === 'A') return applyUserStatus(u, nextStatus);
    confirm.require({
        header: 'Nonaktifkan akun?',
        message: `${u.nama || u.username} tidak bisa login sampai akunnya diaktifkan lagi.`,
        acceptLabel: 'Nonaktifkan',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: () => applyUserStatus(u, nextStatus)
    });
}

async function applyUserStatus(u, nextStatus) {
    try {
        await adminService.updateUser({
            uid_user_system: u.uid_user_system,
            status: nextStatus
        });
        toast.add({
            severity: 'info',
            summary: 'Status Diubah',
            detail: `Akun ${u.nama || u.username} ${nextStatus === 'A' ? 'diaktifkan' : 'dinonaktifkan'}`,
            life: 3000
        });
        await loadData();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: err.message || 'Gagal mengubah status akun',
            life: 3000
        });
    }
}

async function unlockAccount(u) {
    try {
        await adminService.unlockUser(u.uid_user_system);
        toast.add({
            severity: 'success',
            summary: 'Akun Dibuka',
            detail: `Kunci akun ${u.nama || u.username} berhasil dibuka`,
            life: 3000
        });
        await loadData();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: err.message || 'Gagal membuka kunci akun',
            life: 3000
        });
    }
}

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <Shield class="text-primary w-5 h-5" />
                    <span>Manajemen Akun & Peran Pengguna</span>
                </h2>
                <p class="text-xs text-muted-color">
                    Kelola data login, kredensial, penugasan peran, dan atasan karyawan
                    <span v-if="adminDivision" class="font-bold text-primary">({{ adminDivision }})</span>
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    :loading="loading"
                    @click="loadData"
                >
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
                <Button
                    severity="primary"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    @click="openCreate"
                >
                    <Plus :size="14" :stroke-width="2" />
                    <span>Tambah Akun Baru</span>
                </Button>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText v-model="searchQuery" placeholder="Cari Nama / Username / NIK..." class="w-full text-xs" size="small" />
                </IconField>

                <div v-if="adminDivision" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 flex items-center gap-1.5">
                    <span class="text-muted-color">Divisi:</span>
                    <span class="text-primary font-bold">{{ adminDivision }}</span>
                </div>
                <Select
                    v-else-if="isSuper"
                    v-model="departmentFilter"
                    :options="[{ label: 'Semua Divisi', value: null }, ...departments.map(d => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Divisi"
                    class="w-full sm:w-48 text-xs"
                    size="small"
                />
            </div>
            <div class="text-xs text-muted-color w-full sm:w-auto text-right">
                Total Akun: <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredUsers.length }}</span>
            </div>
        </div>

        <!-- DataTable Akun -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredUsers"
                :loading="loading"
                paginator
                :rows="10"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color">Tidak ada akun ditemukan.</div>
                </template>

                <Column header="Pengguna" style="width: 24%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nama || data.username }}</div>
                        <div class="text-[11px] text-muted-color font-mono">
                            {{ data.username }} <span v-if="data.namecode">· NIK: {{ data.namecode }}</span>
                        </div>
                        <div v-if="data.email" class="text-[11px] text-muted-color">{{ data.email }}</div>
                    </template>
                </Column>

                <Column header="Peran Akses" style="width: 16%">
                    <template #body="{ data }">
                        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[11px]">
                            <KeyRound :size="11" />
                            <span>{{ data.nm_role || data.kd_role }}</span>
                        </div>
                    </template>
                </Column>

                <Column header="Departemen" style="width: 12%">
                    <template #body="{ data }">
                        <Tag :value="data.kd_dept || '-'" severity="info" class="text-[11px] font-bold" />
                    </template>
                </Column>

                <Column header="Jabatan" style="width: 16%">
                    <template #body="{ data }">
                        <span class="text-surface-800 dark:text-surface-200">{{ data.position || '-' }}</span>
                    </template>
                </Column>

                <Column header="Atasan Langsung" style="width: 16%">
                    <template #body="{ data }">
                        <span v-if="data.supervisor_nama" class="font-medium text-surface-700 dark:text-surface-300">
                            {{ data.supervisor_nama }}
                        </span>
                        <span v-else class="text-muted-color text-[11px]">-</span>
                    </template>
                </Column>

                <Column header="Status" style="width: 8%">
                    <template #body="{ data }">
                        <Tag
                            v-if="data.is_locked"
                            value="Terkunci"
                            severity="danger"
                            class="text-[11px]"
                        />
                        <Tag
                            v-else
                            :value="(data.status_user === 'A' || data.status === 'A') ? 'Aktif' : 'Nonaktif'"
                            :severity="(data.status_user === 'A' || data.status === 'A') ? 'success' : 'secondary'"
                            class="text-[11px]"
                        />
                    </template>
                </Column>

                <Column header="Aksi" style="width: 8%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openEdit(data)"
                                title="Ubah Akun & Peran"
                            >
                                <Pencil :size="14" :stroke-width="1.75" />
                            </button>

                            <button
                                v-if="data.is_locked"
                                type="button"
                                class="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg transition-colors cursor-pointer"
                                @click="unlockAccount(data)"
                                title="Buka Kunci Akun"
                            >
                                <Unlock :size="14" :stroke-width="1.75" />
                            </button>

                            <!-- Akun Super Admin tidak boleh dinonaktifkan -->
                            <button
                                v-else-if="!data.is_super"
                                type="button"
                                :class="[
                                    'p-1.5 rounded-lg transition-colors cursor-pointer',
                                    (data.status_user === 'A' || data.status === 'A')
                                        ? 'text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20'
                                        : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                ]"
                                @click="toggleUserActive(data)"
                                :title="(data.status_user === 'A' || data.status === 'A') ? 'Nonaktifkan' : 'Aktifkan'"
                            >
                                <component :is="(data.status_user === 'A' || data.status === 'A') ? ToggleRight : ToggleLeft" :size="15" :stroke-width="1.75" />
                            </button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Dialog Create / Edit Akun & Role -->
        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="isEditing ? 'Ubah Akun & Hak Akses Pengguna' : 'Tambah Akun Pengguna Baru'"
            :breakpoints="{ '960px': '75vw', '640px': '92vw' }"
            :style="{ width: '540px' }"
        >
            <div class="space-y-3.5 pt-2 text-xs">
                <!-- Username & NIK -->
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

                <!-- Nama Lengkap & Email -->
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

                <!-- Departemen & Jabatan -->
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

                <!-- Tanggal masuk: periode saldo Staff IT dihitung dari tanggal ini -->
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

                <!-- Role Pengguna & Atasan Langsung -->
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

                <!-- Password -->
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

                <!-- Status Aktif (tidak tersedia untuk akun Super Admin) -->
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
            </div>

            <template #footer>
                <div class="flex justify-end gap-2 pt-2">
                    <Button
                        label="Batal"
                        severity="secondary"
                        size="small"
                        text
                        @click="dialogVisible = false"
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
    </div>
</template>
