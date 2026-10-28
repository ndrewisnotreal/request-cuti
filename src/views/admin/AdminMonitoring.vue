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
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import AdminDashboardMonitoringTable from '@/components/dashboard/AdminDashboardMonitoringTable.vue';
import { downloadExcel } from '@/utils/reportExport';
import { useToast } from 'primevue/usetoast';
import {
    Activity,
    RefreshCw,
    FileSpreadsheet
} from 'lucide-vue-next';

const toast = useToast();
const loading = ref(false);
const requests = ref([]);
const leaveTypes = ref([]);
const departments = ref([]);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

const selectedRequest = ref(null);
const detailVisible = ref(false);
const exporting = ref(false);

async function loadData() {
    loading.value = true;
    try {
        const [leavesData, typesData, deptsData] = await Promise.all([
            adminService.getLeaveRequests(),
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

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}

const tableRef = ref(null);

async function exportExcel() {
    exporting.value = true;
    try {
        const filters = tableRef.value?.exportFilters || {};
        await downloadExcel(
            '/sicuti/report/export',
            { type: 'leave-request', ...filters, kd_dept: adminDivision.value || filters.kd_dept },
            'pemantauan_cuti.xlsx'
        );
        const count = tableRef.value?.filteredCount ?? requests.value.length;
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: `Data pemantauan (${count} pengajuan sesuai filter) diunduh sebagai Excel`, life: 3000 });
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
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <Activity class="text-primary w-5 h-5" />
                    <span>Pemantauan Pengajuan Cuti</span>
                </h1>
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
                    data-tour="export-excel"
                    severity="success"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    :loading="exporting"
                    @click="exportExcel"
                >
                    <FileSpreadsheet :size="14" :stroke-width="2" />
                    <span>Ekspor Excel</span>
                </Button>
            </div>
        </div>

        <AdminDashboardMonitoringTable
            ref="tableRef"
            :requests="requests"
            :loading="loading"
            :admin-division="adminDivision"
            :departments="departments"
            :leave-types="leaveTypes"
            :is-super="isSuper"
            @view-detail="viewDetail"
            @refresh="loadData"
        />

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            @refresh="loadData"
        />
    </div>
</template>
