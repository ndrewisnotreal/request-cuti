<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { leaveService } from '@/service/leaveService';
import {
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    can
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import StatStrip from '@/components/common/StatStrip.vue';
import DashboardMiniCalendar from '@/components/dashboard/DashboardMiniCalendar.vue';
import {
    Plus,
    ArrowRight,
    FolderOpen,
    Eye,
    CalendarCheck,
    CalendarDays,
    CalendarMinus,
    History
} from 'lucide-vue-next';

const router = useRouter();

const loading = ref(false);
const balances = ref([]);
const recentLeaves = ref([]);

const selectedRequest = ref(null);
const detailVisible = ref(false);

const todayDate = new Date();
const balanceYear = todayDate.getFullYear();

const activeBalance = computed(() => {
    if (!balances.value.length) {
        return {
            remaining: 0,
            annual_quota: 12,
            used_days: 0,
            carry_over_days: 0,
            carry_over_expiry_date: null,
            year: balanceYear,
            period_label: ''
        };
    }
    const found = balances.value.find((b) => Number(b.year) === balanceYear) || balances.value[0];
    return {
        remaining: Number(found.remaining ?? (Number(found.annual_quota || 0) + Number(found.carry_over_days || 0) - Number(found.used_days || 0))),
        annual_quota: Number(found.annual_quota ?? 0),
        used_days: Number(found.used_days ?? 0),
        carry_over_days: Number(found.carry_over_days ?? 0),
        carry_over_expiry_date: found.carry_over_expiry_date || null,
        year: found.year || balanceYear,
        period_label: found.period_label || ''
    };
});

const statItems = computed(() => {
    const b = activeBalance.value;
    return [
        {
            label: 'Saldo tersisa',
            value: b.remaining,
            unit: 'hari',
            hint: `dari ${b.annual_quota + b.carry_over_days} hari`,
            accent: true,
            icon: CalendarCheck
        },
        {
            label: 'Hak kuota tahunan',
            value: b.annual_quota,
            unit: 'hari',
            hint: `Periode ${b.period_label || b.year}`,
            icon: CalendarDays
        },
        {
            label: 'Cuti terpakai',
            value: b.used_days,
            unit: 'hari',
            hint: 'Sudah disetujui',
            icon: CalendarMinus
        },
        {
            label: 'Carry over',
            value: b.carry_over_days,
            unit: 'hari',
            hint: b.carry_over_days > 0 && b.carry_over_expiry_date ? `Hangus ${formatDate(b.carry_over_expiry_date)}` : 'Tidak ada carry over',
            icon: History
        }
    ];
});

const recentFiveLeaves = computed(() => {
    return (recentLeaves.value || []).slice(0, 5);
});

async function loadDashboardData() {
    loading.value = true;
    try {
        const [balRes, leavesRes] = await Promise.all([
            leaveService.getBalances({ year: balanceYear }).catch(() => []),
            leaveService.getMyLeaves({ limit: 20 }).catch(() => [])
        ]);

        balances.value = Array.isArray(balRes) ? balRes : (balRes ? [balRes] : []);
        recentLeaves.value = Array.isArray(leavesRes) ? leavesRes : [];
    } catch (err) {
        console.error('Failed to load dashboard data:', err);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    loadDashboardData();
});

function startNewLeave() {
    router.push({ path: '/leave/history', query: { action: 'new_leave' } });
}

function editFromDetail(req) {
    router.push({ path: '/leave/history', query: { editId: req.id_request || req.id } });
}

function viewDetail(request) {
    selectedRequest.value = request;
    detailVisible.value = true;
}
</script>

<template>
    <div class="space-y-6">
        <StatStrip data-tour="dash-stats" :items="statItems" />

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-8">
                <div data-tour="dash-riwayat" class="bg-surface-0 dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)]">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-surface-100 dark:border-surface-800">
                        <div>
                            <h2 class="font-bold text-base text-surface-900 dark:text-surface-0 tracking-tight leading-tight">Riwayat Pengajuan</h2>
                            <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Daftar permohonan cuti terbaru Anda</p>
                        </div>
                        <Button
                            v-if="can('pengajuan_cuti.submit')"
                            data-tour="dash-ajukan"
                            size="small"
                            class="text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-[0.97] transition-all duration-150 self-start sm:self-auto"
                            @click="startNewLeave"
                        >
                            <Plus :size="14" :stroke-width="2" />
                            <span>Ajukan Cuti</span>
                        </Button>
                    </div>

                    <div class="hidden sm:block">
                        <DataTable :value="recentFiveLeaves" :loading="loading" class="p-datatable-sm text-xs">
                            <template #empty>
                                <div class="text-center py-12 px-4">
                                    <div class="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-3 text-surface-400 dark:text-surface-500">
                                        <FolderOpen :size="24" :stroke-width="1.75" />
                                    </div>
                                    <p class="font-semibold text-sm text-surface-900 dark:text-surface-100">Belum Ada Pengajuan Cuti</p>
                                    <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-xs mx-auto">Anda belum mengajukan cuti pada periode ini. Klik tombol di atas untuk membuat permohonan baru.</p>
                                    <Button
                                        v-if="can('pengajuan_cuti.submit')"
                                        size="small"
                                        class="mt-4 text-xs font-semibold inline-flex items-center gap-1.5 active:scale-[0.97] transition-all"
                                        @click="startNewLeave"
                                    >
                                        <Plus :size="14" :stroke-width="2" />
                                        <span>Ajukan Cuti Baru</span>
                                    </Button>
                                </div>
                            </template>
                            <Column header="No" style="width: 3.5rem">
                                <template #body="{ index }">
                                    <span class="text-surface-400 dark:text-surface-500 font-medium text-xs tabular-nums">{{ index + 1 }}</span>
                                </template>
                            </Column>
                            <Column header="Diajukan">
                                <template #body="{ data }">
                                    <span class="text-xs text-surface-900 dark:text-surface-0 whitespace-nowrap tabular-nums">{{ formatDate(data.created_at || data.createdAt) }}</span>
                                </template>
                            </Column>
                            <Column header="Jenis Cuti" style="min-width: 7.5rem">
                                <template #body="{ data }">
                                    <span class="font-medium text-xs text-surface-900 dark:text-surface-0 whitespace-nowrap">{{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}</span>
                                </template>
                            </Column>
                            <Column header="Periode">
                                <template #body="{ data }">
                                    <span class="text-xs text-surface-600 dark:text-surface-300 whitespace-nowrap tabular-nums">
                                        {{ formatDate(data.start_date || data.startDate) }} &ndash; {{ formatDate(data.end_date || data.endDate) }}
                                    </span>
                                </template>
                            </Column>
                            <Column header="Durasi" style="width: 5.5rem">
                                <template #body="{ data }">
                                    <span class="text-xs font-semibold text-surface-900 dark:text-surface-0 whitespace-nowrap tabular-nums" title="Sabtu, Minggu & libur nasional tidak dihitung">{{ data.total_days ?? data.totalDays ?? '-' }} hari kerja</span>
                                </template>
                            </Column>
                            <Column header="Status" style="width: 7.5rem">
                                <template #body="{ data }">
                                    <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="text-xs font-medium" />
                                </template>
                            </Column>

                            <Column header="Aksi" style="width: 4rem" class="text-center">
                                <template #body="{ data }">
                                    <button
                                        type="button"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-surface-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 active:scale-90 transition-all cursor-pointer"
                                        @click="viewDetail(data)"
                                        :aria-label="`Lihat rincian pengajuan ${data.id_request || data.id}`"
                                        title="Lihat Detail"
                                    >
                                        <Eye :size="16" :stroke-width="1.75" />
                                    </button>
                                </template>
                            </Column>
                        </DataTable>
                    </div>

                    <div class="block sm:hidden space-y-3">
                        <div v-if="!recentFiveLeaves.length && !loading" class="text-center py-8 px-4">
                            <div class="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-3 text-surface-400 dark:text-surface-500">
                                <FolderOpen :size="24" :stroke-width="1.75" />
                            </div>
                            <p class="font-semibold text-sm text-surface-900 dark:text-surface-100">Belum Ada Pengajuan Cuti</p>
                            <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-xs mx-auto">Anda belum mengajukan cuti pada periode ini.</p>
                            <Button
                                v-if="can('pengajuan_cuti.submit')"
                                size="small"
                                class="mt-4 text-xs font-semibold inline-flex items-center gap-1.5 active:scale-[0.97] transition-all"
                                @click="startNewLeave"
                            >
                                <Plus :size="14" :stroke-width="2" />
                                <span>Ajukan Cuti Baru</span>
                            </Button>
                        </div>

                        <div
                            v-for="item in recentFiveLeaves"
                            :key="item.id_request || item.id"
                            class="p-3.5 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/40 space-y-2.5"
                        >
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <span class="text-xs font-semibold text-surface-900 dark:text-surface-0 block">
                                        {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type || 'Cuti' }}
                                    </span>
                                    <span class="text-[11px] font-mono text-muted-color">
                                        #{{ item.id_request || item.id }}
                                    </span>
                                </div>
                                <Tag :value="getStatusLabel(item.status)" :severity="getStatusSeverity(item.status)" class="text-xs font-medium" />
                            </div>
                            <div class="text-xs text-surface-600 dark:text-surface-300 space-y-1">
                                <div class="flex items-center justify-between">
                                    <span class="text-muted-color">Periode:</span>
                                    <span class="font-medium tabular-nums text-surface-800 dark:text-surface-200">
                                        {{ formatDate(item.start_date || item.startDate) }} &ndash; {{ formatDate(item.end_date || item.endDate) }}
                                    </span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-muted-color">Durasi:</span>
                                    <span class="font-semibold text-surface-900 dark:text-surface-100 tabular-nums">
                                        {{ item.total_days ?? item.totalDays ?? '-' }} hari kerja
                                    </span>
                                </div>
                            </div>
                            <div class="pt-2 border-t border-surface-200/60 dark:border-surface-700/60 flex justify-end">
                                <Button
                                    size="small"
                                    severity="secondary"
                                    outlined
                                    class="text-xs font-medium py-1 px-2.5 flex items-center gap-1.5"
                                    @click="viewDetail(item)"
                                >
                                    <Eye :size="13" />
                                    <span>Lihat Detail</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 pt-3.5 border-t border-surface-100 dark:border-surface-800 text-center">
                        <button
                            type="button"
                            class="group text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                            @click="$router.push('/leave/history')"
                        >
                            <span>Lihat Seluruh Riwayat Cuti</span>
                            <ArrowRight :size="13" :stroke-width="2" class="group-hover:translate-x-0.5 transition-transform duration-150" />
                        </button>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-4">
                <DashboardMiniCalendar data-tour="dash-kalender" :approved-leaves="recentLeaves" />
            </div>
        </div>

        <LeaveDetailDialog v-model:visible="detailVisible" :request="selectedRequest" @refresh="loadDashboardData" @edit="editFromDetail" />
    </div>
</template>
