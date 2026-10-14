<script setup>
import { ref, computed } from 'vue';
import { sicutiState, syncFromBackend, isSuperAdmin, can, formatDate, CURRENT_YEAR } from '@/service/sicutiService';
import { useConfirm } from 'primevue/useconfirm';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import {
    Plus,
    Pencil,
    Trash2,
    Upload,
    Download,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle2
} from 'lucide-vue-next';
import ReadOnlyNotice from '../shared/ReadOnlyNotice.vue';

const toast = useToast();
const confirm = useConfirm();
const saving = ref(false);

// Prototype: Admin Seksi hanya melihat, kecuali diberi izin manage_holidays
const canManage = computed(() => isSuperAdmin() || can('master_data.manage_holidays'));
const dialogVisible = ref(false);
const isEditing = ref(false);

const currentHoliday = ref({
    id: '',
    date: '',
    endDate: '',
    name: '',
    year: CURRENT_YEAR,
    type: 'national'
});

const HOLIDAY_TYPES = [
    { value: 'national', label: 'Libur Nasional', hint: 'Tanggal merah resmi yang ditetapkan pemerintah.' },
    { value: 'collective', label: 'Cuti Bersama', hint: 'Hari cuti bersama yang ditetapkan pemerintah atau perusahaan.' }
];

// Kolom tanggal: "3 April 2026"; libur beberapa hari ditampilkan sebagai rentang
function dateLabel(h) {
    if (!h.endDate || h.endDate === h.date) return formatDate(h.date);
    return `${formatDate(h.date)} – ${formatDate(h.endDate)}`;
}

const holidayCounts = computed(() => {
    const list = sicutiState.holidays || [];
    const national = list.filter((h) => h.type === 'national').length;
    return { national, collective: list.length - national };
});

const toIso = (value) => {
    if (!value) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};
const fromIso = (iso) => {
    const p = String(iso || '').split('-').map(Number);
    return p.length === 3 && p.every(Boolean) ? new Date(p[0], p[1] - 1, p[2]) : null;
};

// DatePicker bekerja dengan Date; data disimpan sebagai string 'YYYY-MM-DD'
const holidayDate = computed({
    get: () => fromIso(currentHoliday.value.date),
    set(value) {
        currentHoliday.value.date = toIso(value);
        if (value) currentHoliday.value.year = value.getFullYear();
    }
});
const holidayEndDate = computed({
    get: () => fromIso(currentHoliday.value.endDate),
    set: (value) => (currentHoliday.value.endDate = toIso(value))
});

// Import CSV State
const importDialogVisible = ref(false);
const importFile = ref(null);
const parsedHolidays = ref([]);
const importLoading = ref(false);
const importError = ref('');

function openAdd() {
    isEditing.value = false;
    currentHoliday.value = {
        id: 'H' + String(sicutiState.holidays.length + 1).padStart(3, '0'),
        date: '',
        endDate: '',
        name: '',
        year: CURRENT_YEAR,
        type: 'national'
    };
    dialogVisible.value = true;
}

function openEdit(item) {
    isEditing.value = true;
    currentHoliday.value = { ...item };
    dialogVisible.value = true;
}

async function saveHoliday() {
    const h = currentHoliday.value;
    if (!h.date || !h.name) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Tanggal dan Nama hari libur wajib diisi', life: 3000 });
        return;
    }
    if (h.endDate && h.endDate < h.date) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Tanggal akhir tidak boleh sebelum tanggal mulai', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        await adminService.createHoliday({
            id_holiday: isEditing.value ? h.id : undefined,
            holiday_date: h.date,
            end_date: h.endDate || undefined,
            nm_holiday: h.name.trim(),
            type: h.type
        });
        await syncFromBackend();
        toast.add({
            severity: 'success',
            summary: isEditing.value ? 'Diperbarui' : 'Ditambahkan',
            detail: `Hari libur ${h.name} berhasil ${isEditing.value ? 'diperbarui' : 'ditambahkan'}`,
            life: 3000
        });
        dialogVisible.value = false;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Hari libur gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

