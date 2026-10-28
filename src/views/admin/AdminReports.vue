<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import api from '@/service/api';
import { adminService } from '@/service/adminService';
import {
    getAdminDivision,
    currentUser,
    isSuperAdmin,
    formatDate,
    getStatusLabel,
    STATUS_OPTIONS,
    YEAR_OPTIONS
} from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { downloadExcel, printReportPdf } from '@/utils/reportExport';
import {
    FileSpreadsheet,
    FileText,
    Calendar,
    Search,
    RefreshCw,
    BarChart3,
    Wallet,
    PieChart
} from 'lucide-vue-next';
import ReportLeaveHistoryTable from '@/components/admin/reports/ReportLeaveHistoryTable.vue';
import ReportBalanceTable from '@/components/admin/reports/ReportBalanceTable.vue';
import ReportLeaveTypeSummary from '@/components/admin/reports/ReportLeaveTypeSummary.vue';

const toast = useToast();
const loading = ref(false);
const exporting = ref(false);
const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

const activeTab = ref(0);

const leaveReports = ref([]);
const balanceReports = ref([]);
const typeSummary = ref([]);
const leaveTypes = ref([]);
const departments = ref([]);

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;
const departmentFilter = ref(null);
const leaveTypeFilter = ref(null);
const statusFilter = ref(null);
const searchQuery = ref('');
const dateRange = ref(null);
const statusOptions = STATUS_OPTIONS;

