<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    formatDateTime
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import { Clock, Search, Eye, CheckCircle2 } from 'lucide-vue-next';

const router = useRouter();

const loading = ref(false);
const historyRequests = ref([]);
const selectedRequest = ref(null);
const detailVisible = ref(false);
const searchQuery = ref('');
const statusFilter = ref(null);
const first = ref(0);
const rows = ref(10);

const paginatedMobileRequests = computed(() => {
    return processedRequests.value.slice(first.value, first.value + rows.value);
});

watch([searchQuery, statusFilter], () => {
    first.value = 0;
});
const statusOptions = [
    { label: 'Semua Status', value: null },
    { label: 'Disetujui', value: 'approved' },
    { label: 'Ditolak', value: 'rejected' },
    { label: 'Dikembalikan', value: 'returned' }
];

async function loadHistory() {
    loading.value = true;
    try {
        const list = await approvalService.getApprovalHistory();
        historyRequests.value = Array.isArray(list) ? list : [];
    } catch (err) {
        console.error('Failed to load approval history:', err);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadHistory();
});

const processedRequests = computed(() => {
    return historyRequests.value.filter((r) => {
        if (statusFilter.value && r.status !== statusFilter.value) {
            return false;
        }

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase().trim();
            const userName = (r.requester_name || r.userName || '').toLowerCase();
            const id = (r.id_request || r.id || '').toLowerCase();
            const type = (r.nm_leave_type || r.leaveTypeName || r.kd_leave_type || '').toLowerCase();
            const note = (getLastNotes(r) || '').toLowerCase();
            if (!userName.includes(q) && !id.includes(q) && !type.includes(q) && !note.includes(q)) {
                return false;
            }
        }
        return true;
    });
});

function myLastRecord(r) {
    const uid = currentUser.value?.id;
    const mine = (r.approval_records || [])
        .filter((rec) => rec.approver_id === uid)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return mine[mine.length - 1] || null;
}

function getLastApprovalDate(r) {
    return myLastRecord(r)?.created_at || r.updated_at || r.created_at;
}

