<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService } from '@/service/adminService';
import {
    getAdminDivision,
    currentUser,
    isSuperAdmin,
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    STATUS_OPTIONS,
    sicutiState
} from '@/service/sicutiService';
import LeaveDetailDialog from '../leave/LeaveDetailDialog.vue';
import { downloadReportCsv } from './reportExport';
import { useToast } from 'primevue/usetoast';
import {
    Activity,
    Search,
    Eye,
    RefreshCw,
    Download
} from 'lucide-vue-next';

const toast = useToast();
const loading = ref(false);
const requests = ref([]);
const leaveTypes = ref([]);
const departments = ref([]);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

// Filters
const searchQuery = ref('');
const statusFilter = ref(null);
const leaveTypeFilter = ref(null);
const departmentFilter = ref(null);
// Rentang tanggal cuti (backlog E36): pengajuan yang periodenya bersinggungan dengan rentang
const dateRange = ref(null);
const exporting = ref(false);

function iso(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const rangeStart = computed(() => iso(dateRange.value?.[0]));
const rangeEnd = computed(() => iso(dateRange.value?.[1] || dateRange.value?.[0]));

// Detail Dialog
const selectedRequest = ref(null);
const detailVisible = ref(false);

const statusOptions = STATUS_OPTIONS;

async function loadData() {
    loading.value = true;
    try {
        const [leavesData, typesData, deptsData] = await Promise.all([
            adminService.getMonitoringLeaves(),
            adminService.getLeaveTypes().catch(() => []),
            adminService.getDepartments().catch(() => [])
        ]);

        requests.value = Array.isArray(leavesData) ? leavesData : [];
        leaveTypes.value = Array.isArray(typesData) ? typesData : [];
        departments.value = Array.isArray(deptsData) ? deptsData : [];
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Data',
            detail: err.message || 'Gagal mengambil data pemantauan cuti',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

const leaveTypeOptions = computed(() => {
    return [
        { label: 'Semua Jenis Cuti', value: null },
        ...leaveTypes.value.map((t) => ({
            label: t.nm_leave_type || t.name,
            value: t.kd_leave_type || t.id
        }))
    ];
});

const filteredRequests = computed(() => {
    return requests.value.filter((r) => {
        // Scoped department
        const targetDept = adminDivision.value || departmentFilter.value;
        if (targetDept && r.kd_dept !== targetDept) {
            return false;
        }

        // Status filter
        if (statusFilter.value && r.status !== statusFilter.value) {
            return false;
        }

        // Leave type filter
        if (leaveTypeFilter.value && r.kd_leave_type !== leaveTypeFilter.value) {
            return false;
        }

        // Rentang tanggal
        const s = String(r.start_date || '').slice(0, 10);
        const e = String(r.end_date || r.start_date || '').slice(0, 10);
        if (rangeStart.value && e < rangeStart.value) return false;
        if (rangeEnd.value && s > rangeEnd.value) return false;

        // Search query: employee name, NIK, or request ID
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const id = (r.id_request || r.id || '').toLowerCase();
            const name = (r.requester_name || r.userName || '').toLowerCase();
            const nik = (r.namecode || '').toLowerCase();
            const reason = (r.reason || '').toLowerCase();
            if (!id.includes(q) && !name.includes(q) && !nik.includes(q) && !reason.includes(q)) {
                return false;
            }
        }

        return true;
    });
});

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}

// Ekspor dari backend dengan filter yang sama, format sama dengan halaman Laporan
async function exportSimpleCSV() {
    exporting.value = true;
    try {
        await downloadReportCsv({
            type: 'leave-request',
            kd_dept: adminDivision.value || departmentFilter.value || undefined,
            status: statusFilter.value || undefined,
            kd_leave_type: leaveTypeFilter.value || undefined,
            start_date: rangeStart.value,
            end_date: rangeEnd.value,
            search: searchQuery.value.trim() || undefined
        });
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: `Data pemantauan (${filteredRequests.value.length} pengajuan) diunduh sebagai CSV`, life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Ekspor Gagal', detail: err.message || 'Coba lagi beberapa saat.', life: 4000 });
    } finally {
        exporting.value = false;
    }
}

onMounted(() => {
    loadData();
});
watch(() => sicutiState.dataVersion, loadData);
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <Activity class="text-primary w-5 h-5" />
                    <span>Pemantauan Pengajuan Cuti</span>
                </h2>
                <p class="text-xs text-muted-color">
                    Pantau pengajuan cuti karyawan
                    <span v-if="adminDivision" class="font-bold text-primary">Divisi {{ adminDivision }}</span>
                    secara real-time
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
                    severity="success"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    :loading="exporting"
                    @click="exportSimpleCSV"
                >
                    <Download :size="14" :stroke-width="2" />
                    <span>Ekspor CSV</span>
                </Button>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col gap-3 shadow-sm">
            <div class="flex flex-wrap items-center gap-3">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText
                        v-model="searchQuery"
                        placeholder="Cari ID / Nama / NIK..."
                        class="w-full text-xs"
                        size="small"
                    />
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
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />

                <Select
                    v-model="statusFilter"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Status"
                    class="w-full sm:w-48 text-xs"
                    size="small"
                />

                <Select
                    v-model="leaveTypeFilter"
                    :options="leaveTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Jenis Cuti"
                    class="w-full sm:w-48 text-xs"
                    size="small"
                />

                <DatePicker
                    v-model="dateRange"
                    selectionMode="range"
                    :manualInput="false"
                    dateFormat="dd M yy"
                    placeholder="Rentang tanggal cuti"
                    showIcon
                    showButtonBar
                    class="w-full sm:w-64 text-xs"
                    inputClass="text-xs"
                    aria-label="Rentang tanggal cuti"
                />
            </div>
            <div class="text-xs text-muted-color text-right">
                Menampilkan <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredRequests.length }}</span> pengajuan
            </div>
        </div>

        <!-- DataTable Monitoring -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredRequests"
                :loading="loading"
                paginator
                :rows="10"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color">Tidak ada pengajuan cuti yang sesuai filter.</div>
                </template>

                <Column header="No. Pengajuan" style="width: 14%">
                    <template #body="{ data }">
                        <span class="font-mono font-bold text-surface-900 dark:text-surface-100">
                            {{ data.id_request || data.id }}
                        </span>
                        <div class="text-[11px] text-muted-color">
                            {{ formatDate(data.created_at || data.createdAt) }}
                        </div>
                    </template>
                </Column>

                <Column header="Karyawan" style="width: 22%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">
                            {{ data.requester_name || data.userName }}
                        </div>
                        <div class="text-[11px] text-muted-color">
                            NIK: {{ data.namecode || '-' }}
                            <span v-if="data.kd_dept"> · {{ data.kd_dept }}</span>
                        </div>
                    </template>
                </Column>

                <Column header="Jenis Cuti" style="width: 16%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-800 dark:text-surface-200">
                            {{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type }}
                        </span>
                    </template>
                </Column>

                <Column header="Rentang Tanggal" style="width: 20%">
                    <template #body="{ data }">
                        <div>{{ formatDate(data.start_date || data.startDate) }} s/d {{ formatDate(data.end_date || data.endDate) }}</div>
                        <div class="text-[11px] font-bold text-primary">
                            {{ data.total_days || data.totalDays }} Hari Kerja
                        </div>
                    </template>
                </Column>

                <Column header="Status" style="width: 16%">
                    <template #body="{ data }">
                        <Tag
                            :value="getStatusLabel(data.status)"
                            :severity="getStatusSeverity(data.status)"
                            class="text-[11px]"
                        />
                    </template>
                </Column>

                <Column header="Aksi" style="width: 12%">
                    <template #body="{ data }">
                        <Button
                            size="small"
                            severity="secondary"
                            text
                            class="text-xs font-semibold py-1 px-2.5 flex items-center gap-1"
                            @click="viewDetail(data)"
                            title="Lihat Detail"
                        >
                            <Eye :size="14" />
                            <span>Detail</span>
                        </Button>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Detail Dialog -->
        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            @refresh="loadData"
        />
    </div>
</template>
