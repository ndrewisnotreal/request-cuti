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
import LeaveDetailDialog from '../leave/LeaveDetailDialog.vue';
import StatStrip from '../shared/StatStrip.vue';
import { FileText, Plus, ArrowRight, FolderOpen, Eye, ChevronLeft, ChevronRight, Calendar, CalendarCheck, CalendarDays, CalendarMinus, History } from 'lucide-vue-next';

const router = useRouter();

const loading = ref(false);
const balances = ref([]);
const recentLeaves = ref([]);
const holidays = ref([]);
const approvedLeaveDates = ref(new Map());

const selectedRequest = ref(null);
const detailVisible = ref(false);

// Mini Calendar State & Interactive Date Inspector
const todayDate = new Date();
const balanceYear = todayDate.getFullYear();
const calYear = ref(balanceYear);
const calMonth = ref(todayDate.getMonth());
const selectedCalCell = ref(null);

const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const calMonthName = computed(() => {
    return `${monthNames[calMonth.value]} ${calYear.value}`;
});

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
        const [balRes, leavesRes, holRes] = await Promise.all([
            leaveService.getBalances({ year: balanceYear }).catch(() => []),
            leaveService.getMyLeaves({ limit: 20 }).catch(() => []),
            leaveService.getHolidays(calYear.value).catch(() => [])
        ]);

        balances.value = Array.isArray(balRes) ? balRes : (balRes ? [balRes] : []);
        recentLeaves.value = Array.isArray(leavesRes) ? leavesRes : [];
        holidays.value = Array.isArray(holRes) ? holRes : [];

        // Build approved leave dates map
        const approvedMap = new Map();
        for (const req of recentLeaves.value) {
            if (['approved', 'completed'].includes(req.status) && req.start_date && req.end_date) {
                const s = new Date(req.start_date);
                const e = new Date(req.end_date);
                const cur = new Date(s);
                while (cur <= e) {
                    const y = cur.getFullYear();
                    const m = String(cur.getMonth() + 1).padStart(2, '0');
                    const d = String(cur.getDate()).padStart(2, '0');
                    const ds = `${y}-${m}-${d}`;
                    approvedMap.set(ds, {
                        type: req.nm_leave_type || req.kd_leave_type || 'Cuti'
                    });
                    cur.setDate(cur.getDate() + 1);
                }
            }
        }
        approvedLeaveDates.value = approvedMap;
    } catch (err) {
        console.error('Failed to load dashboard data:', err);
    } finally {
        loading.value = false;
    }
}

onMounted(async () => {
    await loadDashboardData();
    const foundToday = calendarDays.value.find((c) => c.isToday);
    if (foundToday) {
        selectedCalCell.value = foundToday;
    } else {
        selectedCalCell.value = calendarDays.value.find((c) => !c.isBlank) || null;
    }
});

// Prototype startNewLeave: pindah ke halaman Pengajuan Cuti, form terbuka di atasnya
function startNewLeave() {
    router.push({ path: '/leave/history', query: { action: 'new_leave' } });
}

function editFromDetail(req) {
    router.push({ path: '/leave/history', query: { editId: req.id_request || req.id } });
}

function selectDate(cell) {
    if (!cell || cell.isBlank) return;
    selectedCalCell.value = cell;
}

function formatInspectorDate(dateStr) {
    if (!dateStr) return '';
    try {
        const [y, m, d] = dateStr.split('-');
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = days[date.getDay()];
        return `${dayName}, ${Number(d)} ${monthNames[Number(m) - 1]} ${y}`;
    } catch {
        return dateStr;
    }
}

function isWeekend(dateStr) {
    if (!dateStr) return false;
    try {
        const [y, m, d] = dateStr.split('-');
        const day = new Date(Number(y), Number(m) - 1, Number(d)).getDay();
        return day === 0 || day === 6;
    } catch {
        return false;
    }
}

function getInspectorDescription(cell) {
    if (!cell) return '';
    if (cell.isHoliday && cell.holidayName) {
        const typeLabel = cell.holidayInfo?.typeLabel || 'Libur Resmi Nasional';
        return `${cell.holidayName} (${typeLabel})`;
    }
    if (cell.isApprovedLeave) {
        return `Cuti Disetujui: ${cell.leaveInfo?.type || 'Cuti Tahunan'}`;
    }
    if (cell.isToday) {
        return 'Hari kerja aktif saat ini (tidak ada agenda libur)';
    }
    if (isWeekend(cell.dateStr)) {
        return 'Akhir pekan (Libur mingguan)';
    }
    return 'Hari kerja reguler';
}

