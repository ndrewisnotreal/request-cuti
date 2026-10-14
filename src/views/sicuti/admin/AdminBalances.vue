<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService } from '@/service/adminService';
import api from '@/service/api';
import { getAdminDivision, currentUser, isSuperAdmin, can, YEAR_OPTIONS, CURRENT_YEAR, defaultAnnualQuota, formatDate, formatDateTime } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { Wallet, Search, Pencil, RefreshCw, Filter, History } from 'lucide-vue-next';
import ReadOnlyNotice from '../shared/ReadOnlyNotice.vue';

const toast = useToast();
const loading = ref(false);
const saving = ref(false);
const balances = ref([]);
const departments = ref([]);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
// Prototype: Admin Seksi hanya melihat saldo, kecuali diberi izin manage_balance
const canManage = computed(() => isSuper.value || can('master_data.manage_balance'));

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;

const searchQuery = ref('');
const departmentFilter = ref(null);

// Edit / Adjust Dialog
const editDialogVisible = ref(false);
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
const reasonError = ref('');

// Riwayat mutasi saldo per karyawan (backlog E33 audit saldo)
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyRows = ref([]);
const historyFor = ref(null);
const HISTORY_LABEL = { DEDUCT: 'Pemakaian', REFUND: 'Pengembalian', ADJUST: 'Penyesuaian admin', EXPIRED: 'Carry over hangus', INIT: 'Saldo awal' };

async function openHistory(item) {
    historyFor.value = item;
    historyVisible.value = true;
    historyLoading.value = true;
    try {
        const res = await api.get('/sicuti/leave-balance/history', { uid: item.uid_user_system, year: item.year || selectedYear.value });
        historyRows.value = Array.isArray(res?.data) ? res.data : [];
    } catch (err) {
        historyRows.value = [];
        toast.add({ severity: 'error', summary: 'Riwayat Gagal Dimuat', detail: err.message, life: 3000 });
    } finally {
        historyLoading.value = false;
    }
}

