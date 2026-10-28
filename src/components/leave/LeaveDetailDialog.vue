<script setup>
import { publicPath } from '@/utils/publicPath';
import { computed, ref, watch } from 'vue';
import { leaveService } from '@/service/leaveService';
import {
    currentUser,
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    formatDateTime,
    can,
    attachmentInfo,
    documentPending,
    stepApproverName
} from '@/service/sicutiService';
import LeaveAttachment from '@/components/leave/LeaveAttachment.vue';
import LeaveApprovalTimeline from '@/components/leave/LeaveApprovalTimeline.vue';
import TourHelpButton from '@/components/common/TourHelpButton.vue';
import { useToast } from 'primevue/usetoast';
import { buildLeaveFormHtml, validationUrl, isQrReachableFromPhone } from '@/utils/leaveFormPrint';
import {
    FileText,
    Printer,
    Copy,
    Calendar,
    ArrowRight,
    RotateCcw,
    ShieldCheck
} from 'lucide-vue-next';

const props = defineProps({
    visible: Boolean,
    request: Object,
    showApproveAction: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'refresh', 'edit', 'process']);
const toast = useToast();

const loading = ref(false);
const detailData = ref(null);

watch(
    () => [props.visible, props.request],
    async ([visible, req]) => {
        if (visible && req) {
            detailData.value = { ...req };
            const reqId = req.id_request || req.id;
            if (reqId) {
                loading.value = true;
                try {
                    const res = await leaveService.getLeaveDetail(reqId);
                    if (res) {
                        detailData.value = res;
                    }
                } catch (err) {
                    console.error('Failed to fetch full leave detail:', err);
                } finally {
                    loading.value = false;
                }
            }
        }
    },
    { immediate: true }
);

const fullRequest = computed(() => detailData.value || props.request || {});

const ticketId = computed(() => fullRequest.value.id_request || fullRequest.value.id || '');
const requesterName = computed(() => fullRequest.value.requester_name || fullRequest.value.userName || 'Karyawan');
const requesterNik = computed(() => fullRequest.value.namecode || fullRequest.value.userNik || '-');
const requesterDept = computed(() => fullRequest.value.nm_dept || fullRequest.value.department || '-');
const leaveTypeName = computed(() => fullRequest.value.nm_leave_type || fullRequest.value.leaveTypeName || fullRequest.value.kd_leave_type || '-');
const startDate = computed(() => fullRequest.value.start_date || fullRequest.value.startDate);
const endDate = computed(() => fullRequest.value.end_date || fullRequest.value.endDate);
const totalDays = computed(() => fullRequest.value.total_days ?? fullRequest.value.totalDays ?? 0);
const reason = computed(() => fullRequest.value.reason || '-');
const attachment = computed(() => attachmentInfo(fullRequest.value));
const status = computed(() => fullRequest.value.status || 'submitted');

const stepsList = computed(() => {
    const rawSteps = fullRequest.value.steps;
    const records = Array.isArray(fullRequest.value.approval_records) ? fullRequest.value.approval_records : [];

    if (Array.isArray(rawSteps) && rawSteps.length > 0) {
        return rawSteps.map((s) => {
            const matchingRecord = records
                .filter((r) => Number(r.level) === Number(s.level))
                .slice(-1)[0];

            let st = (s.status || '').toLowerCase().trim();
            const act = (s.action || matchingRecord?.action || '').toLowerCase().trim();

            if (!st || st === 'pending') {
                if (act === 'approve') st = 'approved';
                else if (act === 'reject') st = 'rejected';
                else if (act === 'return') st = 'returned';
                else st = 'pending';
            }

            return {
                id: s.id_step,
                level: s.level,
                approverId: s.uid_approver || matchingRecord?.approver_id || s.approver_id || '',
                approverName: stepApproverName(s, matchingRecord),
                status: st,
                action: act,
                notes: s.notes || matchingRecord?.notes || null,
                actedAt: s.acted_at || matchingRecord?.created_at || null,
                isCurrent: Boolean(s.is_current)
            };
        });
    }

    if (records.length > 0) {
        return records.map((r) => ({
            id: r.approver_id,
            approverId: r.approver_id || '',
            level: r.level,
            approverName: r.approver_name || 'Approver',
            status: r.action === 'approve' ? 'approved' : (r.action === 'reject' ? 'rejected' : (r.action === 'return' ? 'returned' : 'pending')),
            action: r.action,
            notes: r.notes,
            actedAt: r.created_at,
            isCurrent: false
        }));
    }

    return [];
});