function deleteHoliday(item) {
    confirm.require({
        header: 'Hapus hari libur?',
        message: `${item.name} akan dihapus dari kalender libur.`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: async () => {
            try {
                await adminService.deleteHoliday(item.id);
                await syncFromBackend();
                toast.add({ severity: 'info', summary: 'Dihapus', detail: `Hari libur ${item.name} telah dihapus`, life: 3000 });
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Hari libur gagal dihapus', detail: err.message, life: 4000 });
            }
        }
    });
}

function openImportHolidays() {
    importFile.value = null;
    parsedHolidays.value = [];
    importError.value = '';
    importDialogVisible.value = true;
}

function downloadHolidayTemplate() {
    const template = 'holiday_date,nm_holiday,type\r\n' +
        '2026-01-01,Tahun Baru Masehi 2026,national\r\n' +
        '2026-05-01,Hari Buruh Internasional,national\r\n' +
        '2026-06-01,Hari Lahir Pancasila,national\r\n' +
        '2026-12-26,Cuti Bersama Hari Raya Natal,collective';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_import_hari_libur.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function handleHolidayFileUpload(event) {
    importError.value = '';
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
        importError.value = 'Harap pilih file dengan format .csv';
        return;
    }

    importFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
            if (lines.length <= 1) {
                importError.value = 'File CSV kosong atau hanya berisi baris header.';
                return;
            }

            const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
            const rows = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
                if (values.length < 2) continue;

                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx] || '';
                });

                const rawDate = row.holiday_date || row.date || row.tanggal || '';
                const rawName = row.nm_holiday || row.name || row.nama || '';
                const typeText = (row.type || row.kategori || 'national').toLowerCase();
                const rawType = typeText === 'collective' || typeText.includes('bersama') ? 'collective' : 'national';

                if (rawDate && rawName) {
                    const y = Number(rawDate.slice(0, 4)) || CURRENT_YEAR;
                    rows.push({
                        id: 'H_IMP_' + Date.now().toString(36) + '_' + i,
                        date: rawDate,
                        name: rawName,
                        year: y,
                        type: rawType
                    });
                }
            }

            if (rows.length === 0) {
                importError.value = 'Tidak ada baris data hari libur yang valid dalam file CSV.';
                return;
            }

            parsedHolidays.value = rows;
        } catch (err) {
            importError.value = 'Gagal membaca isi file CSV: ' + err.message;
        }
    };
    reader.readAsText(file);
}