async function loadBalances() {
    loading.value = true;
    try {
        const [balData, deptsData] = await Promise.all([
            adminService.getBalances(selectedYear.value),
            adminService.getDepartments().catch(() => [])
        ]);

        balances.value = Array.isArray(balData) ? balData : [];
        departments.value = Array.isArray(deptsData) ? deptsData : [];
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Saldo',
            detail: err.message || 'Gagal mengambil data saldo cuti karyawan',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

watch(selectedYear, () => {
    loadBalances();
});

const filteredBalances = computed(() => {
    return balances.value.filter((b) => {
        const targetDept = adminDivision.value || departmentFilter.value;
        if (targetDept && b.kd_dept !== targetDept) {
            return false;
        }

        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const name = (b.nama || '').toLowerCase();
            const nik = (b.namecode || '').toLowerCase();
            if (!name.includes(q) && !nik.includes(q)) {
                return false;
            }
        }

        return true;
    });
});

function openEdit(item) {
    editingBalance.value = {
        id_balance: item.id_balance,
        uid_user_system: item.uid_user_system,
        nama: item.nama || '-',
        namecode: item.namecode || '-',
        kd_dept: item.kd_dept || '-',
        year: item.year || selectedYear.value,
        annual_quota: Number(item.annual_quota ?? defaultAnnualQuota()),
        carry_over_days: Number(item.carry_over_days ?? 0),
        used_days: Number(item.used_days ?? 0),
        carry_over_expiry_date: item.carry_over_expiry_date ? String(item.carry_over_expiry_date).slice(0, 10) : '',
        reason: ''
    };
    reasonError.value = '';
    editDialogVisible.value = true;
}

async function saveAdjustBalance() {
    // Alasan wajib: dicatat di riwayat saldo sebagai audit (backlog E31)
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
        editDialogVisible.value = false;
        await loadBalances();
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

onMounted(() => {
    loadBalances();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice v-if="!canManage" module="saldo cuti karyawan" />
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <Wallet class="text-primary w-5 h-5" />
                    <span>Kelola Saldo Cuti Karyawan</span>
                </h2>
                <p class="text-xs text-muted-color">
                    Manajemen kuota tahunan, carry over, dan penyesuaian hak cuti karyawan
                    <span v-if="adminDivision" class="font-bold text-primary">Divisi {{ adminDivision }}</span>
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    :loading="loading"
                    @click="loadBalances"
                >
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText
                        v-model="searchQuery"
                        placeholder="Cari Karyawan / NIK..."
                        class="w-full text-xs"
                        size="small"
                    />
                </IconField>

                <Select
                    v-model="selectedYear"
                    :options="yearOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Tahun"
                    class="w-full sm:w-40 text-xs"
                    size="small"
                />

                <div v-if="adminDivision" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 flex items-center gap-1.5">
                    <span class="text-muted-color">Divisi:</span>
                    <span class="text-primary font-bold">{{ adminDivision }}</span>
                </div>
                <Select
                    v-else-if="isSuper"
                    v-model="departmentFilter"
                    :options="[{ label: 'Semua Divisi', value: null }, ...departments.map(d => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Divisi"
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />
            </div>
            <div class="text-xs text-muted-color w-full sm:w-auto text-right">
                Total Data: <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredBalances.length }}</span> Karyawan
            </div>
        </div>

        <!-- DataTable Saldo -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredBalances"
                :loading="loading"
                paginator
                :rows="10"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color">Tidak ada data saldo cuti karyawan.</div>
                </template>

                <Column header="NIK / ID" style="width: 14%">
                    <template #body="{ data }">
                        <span class="font-mono font-bold text-surface-900 dark:text-surface-100">
                            {{ data.namecode || '-' }}
                        </span>
                    </template>
                </Column>

                <Column header="Nama Karyawan" style="width: 24%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nama }}</div>
                        <div class="text-[11px] text-muted-color">
                            Divisi: <span class="font-semibold text-primary">{{ data.kd_dept || '-' }}</span>
                        </div>
                    </template>
                </Column>

                <Column header="Periode Saldo" style="width: 18%">
                    <template #body="{ data }">
                        <span class="text-surface-700 dark:text-surface-300">
                            {{ data.period_start && data.period_end ? `${formatDate(data.period_start)} – ${formatDate(data.period_end)}` : data.period_label || '-' }}
                        </span>
                    </template>
                </Column>

                <Column header="Kuota Tahunan" style="width: 12%">
                    <template #body="{ data }">
                        <span class="font-bold text-surface-900 dark:text-surface-100">{{ data.annual_quota }}</span> Hari
                    </template>
                </Column>

                <Column header="Carry Over" style="width: 16%">
                    <template #body="{ data }">
                        <div>
                            <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ data.carry_over_days || 0 }}</span> Hari
                        </div>
                        <div v-if="data.carry_over_expiry_date" class="text-[11px] text-muted-color">
                            s/d {{ formatDate(data.carry_over_expiry_date) }}
                        </div>
                    </template>
                </Column>

                <Column header="Terpakai" style="width: 12%">
                    <template #body="{ data }">
                        <span class="font-bold text-rose-600 dark:text-rose-400">{{ data.used_days || 0 }}</span> Hari
                    </template>
                </Column>

                <Column header="Sisa Saldo" style="width: 12%">
                    <template #body="{ data }">
                        <span class="px-2 py-0.5 rounded-full font-black text-xs whitespace-nowrap bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            {{ data.remaining !== undefined ? data.remaining : (Number(data.annual_quota || 0) + Number(data.carry_over_days || 0) - Number(data.used_days || 0)) }} Hari
                        </span>
                    </template>
                </Column>

                <Column header="Aksi" style="width: 10%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openHistory(data)"
                                title="Riwayat Saldo"
                            >
                                <History :size="15" :stroke-width="1.75" />
                            </button>
                            <button
                                v-if="canManage"
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openEdit(data)"
                                title="Sesuaikan Saldo"
                            >
                                <Pencil :size="15" :stroke-width="1.75" />
                            </button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Dialog Penyesuaian Saldo -->
        <Dialog
            v-model:visible="editDialogVisible"
            modal
            header="Penyesuaian Saldo Cuti Karyawan"
            :style="{ width: '460px' }"
            :breakpoints="{ '640px': '92vw' }"
        >
            <div class="space-y-4 pt-2 text-xs">
                <!-- Info Karyawan -->
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
                    <label for="balance-reason" class="block font-medium mb-1">Alasan Penyesuaian <span class="text-rose-500">*</span></label>
                    <Textarea
                        id="balance-reason"
                        v-model="editingBalance.reason"
                        rows="2"
                        class="w-full text-xs"
                        placeholder="Contoh: Koreksi saldo awal sesuai data HR"
                        :invalid="Boolean(reasonError)"
                    />
                    <small v-if="reasonError" class="text-rose-500 text-[11px]">{{ reasonError }}</small>
                    <p v-else class="text-[11px] text-muted-color mt-0.5">Dicatat di riwayat saldo karyawan.</p>
                </div>

                <!-- Live Remaining Calculation -->
                <div class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span class="font-medium">Total Sisa Saldo:</span>
                    <span class="font-black text-sm">
                        {{ Math.max(0, (Number(editingBalance.annual_quota || 0) + Number(editingBalance.carry_over_days || 0) - Number(editingBalance.used_days || 0))) }} Hari
                    </span>
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Batal" severity="secondary" size="small" text @click="editDialogVisible = false" />
                    <Button label="Simpan Saldo" severity="primary" size="small" class="font-bold" :loading="saving" @click="saveAdjustBalance" />
                </div>
            </template>
        </Dialog>

        <!-- Dialog Riwayat Saldo -->
        <Dialog
            v-model:visible="historyVisible"
            modal
            :header="`Riwayat Saldo · ${historyFor?.nama || ''}`"
            :style="{ width: '620px' }"
            :breakpoints="{ '640px': '95vw' }"
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
    </div>
</template>
