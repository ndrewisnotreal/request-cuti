<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    can,
    formatDate,
    attachmentInfo,
    documentPending,
    sicutiState,
    setPendingApprovalCount,
    isStepApprover
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import LeaveAttachment from '@/components/leave/LeaveAttachment.vue';
import StatStrip from '@/components/common/StatStrip.vue';
import ApprovalActionDialog from '@/components/approval/ApprovalActionDialog.vue';
import { matchesApprovalSearch } from '@/utils/approvalSearch';
import { localIsoDate, onLeaveToday, shortDate } from '@/utils/onLeaveToday';
import {
    CheckCircle2,
    Search,
    ShieldCheck,
    Eye,
    RotateCw
} from 'lucide-vue-next';

const loading = ref(false);
const pendingRequests = ref([]);
const historyRequests = ref([]);

const searchQuery = ref('');

const selectedRequest = ref(null);
const detailVisible = ref(false);

const actionModalVisible = ref(false);
const activeRequest = ref(null);

const pendingCount = computed(() => pendingRequests.value.length);

const approvedCount = computed(() => {
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    return historyRequests.value.filter((r) => {
        if (r.status === 'approved') return true;
        if (Array.isArray(r.steps)) {
            return r.steps.some((s) => s.status === 'approved' && (s.uid_approver === curUid || s.approver_id === curUid));
        }
        if (Array.isArray(r.approval_records)) {
            return r.approval_records.some((rec) => rec.action === 'approve' && (rec.uid_approver === curUid || rec.approver_id === curUid));
        }
        return false;
    }).length;
});

const totalProcessedCount = computed(() => historyRequests.value.length);

const statItems = computed(() => [
    {
        label: 'Menunggu validasi',
        value: pendingCount.value,
        unit: 'pengajuan',
        hint: pendingCount.value > 0 ? 'Perlu keputusan Anda' : 'Antrean kosong',
        accent: pendingCount.value > 0
    },
    { label: 'Disetujui oleh Anda', value: approvedCount.value, unit: 'pengajuan', hint: 'Seluruh riwayat' },
    { label: 'Total diproses', value: totalProcessedCount.value, unit: 'pengajuan', hint: 'Disetujui, ditolak, dikembalikan' }
]);

const canSeeTodayLeaves = computed(() => can('approval.view_requests', 'approval.validate'));
const todayIso = ref(localIsoDate());
const todayLeaves = ref([]);

