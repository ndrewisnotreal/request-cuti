<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import api from '@/service/api';
import { can, currentUser, formatDate, getStatusLabel, getStatusSeverity, isSuperAdmin, sicutiState } from '@/service/sicutiService';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-vue-next';

// Kalender cuti (backlog E35): jadwal cuti karyawan + hari libur per bulan, sesuai hak akses.
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const today = new Date();
const year = ref(today.getFullYear());
const month = ref(today.getMonth());
const deptFilter = ref(null);
const showPending = ref(true);
const loading = ref(false);
const leaves = ref([]);
const holidays = ref([]);
const selectedKey = ref(isoOf(today));

// Admin/pemantau boleh memilih divisi; karyawan & approver melihat divisinya sendiri
const canPickDept = computed(() => isSuperAdmin() || can('master_data.view_processed', 'dashboard_laporan.view_reports'));
const deptOptions = computed(() => [
    { label: 'Semua Divisi', value: null },
    ...(sicutiState.departments || []).map((d) => ({ label: d.name || d.nm_dept || d.code, value: d.code || d.kd_dept || d.id }))
]);
const scopeLabel = computed(() => {
    if (canPickDept.value) return deptFilter.value ? `Divisi ${deptFilter.value}` : 'Semua divisi yang bisa Anda lihat';
    return `Divisi ${currentUser.value?.department || currentUser.value?.kd_dept || 'Anda'}`;
});

function isoOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const range = computed(() => {
    const first = new Date(year.value, month.value, 1);
    const last = new Date(year.value, month.value + 1, 0);
    return { start: isoOf(first), end: isoOf(last), daysInMonth: last.getDate(), lead: (first.getDay() + 6) % 7 };
});

