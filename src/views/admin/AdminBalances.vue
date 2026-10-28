<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, can, YEAR_OPTIONS } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { Wallet, Search, Pencil, RefreshCw, Filter, History } from 'lucide-vue-next';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import BalanceEditDialog from '@/components/admin/BalanceEditDialog.vue';
import BalanceHistoryDialog from '@/components/admin/BalanceHistoryDialog.vue';

const toast = useToast();
const loading = ref(false);
const balances = ref([]);
const departments = ref([]);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
const canManage = computed(() => isSuper.value || can('master_data.manage_balance'));

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;

const searchQuery = ref('');
const departmentFilter = ref(null);

const editDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const selectedBalance = ref(null);

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
    selectedBalance.value = item;
    editDialogVisible.value = true;
}

function openHistory(item) {
    selectedBalance.value = item;
    historyDialogVisible.value = true;
}

onMounted(() => {
    loadBalances();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="saldo cuti" />

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <Wallet class="text-primary w-5 h-5" />
                    <span>Manajemen Saldo Cuti Karyawan</span>
                </h1>
                <p class="text-xs text-muted-color">
                    Pantau kuota tahunan, pemakaian, dan sesuaikan saldo cuti karyawan
                    <span v-if="adminDivision" class="font-bold text-primary">({{ adminDivision }})</span>
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

        <div data-tour="bal-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText id="cari-saldo" name="cari-saldo" aria-label="Cari saldo berdasarkan nama atau NIK" v-model="searchQuery" placeholder="Cari Nama / NIK..." class="w-full text-xs" size="small" />
                </IconField>

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
                    class="w-full sm:w-48 text-xs"
                    size="small"
                />

                <Select
                    v-model="selectedYear"
                    :options="yearOptions"
                    placeholder="Pilih Tahun"
                    class="w-full sm:w-32 text-xs"
                    size="small"
                />
            </div>
            <div class="text-xs text-muted-color w-full sm:w-auto text-right">
                Total Karyawan: <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredBalances.length }}</span>
            </div>
        </div>

        <div data-tour="bal-table" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredBalances"
                :loading="loading"
                paginator
                :rows="10"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color">Tidak ada data saldo cuti untuk kriteria ini.</div>
                </template>

                <Column header="Karyawan" style="width: 25%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nama || '-' }}</div>
                        <div class="text-[11px] text-muted-color font-mono">NIK: {{ data.namecode || '-' }}</div>
                    </template>
                </Column>

                <Column header="Departemen" style="width: 12%">
                    <template #body="{ data }">
                        <Tag :value="data.kd_dept || '-'" severity="info" class="text-[11px] font-bold" />
                    </template>
                </Column>

                <Column header="Hak Kuota" style="width: 13%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-900 dark:text-surface-100">{{ data.annual_quota ?? '-' }}</span>
                        <span class="text-muted-color text-[11px] ml-1">hari</span>
                    </template>
                </Column>

                <Column header="Carry Over" style="width: 14%">
                    <template #body="{ data }">
                        <div>
                            <span class="font-semibold text-surface-800 dark:text-surface-200">{{ data.carry_over_days ?? 0 }}</span>
                            <span class="text-muted-color text-[11px] ml-1">hari</span>
                        </div>
                        <div v-if="data.carry_over_expiry_date" class="text-[10px] text-amber-600 dark:text-amber-400">
                            Exp: {{ String(data.carry_over_expiry_date).slice(0, 10) }}
                        </div>
                    </template>
                </Column>

                <Column header="Cuti Terpakai" style="width: 13%">
                    <template #body="{ data }">
                        <span class="font-semibold text-rose-600 dark:text-rose-400">{{ data.used_days ?? 0 }}</span>
                        <span class="text-muted-color text-[11px] ml-1">hari</span>
                    </template>
                </Column>

                <Column header="Sisa Saldo" style="width: 13%">
                    <template #body="{ data }">
                        <div class="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs"
                             :class="(data.remaining ?? (Number(data.annual_quota || 0) + Number(data.carry_over_days || 0) - Number(data.used_days || 0))) > 0
                                     ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                     : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400'">
                            {{ data.remaining ?? Math.max(0, (Number(data.annual_quota || 0) + Number(data.carry_over_days || 0) - Number(data.used_days || 0))) }} hari
                        </div>
                    </template>
                </Column>

                <Column header="Aksi" style="width: 10%" :pt="{ headerCell: { 'data-tour': 'bal-col-aksi' } }">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openHistory(data)"
                                title="Lihat Riwayat Mutasi Saldo"
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

        <BalanceEditDialog
            v-model:visible="editDialogVisible"
            :balance-data="selectedBalance"
            @saved="loadBalances"
        />

        <BalanceHistoryDialog
            v-model:visible="historyDialogVisible"
            :user="selectedBalance"
            :year="selectedYear"
        />
    </div>
</template>
