<script setup>
import { computed, ref, onMounted } from 'vue';
import { leaveService } from '@/service/leaveService';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-vue-next';

const props = defineProps({
    approvedLeaves: {
        type: Array,
        default: () => []
    }
});

const todayDate = new Date();
const calYear = ref(todayDate.getFullYear());
const calMonth = ref(todayDate.getMonth());
const selectedCalCell = ref(null);
const holidays = ref([]);

const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const calMonthName = computed(() => {
    return `${monthNames[calMonth.value]} ${calYear.value}`;
});

async function loadHolidays() {
    holidays.value = await leaveService.getHolidays(calYear.value).catch(() => []);
}

onMounted(async () => {
    await loadHolidays();
    const foundToday = calendarDays.value.find((c) => c.isToday);
    if (foundToday) {
        selectedCalCell.value = foundToday;
    } else {
        selectedCalCell.value = calendarDays.value.find((c) => !c.isBlank) || null;
    }
});

const approvedLeaveDates = computed(() => {
    const approvedMap = new Map();
    for (const req of props.approvedLeaves || []) {
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
    return approvedMap;
});

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

    const foundToday = calendarDays.value.find((c) => c.isToday);
    selectedCalCell.value = foundToday || calendarDays.value.find((c) => !c.isBlank) || null;
}
</script>

<template>
    <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)]">
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

        <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">
            <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
        </div>

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
</template>