async function processHolidayImport() {
    if (!parsedHolidays.value.length) {
        importError.value = 'Tidak ada data hari libur untuk diimport.';
        return;
    }

    importLoading.value = true;
    let addedCount = 0;
    const failed = [];

    for (const h of parsedHolidays.value) {
        if (sicutiState.holidays.some((x) => x.date === h.date)) continue;
        try {
            await adminService.createHoliday({ holiday_date: h.date, nm_holiday: h.name, type: h.type });
            addedCount++;
        } catch (err) {
            failed.push(`${h.date}: ${err.message}`);
        }
    }
    await syncFromBackend();

    if (failed.length) {
        toast.add({ severity: 'warn', summary: `${failed.length} baris gagal diimport`, detail: failed.slice(0, 3).join('; '), life: 5000 });
    }
    toast.add({
        severity: 'success',
        summary: 'Impor CSV Berhasil',
        detail: `${addedCount} hari libur baru berhasil ditambahkan ke kalender.`,
        life: 3500
    });

    importLoading.value = false;
    importDialogVisible.value = false;
}
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice v-if="!canManage" module="hari libur" />
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100">Master Hari Libur & Cuti Bersama {{ CURRENT_YEAR }}</h2>
                <p class="text-xs text-muted-color">Tanggal libur resmi yang dikecualikan dari pemotongan kuota cuti tahunan</p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    v-if="canManage"
                    severity="secondary"
                    outlined
                    size="small"
                    class="font-semibold flex items-center gap-1.5"
                    @click="openImportHolidays"
                >
                    <Upload :size="14" :stroke-width="2" />
                    <span>Impor CSV</span>
                </Button>
                <Button
                    v-if="canManage"
                    severity="primary"
                    size="small"
                    class="font-semibold flex items-center gap-1.5"
                    @click="openAdd"
                >
                    <Plus :size="14" :stroke-width="2" />
                    <span>Tambah Hari Libur</span>
                </Button>
            </div>
        </div>

        <!-- DataTable -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pb-3 text-sm text-surface-700 dark:text-surface-300">
                <span class="inline-flex items-center gap-2">
                    <span class="size-2.5 rounded-full bg-red-600" aria-hidden="true" />
                    Libur Nasional <strong class="text-surface-900 dark:text-surface-0 tabular-nums">{{ holidayCounts.national }}</strong>
                </span>
                <span class="inline-flex items-center gap-2">
                    <span class="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                    Cuti Bersama <strong class="text-surface-900 dark:text-surface-0 tabular-nums">{{ holidayCounts.collective }}</strong>
                </span>
            </div>
            <DataTable :value="sicutiState.holidays" paginator :rows="10" class="p-datatable-sm text-sm" responsiveLayout="scroll">
                <Column field="date" header="Tanggal" style="width: 24%">
                    <template #body="{ data }">
                        <span v-if="data.date" class="font-semibold text-surface-900 dark:text-surface-100">{{ dateLabel(data) }}</span>
                        <span v-else class="text-muted-color">-</span>
                    </template>
                </Column>
                <Column field="name" header="Nama hari libur" style="width: 38%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-800 dark:text-surface-200">{{ data.name }}</span>
                    </template>
                </Column>
                <Column field="type" header="Kategori" style="width: 23%">
                    <template #body="{ data }">
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                            :class="
                                data.type === 'national'
                                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
                                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                            "
                        >
                            <span class="size-1.5 rounded-full" :class="data.type === 'national' ? 'bg-red-600' : 'bg-amber-500'" aria-hidden="true" />
                            {{ data.type === 'national' ? 'Libur Nasional' : 'Cuti Bersama' }}
                        </span>
                    </template>
                </Column>
                <Column v-if="canManage" header="Aksi" style="width: 15%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openEdit(data)"
                                title="Ubah"
                            >
                                <Pencil :size="15" :stroke-width="1.75" />
                            </button>
                            <button
                                type="button"
                                class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                                @click="deleteHoliday(data)"
                                title="Hapus"
                            >
                                <Trash2 :size="15" :stroke-width="1.75" />
                            </button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Add / Edit Dialog -->
        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="isEditing ? 'Ubah Hari Libur' : 'Tambah Hari Libur Baru'"
            :breakpoints="{ '960px': '75vw', '640px': '92vw' }"
            :style="{ width: '460px' }"
        >
            <div class="space-y-5 pt-1 text-sm">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label for="holiday-date" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Tanggal <span class="text-rose-500">*</span></label>
                        <DatePicker
                            v-model="holidayDate"
                            inputId="holiday-date"
                            dateFormat="dd M yy"
                            showIcon
                            iconDisplay="input"
                            placeholder="Pilih tanggal"
                            fluid
                        />
                    </div>
                    <div>
                        <label for="holiday-end" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Sampai tanggal</label>
                        <DatePicker
                            v-model="holidayEndDate"
                            inputId="holiday-end"
                            dateFormat="dd M yy"
                            showIcon
                            showClear
                            iconDisplay="input"
                            placeholder="Satu hari"
                            :minDate="holidayDate || undefined"
                            fluid
                        />
                    </div>
                </div>
                <div>
                    <label for="holiday-name" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Nama hari libur <span class="text-rose-500">*</span></label>
                    <InputText id="holiday-name" v-model="currentHoliday.name" class="w-full" placeholder="Contoh: Tahun Baru Masehi" />
                </div>
                <fieldset>
                    <legend class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Kategori</legend>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label
                            v-for="t in HOLIDAY_TYPES"
                            :key="t.value"
                            class="relative flex cursor-pointer gap-2.5 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                            :class="
                                currentHoliday.type === t.value
                                    ? t.value === 'national'
                                        ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/40'
                                        : 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
                                    : 'border-surface-200 hover:border-surface-300 dark:border-surface-700 dark:hover:border-surface-600'
                            "
                        >
                            <input v-model="currentHoliday.type" type="radio" name="holiday-type" :value="t.value" class="sr-only" />
                            <span
                                class="mt-1 size-2.5 shrink-0 rounded-full"
                                :class="t.value === 'national' ? 'bg-red-600' : 'bg-amber-500'"
                                aria-hidden="true"
                            />
                            <span>
                                <span class="block font-semibold text-surface-900 dark:text-surface-100">{{ t.label }}</span>
                                <span class="block text-xs text-muted-color mt-0.5">{{ t.hint }}</span>
                            </span>
                        </label>
                    </div>
                </fieldset>
            </div>
            <template #footer>
                <div class="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 w-full pt-2">
                    <Button label="Batal" severity="secondary" size="small" text @click="dialogVisible = false" />
                    <Button
                        :label="isEditing ? 'Simpan Perubahan' : 'Tambah Hari Libur'"
                        severity="primary"
                        size="small"
                        class="font-semibold"
                        :loading="saving"
                        @click="saveHoliday"
                    />
                </div>
            </template>
        </Dialog>

        <!-- Modal Dialog Import CSV Hari Libur -->
        <Dialog
            v-model:visible="importDialogVisible"
            modal
            header="Impor Hari Libur & Cuti Bersama via CSV"
            :style="{ width: '540px', maxWidth: '95vw' }"
        >
            <div class="space-y-4 pt-2 text-xs">
                <!-- Info & Download Template -->
                <div class="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start justify-between gap-3">
                    <div class="space-y-1">
                        <span class="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                            <FileSpreadsheet :size="15" class="text-primary" />
                            <span>Format File CSV Hari Libur</span>
                        </span>
                        <p class="text-[11px] text-muted-color leading-relaxed">
                            Kolom: <code class="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded">holiday_date,nm_holiday,type</code><br />
                            (nilai tipe: <code class="font-mono">national</code> atau <code class="font-mono">collective</code>)
                        </p>
                    </div>
                    <Button
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs font-semibold shrink-0 flex items-center gap-1.5"
                        @click="downloadHolidayTemplate"
                    >
                        <Download :size="13" />
                        <span>Templat CSV</span>
                    </Button>
                </div>

                <!-- Error Banner -->
                <div v-if="importError" class="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900 flex items-center gap-2">
                    <AlertCircle :size="15" class="shrink-0" />
                    <span>{{ importError }}</span>
                </div>

                <!-- File Input -->
                <div>
                    <label class="block font-semibold text-surface-700 dark:text-surface-300 mb-1">
                        Pilih File CSV (.csv) <span class="text-rose-500">*</span>
                    </label>
                    <input
                        type="file"
                        accept=".csv"
                        @change="handleHolidayFileUpload"
                        class="block w-full text-xs text-surface-700 dark:text-surface-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-emphasis cursor-pointer border border-surface-200 dark:border-surface-700 rounded-lg p-1 bg-surface-50 dark:bg-surface-800/50"
                    />
                </div>

                <!-- Preview Table -->
                <div v-if="parsedHolidays.length > 0" class="space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 :size="14" />
                            <span>Preview Data Terbaca ({{ parsedHolidays.length }} Hari Libur)</span>
                        </span>
                    </div>

                    <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-x-auto max-h-48 text-[11px]">
                        <table class="w-full border-collapse">
                            <thead class="bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
                                <tr>
                                    <th class="p-2 text-left font-semibold">Tanggal</th>
                                    <th class="p-2 text-left font-semibold">Nama Hari Libur</th>
                                    <th class="p-2 text-left font-semibold">Kategori</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                                <tr v-for="(h, idx) in parsedHolidays" :key="idx">
                                    <td class="p-2 font-semibold">{{ formatDate(h.date) }}</td>
                                    <td class="p-2">{{ h.name }}</td>
                                    <td class="p-2">
                                        <Tag
                                            :value="h.type === 'collective' ? 'Cuti Bersama' : 'Libur Nasional'"
                                            :severity="h.type === 'collective' ? 'warn' : 'danger'"
                                            class="text-[11px]"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-700">
                    <Button
                        label="Batal"
                        severity="secondary"
                        text
                        size="small"
                        class="text-xs"
                        :disabled="importLoading"
                        @click="importDialogVisible = false"
                    />
                    <Button
                        label="Proses Impor"
                        size="small"
                        class="text-xs font-bold"
                        :loading="importLoading"
                        :disabled="parsedHolidays.length === 0"
                        @click="processHolidayImport"
                    />
                </div>
            </div>
        </Dialog>
    </div>
</template>
