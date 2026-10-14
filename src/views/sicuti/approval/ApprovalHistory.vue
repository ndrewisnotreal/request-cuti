<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    formatDateTime
} from '@/service/sicutiService';
import LeaveDetailDialog from '../leave/LeaveDetailDialog.vue';
import { Clock, Search, Eye, CheckCircle2 } from 'lucide-vue-next';

const router = useRouter();

const loading = ref(false);
const historyRequests = ref([]);
const selectedRequest = ref(null);
const detailVisible = ref(false);
const searchQuery = ref('');
const statusFilter = ref(null);

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

// Keputusan terakhir approver yang sedang login (satu pengajuan diputus beberapa pejabat)
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
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100">Riwayat Persetujuan Cuti</h2>
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

        <!-- Filter Bar -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText v-model="searchQuery" placeholder="Cari Karyawan / ID / Catatan..." class="w-full text-xs" size="small" />
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

        <!-- DataTable -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xs">
            <DataTable
                :value="processedRequests"
                :loading="loading"
                paginator
                :rows="10"
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

                <!-- Tanggal Approval -->
                <Column header="Tgl. Keputusan" style="width: 14%">
                    <template #body="{ data }">
                        <span class="text-surface-700 dark:text-surface-300">
                            {{ formatDateTime(getLastApprovalDate(data)) }}
                        </span>
                    </template>
                </Column>

                <!-- Status Akhir -->
                <Column header="Status Akhir" style="width: 11%">
                    <template #body="{ data }">
                        <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="text-[11px] !rounded-full !px-2.5 !py-0.5" />
                    </template>
                </Column>

                <!-- Catatan -->
                <Column header="Catatan Persetujuan" style="min-width: 180px">
                    <template #body="{ data }">
                        <div class="text-[11px] text-surface-700 dark:text-surface-300 line-clamp-2 italic" :title="getLastNotes(data)">
                            {{ getLastNotes(data) }}
                        </div>
                    </template>
                </Column>

                <!-- Tombol Lihat Detail -->
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

        <!-- Detail Dialog Reusable -->
        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            @refresh="loadHistory"
        />
    </div>
</template>