async function load() {
    loading.value = true;
    try {
        const res = await api.get('/sicuti/leave-request/calendar', {
            start: range.value.start,
            end: range.value.end,
            kd_dept: canPickDept.value ? deptFilter.value : undefined
        });
        leaves.value = res?.data?.leaves || [];
        holidays.value = res?.data?.holidays || [];
    } catch {
        leaves.value = [];
        holidays.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(load);
watch([year, month, deptFilter], load);
watch(() => sicutiState.dataVersion, load);

const visibleLeaves = computed(() =>
    leaves.value.filter((l) => showPending.value || ['approved', 'completed'].includes(l.status))
);

function within(key, start, end) {
    return key >= String(start).slice(0, 10) && key <= String(end || start).slice(0, 10);
}

const cells = computed(() => {
    const out = [];
    for (let i = 0; i < range.value.lead; i++) out.push(null);
    for (let d = 1; d <= range.value.daysInMonth; d++) {
        const date = new Date(year.value, month.value, d);
        const key = isoOf(date);
        const dow = date.getDay();
        out.push({
            day: d,
            key,
            weekend: dow === 0 || dow === 6,
            isToday: key === isoOf(today),
            holiday: holidays.value.find((h) => within(key, h.date, h.end_date)) || null,
            leaves: visibleLeaves.value.filter((l) => within(key, l.start_date, l.end_date))
        });
    }
    while (out.length % 7) out.push(null);
    return out;
});

const selected = computed(() => cells.value.find((c) => c?.key === selectedKey.value) || null);
const monthSummary = computed(() => ({
    people: new Set(visibleLeaves.value.map((l) => l.uid_user_system)).size,
    requests: visibleLeaves.value.length,
    holidays: holidays.value.length
}));

function shift(delta) {
    const d = new Date(year.value, month.value + delta, 1);
    year.value = d.getFullYear();
    month.value = d.getMonth();
    selectedKey.value = isoOf(d);
}

function goToday() {
    year.value = today.getFullYear();
    month.value = today.getMonth();
    selectedKey.value = isoOf(today);
}

// Selain admin, nama karyawan lain disamarkan backend (nama kosong)
const HIDDEN_NAME = 'Karyawan';

function shortName(name) {
    if (!name) return HIDDEN_NAME;
    const parts = String(name).split(' ').filter(Boolean);
    return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0] || '-';
}

function chipClass(status) {
    return ['approved', 'completed'].includes(status)
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
}
</script>

<template>
    <div class="space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Kalender Cuti</h1>
                <p class="text-xs text-muted-color">Jadwal cuti karyawan dan hari libur · {{ scopeLabel }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Select
                    v-if="canPickDept"
                    v-model="deptFilter"
                    :options="deptOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Semua Divisi"
                    size="small"
                    class="text-xs w-48"
                />
                <label class="flex items-center gap-1.5 text-xs text-surface-700 dark:text-surface-300 cursor-pointer select-none">
                    <input v-model="showPending" type="checkbox" class="cursor-pointer" />
                    Tampilkan yang masih diproses
                </label>
            </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-4">
            <section class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4 min-w-0">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <div class="flex items-center gap-1">
                        <button type="button" class="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer" aria-label="Bulan sebelumnya" @click="shift(-1)">
                            <ChevronLeft :size="16" />
                        </button>
                        <h2 class="text-base font-bold text-surface-900 dark:text-surface-0 w-40 text-center tabular-nums">{{ MONTHS[month] }} {{ year }}</h2>
                        <button type="button" class="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer" aria-label="Bulan berikutnya" @click="shift(1)">
                            <ChevronRight :size="16" />
                        </button>
                    </div>
                    <Button label="Bulan Ini" severity="secondary" outlined size="small" class="text-xs" @click="goToday" />
                </div>

                <div class="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-200 dark:bg-surface-700" :class="{ 'opacity-60': loading }">
                    <div v-for="d in DAYS" :key="d" class="bg-surface-50 dark:bg-surface-800 text-[11px] font-semibold text-muted-color text-center py-1.5">{{ d }}</div>
                    <template v-for="(c, i) in cells" :key="c?.key || `kosong-${i}`">
                        <div v-if="!c" class="bg-surface-50/60 dark:bg-surface-900/60 min-h-16 sm:min-h-24" />
                        <button
                            v-else
                            type="button"
                            class="text-left bg-surface-0 dark:bg-surface-900 min-h-16 sm:min-h-24 p-1 sm:p-1.5 flex flex-col gap-0.5 cursor-pointer hover:bg-primary-50/60 dark:hover:bg-primary-950/30 focus-visible:outline-2 focus-visible:outline-primary"
                            :class="{ 'ring-2 ring-inset ring-primary': c.key === selectedKey, 'bg-rose-50/60 dark:bg-rose-950/20': c.holiday }"
                            :aria-label="`${c.day} ${MONTHS[month]}: ${c.leaves.length} cuti${c.holiday ? ', ' + c.holiday.name : ''}`"
                            @click="selectedKey = c.key"
                        >
                            <span
                                class="text-xs font-semibold tabular-nums w-6 h-6 flex items-center justify-center rounded-full"
                                :class="c.isToday ? 'bg-primary text-primary-contrast' : c.holiday || c.weekend ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-200'"
                            >
                                {{ c.day }}
                            </span>
                            <span v-if="c.holiday" class="hidden sm:block text-[10px] leading-tight text-rose-700 dark:text-rose-300 truncate">{{ c.holiday.name }}</span>
                            <span v-for="l in c.leaves.slice(0, 2)" :key="l.id_request" class="hidden sm:block text-[10px] leading-tight px-1 py-0.5 rounded truncate" :class="chipClass(l.status)">
                                {{ shortName(l.nama) }}
                            </span>
                            <span v-if="c.leaves.length > 2" class="hidden sm:block text-[10px] text-muted-color">+{{ c.leaves.length - 2 }} lainnya</span>
                            <!-- Layar sempit: cukup titik penanda -->
                            <span v-if="c.leaves.length" class="sm:hidden flex gap-0.5">
                                <span v-for="n in Math.min(c.leaves.length, 3)" :key="n" class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            </span>
                        </button>
                    </template>
                </div>

                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-color">
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-800" /> Cuti disetujui</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-amber-200 dark:bg-amber-800" /> Masih diproses</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-rose-200 dark:bg-rose-800" /> Hari libur</span>
                </div>
            </section>

            <aside class="space-y-4 min-w-0">
                <section class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4">
                    <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <CalendarDays :size="15" class="text-primary" />
                        {{ selected ? formatDate(selected.key) : '-' }}
                    </h3>
                    <p v-if="selected?.holiday" class="mt-2 text-xs px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200">{{ selected.holiday.name }}</p>
                    <ul v-if="selected?.leaves.length" class="mt-3 space-y-2">
                        <li v-for="l in selected.leaves" :key="l.id_request" class="text-xs border-b border-surface-100 dark:border-surface-800 pb-2 last:border-0 last:pb-0">
                            <div class="flex items-center justify-between gap-2">
                                <span class="font-semibold text-surface-900 dark:text-surface-100 truncate">{{ l.nama || HIDDEN_NAME }}</span>
                                <Tag :value="getStatusLabel(l.status)" :severity="getStatusSeverity(l.status)" class="text-[10px] shrink-0" />
                            </div>
                            <div class="text-muted-color mt-0.5" title="Sabtu, Minggu & libur nasional tidak dihitung">{{ l.nm_leave_type }} · {{ l.total_days }} hari kerja</div>
                            <div class="text-muted-color">{{ formatDate(l.start_date) }}<template v-if="l.end_date !== l.start_date"> – {{ formatDate(l.end_date) }}</template></div>
                        </li>
                    </ul>
                    <p v-else-if="!selected?.holiday" class="mt-3 text-xs text-muted-color">Tidak ada karyawan yang cuti pada tanggal ini.</p>
                </section>

                <section class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 p-4 text-xs">
                    <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 mb-2">Ringkasan {{ MONTHS[month] }}</h3>
                    <dl class="grid grid-cols-3 gap-2 text-center">
                        <div><dt class="text-muted-color">Karyawan</dt><dd class="text-lg font-bold tabular-nums">{{ monthSummary.people }}</dd></div>
                        <div><dt class="text-muted-color">Pengajuan</dt><dd class="text-lg font-bold tabular-nums">{{ monthSummary.requests }}</dd></div>
                        <div><dt class="text-muted-color">Hari libur</dt><dd class="text-lg font-bold tabular-nums">{{ monthSummary.holidays }}</dd></div>
                    </dl>
                </section>
            </aside>
        </div>
    </div>
</template>
