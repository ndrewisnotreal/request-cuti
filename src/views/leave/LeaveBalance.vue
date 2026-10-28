<script setup>
import { computed, ref, onMounted } from 'vue';
import { leaveService } from '@/service/leaveService';
import { formatDate, YEAR_OPTIONS, can } from '@/service/sicutiService';
import StatStrip from '@/components/common/StatStrip.vue';
import { Plus, FolderOpen, ArrowUpRight, ArrowDownLeft, CalendarCheck, CalendarDays, CalendarMinus, History } from 'lucide-vue-next';

const loading = ref(false);
const balances = ref([]);
const mutations = ref([]);
const mutationTypeFilter = ref('all');

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;

async function loadBalanceData() {
    loading.value = true;
    try {
        const balsPromise = leaveService.getBalances({ year: selectedYear.value }).catch(() => []);
        const [bals, muts] = await Promise.all([
            balsPromise,
            leaveService.getBalanceMutations({ year: selectedYear.value, balances: balsPromise }).catch(() => [])
        ]);

        balances.value = Array.isArray(bals) ? bals : (bals ? [bals] : []);
        mutations.value = Array.isArray(muts) ? muts : [];
    } catch (err) {
        console.error('Failed to load balance info:', err);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadBalanceData();
});

const userBalance = computed(() => {
    if (!balances.value.length) {
        return {
            remaining: 0,
            annual_quota: 12,
            used_days: 0,
            carry_over_days: 0,
            carry_over_expiry_date: null,
            year: selectedYear.value
        };
    }
    const found = balances.value.find((b) => Number(b.year) === Number(selectedYear.value)) || balances.value[0];
    return {
        remaining: Number(found.remaining ?? (Number(found.annual_quota || 0) + Number(found.carry_over_days || 0) - Number(found.used_days || 0))),
        annual_quota: Number(found.annual_quota ?? 0),
        used_days: Number(found.used_days ?? 0),
        carry_over_days: Number(found.carry_over_days ?? 0),
        carry_over_expiry_date: found.carry_over_expiry_date || null,
        year: found.year || selectedYear.value,
        period_label: found.period_label || ''
    };
});

const totalQuota = computed(() => {
    return userBalance.value.annual_quota + userBalance.value.carry_over_days;
});

const quotaPercentage = computed(() => {
    if (totalQuota.value <= 0) return 0;
    return Math.min(100, Math.round((userBalance.value.used_days / totalQuota.value) * 100));
});

const statItems = computed(() => {
    const b = userBalance.value;
    return [
        {
            label: 'Saldo tersisa',
            value: b.remaining,
            unit: 'hari',
            accent: true,
            progress: quotaPercentage.value,
            hint: `${b.used_days} dari ${totalQuota.value} hari terpakai`,
            icon: CalendarCheck
        },
        { label: 'Hak kuota tahunan', value: b.annual_quota, unit: 'hari', hint: `Periode ${b.period_label || b.year}`, icon: CalendarDays },
        { label: 'Cuti terpakai', value: b.used_days, unit: 'hari', hint: 'Sudah disetujui', icon: CalendarMinus },
        {
            label: 'Carry over',
            value: b.carry_over_days,
            unit: 'hari',
            hint: b.carry_over_days > 0 && b.carry_over_expiry_date ? `Hangus ${formatDate(b.carry_over_expiry_date)}` : 'Tidak ada carry over',
            icon: History
        }
    ];
});

const mutationTabs = computed(() => [
    { key: 'all', label: `Semua (${mutations.value.length})` },
    { key: 'credit', label: `Kredit (+${totalCredit.value})`, icon: ArrowDownLeft },
    { key: 'debit', label: `Debit (-${totalDebit.value})`, icon: ArrowUpRight }
]);

const filteredMutations = computed(() => {
    if (!mutations.value.length) return [];
    if (mutationTypeFilter.value === 'all') return mutations.value;
    return mutations.value.filter((m) => m.type === mutationTypeFilter.value);
});

const totalCredit = computed(() => {
    return mutations.value
        .filter((m) => m.type === 'credit')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);
});