function iso(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const rangeStart = computed(() => iso(dateRange.value?.[0]));
const rangeEnd = computed(() => iso(dateRange.value?.[1] || dateRange.value?.[0]));
const targetDept = computed(() => adminDivision.value || departmentFilter.value || null);

const exportParams = computed(() => ({
    year: selectedYear.value,
    kd_dept: targetDept.value || undefined,
    kd_leave_type: leaveTypeFilter.value || undefined,
    status: statusFilter.value || undefined,
    start_date: rangeStart.value,
    end_date: rangeEnd.value,
    search: searchQuery.value.trim() || undefined
}));

async function loadSummary() {
    try {
        const res = await api.get('/sicuti/report/leave-type-summary', {
            year: selectedYear.value,
            kd_dept: targetDept.value || undefined,
            start_date: rangeStart.value,
            end_date: rangeEnd.value
        });
        typeSummary.value = Array.isArray(res?.data) ? res.data : [];
    } catch {
        typeSummary.value = [];
    }
}

async function loadData() {
    loading.value = true;
    try {
        const [repData, balData, typesData, deptsData] = await Promise.all([
            adminService.getLeaveRequests({ year: selectedYear.value }),
            adminService.getBalances(selectedYear.value).catch(() => []),
            adminService.getLeaveTypes().catch(() => []),
            adminService.getDepartments().catch(() => [])
        ]);
        leaveReports.value = Array.isArray(repData) ? repData : [];
        balanceReports.value = Array.isArray(balData) ? balData : [];
        leaveTypes.value = Array.isArray(typesData) ? typesData : [];
        departments.value = Array.isArray(deptsData) ? deptsData : [];
        await loadSummary();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Memuat Laporan', detail: err.message || 'Gagal mengambil data laporan cuti', life: 3000 });
    } finally {
        loading.value = false;
    }
}

watch(selectedYear, loadData);
watch([departmentFilter, dateRange], loadSummary);

const leaveTypeOptions = computed(() => [
    { label: 'Semua Jenis Cuti', value: null },
    ...leaveTypes.value.map((t) => ({ label: t.nm_leave_type || t.name, value: t.kd_leave_type || t.id }))
]);

const filteredLeaveReports = computed(() =>
    leaveReports.value.filter((r) => {
        if (targetDept.value && r.kd_dept !== targetDept.value) return false;
        if (leaveTypeFilter.value && r.kd_leave_type !== leaveTypeFilter.value) return false;
        if (statusFilter.value && r.status !== statusFilter.value) return false;
        const s = String(r.start_date || '').slice(0, 10);
        const e = String(r.end_date || r.start_date || '').slice(0, 10);
        if (rangeStart.value && e < rangeStart.value) return false;
        if (rangeEnd.value && s > rangeEnd.value) return false;
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const hay = `${r.requester_name || ''} ${r.namecode || ''} ${r.id_request || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    })
);

const filteredBalanceReports = computed(() =>
    balanceReports.value.filter((b) => {
        if (targetDept.value && b.kd_dept !== targetDept.value) return false;
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            if (!`${b.nama || ''} ${b.namecode || ''}`.toLowerCase().includes(q)) return false;
        }
        return true;
    })
);

const remaining = (b) => (b.remaining !== undefined ? b.remaining : Number(b.annual_quota || 0) + Number(b.carry_over_days || 0) - Number(b.used_days || 0));
const scopeLabel = computed(() => {
    const parts = [targetDept.value ? `Divisi ${targetDept.value}` : 'Semua divisi', `Tahun ${selectedYear.value}`];
    if (rangeStart.value) parts.push(`${formatDate(rangeStart.value)} – ${formatDate(rangeEnd.value)}`);
    return parts.join(' · ');
});

async function exportExcel() {
    exporting.value = true;
    try {
        const types = ['leave-request', 'leave-balance', 'leave-type-summary'];
        const filenames = [
            `laporan_cuti_${selectedYear.value}.xlsx`,
            `rekap_saldo_${selectedYear.value}.xlsx`,
            `rekap_jenis_cuti_${selectedYear.value}.xlsx`
        ];
        await downloadExcel('/sicuti/report/export', { type: types[activeTab.value], ...exportParams.value }, filenames[activeTab.value]);
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: 'Berkas Excel berhasil diunduh.', life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Ekspor', detail: err.message, life: 4000 });
    } finally {
        exporting.value = false;
    }
}

function exportPdf() {
    const configs = [
        {
            title: 'Laporan Rekapitulasi Riwayat Cuti',
            filename: `laporan_cuti_${selectedYear.value}`,
            rows: filteredLeaveReports.value,
            columns: [
                { header: 'No. Pengajuan', value: (r) => r.id_request },
                { header: 'Nama', value: (r) => r.requester_name },
                { header: 'NIK', value: (r) => r.namecode || '-' },
                { header: 'Divisi', value: (r) => r.kd_dept || '-' },
                { header: 'Jenis Cuti', value: (r) => r.nm_leave_type },
                { header: 'Mulai', value: (r) => formatDate(r.start_date) },
                { header: 'Selesai', value: (r) => formatDate(r.end_date) },
                { header: 'Hari', value: (r) => r.total_days },
                { header: 'Status', value: (r) => getStatusLabel(r.status) }
            ]
        },
        {
            title: 'Laporan Rekapitulasi Saldo Cuti Karyawan',
            filename: `rekap_saldo_${selectedYear.value}`,
            rows: filteredBalanceReports.value,
            columns: [
                { header: 'NIK', value: (b) => b.namecode || '-' },
                { header: 'Nama Karyawan', value: (b) => b.nama },
                { header: 'Divisi', value: (b) => b.kd_dept || '-' },
                { header: 'Kuota', value: (b) => b.annual_quota },
                { header: 'Carry Over', value: (b) => b.carry_over_days || 0 },
                { header: 'Terpakai', value: (b) => b.used_days || 0 },
                { header: 'Sisa', value: remaining }
            ]
        },
        {
            title: 'Laporan Rekap Penggunaan per Jenis Cuti',
            filename: `rekap_jenis_cuti_${selectedYear.value}`,
            rows: typeSummary.value,
            columns: [
                { header: 'Jenis Cuti', value: (s) => s.nm_leave_type },
                { header: 'Total Pengajuan', value: (s) => s.total },
                { header: 'Disetujui', value: (s) => s.approved },
                { header: 'Ditolak', value: (s) => s.rejected },
                { header: 'Dibatalkan', value: (s) => s.cancelled },
                { header: 'Dalam Proses', value: (s) => s.pending },
                { header: 'Total Hari Disetujui', value: (s) => s.approved_days }
            ]
        }
    ];
    const cfg = configs[activeTab.value];
    if (!printReportPdf({ ...cfg, subtitle: scopeLabel.value })) {
        toast.add({ severity: 'warn', summary: 'Jendela Diblokir', detail: 'Izinkan pop-up untuk mencetak laporan PDF.', life: 4000 });
    }
}

onMounted(loadData);
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <BarChart3 class="text-primary w-5 h-5" />
                    <span>Laporan & Ekspor Data Cuti</span>
                </h1>
                <p class="text-xs text-muted-color">
                    Rekapitulasi riwayat pengajuan, saldo, dan penggunaan per jenis cuti
                    <span v-if="adminDivision" class="font-bold text-primary">Divisi {{ adminDivision }}</span>
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Button severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5" :loading="loading" @click="loadData">
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
                <Button data-tour="rep-pdf" severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5" @click="exportPdf">
                    <FileText :size="14" :stroke-width="1.75" />
                    <span>Ekspor PDF</span>
                </Button>
                <Button data-tour="export-excel" severity="success" size="small" class="text-xs font-bold flex items-center gap-1.5" :loading="exporting" @click="exportExcel">
                    <FileSpreadsheet :size="14" :stroke-width="2" />
                    <span>Ekspor Excel</span>
                </Button>
            </div>
        </div>

        <div data-tour="rep-tabs" class="flex flex-wrap items-center gap-2 border-b border-surface-200 dark:border-surface-700 pb-2" role="tablist" aria-label="Jenis laporan">
            <button
                v-for="(t, i) in [
                    { label: 'Rekapitulasi Riwayat Cuti', icon: Calendar, count: filteredLeaveReports.length },
                    { label: 'Rekapitulasi Saldo Karyawan', icon: Wallet, count: filteredBalanceReports.length },
                    { label: 'Rekap per Jenis Cuti', icon: PieChart, count: typeSummary.length }
                ]"
                :key="t.label"
                type="button"
                role="tab"
                :aria-selected="activeTab === i"
                :class="[
                    'px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2',
                    activeTab === i ? 'bg-primary text-white shadow-sm' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                ]"
                @click="activeTab = i"
            >
                <component :is="t.icon" :size="14" />
                <span>{{ t.label }}</span>
                <span class="ml-1 px-1.5 rounded-full text-[11px]" :class="activeTab === i ? 'bg-white/20 text-white' : 'bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300'">
                    {{ t.count }}
                </span>
            </button>
        </div>

        <div data-tour="rep-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <div class="flex flex-wrap items-center gap-3">
                <IconField v-if="activeTab !== 2" iconPosition="left" class="w-full sm:w-60">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText id="cari-laporan" name="cari-laporan" aria-label="Cari laporan berdasarkan karyawan atau NIK" v-model="searchQuery" placeholder="Cari Karyawan / NIK..." class="w-full text-xs" size="small" />
                </IconField>
                <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" placeholder="Pilih Tahun" class="w-full sm:w-36 text-xs" size="small" />
                <div
                    v-if="adminDivision"
                    class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700"
                >
                    <span class="text-muted-color">Divisi:</span> <span class="text-primary font-bold">{{ adminDivision }}</span>
                </div>
                <Select
                    v-else-if="isSuper"
                    v-model="departmentFilter"
                    :options="[{ label: 'Semua Divisi', value: null }, ...departments.map((d) => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Divisi"
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />
                <DatePicker
                    v-if="activeTab !== 1"
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
                <template v-if="activeTab === 0">
                    <Select v-model="leaveTypeFilter" :options="leaveTypeOptions" optionLabel="label" optionValue="value" placeholder="Jenis Cuti" class="w-full sm:w-44 text-xs" size="small" />
                    <Select v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Pilih Status" class="w-full sm:w-44 text-xs" size="small" />
                </template>
            </div>
        </div>

        <ReportLeaveHistoryTable data-tour="rep-table"
            v-if="activeTab === 0"
            :items="filteredLeaveReports"
            :loading="loading"
        />

        <ReportBalanceTable data-tour="rep-table"
            v-else-if="activeTab === 1"
            :items="filteredBalanceReports"
            :loading="loading"
        />

        <ReportLeaveTypeSummary data-tour="rep-table"
            v-else
            :items="typeSummary"
            :loading="loading"
        />
    </div>
</template>
