<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { approvalService } from '@/service/approvalService';
import {
    currentUser,
    formatDate,
    attachmentInfo,
    documentPending,
    sicutiState,
    refreshPendingApprovalCount,
    isStepApprover
} from '@/service/sicutiService';
import LeaveDetailDialog from '../leave/LeaveDetailDialog.vue';
import LeaveAttachment from '../leave/LeaveAttachment.vue';
import StatStrip from '../shared/StatStrip.vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { approvalConfirmOptions } from './approvalConfirm';
import {
    CheckCircle2,
    Search,
    ShieldCheck,
    Eye,
    Check,
    X,
    RotateCcw,
    RotateCw,
    Calendar,
    ArrowRight
} from 'lucide-vue-next';

const toast = useToast();
const confirm = useConfirm();

const loading = ref(false);
const pendingRequests = ref([]);
const historyRequests = ref([]);

const searchQuery = ref('');

// Dialog State
const selectedRequest = ref(null);
const detailVisible = ref(false);

// Modal Aksi Persetujuan
const actionModalVisible = ref(false);
const activeRequest = ref(null);
const activeAttachment = computed(() => attachmentInfo(activeRequest.value));
const waitingDocument = computed(() => documentPending(activeRequest.value));
const isProcessing = ref(false);
const approvalNotes = ref('');

// Area Utama: Statistik Approval
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