async function changeCalMonth(dir) {
    let m = calMonth.value + dir;
    let y = calYear.value;
    if (m > 11) {
        m = 0;
        y++;
    } else if (m < 0) {
        m = 11;
        y--;
    }
    calMonth.value = m;
    const yearChanged = y !== calYear.value;
    calYear.value = y;
    if (yearChanged) await loadHolidays();

    // Perbarui tanggal terpilih sesuai bulan yang aktif
    const foundToday = calendarDays.value.find((c) => c.isToday);
    selectedCalCell.value = foundToday || calendarDays.value.find((c) => !c.isBlank) || null;
}

async function loadHolidays() {
    holidays.value = await leaveService.getHolidays(calYear.value).catch(() => []);
}

const holidayMap = computed(() => {
    const map = new Map();
    (holidays.value || []).forEach((h) => {
        const startStr = (h.holiday_date || h.date || '').split('T')[0];
        const endStr = (h.end_date || startStr).split('T')[0];
        const name = h.nm_holiday || h.description || h.name || 'Hari Libur Nasional';
        const isCollective = h.type === 'collective';
        const typeLabel = isCollective ? 'Cuti Bersama' : 'Libur Resmi Nasional';
        if (startStr) {
            try {
                const s = new Date(startStr);
                const e = new Date(endStr || startStr);
                const cur = new Date(s);
                while (cur <= e) {
                    const y = cur.getFullYear();
                    const m = String(cur.getMonth() + 1).padStart(2, '0');
                    const d = String(cur.getDate()).padStart(2, '0');
                    const ds = `${y}-${m}-${d}`;
                    map.set(ds, {
                        name,
                        isCollective,
                        typeLabel
                    });
                    cur.setDate(cur.getDate() + 1);
                }
            } catch {
                map.set(startStr, {
                    name,
                    isCollective,
                    typeLabel
                });
            }
        }
    });
    return map;
});

