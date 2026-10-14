<script setup>
import { computed, ref } from 'vue';
import { useLayout } from '@/layout/composables/layout';
import { currentUser, sicutiState, getUser, getAdminDivision, getDivisionUsers, getDivisionRequests, CURRENT_YEAR } from '@/service/sicutiService';
import StatStrip from '../shared/StatStrip.vue';
import { CalendarDays, BarChart3 } from 'lucide-vue-next';

const { isDarkTheme } = useLayout();

const adminDivision = computed(() => getAdminDivision(currentUser.value));

const divisionUsers = computed(() => getDivisionUsers(adminDivision.value));

const divisionRequests = computed(() => getDivisionRequests(adminDivision.value));

const totalKaryawan = computed(() => {
    return divisionUsers.value.filter((u) => !u.role?.startsWith('admin_') && u.isActive !== false).length;
});

const pendingCount = computed(() => {
    return divisionRequests.value.filter((r) =>
        ['submitted', 'pending_validation'].includes(r.status)
    ).length;
});

const approvedCount = computed(() => {
    return divisionRequests.value.filter((r) => r.status === 'approved').length;
});

const holidaysThisYear = computed(() => {
    return sicutiState.holidays.filter((h) => h.year === CURRENT_YEAR).length;
});

const statItems = computed(() => [
    { label: 'Total karyawan', value: totalKaryawan.value, unit: 'orang', hint: adminDivision.value ? `Aktif, divisi ${adminDivision.value}` : 'Aktif, semua divisi' },
    { label: 'Pengajuan pending', value: pendingCount.value, unit: 'pengajuan', hint: 'Menunggu verifikasi', accent: pendingCount.value > 0 },
    { label: 'Cuti disetujui', value: approvedCount.value, unit: 'pengajuan', hint: 'Total permohonan disetujui' },
    { label: 'Hari libur', value: holidaysThisYear.value, unit: 'hari', hint: `Tahun kalender ${CURRENT_YEAR}` }
]);

const totalTahunIni = computed(() => {
    return divisionRequests.value.length;
});

// Chart: Pengajuan per Bulan (Sakai PrimeVue Theme-Reactive)
const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const fullMonthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const monthlyChartData = computed(() => {
    const isDark = isDarkTheme.value;
    const primaryColor = isDark ? '#3ea7df' : '#0077b8';
    const primaryHoverColor = isDark ? '#82c5f5' : '#00649b';

    const counts = monthLabels.map((_, month) => {
        return divisionRequests.value.filter((r) => {
            if (!r.createdAt) return false;
            const d = new Date(r.createdAt);
            return d.getMonth() === month;
        }).length;
    });

    return {
        labels: monthLabels,
        datasets: [
            {
                label: 'Pengajuan Cuti',
                backgroundColor: primaryColor,
                hoverBackgroundColor: primaryHoverColor,
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 32,
                data: counts
            }
        ]
    };
});

const monthlyChartOptions = computed(() => {
    const isDark = isDarkTheme.value;
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const textMutedColor = isDark ? '#64748b' : '#94a3b8';
    const surfaceBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    return {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: isDark ? '#0f172a' : '#1e293b',
                titleColor: '#ffffff',
                bodyColor: '#e2e8f0',
                borderColor: isDark ? '#334155' : '#475569',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    title: (items) => `${fullMonthNames[items[0].dataIndex]} ${CURRENT_YEAR}`,
                    label: (item) => ` ${item.raw} Pengajuan Cuti`
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    color: textColor,
                    font: { size: 11, weight: '500' }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                },
                ticks: {
                    color: textMutedColor,
                    stepSize: 1,
                    precision: 0,
                    font: { size: 11 }
                }
            }
        }
    };
});

// Leave Calendar State (PrimeVue DatePicker Inline - Sakai UI)
const today = new Date();
const selectedCalendarDate = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

const holidayCalendarMap = computed(() => {
    const map = new Map();
    (sicutiState.holidays || []).forEach((h) => {
        if (!h.date) return;
        const start = new Date(`${h.date}T00:00:00`);
        const end = new Date(`${h.date2 || h.date}T00:00:00`);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            map.set(key, h.name || 'Hari Libur');
        }
    });
    return map;
});

const leaveDetailsByDate = computed(() => {
    const map = {};
    const approvedRequests = divisionRequests.value.filter((r) => r.status === 'approved');
    approvedRequests.forEach((request) => {
        if (!request.startDate || !request.endDate) return;
        const start = new Date(`${request.startDate}T00:00:00`);
        const end = new Date(`${request.endDate}T00:00:00`);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!map[key]) map[key] = [];
            const user = getUser(request.userId);
            const userName = user?.name || request.userName || 'Karyawan';
            map[key].push({
                requestId: request.id,
                userId: request.userId,
                userName,
                department: user?.department || request.department || '',
                leaveTypeName: request.leaveTypeName || 'Cuti Tahunan',
                reason: request.reason || ''
            });
        }
    });
    return map;
});

