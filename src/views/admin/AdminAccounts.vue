<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { rbacService } from '@/service/rbacService';
import { currentUser, getAdminDivision, isSuperAdmin } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { statusSummary } from '@/service/statusReason';
import { formatDate } from '@/utils/dateUtils';
import StatusHistoryDialog from '@/components/admin/StatusHistoryDialog.vue';
import AccountFormDialog from '@/components/admin/AccountFormDialog.vue';
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog.vue';
import DeactivateAccountDialog from '@/components/admin/DeactivateAccountDialog.vue';
import {
    Plus,
    Pencil,
    Search,
    Shield,
    KeyRound,
    Unlock,
    ToggleLeft,
    ToggleRight,
    RefreshCw,
    History
} from 'lucide-vue-next';

const toast = useToast();
const loading = ref(false);
const users = ref([]);
const roles = ref([]);
const departments = ref([]);
const searchQuery = ref('');
const departmentFilter = ref(null);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

const formDialogVisible = ref(false);
const isEditing = ref(false);
const selectedUser = ref(null);

const resetPasswordVisible = ref(false);
const resetPasswordUser = ref(null);

const historyDialog = ref({ visible: false, user: null });
const deactivateDialog = ref({ visible: false, user: null });

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
    selectedUser.value = null;
    isEditing.value = false;
    formDialogVisible.value = true;
}

function openEdit(u) {
    selectedUser.value = u;
    isEditing.value = true;
    formDialogVisible.value = true;
}

function openResetPassword(u) {
    resetPasswordUser.value = u;
    resetPasswordVisible.value = true;
}

function openHistory(u) {
    historyDialog.value = { visible: true, user: u };
}

function toggleUserActive(u) {
    const nextStatus = (u.status_user === 'A' || u.status === 'A') ? 'N' : 'A';
    if (nextStatus === 'A') return applyUserStatus(u, nextStatus);
    deactivateDialog.value = { visible: true, user: u };
}

async function applyUserStatus(u, nextStatus, extra = {}) {
    try {
        await adminService.updateUser({
            uid_user_system: u.uid_user_system,
            status: nextStatus,
            ...extra
        });
        toast.add({
            severity: 'info',
            summary: 'Status Diubah',
            detail: `Akun ${u.nama || u.username} ${nextStatus === 'A' ? 'diaktifkan' : 'dinonaktifkan'}`,
            life: 3000
        });
        await loadData();
        return true;
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: err.message || 'Gagal mengubah status akun',
            life: 3000
        });
        return false;
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
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <Shield class="text-primary w-5 h-5" />
                    <span>Manajemen Akun & Peran Pengguna</span>
                </h1>
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
                <Button data-tour="acc-add"
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

        <div data-tour="acc-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText id="cari-akun" name="cari-akun" aria-label="Cari akun berdasarkan nama, username, atau NIK" v-model="searchQuery" placeholder="Cari Nama / Username / NIK..." class="w-full text-xs" size="small" />
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

        <div data-tour="acc-table" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
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

                <Column header="Peran Akses" style="width: 16%" :pt="{ headerCell: { 'data-tour': 'acc-col-role' } }">
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
                        <div class="text-[11px] text-muted-color">
                            <template v-if="data.join_date">Masuk {{ formatDate(data.join_date) }}</template>
                            <template v-else>Tanggal masuk belum diisi</template>
                        </div>
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
                        <button
                            v-if="statusSummary(data)"
                            type="button"
                            class="block mt-1 text-[10px] text-muted-color hover:text-primary text-left leading-tight line-clamp-2 cursor-pointer"
                            :title="'Lihat riwayat status: ' + statusSummary(data)"
                            @click="openHistory(data)"
                        >
                            {{ statusSummary(data) }}
                        </button>
                    </template>
                </Column>

                <Column header="Aksi" style="width: 8%" :pt="{ headerCell: { 'data-tour': 'acc-col-aksi' } }">
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
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openResetPassword(data)"
                                title="Atur Ulang Kata Sandi"
                            >
                                <KeyRound :size="14" :stroke-width="1.75" />
                            </button>

                            <button
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openHistory(data)"
                                title="Riwayat Status"
                            >
                                <History :size="14" :stroke-width="1.75" />
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

        <AccountFormDialog
            v-model:visible="formDialogVisible"
            :is-editing="isEditing"
            :user-data="selectedUser"
            :roles="roles"
            :departments="departments"
            :users="users"
            :admin-division="adminDivision"
            @saved="loadData"
        />

        <ResetPasswordDialog
            v-model:visible="resetPasswordVisible"
            :user="resetPasswordUser"
            @saved="loadData"
        />

        <StatusHistoryDialog
            v-model:visible="historyDialog.visible"
            :user="historyDialog.user"
        />

        <DeactivateAccountDialog
            v-model:visible="deactivateDialog.visible"
            :user="deactivateDialog.user"
            @saved="loadData"
        />
    </div>
</template>