const calendarDays = computed(() => {
    const firstDay = new Date(calYear.value, calMonth.value, 1).getDay();
    const daysInMonth = new Date(calYear.value, calMonth.value + 1, 0).getDate();
    const today = new Date();

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
        cells.push({ day: null, isBlank: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(calMonth.value + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${calYear.value}-${mm}-${dd}`;
        const holiday = holidayMap.value.get(dateStr);
        const approvedLeave = approvedLeaveDates.value.get(dateStr);
        const isToday =
            today.getDate() === d &&
            today.getMonth() === calMonth.value &&
            today.getFullYear() === calYear.value;

        cells.push({
            day: d,
            isBlank: false,
            dateStr,
            isToday,
            isHoliday: Boolean(holiday),
            holidayName: holiday?.name || null,
            holidayInfo: holiday || null,
            isApprovedLeave: Boolean(approvedLeave),
            leaveInfo: approvedLeave || null
        });
    }

    return cells;
});

function viewDetail(request) {
    selectedRequest.value = request;
    detailVisible.value = true;
}
</script>

<template>
    <div class="space-y-6">
        <!-- 4-Stat Metric Cards directly at the top (Zero Header / Clean First Impression) -->
        <StatStrip :items="statItems" />

        <!-- 2-Column Content Grid: Table + Mini Calendar Hub -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Left: 5 Pengajuan Terakhir (8 cols) -->
            <div class="lg:col-span-8">
                <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)]">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-surface-100 dark:border-surface-800">
                        <div>
                            <h2 class="font-bold text-base text-surface-900 dark:text-surface-0 tracking-tight leading-tight">Riwayat Pengajuan</h2>
                            <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Daftar permohonan cuti terbaru Anda</p>
                        </div>
                        <Button
                            v-if="can('pengajuan_cuti.submit')"
                            size="small"
                            class="text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-[0.97] transition-all duration-150 self-start sm:self-auto"
                            @click="startNewLeave"
                        >
                            <Plus :size="14" :stroke-width="2" />
                            <span>Ajukan Cuti</span>
                        </Button>
                    </div>

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

                    <!-- Footer Link: Lihat Seluruh Riwayat Cuti -->
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

            <!-- Right: Mini Kalender Cuti & Libur (4 cols - Apple Widget Style) -->
            <div class="lg:col-span-4">
                <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)]">
                    <!-- Calendar Header -->
                    <div class="flex items-center justify-between mb-4 pb-3 border-b border-surface-100 dark:border-surface-800">
                        <span class="font-bold text-sm tracking-tight text-surface-900 dark:text-surface-0">{{ calMonthName }}</span>
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="w-7 h-7 flex items-center justify-center rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 active:scale-90 transition-all cursor-pointer"
                                @click="changeCalMonth(-1)"
                                aria-label="Bulan sebelumnya"
                                title="Bulan Sebelumnya"
                            >
                                <ChevronLeft :size="16" :stroke-width="2" />
                            </button>
                            <button
                                type="button"
                                class="w-7 h-7 flex items-center justify-center rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 active:scale-90 transition-all cursor-pointer"
                                @click="changeCalMonth(1)"
                                aria-label="Bulan berikutnya"
                                title="Bulan Berikutnya"
                            >
                                <ChevronRight :size="16" :stroke-width="2" />
                            </button>
                        </div>
                    </div>

                    <!-- Day of week headers -->
                    <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">
                        <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
                    </div>

                    <!-- Day grid cells -->
                    <div class="grid grid-cols-7 gap-1 text-center">
                        <div
                            v-for="(cell, idx) in calendarDays"
                            :key="idx"
                            class="h-8 flex items-center justify-center"
                        >
                            <button
                                v-if="!cell.isBlank"
                                type="button"
                                @click="selectDate(cell)"
                                class="h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-900 cursor-pointer select-none"
                                :class="[
                                    selectedCalCell?.dateStr === cell.dateStr
                                        ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-surface-900 font-bold z-10'
                                        : '',
                                    cell.isToday
                                        ? 'bg-primary text-white shadow-xs'
                                        : cell.isApprovedLeave
                                          ? selectedCalCell?.dateStr === cell.dateStr
                                              ? 'bg-emerald-600 text-white font-semibold'
                                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200/80 dark:border-emerald-800/60'
                                          : cell.isHoliday
                                            ? selectedCalCell?.dateStr === cell.dateStr
                                                ? 'bg-rose-600 text-white font-semibold'
                                                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 font-semibold border border-rose-200/80 dark:border-rose-900/60'
                                            : selectedCalCell?.dateStr === cell.dateStr
                                              ? 'bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
                                              : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 active:scale-90'
                                ]"
                                :aria-pressed="selectedCalCell?.dateStr === cell.dateStr"
                                :aria-label="formatInspectorDate(cell.dateStr)"
                                :title="cell.isApprovedLeave ? `Cuti Disetujui: ${cell.leaveInfo?.type}` : (cell.holidayName || (cell.isToday ? 'Hari Ini' : ''))"
                            >
                                {{ cell.day }}
                            </button>
                        </div>
                    </div>

                    <!-- Legend -->
                    <div class="mt-4 pt-3.5 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-[11px] text-surface-500 dark:text-surface-400">
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-primary inline-block"></span>
                            <span>Hari Ini</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                            <span>Cuti Disetujui</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                            <span>Libur Resmi</span>
                        </div>
                    </div>

                    <!-- Date Inspector Panel -->
                    <div class="mt-3.5 pt-3 border-t border-surface-100 dark:border-surface-800/80">
                        <transition
                            mode="out-in"
                            enter-active-class="transition-all duration-200 ease-out"
                            enter-from-class="opacity-0 translate-y-1"
                            enter-to-class="opacity-100 translate-y-0"
                            leave-active-class="transition-all duration-150 ease-in"
                            leave-from-class="opacity-100 translate-y-0"
                            leave-to-class="opacity-0 -translate-y-1"
                        >
                            <div
                                v-if="selectedCalCell"
                                :key="selectedCalCell.dateStr"
                                class="rounded-xl p-3 bg-surface-50/80 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-700/50 flex flex-col gap-1.5"
                            >
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-xs font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                                        <Calendar :size="13" class="text-surface-400 dark:text-surface-500 shrink-0" />
                                        <span>{{ formatInspectorDate(selectedCalCell.dateStr) }}</span>
                                    </span>

                                    <!-- Status Pill Badge -->
                                    <span
                                        v-if="selectedCalCell.isHoliday"
                                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60"
                                    >
                                        {{ selectedCalCell.holidayInfo?.typeLabel || 'Libur Resmi' }}
                                    </span>
                                    <span
                                        v-else-if="selectedCalCell.isApprovedLeave"
                                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60"
                                    >
                                        Cuti Disetujui
                                    </span>
                                    <span
                                        v-else-if="selectedCalCell.isToday"
                                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300 border border-primary/20"
                                    >
                                        Hari Ini
                                    </span>
                                    <span
                                        v-else-if="isWeekend(selectedCalCell.dateStr)"
                                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-200/60 text-surface-600 dark:bg-surface-700/60 dark:text-surface-300"
                                    >
                                        Akhir Pekan
                                    </span>
                                    <span
                                        v-else
                                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-200/60 text-surface-600 dark:bg-surface-700/60 dark:text-surface-300"
                                    >
                                        Hari Kerja
                                    </span>
                                </div>

                                <p class="text-xs text-surface-600 dark:text-surface-400 font-normal leading-relaxed">
                                    {{ getInspectorDescription(selectedCalCell) }}
                                </p>
                            </div>

                            <div
                                v-else
                                class="text-center py-2.5 text-xs text-surface-400 dark:text-surface-500 italic"
                            >
                                Klik salah satu tanggal untuk melihat keterangan agenda atau hari libur.
                            </div>
                        </transition>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detail Modal -->
        <LeaveDetailDialog v-model:visible="detailVisible" :request="selectedRequest" @refresh="loadDashboardData" @edit="editFromDetail" />
    </div>
</template>