const todayISO = computed(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

const onLeaveTodayList = computed(() => {
    if (todayLeaves.value && todayLeaves.value.length > 0) {
        return todayLeaves.value;
    }
    const today = todayISO.value;
    return historyRequests.value.filter((r) => {
        if (r.status !== 'approved' && r.status !== 'completed') return false;
        const start = String(r.start_date || r.startDate || '').slice(0, 10);
        const end = String(r.end_date || r.endDate || '').slice(0, 10);
        return start && end && start <= today && end >= today;
    });
});

const approvedToday = computed(() => {
    const today = todayISO.value;
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    return historyRequests.value.filter((r) => {
        const isToday = (d) => Boolean(d) && String(d).slice(0, 10) === today;
        if (Array.isArray(r.approval_records)) {
            const rec = r.approval_records.find(
                (a) => a.action === 'approve' && (a.approver_id === curUid || a.uid_approver === curUid) && isToday(a.created_at)
            );
            if (rec) return true;
        }
        if (Array.isArray(r.steps)) {
            const step = r.steps.find(
                (s) => s.status === 'approved' && (s.uid_approver === curUid || s.approver_id === curUid) && isToday(s.acted_at)
            );
            if (step) return true;
        }
        if (r.status === 'approved' && isToday(r.updated_at || r.updatedAt)) {
            return true;
        }
        return false;
    });
});

function formatApprovedTime(req) {
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    let dateVal = null;
    if (Array.isArray(req.approval_records)) {
        const rec = req.approval_records.find((a) => a.action === 'approve' && (a.approver_id === curUid || a.uid_approver === curUid));
        if (rec?.created_at) dateVal = rec.created_at;
    }
    if (!dateVal && Array.isArray(req.steps)) {
        const step = req.steps.find((s) => s.status === 'approved' && (s.uid_approver === curUid || s.approver_id === curUid));
        if (step?.acted_at) dateVal = step.acted_at;
    }
    if (!dateVal) dateVal = req.updated_at || req.updatedAt;
    if (!dateVal) return 'Hari ini';
    try {
        const d = new Date(dateVal);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
        return 'Hari ini';
    }
}

async function loadTodayLeaves() {
    if (!canSeeTodayLeaves.value) {
        todayLeaves.value = [];
        return;
    }
    todayIso.value = localIsoDate();
    try {
        todayLeaves.value = onLeaveToday(await approvalService.getOnLeaveToday(), todayIso.value);
    } catch {
        todayLeaves.value = [];
    }
}
async function loadData() {
    loading.value = true;
    void loadTodayLeaves();
    try {
        const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
        const [pendingRes, historyRes] = await Promise.allSettled([
            approvalService.getPendingApprovals(),
            approvalService.getApprovalHistory()
        ]);

        if (pendingRes.status === 'fulfilled') {
            const list = Array.isArray(pendingRes.value) ? pendingRes.value : [];
            setPendingApprovalCount(list.length);
            pendingRequests.value = list.filter((r) => {
                if (Array.isArray(r.steps) && r.steps.length > 0 && curUid) {
                    const currentStep = r.steps.find((s) => s.is_current || s.isCurrent);
                    if (currentStep) {
                        return isStepApprover(currentStep, curUid);
                    }
                }
                return true;
            });
        }

        if (historyRes.status === 'fulfilled') {
            historyRequests.value = Array.isArray(historyRes.value) ? historyRes.value : [];
        }
    } catch (err) {
        console.error('Failed to load approval dashboard data:', err);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadData();
});
watch(() => sicutiState.dataVersion, loadData);

const filteredRequests = computed(() => pendingRequests.value.filter((r) => matchesApprovalSearch(r, searchQuery.value)));

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
        <StatStrip data-tour="appr-stats" :items="statItems" />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <div data-tour="appr-today" class="card !mb-0 h-full border border-surface-200 dark:border-surface-700/80 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xs flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between pb-2.5 mb-2 border-b border-surface-100 dark:border-surface-800">
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 m-0">Sedang Cuti Hari Ini</h3>
                            <span class="text-xs font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-muted-color tabular-nums">
                                {{ onLeaveTodayList.length }}
                            </span>
                        </div>
                        <router-link
                            v-if="can('dashboard_laporan.view_calendar')"
                            to="/calendar"
                            class="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                        >
                            <span>Kalender</span>
                            <span>&rarr;</span>
                        </router-link>
                        <span v-else class="text-xs text-muted-color font-medium">Hari ini</span>
                    </div>

                    <div v-if="onLeaveTodayList.length > 0" class="divide-y divide-surface-100 dark:divide-surface-800/80">
                        <div
                            v-for="item in onLeaveTodayList.slice(0, 5)"
                            :key="item.id_request || item.id"
                            class="py-2.5 flex items-center justify-between gap-3 hover:bg-surface-50/50 dark:hover:bg-surface-800/30 px-1 rounded transition"
                        >
                            <div>
                                <div class="font-semibold text-xs text-surface-900 dark:text-surface-100">
                                    {{ item.nama || item.requester_name || item.userName }}
                                </div>
                                <div class="text-[11px] text-muted-color font-mono">
                                    {{ item.namecode || item.userNik || item.nip || '-' }}
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-surface-800 dark:text-surface-200 font-medium">
                                    {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type }}
                                </div>
                                <div class="text-[11px] text-muted-color tabular-nums">
                                    <template v-if="String(item.start_date || item.startDate).slice(0, 10) === String(item.end_date || item.endDate).slice(0, 10)">
                                        {{ formatDate(item.start_date || item.startDate) }} ({{ item.total_days ?? item.totalDays }} hari)
                                    </template>
                                    <template v-else>
                                        {{ formatDate(item.start_date || item.startDate) }} - {{ formatDate(item.end_date || item.endDate) }} ({{ item.total_days ?? item.totalDays }} hari)
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else class="py-8 text-center text-muted-color text-xs">
                        <span class="font-semibold text-surface-800 dark:text-surface-200 block mb-0.5">Tidak ada karyawan yang cuti hari ini</span>
                        <span class="text-[11px]">Seluruh anggota tim aktif bekerja.</span>
                    </div>
                </div>
            </div>

            <div class="card !mb-0 h-full border border-surface-200 dark:border-surface-700/80 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xs flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between pb-2.5 mb-2 border-b border-surface-100 dark:border-surface-800">
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 m-0">Disetujui Hari Ini</h3>
                            <span class="text-xs font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-muted-color tabular-nums">
                                {{ approvedToday.length }}
                            </span>
                        </div>
                        <router-link
                            v-if="can('approval.view_requests')"
                            to="/approval/history"
                            class="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                        >
                            <span>Riwayat</span>
                            <span>&rarr;</span>
                        </router-link>
                    </div>

                    <div v-if="approvedToday.length > 0" class="divide-y divide-surface-100 dark:divide-surface-800/80">
                        <div
                            v-for="item in approvedToday.slice(0, 5)"
                            :key="item.id_request || item.id"
                            class="py-2.5 flex items-center justify-between gap-3 hover:bg-surface-50/50 dark:hover:bg-surface-800/30 px-1 rounded transition"
                        >
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-mono text-xs font-bold text-primary">{{ item.id_request || item.id }}</span>
                                    <span class="text-xs font-semibold text-surface-900 dark:text-surface-100">{{ item.requester_name || item.userName || item.nama }}</span>
                                </div>
                                <div class="text-[11px] text-muted-color">
                                    {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type }} &bull; {{ item.total_days ?? item.totalDays }} hari kerja
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-medium text-surface-700 dark:text-surface-300 tabular-nums">{{ formatApprovedTime(item) }}</div>
                                <button type="button" @click="viewDetail(item)" class="text-[11px] text-primary hover:underline font-medium">Detail</button>
                            </div>
                        </div>
                    </div>

                    <div v-else class="py-8 text-center text-muted-color text-xs">
                        <span class="font-semibold text-surface-800 dark:text-surface-200 block mb-0.5">Belum ada pengajuan disetujui hari ini</span>
                        <span class="text-[11px]">Pengajuan yang disetujui akan tercatat di sini.</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div class="w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-72">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText id="cari-antrean-dashboard" name="cari-antrean-dashboard" aria-label="Cari antrean berdasarkan pemohon atau nomor tiket" v-model="searchQuery" placeholder="Cari pemohon / No. Tiket..." class="w-full text-xs" size="small" />
                </IconField>
            </div>
            <Button
                severity="secondary"
                outlined
                size="small"
                class="text-xs font-semibold flex items-center gap-1.5"
                @click="loadData"
                :loading="loading"
            >
                <RotateCw :size="13" />
                <span>Segarkan</span>
            </Button>
        </div>

        <div data-tour="appr-queue" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xs">
            <div class="flex items-center justify-between mb-3 px-1">
                <div>
                    <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100">Antrean Menunggu Validasi</h3>
                    <p class="text-xs text-muted-color">Daftar permohonan cuti aktif yang memerlukan tindakan approver</p>
                </div>
                <Tag :value="`${filteredRequests.length} menunggu`" severity="secondary" class="text-xs font-semibold" />
            </div>

            <DataTable
                :value="filteredRequests"
                :loading="loading"
                paginator
                :rows="10"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
                dataKey="id_request"
            >
                <template #empty>
                    <div class="text-center py-12 text-muted-color">
                        <CheckCircle2 :size="40" :stroke-width="1.5" class="text-emerald-500 mb-2 block mx-auto" />
                        <span class="font-medium">Tidak ada permohonan cuti yang menunggu validasi Anda saat ini.</span>
                    </div>
                </template>

                <Column header="Nomor Tiket" style="width: 16%">
                    <template #body="{ data }">
                        <span class="font-bold text-primary font-mono">{{ data.id_request || data.id }}</span>
                    </template>
                </Column>

                <Column header="Nama Pemohon" style="width: 22%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.requester_name || data.userName }}</div>
                        <div class="text-[11px] text-muted-color">
                            {{ data.namecode || data.userNik || '-' }}
                        </div>
                    </template>
                </Column>

                <Column header="Jenis Cuti" style="width: 18%">
                    <template #body="{ data }">
                        <div class="font-semibold">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</div>
                        <LeaveAttachment v-if="attachmentInfo(data) || documentPending(data)" :request="data" :preview="false" compact class="mt-0.5" />
                    </template>
                </Column>

                <Column header="Periode Cuti" style="width: 18%">
                    <template #body="{ data }">
                        <div>{{ formatDate(data.start_date || data.startDate) }} - {{ formatDate(data.end_date || data.endDate) }}</div>
                    </template>
                </Column>

                <Column header="Durasi" style="width: 10%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-900 dark:text-surface-0 whitespace-nowrap" title="Sabtu, Minggu & libur nasional tidak dihitung">{{ data.total_days ?? data.totalDays }} hari kerja</span>
                    </template>
                </Column>

                <Column header="Diajukan Pada" style="width: 12%">
                    <template #body="{ data }">
                        <div class="text-muted-color">{{ formatDate(data.created_at || data.createdAt) }}</div>
                    </template>
                </Column>

                <Column header="Aksi Cepat" style="width: 14%; text-align: center">
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

        <ApprovalActionDialog v-model:visible="actionModalVisible" :request="activeRequest" :reload="loadData" />

        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            :showApproveAction="true"
            @process="(req) => { openApprovalModal(req); detailVisible = false; }"
            @refresh="loadData"
        />
    </div>
</template>
