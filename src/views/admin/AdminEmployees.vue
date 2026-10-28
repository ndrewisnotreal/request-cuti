<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, can } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { Search, Users, RefreshCw, FileSpreadsheet } from 'lucide-vue-next';
import { downloadExcel } from '@/utils/reportExport';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import StatusHistoryDialog from '@/components/admin/StatusHistoryDialog.vue';
import { isAccountActive, statusSummary } from '@/service/statusReason';

const toast = useToast();
const loading = ref(false);
const exporting = ref(false);
const employees = ref([]);
const searchQuery = ref('');
const departmentFilter = ref(null);
const statusFilter = ref(null);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
const canManage = computed(() => isSuper.value || can('master_data.manage_employees'));

const deptOptions = [
    { label: 'Semua Divisi', value: null },
    { label: 'Divisi SIT', value: 'SIT' },
    { label: 'Divisi SIS', value: 'SIS' }
];

const statusOptions = [
    { label: 'Semua Status', value: null },
    { label: 'Aktif', value: 'A' },
    { label: 'Nonaktif', value: 'N' }
];

const historyDialog = ref({ visible: false, user: null });
function openHistory(emp) {
    historyDialog.value = { visible: true, user: emp };
}

async function exportExcel() {
    const count = filteredEmployees.value.length;
    if (!count) {
        toast.add({ severity: 'warn', summary: 'Tidak ada data', detail: 'Tidak ada karyawan yang sesuai filter untuk diekspor.', life: 3000 });
        return;
    }
    exporting.value = true;
    try {
        await downloadExcel(
            '/master/user/export',
            {
                kd_dept: adminDivision.value || departmentFilter.value || undefined,
                status: statusFilter.value || undefined,
                search: searchQuery.value.trim() || undefined
            },
            'data_karyawan.xlsx'
        );
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: `${count} data karyawan diekspor ke Excel.`, life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Ekspor', detail: err.message || 'Coba lagi beberapa saat.', life: 4000 });
    } finally {
        exporting.value = false;
    }
}

function tenure(joinDate) {
    if (!joinDate) return 'tanggal masuk belum diisi';
    const start = new Date(String(joinDate).slice(0, 10));
    if (Number.isNaN(start.getTime())) return '-';
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months--;
    if (months < 0) return 'belum mulai bekerja';
    const y = Math.floor(months / 12);
    const m = months % 12;
    return [y ? `${y} tahun` : '', m ? `${m} bulan` : '', !y && !m ? 'kurang dari 1 bulan' : ''].filter(Boolean).join(' ');
}

async function loadEmployees() {
    loading.value = true;
    try {
        const data = await adminService.getEmployees();
        employees.value = Array.isArray(data) ? data : [];
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Data',
            detail: err.message || 'Gagal mengambil data karyawan',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

const filteredEmployees = computed(() => {
    return employees.value.filter((emp) => {
        const targetDept = adminDivision.value || departmentFilter.value;
        if (targetDept && (emp.kd_dept || emp.department) !== targetDept) {
            return false;
        }

        if (statusFilter.value) {
            const st = emp.status_user || emp.status || (emp.isActive !== false ? 'A' : 'N');
            if (st !== statusFilter.value) return false;
        }

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const name = (emp.nama || emp.name || '').toLowerCase();
            const nik = (emp.namecode || emp.username || '').toLowerCase();
            const email = (emp.email || '').toLowerCase();
            const pos = (emp.position || '').toLowerCase();
            if (!name.includes(q) && !nik.includes(q) && !email.includes(q) && !pos.includes(q)) {
                return false;
            }
        }

        return true;
    });
});

onMounted(() => {
    loadEmployees();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="data karyawan" />
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <Users class="text-primary w-5 h-5" />
                    <span>Data Karyawan</span>
                </h1>
                <p class="text-xs text-muted-color">Direktori data pegawai (NIK, Nama, Email, Jabatan, Departemen, Status, dan Atasan)</p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    :loading="loading"
                    @click="loadEmployees"
                >
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
                <Button data-tour="export-excel"
                    severity="success"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    :disabled="loading"
                    :loading="exporting"
                    @click="exportExcel"
                >
                    <FileSpreadsheet :size="14" :stroke-width="2" />
                    <span>Ekspor Excel</span>
                </Button>
            </div>
        </div>

        <div data-tour="emp-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText id="cari-karyawan" name="cari-karyawan" aria-label="Cari karyawan berdasarkan nama, NIK, atau email" v-model="searchQuery" placeholder="Cari Nama / NIK / Email..." class="w-full text-xs" size="small" />
                </IconField>

                <div v-if="adminDivision" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 flex items-center gap-1.5">
                    <span class="text-muted-color">Divisi:</span>
                    <span class="text-primary font-bold">{{ adminDivision }}</span>
                </div>
                <Select
                    v-else-if="isSuper"
                    v-model="departmentFilter"
                    :options="deptOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Divisi"
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />

                <Select
                    v-model="statusFilter"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Status"
                    class="w-full sm:w-36 text-xs"
                    size="small"
                />
            </div>
            <div class="text-xs text-muted-color w-full sm:w-auto text-right">
                Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredEmployees.length }}</span> Karyawan
            </div>
        </div>

        <div data-tour="emp-table" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredEmployees"
                :loading="loading"
                paginator
                :rows="10"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color">Tidak ada data karyawan ditemukan.</div>
                </template>

                <Column header="NIK / Username" style="width: 15%">
                    <template #body="{ data }">
                        <span class="font-mono font-bold text-surface-900 dark:text-surface-100">
                            {{ data.namecode || data.username }}
                        </span>
                    </template>
                </Column>

                <Column header="Nama Lengkap & Email" style="width: 25%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nama || data.name }}</div>
                        <div class="text-[11px] text-muted-color">{{ data.email || '-' }}</div>
                    </template>
                </Column>

                <Column header="Departemen / Divisi" style="width: 14%">
                    <template #body="{ data }">
                        <Tag
                            :value="data.kd_dept || data.nm_dept || data.department || '-'"
                            severity="info"
                            class="text-[11px] uppercase font-bold"
                        />
                    </template>
                </Column>

                <Column header="Jabatan" style="width: 18%">
                    <template #body="{ data }">
                        <span class="text-surface-800 dark:text-surface-200">{{ data.position || '-' }}</span>
                        <div class="text-[11px] text-muted-color">
                            {{ data.employment_status || 'Status belum diisi' }} · {{ tenure(data.join_date) }}
                        </div>
                    </template>
                </Column>

                <Column header="Atasan Langsung" style="width: 18%">
                    <template #body="{ data }">
                        <span v-if="data.supervisor_nama" class="font-medium text-surface-700 dark:text-surface-300">
                            {{ data.supervisor_nama }}
                        </span>
                        <span v-else class="text-muted-color text-[11px]">-</span>
                    </template>
                </Column>

                <Column header="Status" style="width: 10%" :pt="{ headerCell: { 'data-tour': 'emp-col-status' } }">
                    <template #body="{ data }">
                        <Tag
                            v-if="data.is_locked"
                            value="Terkunci"
                            severity="danger"
                            class="text-[11px]"
                        />
                        <Tag
                            v-else
                            :value="isAccountActive(data) ? 'Aktif' : 'Nonaktif'"
                            :severity="isAccountActive(data) ? 'success' : 'secondary'"
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
            </DataTable>
        </div>

        <StatusHistoryDialog v-model:visible="historyDialog.visible" :user="historyDialog.user" />
    </div>
</template>