// Data loading
async function loadData() {
    loading.value = true;
    try {
        const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
        const [pendingRes, historyRes] = await Promise.allSettled([
            approvalService.getPendingApprovals(),
            approvalService.getApprovalHistory()
        ]);

        if (pendingRes.status === 'fulfilled') {
            const list = Array.isArray(pendingRes.value) ? pendingRes.value : [];
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
// Notifikasi baru → antrean diperbarui tanpa reload
watch(() => sicutiState.dataVersion, loadData);

const filteredRequests = computed(() => {
    return pendingRequests.value.filter((r) => {
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase().trim();
            const name = (r.requester_name || r.userName || '').toLowerCase();
            const id = (r.id_request || r.id || '').toLowerCase();
            const type = (r.nm_leave_type || r.leaveTypeName || r.kd_leave_type || '').toLowerCase();
            if (!name.includes(q) && !id.includes(q) && !type.includes(q)) {
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

function openApprovalModal(req) {
    activeRequest.value = req;
    approvalNotes.value = '';
    actionModalVisible.value = true;
}

function handleAction(actionType) {
    if (!activeRequest.value) return;

    const idReq = activeRequest.value.id_request || activeRequest.value.id;

    if ((actionType === 'reject' || actionType === 'return') && !approvalNotes.value.trim()) {
        toast.add({
            severity: 'error',
            summary: 'Catatan Diperlukan',
            detail: `Alasan/catatan wajib diisi saat ${actionType === 'reject' ? 'menolak' : 'mengembalikan'} pengajuan cuti.`,
            life: 3500
        });
        return;
    }

    confirm.require({
        ...approvalConfirmOptions(actionType, activeRequest.value),
        accept: () => processAction(actionType, idReq)
    });
}

async function processAction(actionType, idReq) {
    isProcessing.value = true;
    try {
        await approvalService.processApproval({
            idRequest: idReq,
            action: actionType,
            notes: approvalNotes.value.trim()
        });

        const actionText = actionType === 'approve' ? 'disetujui' : (actionType === 'reject' ? 'ditolak' : 'dikembalikan');
        toast.add({
            severity: 'success',
            summary: 'Aksi Berhasil',
            detail: `Pengajuan cuti #${idReq} berhasil ${actionText}.`,
            life: 4000
        });

        actionModalVisible.value = false;
        await loadData();
        void refreshPendingApprovalCount();
    } catch (err) {
        const msg = err?.data?.message || err?.message || 'Gagal memproses persetujuan';
        const alreadyProcessed = err?.status === 409;
        toast.add({
            severity: alreadyProcessed ? 'warn' : 'error',
            summary: alreadyProcessed ? 'Sudah Diproses' : 'Gagal',
            detail: msg,
            life: 5000
        });
        if (alreadyProcessed) {
            actionModalVisible.value = false;
            await loadData();
            void refreshPendingApprovalCount();
        }
    } finally {
        isProcessing.value = false;
    }
}
</script>

<template>
    <div class="space-y-6">
        <StatStrip :items="statItems" />

        <!-- Filter Bar & Search -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div class="w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-72">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText v-model="searchQuery" placeholder="Cari pemohon / No. Tiket..." class="w-full text-xs" size="small" />
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

        <!-- Tabel Antrean Approval Pending -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-xs">
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

                <!-- 1. Nomor Tiket -->
                <Column header="Nomor Tiket" style="width: 16%">
                    <template #body="{ data }">
                        <span class="font-bold text-primary font-mono">{{ data.id_request || data.id }}</span>
                    </template>
                </Column>

                <!-- 2. Nama Pemohon -->
                <Column header="Nama Pemohon" style="width: 22%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.requester_name || data.userName }}</div>
                        <div class="text-[11px] text-muted-color">
                            {{ data.namecode || data.userNik || '-' }}
                        </div>
                    </template>
                </Column>

                <!-- 3. Jenis Cuti -->
                <Column header="Jenis Cuti" style="width: 18%">
                    <template #body="{ data }">
                        <div class="font-semibold">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</div>
                        <LeaveAttachment v-if="attachmentInfo(data) || documentPending(data)" :request="data" :preview="false" compact class="mt-0.5" />
                    </template>
                </Column>

                <!-- 4. Periode Cuti -->
                <Column header="Periode Cuti" style="width: 18%">
                    <template #body="{ data }">
                        <div>{{ formatDate(data.start_date || data.startDate) }} - {{ formatDate(data.end_date || data.endDate) }}</div>
                    </template>
                </Column>

                <!-- 5. Durasi Hari -->
                <Column header="Durasi" style="width: 10%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-900 dark:text-surface-0 whitespace-nowrap" title="Sabtu, Minggu & libur nasional tidak dihitung">{{ data.total_days ?? data.totalDays }} hari kerja</span>
                    </template>
                </Column>

                <!-- 6. Tanggal Pengajuan -->
                <Column header="Diajukan Pada" style="width: 12%">
                    <template #body="{ data }">
                        <div class="text-muted-color">{{ formatDate(data.created_at || data.createdAt) }}</div>
                    </template>
                </Column>

                <!-- 7. Aksi Cepat -->
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

        <!-- Modal Aksi Persetujuan Terintegrasi -->
        <Dialog
            v-model:visible="actionModalVisible"
            modal
            :header="`Proses Persetujuan Cuti #${activeRequest?.id_request || activeRequest?.id || ''}`"
            :style="{ width: '560px' }"
            :breakpoints="{ '960px': '80vw', '640px': '95vw' }"
            :closable="true"
            dismissableMask
        >
            <div v-if="activeRequest" class="space-y-4 pt-1 text-xs">
                <!-- Rincian Informasi Cuti Card (Adopsi Pola LeaveDetailDialog) -->
                <div class="rounded-xl border border-surface-200/80 dark:border-surface-700/80 bg-surface-0 dark:bg-surface-900 p-4 space-y-3">
                    <!-- Grid Informasi Utama -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-3 border-b border-surface-100 dark:border-surface-800 text-xs">
                        <div>
                            <span class="text-muted-color block mb-1">Pemohon</span>
                            <div class="font-bold text-surface-900 dark:text-surface-0 text-sm">
                                {{ activeRequest.requester_name || activeRequest.userName }}
                            </div>
                            <div class="text-[11px] text-muted-color mt-0.5">
                                NIK: {{ activeRequest.namecode || '-' }} &bull; {{ activeRequest.nm_dept || activeRequest.kd_dept || activeRequest.department || '-' }}
                            </div>
                        </div>
                        <div>
                            <span class="text-muted-color block mb-1">Jenis Cuti</span>
                            <div class="font-bold text-surface-900 dark:text-surface-0 text-sm">
                                {{ activeRequest.nm_leave_type || activeRequest.kd_leave_type }}
                            </div>
                            <div class="text-[11px] font-semibold text-primary mt-0.5">
                                {{ activeRequest.total_days ?? activeRequest.totalDays }} Hari Kerja
                            </div>
                        </div>
                        <div class="sm:col-span-2">
                            <span class="text-muted-color block mb-1">Rentang Tanggal Pelaksanaan</span>
                            <div class="flex items-center gap-2 font-medium text-surface-800 dark:text-surface-200">
                                <Calendar :size="14" class="text-primary shrink-0" />
                                <span>{{ formatDate(activeRequest.start_date || activeRequest.startDate) }}</span>
                                <ArrowRight :size="13" class="text-muted-color shrink-0" />
                                <span>{{ formatDate(activeRequest.end_date || activeRequest.endDate) }}</span>
                            </div>
                        </div>
                        <div v-if="activeAttachment || waitingDocument" class="sm:col-span-2 pt-0.5">
                            <span class="text-muted-color block mb-1">Dokumen Lampiran</span>
                            <LeaveAttachment :request="activeRequest" />
                        </div>
                    </div>

                    <!-- Alasan Permohonan Cuti (Dedicated Box) -->
                    <div v-if="activeRequest.reason" class="text-xs">
                        <span class="text-muted-color block mb-1 font-medium">Alasan Permohonan Cuti</span>
                        <p class="text-surface-800 dark:text-surface-200 leading-relaxed bg-surface-50 dark:bg-surface-800/80 p-3 rounded-lg border border-surface-200/60 dark:border-surface-700/60">
                            {{ activeRequest.reason }}
                        </p>
                    </div>
                </div>

                <!-- Input Catatan Validasi Approver -->
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="text-xs font-semibold text-surface-800 dark:text-surface-200">
                            Catatan Persetujuan
                        </label>
                        <span class="text-[11px] text-muted-color">Wajib jika menolak/mengembalikan</span>
                    </div>
                    <Textarea
                        v-model="approvalNotes"
                        rows="2"
                        class="w-full text-xs"
                        placeholder="Tuliskan instruksi atau alasan bila menolak/mengembalikan..."
                    />
                </div>
            </div>

            <!-- Footer: Asymmetric Action Buttons (Opsi 1) -->
            <template #footer>
                <div class="flex items-center justify-between gap-2 w-full pt-3 border-t border-surface-100 dark:border-surface-800">
                    <!-- Sisi Kiri: Batal & Tindakan Pengecualian -->
                    <div class="flex items-center gap-1.5">
                        <Button
                            label="Batal"
                            severity="secondary"
                            text
                            class="text-xs font-semibold"
                            @click="actionModalVisible = false"
                            :disabled="isProcessing"
                        />
                        <Button
                            severity="warn"
                            text
                            class="text-xs font-semibold flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            :loading="isProcessing"
                            @click="handleAction('return')"
                        >
                            <RotateCcw :size="13" />
                            <span>Kembalikan</span>
                        </Button>
                        <Button
                            severity="danger"
                            text
                            class="text-xs font-semibold flex items-center gap-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            :loading="isProcessing"
                            @click="handleAction('reject')"
                        >
                            <X :size="13" />
                            <span>Tolak</span>
                        </Button>
                    </div>

                    <!-- Sisi Kanan: Primary Action (Setujui) -->
                    <Button
                        severity="success"
                        class="text-xs font-semibold flex items-center gap-1.5 shadow-xs px-4"
                        :loading="isProcessing"
                        :disabled="waitingDocument"
                        v-tooltip.top="waitingDocument ? 'Menunggu dokumen pendukung dari pemohon' : null"
                        @click="handleAction('approve')"
                    >
                        <Check :size="14" :stroke-width="2.2" />
                        <span>Setujui Permohonan</span>
                    </Button>
                </div>
            </template>
        </Dialog>

        <!-- Detail Dialog Terintegrasi -->
        <LeaveDetailDialog
            v-model:visible="detailVisible"
            :request="selectedRequest"
            :showApproveAction="true"
            @process="(req) => { openApprovalModal(req); detailVisible = false; }"
            @refresh="loadData"
        />
    </div>
</template>
