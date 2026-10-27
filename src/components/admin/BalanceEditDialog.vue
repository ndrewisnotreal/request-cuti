<script setup>
import { ref, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { defaultAnnualQuota, CURRENT_YEAR } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    balanceData: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const saving = ref(false);
const reasonError = ref('');

const editingBalance = ref({
    id_balance: '',
    uid_user_system: '',
    nama: '',
    namecode: '',
    kd_dept: '',
    year: CURRENT_YEAR,
    annual_quota: defaultAnnualQuota(),
    carry_over_days: 0,
    used_days: 0,
    carry_over_expiry_date: '',
    reason: ''
});

watch(
    () => props.visible,
    (isOpen) => {
        if (!isOpen) return;
        reasonError.value = '';
        if (props.balanceData) {
            const item = props.balanceData;
            editingBalance.value = {
                id_balance: item.id_balance || '',
                uid_user_system: item.uid_user_system,
                nama: item.nama || '-',
                namecode: item.namecode || '-',
                kd_dept: item.kd_dept || '-',
                year: item.year || CURRENT_YEAR,
                annual_quota: Number(item.annual_quota ?? defaultAnnualQuota()),
                carry_over_days: Number(item.carry_over_days ?? 0),
                used_days: Number(item.used_days ?? 0),
                carry_over_expiry_date: item.carry_over_expiry_date ? String(item.carry_over_expiry_date).slice(0, 10) : '',
                reason: ''
            };
        }
    }
);

async function saveAdjustBalance() {
    if (!editingBalance.value.reason.trim()) {
        reasonError.value = 'Alasan penyesuaian wajib diisi';
        return;
    }
    reasonError.value = '';
    saving.value = true;
    try {
        const payload = {
            uid_user_system: editingBalance.value.uid_user_system,
            year: Number(editingBalance.value.year),
            annual_quota: Number(editingBalance.value.annual_quota),
            carry_over_days: Number(editingBalance.value.carry_over_days),
            carry_over_expiry_date: editingBalance.value.carry_over_expiry_date || undefined,
            reason: editingBalance.value.reason.trim()
        };

        await adminService.upsertBalance(payload);
        toast.add({
            severity: 'success',
            summary: 'Saldo Diperbarui',
            detail: `Saldo cuti ${editingBalance.value.nama} berhasil disesuaikan`,
            life: 3000
        });
        emit('update:visible', false);
        emit('saved');
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Menyesuaikan Saldo',
            detail: err.message || 'Terjadi kesalahan saat menyimpan saldo',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        header="Penyesuaian Saldo Cuti Karyawan"
        :style="{ width: '460px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-4 pt-2 text-xs">
            <div class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                <div class="font-bold text-surface-900 dark:text-surface-100 text-sm">{{ editingBalance.nama }}</div>
                <div class="text-[11px] text-muted-color">NIK: {{ editingBalance.namecode }} · Divisi: {{ editingBalance.kd_dept }} · Tahun {{ editingBalance.year }}</div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block font-medium mb-1">Kuota Tahunan (Hari) *</label>
                    <InputNumber v-model="editingBalance.annual_quota" :min="0" :max="50" class="w-full text-xs" />
                </div>
                <div>
                    <label class="block font-medium mb-1">Carry Over (Hari)</label>
                    <InputNumber v-model="editingBalance.carry_over_days" :min="0" :max="30" class="w-full text-xs" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block font-medium mb-1">Kadaluarsa Carry Over</label>
                    <InputText v-model="editingBalance.carry_over_expiry_date" type="date" class="w-full text-xs" />
                </div>
                <div>
                    <span class="block font-medium mb-1">Hari Terpakai</span>
                    <div class="h-[34px] flex items-center font-semibold text-surface-800 dark:text-surface-200">
                        {{ editingBalance.used_days }} hari
                    </div>
                </div>
            </div>
            <p class="text-[11px] text-muted-color -mt-2">Hari terpakai dihitung otomatis dari cuti yang sudah disetujui dalam periode saldo.</p>

            <div>
                <label for="balance-reason-input" class="block font-medium mb-1">Alasan Penyesuaian <span class="text-rose-500">*</span></label>
                <Textarea
                    id="balance-reason-input"
                    v-model="editingBalance.reason"
                    rows="2"
                    class="w-full text-xs"
                    placeholder="Contoh: Koreksi saldo awal sesuai data HR"
                    :invalid="Boolean(reasonError)"
                />
                <small v-if="reasonError" class="text-rose-500 text-[11px]">{{ reasonError }}</small>
                <p v-else class="text-[11px] text-muted-color mt-0.5">Dicatat di riwayat saldo karyawan.</p>
            </div>

            <div class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span class="font-medium">Total Sisa Saldo:</span>
                <span class="font-black text-sm">
                    {{ Math.max(0, (Number(editingBalance.annual_quota || 0) + Number(editingBalance.carry_over_days || 0) - Number(editingBalance.used_days || 0))) }} Hari
                </span>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Batal" severity="secondary" size="small" text @click="emit('update:visible', false)" />
                <Button label="Simpan Saldo" severity="primary" size="small" class="font-bold" :loading="saving" @click="saveAdjustBalance" />
            </div>
        </template>
    </Dialog>
</template>