function copyTicketId(id) {
    if (!id) return;
    navigator.clipboard?.writeText(id).then(() => {
        toast.add({
            severity: 'info',
            summary: 'Tersalin',
            detail: `Nomor ID #${id} disalin ke papan klip`,
            life: 2500
        });
    }).catch(() => {
        toast.add({
            severity: 'info',
            summary: 'Nomor ID',
            detail: `#${id}`,
            life: 2000
        });
    });
}


async function printDocument() {
    if (!['approved', 'completed'].includes(status.value)) {
        toast.add({
            severity: 'warn',
            summary: 'Belum Disetujui Penuh',
            detail: 'Dokumen cuti hanya dapat dicetak setelah seluruh tahapan persetujuan selesai (Disetujui).',
            life: 4000
        });
        return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const req = fullRequest.value;
    const requesterUid = req.uid_user_system;
    const approvers = stepsList.value.filter((s) => s.status === 'approved' && s.approverId && s.approverId !== requesterUid);
    const atasan = approvers[0];
    const mengetahui = approvers[approvers.length - 1];

    const year = Number(String(startDate.value || '').slice(0, 4)) || new Date().getFullYear();
    const balances = await leaveService.getBalances({ uid: requesterUid, year }).catch(() => []);
    const balance = balances.find((b) => Number(b.year) === year) || balances[0] || null;

    const signerOf = (step) =>
        step
            ? {
                  name: step.approverName,
                  date: step.actedAt,
                  qrUrl: req.validation_tokens?.[step.approverId] ? validationUrl(req.validation_tokens[step.approverId]) : ''
              }
            : null;
    const html = await buildLeaveFormHtml({
        ticketId: ticketId.value,
        employeeName: requesterName.value,
        nik: requesterNik.value,
        department: requesterDept.value,
        usedDays: balance ? Number(balance.used_days ?? 0) : '',
        remainingDays: balance ? Number(balance.remaining ?? 0) : '',
        leaveTypeName: leaveTypeName.value,
        totalDays: totalDays.value,
        startDate: startDate.value,
        endDate: endDate.value,
        phone: req.requester_no_hp || '',
        reason: req.reason || '',
        substituteName: req.substitute_name || '',
        location: '',
        submittedAt: req.created_at,
        status: status.value,
        komentar: atasan?.notes || '',
        atasan: signerOf(atasan),
        mengetahui: signerOf(mengetahui),
        logoUrl: `${window.location.origin}${publicPath('logo-sinergi.png')}`
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    if (!isQrReachableFromPhone()) {
        toast.add({
            severity: 'warn',
            summary: 'QR hanya bisa dibuka dari komputer ini',
            detail: 'Surat dicetak dari alamat localhost. Agar QR bisa dipindai HP, buka aplikasi lewat alamat jaringan (Network) atau isi VITE_PUBLIC_APP_URL.',
            life: 8000
        });
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        modal
        :breakpoints="{ '960px': '85vw', '640px': '95vw' }"
        :style="{ width: '680px' }"
        :contentStyle="{ maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }"
        :closable="true"
        dismissableMask
    >
        <template #header>
            <div class="flex items-center gap-2.5">
                <span class="text-base font-bold text-surface-900 dark:text-surface-100">
                    Detail Permohonan Cuti
                </span>
                <button
                    v-if="ticketId"
                    type="button"
                    class="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary/20 px-2 py-0.5 rounded-md transition-all cursor-pointer active:scale-95"
                    @click="copyTicketId(ticketId)"
                    title="Salin ID Tiket"
                >
                    <span>#{{ ticketId }}</span>
                    <Copy :size="11" :stroke-width="1.8" />
                </button>
            </div>
        </template>

        <div v-if="fullRequest" class="space-y-4 pt-1">
            <div data-tour="detail-summary" class="p-3 px-3.5 bg-surface-50 dark:bg-surface-800/80 rounded-xl border border-surface-200/80 dark:border-surface-700/80 flex items-center justify-between gap-3 shadow-2xs">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center font-bold text-xs select-none shrink-0">
                        {{ requesterName.charAt(0) }}
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-surface-900 dark:text-surface-0 leading-tight truncate">
                            {{ requesterName }}
                        </h4>
                        <p class="text-[11px] text-muted-color mt-0.5 truncate">
                            NIK: {{ requesterNik }} &bull; Divisi: {{ requesterDept }}
                        </p>
                    </div>
                </div>
                <div class="shrink-0 flex items-center gap-2">
                    <Tag
                        :value="getStatusLabel(status)"
                        :severity="getStatusSeverity(status)"
                        class="text-[11px] font-semibold !rounded-full !px-2.5 !py-0.5"
                    />
                </div>
            </div>

            <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4 space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-surface-100 dark:border-surface-800 text-xs">
                    <div>
                        <span class="text-muted-color block mb-1">Jenis Cuti</span>
                        <span class="font-bold text-surface-900 dark:text-surface-0 text-sm">
                            {{ leaveTypeName }}
                        </span>
                    </div>
                    <div>
                        <span class="text-muted-color block mb-1">Durasi Hari Kerja</span>
                        <span class="font-bold text-primary text-sm">
                            {{ totalDays }} Hari Kerja
                        </span>
                    </div>
                    <div class="sm:col-span-2">
                        <span class="text-muted-color block mb-1">Rentang Tanggal Pelaksanaan</span>
                        <div class="flex items-center gap-2 font-medium text-surface-800 dark:text-surface-200">
                            <Calendar :size="14" class="text-primary" />
                            <span>{{ formatDate(startDate) }}</span>
                            <ArrowRight :size="13" class="text-muted-color" />
                            <span>{{ formatDate(endDate) }}</span>
                        </div>
                    </div>
                </div>

                <div class="text-xs">
                    <span class="text-muted-color block mb-1">Alasan Permohonan Cuti</span>
                    <p class="text-surface-800 dark:text-surface-200 leading-relaxed bg-surface-50 dark:bg-surface-800 p-3 rounded-lg border border-surface-200/60 dark:border-surface-700/60">
                        {{ reason }}
                    </p>
                </div>

                <div v-if="attachment || documentPending(fullRequest)" data-tour="detail-attachment" class="text-xs pt-1">
                    <span class="text-muted-color block mb-1">Dokumen Pendukung</span>
                    <LeaveAttachment :request="fullRequest" />
                </div>
            </div>

            <LeaveApprovalTimeline data-tour="detail-timeline" :steps="stepsList" />
        </div>

        <template #footer>
            <div class="flex items-center justify-between gap-2 w-full pt-3 border-t border-surface-100 dark:border-surface-800">
                <div class="flex items-center gap-1">
                    <TourHelpButton :tour-id="['karyawan.detail', 'approval.detail']" />
                    <Button
                        label="Tutup"
                        severity="secondary"
                        class="text-xs font-semibold px-4"
                        @click="emit('update:visible', false)"
                    />
                </div>

                <div data-tour="detail-actions" class="flex items-center gap-2">
                    <Button
                        v-if="['approved', 'completed'].includes(status)"
                        label="Cetak Surat Cuti"
                        severity="secondary"
                        outlined
                        class="text-xs flex items-center gap-1.5 font-semibold"
                        @click="printDocument"
                    >
                        <template #icon>
                            <Printer :size="14" />
                        </template>
                    </Button>
                    <Button
                        v-else-if="status === 'returned' && can('pengajuan_cuti.edit_returned')"
                        label="Ajukan Ulang / Ubah"
                        severity="warn"
                        class="text-xs flex items-center gap-1.5 font-semibold"
                        @click="emit('edit', fullRequest); emit('update:visible', false)"
                    >
                        <template #icon>
                            <RotateCcw :size="14" />
                        </template>
                    </Button>
                    <Button
                        v-else-if="showApproveAction && (status === 'submitted' || status === 'pending_validation')"
                        label="Proses"
                        severity="primary"
                        class="text-xs flex items-center gap-1.5 font-semibold"
                        @click="emit('process', fullRequest); emit('update:visible', false)"
                    >
                        <template #icon>
                            <ShieldCheck :size="14" />
                        </template>
                    </Button>
                </div>
            </div>
        </template>
    </Dialog>
</template>
