<script setup>
import { ref, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { sicutiState, syncFromBackend, formatDate, CURRENT_YEAR } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from 'lucide-vue-next';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    year: {
        type: Number,
        default: CURRENT_YEAR
    }
});

const emit = defineEmits(['update:visible', 'uploaded']);
const toast = useToast();

const importFile = ref(null);
const parsedHolidays = ref([]);
const importLoading = ref(false);
const importError = ref('');

watch(
    () => props.visible,
    (isOpen) => {
        if (isOpen) {
            importFile.value = null;
            parsedHolidays.value = [];
            importError.value = '';
        }
    }
);

function downloadHolidayTemplate() {
    const yr = props.year || CURRENT_YEAR;
    const template =
        'holiday_date,nm_holiday,type\r\n' +
        `${yr}-01-01,Tahun Baru Masehi ${yr},national\r\n` +
        `${yr}-05-01,Hari Buruh Internasional,national\r\n` +
        `${yr}-06-01,Hari Lahir Pancasila,national\r\n` +
        `${yr}-12-26,Cuti Bersama Hari Raya Natal,collective`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `template_import_hari_libur_${yr}.csv`);
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
                    const y = Number(rawDate.slice(0, 4)) || props.year || CURRENT_YEAR;
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
    emit('update:visible', false);
    emit('uploaded');
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        header="Impor Hari Libur & Cuti Bersama via CSV"
        :style="{ width: '540px', maxWidth: '95vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-4 pt-2 text-xs">
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

            <div v-if="importError" class="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900 flex items-center gap-2">
                <AlertCircle :size="15" class="shrink-0" />
                <span>{{ importError }}</span>
            </div>

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

            <div class="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-700">
                <Button
                    label="Batal"
                    severity="secondary"
                    text
                    size="small"
                    class="text-xs"
                    :disabled="importLoading"
                    @click="emit('update:visible', false)"
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
</template>
