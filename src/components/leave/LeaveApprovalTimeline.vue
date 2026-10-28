<script setup>
import { formatDateTime } from '@/service/sicutiService';
import { User, Clock, CheckCircle2, XCircle, RotateCcw } from 'lucide-vue-next';

defineProps({
    steps: {
        type: Array,
        default: () => []
    }
});

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
</script>

<template>
    <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4">
        <h5 class="font-bold text-xs uppercase tracking-wider text-muted-color mb-3 pb-2 border-b border-surface-100 dark:border-surface-800">
            Alur Persetujuan Bertingkat
        </h5>

        <div v-if="steps.length === 0" class="text-center py-4 text-xs text-muted-color">
            Belum ada data tahapan approval untuk pengajuan ini.
        </div>

        <div v-else class="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-700">
            <div
                v-for="(step, idx) in steps"
                :key="step.id || idx"
                class="relative"
            >
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

                    <div v-if="step.actedAt" class="text-[11px] text-muted-color flex items-center gap-1 mb-1">
                        <Clock :size="11" />
                        <span>Waktu Keputusan: {{ formatDateTime(step.actedAt) }}</span>
                    </div>

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
</template>