function getLastNotes(r) {
    return myLastRecord(r)?.notes || '-';
}

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Riwayat Persetujuan Cuti</h1>
                <p class="text-xs text-muted-color">Seluruh permohonan cuti yang telah selesai diproses oleh Approver</p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    @click="$router.push('/approval/pending')"
                >
                    <Clock :size="14" :stroke-width="1.75" />
                    <span>Lihat Antrean Validasi</span>
                </Button>
            </div>
        </div>

        <div data-tour="history-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText id="cari-riwayat-approval" name="cari-riwayat-approval" aria-label="Cari riwayat persetujuan berdasarkan karyawan, ID, atau catatan" v-model="searchQuery" placeholder="Cari Karyawan / ID / Catatan..." class="w-full text-xs" size="small" />
                </IconField>
                <Select
                    v-model="statusFilter"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Status"
                    class="w-full sm:w-56 text-xs"
                    size="small"
                />
            </div>
            <div class="flex items-center gap-3 text-xs text-muted-color w-full sm:w-auto justify-between sm:justify-end">
                <span>Total Diproses: <strong class="text-surface-900 dark:text-surface-100">{{ processedRequests.length }}</strong> Pengajuan</span>
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold py-1 px-2.5"
                    @click="loadHistory"
                    :loading="loading"
                >
                    Segarkan
                </Button>
            </div>
        </div>

        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xs">
            <div class="hidden md:block">
                <DataTable
                    v-model:first="first"
                    :value="processedRequests"
                    :loading="loading"
                    paginator
                    :rows="rows"
                    class="p-datatable-sm text-xs"
                    responsiveLayout="scroll"
                    dataKey="id_request"
                >
                    <template #empty>
                        <div class="text-center py-10 text-muted-color">
                            <CheckCircle2 :size="36" :stroke-width="1.5" class="text-surface-400 mb-2 block mx-auto" />
                            Tidak ada riwayat persetujuan cuti yang sesuai filter.
                        </div>
                    </template>

                    <Column header="No. Pengajuan" style="width: 14%">
                        <template #body="{ data }">
                            <span class="font-bold text-primary">{{ data.id_request || data.id }}</span>
                            <div class="text-[11px] text-muted-color">Diajukan: {{ formatDate(data.created_at || data.createdAt) }}</div>
                        </template>
                    </Column>

                    <Column header="Karyawan Pengaju" style="width: 20%">
                        <template #body="{ data }">
                            <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.requester_name || data.userName }}</div>
                            <div class="text-[11px] text-muted-color">
                                {{ data.namecode || data.userNik || '-' }} &bull; Divisi {{ data.nm_dept || data.kd_dept || data.department || '-' }}
                            </div>
                        </template>
                    </Column>

                    <Column header="Jenis Cuti & Durasi" style="width: 18%">
                        <template #body="{ data }">
                            <div class="font-semibold">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</div>
                            <div class="text-[11px] text-muted-color">
                                {{ formatDate(data.start_date || data.startDate) }} s/d {{ formatDate(data.end_date || data.endDate) }}
                                <span class="font-semibold text-surface-700 dark:text-surface-200" title="Sabtu, Minggu & libur nasional tidak dihitung">({{ data.total_days ?? data.totalDays }} hari kerja)</span>
                            </div>
                        </template>
                    </Column>

                    <Column header="Tgl. Keputusan" style="width: 14%">
                        <template #body="{ data }">
                            <span class="text-surface-700 dark:text-surface-300">
                                {{ formatDateTime(getLastApprovalDate(data)) }}
                            </span>
                        </template>
                    </Column>

                    <Column header="Status Akhir" style="width: 11%" :pt="{ headerCell: { 'data-tour': 'history-col-status' } }">
                        <template #body="{ data }">
                            <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="text-[11px] !rounded-full !px-2.5 !py-0.5" />
                        </template>
                    </Column>

                    <Column header="Catatan Persetujuan" style="min-width: 180px" :pt="{ headerCell: { 'data-tour': 'history-col-notes' } }">
                        <template #body="{ data }">
                            <div class="text-[11px] text-surface-700 dark:text-surface-300 line-clamp-2 italic" :title="getLastNotes(data)">
                                {{ getLastNotes(data) }}
                            </div>
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 8%; text-align: center">
                        <template #body="{ data }">
                            <Button
                                size="small"
                                severity="secondary"
                                text
                                class="text-xs font-semibold py-1 px-2.5 flex items-center gap-1 mx-auto"
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

            <div data-tour="history-list-mobile" class="block md:hidden space-y-3">
                <div v-if="!processedRequests.length && !loading" class="text-center py-10 px-4 text-muted-color">
                    <CheckCircle2 :size="36" :stroke-width="1.5" class="text-surface-400 mb-2 block mx-auto" />
                    <p class="max-w-xs mx-auto text-xs">Tidak ada riwayat persetujuan cuti yang sesuai filter.</p>
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
                        <Tag :value="getStatusLabel(item.status)" :severity="getStatusSeverity(item.status)" class="text-[11px] !rounded-full !px-2.5 !py-0.5" />
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
                                {{ formatDate(item.start_date || item.startDate) }} s/d {{ formatDate(item.end_date || item.endDate) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Durasi:</span>
                            <span class="font-semibold text-surface-800 dark:text-surface-200 tabular-nums">
                                {{ item.total_days ?? item.totalDays }} hari kerja
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Tgl. Keputusan:</span>
                            <span class="tabular-nums">{{ formatDateTime(getLastApprovalDate(item)) }}</span>
                        </div>
                        <div v-if="getLastNotes(item) && getLastNotes(item) !== '-'" class="pt-1">
                            <span class="text-muted-color block text-[11px]">Catatan Persetujuan:</span>
                            <p class="text-[11px] text-surface-700 dark:text-surface-300 italic line-clamp-2 bg-surface-100 dark:bg-surface-800 p-2 rounded-lg mt-0.5">
                                {{ getLastNotes(item) }}
                            </p>
                        </div>
                    </div>

                    <div class="pt-2.5 border-t border-surface-200/60 dark:border-surface-700/60 flex items-center justify-end">
                        <Button
                            size="small"
                            severity="secondary"
                            outlined
                            class="text-xs font-semibold py-1 px-2.5 flex items-center gap-1"
                            @click="viewDetail(item)"
                        >
                            <Eye :size="13" />
                            <span>Lihat Detail</span>
                        </Button>
                    </div>
                </div>

                <Paginator
                    v-if="processedRequests.length > rows"
                    v-model:first="first"
                    :rows="rows"
                    :totalRecords="processedRequests.length"
                    template="PrevPageLink PageLinks NextPageLink"
                    class="mt-2 border-0 bg-transparent"
                />
            </div>
        </div>

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            @refresh="loadHistory"
        />
    </div>
</template>