function getDateKey(d) {
    if (!d) return '';
    if (d instanceof Date) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (typeof d === 'object' && d.day !== undefined) {
        return `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
    }
    return String(d);
}

function hasHoliday(dateObj) {
    return holidayCalendarMap.value.has(getDateKey(dateObj));
}

function hasLeave(dateObj) {
    return Boolean(leaveDetailsByDate.value[getDateKey(dateObj)]?.length);
}

function getDayTooltip(dateObj) {
    const key = getDateKey(dateObj);
    const holiday = holidayCalendarMap.value.get(key);
    const leaves = leaveDetailsByDate.value[key] || [];

    const parts = [];
    if (holiday) parts.push(`Libur: ${holiday}`);
    if (leaves.length > 0) parts.push(`Cuti (${leaves.length}): ${leaves.map((l) => l.userName).join(', ')}`);
    return parts.length > 0 ? parts.join(' | ') : null;
}

function getDayCellClass(context) {
    if (!context || !context.date) return '';
    const dateObj = context.date;
    const isSelected = context.selected;

    if (isSelected) {
        return '!bg-primary !text-primary-contrast !border-0 font-bold shadow-xs';
    }

    const holiday = hasHoliday(dateObj);
    const leave = hasLeave(dateObj);

    if (holiday && leave) {
        return '!bg-gradient-to-br !from-amber-100/70 !to-rose-100/70 dark:!from-amber-950/40 dark:!to-rose-950/40 !border !border-amber-300/80 dark:!border-amber-700/60 !text-surface-900 dark:!text-surface-0 font-semibold';
    }
    if (holiday) {
        return '!bg-rose-50 dark:!bg-rose-950/40 !border !border-rose-200 dark:!border-rose-900/50 !text-rose-600 dark:!text-rose-400 font-semibold';
    }
    if (leave) {
        return '!bg-amber-50 dark:!bg-amber-950/40 !border !border-amber-200 dark:!border-amber-800/50 !text-amber-800 dark:!text-amber-300 font-semibold';
    }
    return 'hover:!bg-surface-100 dark:hover:!bg-surface-800 !text-surface-700 dark:!text-surface-200 !border-0';
}

const calendarPt = computed(() => ({
    root: { class: '!border-0 !bg-transparent w-full shadow-none p-0' },
    panel: { class: '!border-0 !bg-transparent w-full shadow-none p-0' },
    header: { class: '!border-b border-surface-200 dark:border-surface-800 !pb-2.5 !mb-2.5 !bg-transparent' },
    table: { class: 'w-full' },
    tableHeaderCell: { class: 'text-xs font-semibold text-muted-color pb-1.5' },
    dayView: { class: 'w-full' },
    day: ({ context }) => ({
        class: [
            '!w-full !h-8.5 !rounded-md !transition-colors !p-0 flex flex-col items-center justify-center cursor-pointer',
            getDayCellClass(context)
        ]
    })
}));

const selectedDateEvents = computed(() => {
    const key = getDateKey(selectedCalendarDate.value);
    const holidayName = holidayCalendarMap.value.get(key) || null;
    const leaves = leaveDetailsByDate.value[key] || [];
    return {
        key,
        isHoliday: Boolean(holidayName),
        holidayName,
        leaves
    };
});

const formattedSelectedDate = computed(() => {
    if (!selectedCalendarDate.value) return '';
    const d = selectedCalendarDate.value instanceof Date
        ? selectedCalendarDate.value
        : new Date(selectedCalendarDate.value.year, selectedCalendarDate.value.month, selectedCalendarDate.value.day);

    return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});
</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Dashboard Admin</h1>
            <p class="text-xs text-muted-color">Ringkasan cuti divisi {{ adminDivision || 'seluruh organisasi' }} tahun {{ CURRENT_YEAR }}</p>
        </div>

        <StatStrip :items="statItems" />

        <!-- 2 Columns: Pengajuan per Bulan + Kalender Cuti (Sakai PrimeVue UI) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <!-- Left: Pengajuan per Bulan -->
            <div class="card mb-0 flex flex-col justify-between p-5">
                <div>
                    <div class="flex items-center justify-between mb-4 pb-3 border-b border-surface-200 dark:border-surface-800">
                        <div>
                            <h3 class="font-bold text-base text-surface-900 dark:text-surface-0 m-0">
                                Pengajuan per Bulan
                            </h3>
                            <p class="text-xs text-muted-color mt-0.5">Tren pengajuan cuti karyawan tahun {{ CURRENT_YEAR }}</p>
                        </div>
                        <Tag :value="`${totalTahunIni} Pengajuan`" severity="info" class="font-semibold text-xs" />
                    </div>

                    <div class="h-80 w-full pt-2">
                        <Chart type="bar" :data="monthlyChartData" :options="monthlyChartOptions" class="h-full w-full" />
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-xs text-muted-color">
                    <span class="flex items-center gap-1.5">
                        <BarChart3 :size="14" class="text-primary" />
                        <span>Data divisi {{ adminDivision || 'seluruh organisasi' }}</span>
                    </span>
                    <span class="font-medium">Periode Jan - Des {{ CURRENT_YEAR }}</span>
                </div>
            </div>

            <!-- Right: Kalender Cuti (PrimeVue DatePicker Inline - Sakai Component) -->
            <div class="card mb-0 flex flex-col justify-between p-5">
                <div>
                    <div class="flex items-center justify-between mb-4 pb-3 border-b border-surface-200 dark:border-surface-800">
                        <div>
                            <h3 class="font-bold text-base text-surface-900 dark:text-surface-0 m-0">
                                Kalender Cuti
                            </h3>
                            <p class="text-xs text-muted-color mt-0.5">Jadwal cuti divisi & agenda libur resmi</p>
                        </div>
                        <Tag :value="`Tahun ${CURRENT_YEAR}`" severity="secondary" class="font-semibold text-xs" />
                    </div>

                    <!-- PrimeVue DatePicker Component Inline -->
                    <div class="admin-sakai-calendar">
                        <DatePicker
                            v-model="selectedCalendarDate"
                            inline
                            :showOtherMonths="false"
                            class="w-full !border-0 !bg-transparent"
                            :pt="calendarPt"
                        >
                            <template #date="{ date }">
                                <div
                                    class="w-full h-full flex flex-col items-center justify-center select-none"
                                    v-tooltip.top="getDayTooltip(date)"
                                >
                                    <span class="leading-none text-xs tabular-nums">
                                        {{ date.day }}
                                    </span>

                                    <!-- Indicator Dots -->
                                    <span
                                        v-if="hasHoliday(date) || hasLeave(date)"
                                        class="flex items-center gap-0.5 mt-0.5 h-1"
                                    >
                                        <span
                                            v-if="hasHoliday(date)"
                                            class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-2xs"
                                        ></span>
                                        <span
                                            v-if="hasLeave(date)"
                                            class="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-2xs"
                                        ></span>
                                    </span>
                                </div>
                            </template>
                        </DatePicker>
                    </div>

                    <!-- Selected Date Inspection Panel -->
                    <div class="mt-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-700/60">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-1.5 text-xs font-semibold text-surface-800 dark:text-surface-100">
                                <CalendarDays :size="14" class="text-primary" />
                                <span>{{ formattedSelectedDate }}</span>
                            </div>
                            <Tag v-if="selectedDateEvents.isHoliday" :value="selectedDateEvents.holidayName" severity="danger" class="text-[11px] py-0 px-1.5" />
                        </div>

                        <div v-if="selectedDateEvents.leaves.length > 0" class="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                            <div
                                v-for="(item, idx) in selectedDateEvents.leaves"
                                :key="idx"
                                class="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700/60"
                            >
                                <div class="flex items-center gap-2 truncate">
                                    <div class="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                                        {{ item.userName?.charAt(0) || 'U' }}
                                    </div>
                                    <span class="font-medium text-surface-800 dark:text-surface-200 truncate">{{ item.userName }}</span>
                                </div>
                                <Tag :value="item.leaveTypeName" severity="warn" class="text-[9.5px] py-0 px-1.5 shrink-0" />
                            </div>
                        </div>
                        <div v-else-if="!selectedDateEvents.isHoliday" class="text-[11px] text-muted-color italic">
                            Tidak ada karyawan cuti atau libur nasional pada tanggal ini.
                        </div>
                    </div>
                </div>

                <!-- Legend (Sakai PrimeVue Badges) -->
                <div class="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-xs text-muted-color">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs"></span>
                        <span class="text-[11.5px] font-medium text-surface-700 dark:text-surface-300">Cuti karyawan</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-2xs"></span>
                        <span class="text-[11.5px] font-medium text-surface-700 dark:text-surface-300">Hari libur</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-primary-500 inline-block shadow-2xs"></span>
                        <span class="text-[11.5px] font-medium text-surface-700 dark:text-surface-300">Hari ini / Terpilih</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
:deep(.admin-sakai-calendar) {
    .p-datepicker {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        width: 100% !important;
    }
    .p-datepicker-day-cell {
        padding: 2px !important;
    }
}
</style>
