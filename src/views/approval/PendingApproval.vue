<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    attachmentInfo,
    documentPending,
    sicutiState,
    setPendingApprovalCount,
    isStepApprover
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import LeaveAttachment from '@/components/leave/LeaveAttachment.vue';
import ApprovalActionDialog from '@/components/approval/ApprovalActionDialog.vue';
import { matchesApprovalSearch } from '@/utils/approvalSearch';
import {
    Search,
    CheckCircle2,
    Eye,
    ShieldCheck
} from 'lucide-vue-next';

const loading = ref(false);
const pendingRequests = ref([]);
const selectedRequest = ref(null);
const detailVisible = ref(false);

const searchQuery = ref('');
const departmentFilter = ref(null);
const first = ref(0);
const rows = ref(10);

const paginatedMobileRequests = computed(() => {
    return filteredRequests.value.slice(first.value, first.value + rows.value);
});

watch([searchQuery, departmentFilter], () => {
    first.value = 0;
});
const actionModalVisible = ref(false);
const activeRequest = ref(null);

async function loadPendingApprovals() {
    loading.value = true;
    try {
        const list = await approvalService.getPendingApprovals();
        setPendingApprovalCount(Array.isArray(list) ? list.length : 0);
        const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
        pendingRequests.value = (Array.isArray(list) ? list : []).filter((r) => {
            if (Array.isArray(r.steps) && r.steps.length > 0 && curUid) {
                const current = r.steps.filter((s) => s.is_current || s.isCurrent);
                if (current.length) {
                    return current.some((s) => isStepApprover(s, curUid));
                }
            }
            return true;
        });
    } catch (err) {
        console.error('Failed to load pending approvals:', err);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadPendingApprovals();
});
watch(() => sicutiState.dataVersion, loadPendingApprovals);

const deptOptions = computed(() => {
    const depts = new Set();
    pendingRequests.value.forEach((r) => {
        const d = r.nm_dept || r.kd_dept || r.department;
        if (d) depts.add(d);
    });
    return [
        { label: 'Semua Divisi / Departemen', value: null },
        ...Array.from(depts).map((d) => ({ label: d, value: d }))
    ];
});

const filteredRequests = computed(() => {
    return pendingRequests.value.filter((r) => {
        if (departmentFilter.value) {
            const d = r.nm_dept || r.kd_dept || r.department;
            if (d !== departmentFilter.value) return false;
        }
        return matchesApprovalSearch(r, searchQuery.value);
    });
});

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}

