<script setup>
import { ref, watch } from 'vue';
import api from '@/service/api';
import { formatDateTime } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    user: {
        type: Object,
        default: null
    },
    year: {
        type: Number,
        default: null
    }
});

const emit = defineEmits(['update:visible']);
const toast = useToast();

const historyRows = ref([]);
const historyLoading = ref(false);

const HISTORY_LABEL = {
    DEDUCT: 'Pemakaian',
    REFUND: 'Pengembalian',
    ADJUST: 'Penyesuaian admin',
    EXPIRED: 'Carry over hangus',
    INIT: 'Saldo awal'
};

watch(
    () => props.visible,
    async (isOpen) => {
        if (!isOpen || !props.user?.uid_user_system) {
            historyRows.value = [];
            return;
        }
        historyLoading.value = true;
        try {
            const yr = props.year || props.user.year || new Date().getFullYear();
            const res = await api.get('/sicuti/leave-balance/history', {
                uid: props.user.uid_user_system,
                year: yr
            });
            historyRows.value = Array.isArray(res?.data) ? res.data : [];
        } catch (err) {
            historyRows.value = [];
            toast.add({ severity: 'error', summary: 'Riwayat Gagal Dimuat', detail: err.message, life: 3000 });
        } finally {
            historyLoading.value = false;
        }
    }
);
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="`Riwayat Saldo · ${user?.nama || ''}`"
        :style="{ width: '620px' }"
        :breakpoints="{ '640px': '95vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <DataTable :value="historyRows" :loading="historyLoading" class="p-datatable-sm text-xs" :rows="10" paginator responsiveLayout="scroll">
            <template #empty>
                <div class="text-center py-6 text-muted-color">Belum ada mutasi saldo pada tahun ini.</div>
            </template>
            <Column header="Waktu" style="width: 26%">
                <template #body="{ data }">{{ formatDateTime(data.created_at) }}</template>
            </Column>
            <Column header="Jenis" style="width: 22%">
                <template #body="{ data }">{{ HISTORY_LABEL[data.type] || data.type }}</template>
            </Column>
            <Column header="Hari" style="width: 10%">
                <template #body="{ data }">
                    <span class="font-semibold tabular-nums">{{ Number(data.amount) > 0 && data.type !== 'DEDUCT' ? '+' : '' }}{{ data.type === 'DEDUCT' ? -Math.abs(data.amount) : data.amount }}</span>
                </template>
            </Column>
            <Column header="Keterangan">
                <template #body="{ data }">{{ data.reason || '-' }}</template>
            </Column>
        </DataTable>
    </Dialog>
</template>
