<script setup>
import { computed, ref } from 'vue';
import { useLayout } from '@/layout/composables/layout';
import { currentUser, sicutiState, getAdminDivision, getDivisionUsers, getDivisionRequests, CURRENT_YEAR } from '@/service/sicutiService';
import StatStrip from '@/components/common/StatStrip.vue';
import AdminDashboardCalendar from '@/components/dashboard/AdminDashboardCalendar.vue';
import { BarChart3 } from 'lucide-vue-next';

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

</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Dashboard Admin</h1>
            <p class="text-xs text-muted-color">Ringkasan cuti divisi {{ adminDivision || 'seluruh organisasi' }} tahun {{ CURRENT_YEAR }}</p>
        </div>

        <StatStrip data-tour="admin-stats" :items="statItems" />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <div data-tour="admin-chart" class="card mb-0 flex flex-col justify-between p-5">
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

            <AdminDashboardCalendar data-tour="admin-calendar"
                :division-requests="divisionRequests"
                :admin-division="adminDivision"
            />
        </div>
    </div>
</template>

