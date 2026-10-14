<script setup>
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
import LeaveAttachment from './LeaveAttachment.vue';
import { useToast } from 'primevue/usetoast';
import { buildLeaveFormHtml, validationUrl, isQrReachableFromPhone } from './leaveFormPrint';
import {
    FileText,
    Printer,
    Copy,
    Calendar,
    ArrowRight,
    CheckCircle2,
    Clock,
    XCircle,
    RotateCcw,
    User,
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

            // Penentuan akurat status tiap step
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

    // Fallback: If steps not populated but approval_records exist
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

function getStepBadge(stepStatus, isCurrent) {
    switch (stepStatus?.toLowerCase()) {
        case 'approved':
            return { label: 'Disetujui', severity: 'success', icon: CheckCircle2 };
        case 'rejected':
            return { label: 'Ditolak', severity: 'danger', icon: XCircle };
        case 'returned':
            return { label: 'Dikembalikan', severity: 'warn', icon: RotateCcw };
        case 'pending':
        default:
            return {
                label: isCurrent ? 'Sedang Ditinjau' : 'Menunggu Antrean',
                severity: isCurrent ? 'info' : 'secondary',
                icon: Clock
            };
    }
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
    // Jendela dibuka lebih dulu (masih dalam klik) agar tidak diblokir popup blocker
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const req = fullRequest.value;
    const requesterUid = req.uid_user_system;
    // Approver yang benar-benar menyetujui; level milik pemohon sendiri (auto-skip) tidak dihitung
    const approvers = stepsList.value.filter((s) => s.status === 'approved' && s.approverId && s.approverId !== requesterUid);
    const atasan = approvers[0];
    const mengetahui = approvers[approvers.length - 1];

    const year = Number(String(startDate.value || '').slice(0, 4)) || new Date().getFullYear();
    const balances = await leaveService.getBalances({ uid: requesterUid, year }).catch(() => []);
    const balance = balances.find((b) => Number(b.year) === year) || balances[0] || null;

    // QR per pengesah (Atasan Langsung & Mengetahui) → halaman validasi daftar pengesah
    const signerOf = (step) =>
        step
            ? {
                  name: step.approverName,
                  date: step.actedAt,
                  // Token ditandatangani backend; tanpa token QR tidak dicetak
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
        logoUrl: `${window.location.origin}/logo-sinergi.png`
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
            <!-- Header Summary Card (Profil Pemohon Ramping) -->
            <div class="p-3 px-3.5 bg-surface-50 dark:bg-surface-800/80 rounded-xl border border-surface-200/80 dark:border-surface-700/80 flex items-center justify-between gap-3 shadow-2xs">
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

            <!-- Rincian Informasi Cuti Card -->
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

                <!-- Alasan -->
                <div class="text-xs">
                    <span class="text-muted-color block mb-1">Alasan Permohonan Cuti</span>
                    <p class="text-surface-800 dark:text-surface-200 leading-relaxed bg-surface-50 dark:bg-surface-800 p-3 rounded-lg border border-surface-200/60 dark:border-surface-700/60">
                        {{ reason }}
                    </p>
                </div>

                <!-- Dokumen Pendukung -->
                <div v-if="attachment || documentPending(fullRequest)" class="text-xs pt-1">
                    <span class="text-muted-color block mb-1">Dokumen Pendukung</span>
                    <LeaveAttachment :request="fullRequest" />
                </div>
            </div>

            <!-- Timeline Alur Approval Dinamis (d_leave_request_step) -->
            <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4">
                <h5 class="font-bold text-xs uppercase tracking-wider text-muted-color mb-3 pb-2 border-b border-surface-100 dark:border-surface-800">
                    Alur Persetujuan Bertingkat
                </h5>

                <div v-if="stepsList.length === 0" class="text-center py-4 text-xs text-muted-color">
                    Belum ada data tahapan approval untuk pengajuan ini.
                </div>

                <div v-else class="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-700">
                    <div
                        v-for="(step, idx) in stepsList"
                        :key="step.id || idx"
                        class="relative"
                    >
                        <!-- Timeline bullet marker -->
                        <div
                            class="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-surface-0 dark:bg-surface-900 flex items-center justify-center"
                            :class="[
                                step.status === 'approved' ? 'border-emerald-500 text-emerald-500' : '',
                                step.status === 'rejected' ? 'border-rose-500 text-rose-500' : '',
                                step.status === 'returned' ? 'border-amber-500 text-amber-500' : '',
                                step.status === 'pending' && step.isCurrent ? 'border-sky-500 text-sky-500' : '',
                                step.status === 'pending' && !step.isCurrent ? 'border-surface-300 dark:border-surface-600 text-surface-400' : ''
                            ]"
                        >
                            <span class="w-1.5 h-1.5 rounded-full" :class="[
                                step.status === 'approved' ? 'bg-emerald-500' : '',
                                step.status === 'rejected' ? 'bg-rose-500' : '',
                                step.status === 'returned' ? 'bg-amber-500' : '',
                                step.status === 'pending' && step.isCurrent ? 'bg-sky-500' : '',
                                step.status === 'pending' && !step.isCurrent ? 'bg-surface-300 dark:bg-surface-600' : ''
                            ]"></span>
                        </div>

                        <!-- Step Card Content -->
                        <div
                            class="rounded-xl p-3 border text-xs"
                            :class="[
                                step.status === 'returned' ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/80' :
                                step.status === 'rejected' ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/80' :
                                step.status === 'approved' ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-surface-200/70 dark:border-surface-700/70' :
                                'bg-surface-50 dark:bg-surface-800/60 border-surface-200/70 dark:border-surface-700/70'
                            ]"
                        >
                            <div class="flex items-center justify-between gap-2 mb-1.5">
                                <div class="flex items-center gap-1.5 font-semibold text-surface-900 dark:text-surface-0">
                                    <User :size="13" class="text-muted-color" />
                                    <span>Tingkat {{ step.level }}: {{ step.approverName }}</span>
                                </div>
                                <Tag
                                    :value="getStepBadge(step.status, step.isCurrent).label"
                                    :severity="getStepBadge(step.status, step.isCurrent).severity"
                                    class="text-[11px] font-semibold !px-2 !py-0.5"
                                />
                            </div>

                            <!-- Tanggal Tindakan -->
                            <div v-if="step.actedAt" class="text-[11px] text-muted-color flex items-center gap-1 mb-1">
                                <Clock :size="11" />
                                <span>Waktu Keputusan: {{ formatDateTime(step.actedAt) }}</span>
                            </div>

                            <!-- Catatan -->
                            <div
                                v-if="step.notes"
                                class="mt-2 text-xs p-2 rounded border italic"
                                :class="[
                                    step.status === 'returned' ? 'text-amber-900 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800' :
                                    step.status === 'rejected' ? 'text-rose-900 dark:text-rose-200 bg-rose-50/80 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800' :
                                    'text-surface-700 dark:text-surface-300 bg-surface-0 dark:bg-surface-900 border-surface-200/50 dark:border-surface-700/50'
                                ]"
                            >
                                <span class="font-semibold not-italic block text-[11px] uppercase tracking-wider mb-0.5" :class="step.status === 'returned' ? 'text-amber-700 dark:text-amber-300' : (step.status === 'rejected' ? 'text-rose-700 dark:text-rose-300' : 'text-muted-color')">
                                    {{ step.status === 'returned' ? 'Catatan Pengembalian / Revisi:' : (step.status === 'rejected' ? 'Alasan Penolakan:' : 'Catatan:') }}
                                </span>
                                &ldquo;{{ step.notes }}&rdquo;
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex items-center justify-between gap-2 w-full pt-3 border-t border-surface-100 dark:border-surface-800">
                <!-- Sisi Kiri: Tombol Tutup (Aksi Netral / Keluar) -->
                <Button
                    label="Tutup"
                    severity="secondary"
                    class="text-xs font-semibold px-4"
                    @click="emit('update:visible', false)"
                />

                <!-- Sisi Kanan: Aksi Keputusan / Operasional -->
                <div class="flex items-center gap-2">
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
