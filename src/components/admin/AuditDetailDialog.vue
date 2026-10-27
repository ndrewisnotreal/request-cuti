<template>
    <Dialog
        :visible="visible"
        modal
        header="Rincian Log Aktivitas"
        :style="{ width: '500px', maxWidth: '95vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div v-if="log" class="space-y-4 pt-2 text-xs">
            <div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700">
                <div>
                    <span class="text-muted-color block mb-0.5">Waktu Kejadian</span>
                    <span class="font-semibold text-surface-900 dark:text-surface-100">
                        {{ formattedTime }}
                    </span>
                </div>
                <div>
                    <span class="text-muted-color block mb-0.5">IP Address</span>
                    <span class="font-mono font-semibold text-surface-900 dark:text-surface-100">
                        {{ log.ip_address || '-' }}
                    </span>
                </div>
                <div>
                    <span class="text-muted-color block mb-0.5">Pengguna</span>
                    <span class="font-semibold text-surface-900 dark:text-surface-100">
                        {{ log.username || log.user || '-' }}
                    </span>
                </div>
                <div>
                    <span class="text-muted-color block mb-0.5">Entitas Target</span>
                    <span class="font-mono font-semibold text-surface-900 dark:text-surface-100">
                        {{ log.entity || '-' }}
                    </span>
                </div>
            </div>

            <div>
                <span class="text-muted-color block mb-1 font-semibold">Tipe Aksi</span>
                <Tag
                    :value="log.action"
                    :severity="getActionSeverity(log.action)"
                    class="text-xs font-mono"
                />
            </div>

            <div>
                <span class="text-muted-color block mb-1 font-semibold">Keterangan / Deskripsi Perubahan</span>
                <div class="p-3 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 leading-relaxed font-mono text-[11px] whitespace-pre-wrap break-words">
                    {{ log.details || log.description || '-' }}
                </div>
            </div>

            <div v-if="log.payload" class="space-y-1">
                <span class="text-muted-color block font-semibold">Payload Data (JSON)</span>
                <pre class="p-3 rounded-lg bg-surface-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48">{{ JSON.stringify(log.payload, null, 2) }}</pre>
            </div>

            <div class="flex justify-end pt-2">
                <Button
                    label="Tutup"
                    severity="secondary"
                    size="small"
                    class="text-xs"
                    @click="closeDialog"
                />
            </div>
        </div>
    </Dialog>
</template>

<script setup>
import { computed } from 'vue';
import { formatDate } from '@/service/sicutiService';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    log: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible']);

function closeDialog() {
    emit('update:visible', false);
}

function getActionSeverity(action) {
    if (!action) return 'secondary';
    const a = action.toUpperCase();
    if (a.includes('APPROVE') || a === 'LOGIN') return 'success';
    if (a.includes('REJECT') || a.includes('DELETE') || a === 'LOCKOUT') return 'danger';
    if (a.includes('CREATE') || a.includes('INSERT') || a.includes('SUBMIT')) return 'info';
    if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('RETURN') || a.includes('RESET')) return 'warn';
    return 'secondary';
}

const formattedTime = computed(() => {
    if (!props.log) return '-';
    const raw = String(props.log.timestamp || props.log.created_at || '');
    if (!raw) return '-';
    const datePart = raw.split(/[ T]/)[0];
    const timePart = raw.split(/[ T]/)[1]?.slice(0, 8);
    const formattedDate = datePart ? formatDate(datePart) : '';
    return timePart ? `${formattedDate}, ${timePart} WIB` : formattedDate;
});
</script>