function openApprovalModal(req) {
    activeRequest.value = req;
    actionModalVisible.value = true;
}
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Validasi Pengajuan Cuti</h1>
                <p class="text-xs text-muted-color">Daftar permohonan cuti yang menunggu validasi dan persetujuan Anda</p>
            </div>
            <div class="text-xs text-muted-color">
                <span class="font-semibold text-surface-900 dark:text-surface-100 tabular-nums">{{ filteredRequests.length }}</span> pengajuan menunggu
            </div>
        </div>

        <div data-tour="pending-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText id="cari-antrean-validasi" name="cari-antrean-validasi" aria-label="Cari antrean validasi berdasarkan karyawan atau ID" v-model="searchQuery" placeholder="Cari Karyawan / ID..." class="w-full text-xs" size="small" />
                </IconField>
                <Select
                    v-model="departmentFilter"
                    :options="deptOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Divisi"
                    class="w-full sm:w-56 text-xs"
                    size="small"
                />
            </div>
            <Button
                severity="secondary"
                outlined
                size="small"
                class="text-xs font-semibold"
                @click="loadPendingApprovals"
                :loading="loading"
            >
                Segarkan
            </Button>
        </div>

        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xs">
            <div data-tour="pending-table" class="hidden md:block">
                <DataTable
                    v-model:first="first"
                    :value="filteredRequests"
                    :loading="loading"
                    paginator
                    :rows="rows"
                    class="p-datatable-sm text-xs"
                    responsiveLayout="scroll"
                    dataKey="id_request"
                >
                    <template #empty>
                        <div class="text-center py-10 px-4 text-muted-color">
                            <CheckCircle2 :size="36" :stroke-width="1.5" class="text-sky-500 mb-2 block mx-auto" />
                            <p class="max-w-xs mx-auto">Tidak ada pengajuan permohonan cuti yang perlu divalidasi saat ini.</p>
                        </div>
                    </template>

                    <Column header="No. Pengajuan" style="width: 14%">
                        <template #body="{ data }">
                            <span class="font-bold text-primary">{{ data.id_request || data.id }}</span>
                            <div class="text-[11px] text-muted-color">{{ formatDate(data.created_at || data.createdAt) }}</div>
                        </template>
                    </Column>

                    <Column header="Karyawan Pengaju" style="width: 24%">
                        <template #body="{ data }">
                            <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.requester_name || data.userName }}</div>
                            <div class="text-[11px] text-muted-color">
                                {{ data.namecode || data.userNik || '-' }} &bull; Divisi {{ data.nm_dept || data.kd_dept || data.department || '-' }}
                            </div>
                        </template>
                    </Column>

                    <Column header="Jenis Cuti" style="width: 18%">
                        <template #body="{ data }">
                            <div class="font-semibold">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</div>
                            <LeaveAttachment v-if="attachmentInfo(data) || documentPending(data)" :request="data" :preview="false" compact class="mt-0.5" />
                        </template>
                    </Column>

                    <Column header="Periode & Durasi" style="width: 20%">
                        <template #body="{ data }">
                            <div>{{ formatDate(data.start_date || data.startDate) }} - {{ formatDate(data.end_date || data.endDate) }}</div>
                            <div class="font-semibold text-surface-800 dark:text-surface-200 text-[11px]">{{ data.total_days ?? data.totalDays }} hari kerja</div>
                        </template>
                    </Column>

                    <Column header="Status" style="width: 10%">
                        <template #body="{ data }">
                            <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="text-[11px]" />
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 14%; text-align: center" :pt="{ headerCell: { 'data-tour': 'pending-col-aksi' } }">
                        <template #body="{ data }">
                            <div class="flex items-center justify-center gap-1.5">
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
                                <Button
                                    size="small"
                                    severity="primary"
                                    class="text-xs font-semibold py-1 px-3 flex items-center gap-1 shadow-xs"
                                    @click="openApprovalModal(data)"
                                    title="Proses Persetujuan"
                                >
                                    <ShieldCheck :size="14" />
                                    <span>Proses</span>
                                </Button>
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div data-tour="pending-list-mobile" class="block md:hidden space-y-3">
                <div v-if="!filteredRequests.length && !loading" class="text-center py-10 px-4 text-muted-color">
                    <CheckCircle2 :size="36" :stroke-width="1.5" class="text-sky-500 mb-2 block mx-auto" />
                    <p class="max-w-xs mx-auto text-xs">Tidak ada pengajuan permohonan cuti yang perlu divalidasi saat ini.</p>
                </div>

                <div
                    v-for="item in paginatedMobileRequests"
                    :key="item.id_request || item.id"
                    class="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/40 space-y-3 shadow-2xs"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <span class="text-xs font-bold text-primary block">
                                {{ item.id_request || item.id }}
                            </span>
                            <span class="text-xs font-semibold text-surface-900 dark:text-surface-0 block">
                                {{ item.requester_name || item.userName }}
                            </span>
                            <span class="text-[11px] text-muted-color">
                                {{ item.namecode || item.userNik || '-' }} &bull; Divisi {{ item.nm_dept || item.kd_dept || item.department || '-' }}
                            </span>
                        </div>
                        <Tag :value="getStatusLabel(item.status)" :severity="getStatusSeverity(item.status)" class="text-[11px]" />
                    </div>

                    <div class="text-xs text-surface-600 dark:text-surface-300 space-y-1.5 pt-1 border-t border-surface-200/60 dark:border-surface-700/60">
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Jenis Cuti:</span>
                            <span class="font-medium text-surface-900 dark:text-surface-100">
                                {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type || '-' }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Periode:</span>
                            <span class="tabular-nums">
                                {{ formatDate(item.start_date || item.startDate) }} - {{ formatDate(item.end_date || item.endDate) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Durasi:</span>
                            <span class="font-semibold text-surface-800 dark:text-surface-200 tabular-nums">
                                {{ item.total_days ?? item.totalDays }} hari kerja
                            </span>
                        </div>
                        <LeaveAttachment v-if="attachmentInfo(item) || documentPending(item)" :request="item" :preview="false" compact class="mt-1" />
                    </div>

                    <div class="pt-2.5 border-t border-surface-200/60 dark:border-surface-700/60 flex items-center justify-end gap-2">
                        <Button
                            size="small"
                            severity="secondary"
                            outlined
                            class="text-xs font-semibold py-1 px-2.5 flex items-center gap-1"
                            @click="viewDetail(item)"
                        >
                            <Eye :size="13" />
                            <span>Detail</span>
                        </Button>
                        <Button
                            size="small"
                            severity="primary"
                            class="text-xs font-semibold py-1 px-3 flex items-center gap-1 shadow-xs"
                            @click="openApprovalModal(item)"
                        >
                            <ShieldCheck :size="13" />
                            <span>Proses</span>
                        </Button>
                    </div>
                </div>

                <Paginator
                    v-if="filteredRequests.length > rows"
                    v-model:first="first"
                    :rows="rows"
                    :totalRecords="filteredRequests.length"
                    template="PrevPageLink PageLinks NextPageLink"
                    class="mt-2 border-0 bg-transparent"
                />
            </div>
        </div>

        <ApprovalActionDialog v-model:visible="actionModalVisible" :request="activeRequest" :reload="loadPendingApprovals" />

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            :showApproveAction="true"
            @process="(req) => { openApprovalModal(req); detailVisible = false; }"
            @refresh="loadPendingApprovals"
        />
    </div>
</template>