const totalDebit = computed(() => {
    return mutations.value
        .filter((m) => m.type === 'debit')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Informasi Saldo Cuti</h1>
                <p class="text-xs text-muted-color">Kuota, carry over, dan riwayat mutasi saldo cuti Anda</p>
            </div>
            <div class="flex items-center gap-2">
                <Select
                    v-model="selectedYear"
                    :options="yearOptions"
                    optionLabel="label"
                    optionValue="value"
                    @change="loadBalanceData"
                    class="text-xs w-36"
                    size="small"
                    aria-label="Pilih tahun"
                />
                <Button v-if="can('pengajuan_cuti.submit')" @click="$router.push({ path: '/leave/history', query: { action: 'new_leave' } })" size="small" class="font-semibold text-xs flex items-center gap-1.5">
                    <Plus :size="14" :stroke-width="2" />
                    <span>Tambah Pengajuan</span>
                </Button>
            </div>
        </div>

        <StatStrip data-tour="balance-stats" :items="statItems" />

        <div data-tour="balance-mutasi" class="card mb-0 p-5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 shadow-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-surface-100 dark:border-surface-800">
                <div>
                    <h2 class="font-bold text-base text-surface-900 dark:text-surface-0 leading-tight">
                        Riwayat Mutasi Saldo
                    </h2>
                    <p class="text-xs text-muted-color mt-0.5">
                        Log transaksi penambahan (kredit) dan pengurangan (debit) kuota cuti tahunan Anda
                    </p>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                    <div class="flex items-center gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-lg text-xs" role="tablist" aria-label="Saring jenis mutasi">
                        <button
                            v-for="tab in mutationTabs"
                            :key="tab.key"
                            type="button"
                            role="tab"
                            :aria-selected="mutationTypeFilter === tab.key"
                            @click="mutationTypeFilter = tab.key"
                            :class="[
                                'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 tabular-nums',
                                mutationTypeFilter === tab.key
                                    ? 'bg-surface-0 dark:bg-surface-700 text-surface-900 dark:text-surface-0 shadow-2xs font-semibold'
                                    : 'text-muted-color hover:text-surface-800 dark:hover:text-surface-200'
                            ]"
                        >
                            <component v-if="tab.icon" :is="tab.icon" :size="12" />
                            <span>{{ tab.label }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <DataTable :value="filteredMutations" :loading="loading" class="p-datatable-sm text-xs">
                <template #empty>
                    <div class="text-center py-10 text-muted-color text-xs">
                        <FolderOpen :size="32" :stroke-width="1.5" class="text-surface-400 mb-2 block mx-auto" />
                        Belum ada riwayat transaksi mutasi saldo pada periode ini.
                    </div>
                </template>

                <Column header="No" style="width: 5%">
                    <template #body="{ index }">
                        <span class="text-muted-color font-semibold text-xs tabular-nums">{{ index + 1 }}</span>
                    </template>
                </Column>

                <Column header="Jenis Mutasi" style="width: 16%">
                    <template #body="{ data }">
                        <span
                            :class="[
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                                data.type === 'credit'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            ]"
                        >
                            <component :is="data.type === 'credit' ? ArrowDownLeft : ArrowUpRight" :size="12" :stroke-width="2.5" />
                            <span>{{ data.type === 'credit' ? 'Kredit (+)' : 'Debit (-)' }}</span>
                        </span>
                    </template>
                </Column>

                <Column header="Jumlah Hari" style="width: 14%" class="text-left">
                    <template #body="{ data }">
                        <span
                            :class="[
                                'text-xs font-bold tabular-nums',
                                data.type === 'credit'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                            ]"
                        >
                            {{ data.type === 'credit' ? '+' : '-' }}{{ data.amount }} hari
                        </span>
                    </template>
                </Column>

                <Column header="Keterangan">
                    <template #body="{ data }">
                        <span class="text-xs text-surface-900 dark:text-surface-0 font-medium">
                            {{ data.description }}<template v-if="data.expiry">, hangus {{ formatDate(data.expiry) }}</template>
                        </span>
                    </template>
                </Column>

                <Column header="Tanggal" style="width: 16%">
                    <template #body="{ data }">
                        <span class="text-xs text-surface-700 dark:text-surface-300 tabular-nums">
                            {{ formatDate(data.date) }}
                        </span>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
