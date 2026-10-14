<script setup>
import { ref, computed, watch } from 'vue';
import { leaveService } from '@/service/leaveService';
import { currentUser, isSubstituteRequired, lastReturnNote } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import {
    Paperclip,
    X,
    Send,
    Save,
    AlertTriangle,
    FileText,
    UploadCloud,
    Trash2
} from 'lucide-vue-next';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    editId: {
        type: String,
        default: null
    },
    editingLeave: {
        type: [Object, String],
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved', 'refresh']);
const toast = useToast();
const substituteRequired = computed(() => isSubstituteRequired());

const editingId = computed(() => {
    if (props.editingLeave) {
        if (typeof props.editingLeave === 'string') return props.editingLeave;
        return props.editingLeave.id || props.editingLeave.id_request || null;
    }
    return props.editId || null;
});

const isEditMode = computed(() => Boolean(editingId.value));
// Draf (QA #7): disimpan dulu tanpa dikirim ke approver, bisa diubah lalu dikirim kapan saja
const isDraftEdit = computed(() => isEditMode.value && typeof props.editingLeave === 'object' && props.editingLeave?.status === 'draft');
const canSaveDraft = computed(() => !isEditMode.value || isDraftEdit.value);
const isSavingDraft = ref(false);
// Alasan approver mengembalikan pengajuan, ditampilkan di atas form revisi
const returnNote = ref(null);

const isSubmitting = ref(false);
const loadingInit = ref(false);
const validationAlert = ref(null);
const fileInputRef = ref(null);

const leaveTypes = ref([]);
const holidays = ref([]);
const balances = ref([]);
const colleagues = ref([]);

const form = ref({
    leaveTypeId: '',
    startDate: null,
    endDate: null,
    reason: '',
    substituteId: '',
    documentFile: null,
    documentName: '',
    documentSize: 0,
    existingAttachmentUrl: ''
});

function parseToDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
        const clean = val.split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        return new Date(val);
    }
    return null;
}

function formatDate(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        return d.split('T')[0];
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const currentYear = computed(() => {
    return form.value.startDate ? new Date(form.value.startDate).getFullYear() : new Date().getFullYear();
});

const remainingBalance = computed(() => {
    if (!balances.value.length) return 0;
    const found = balances.value.find((b) => Number(b.year) === currentYear.value) || balances.value[0];
    return Number(found.remaining ?? (Number(found.annual_quota || 0) + Number(found.carry_over_days || 0) - Number(found.used_days || 0)));
});

const activeLeaveTypes = computed(() => {
    return leaveTypes.value.map((t) => ({
        id: t.kd_leave_type || t.id || t.code,
        name: t.nm_leave_type || t.name,
        usesQuota: t.uses_quota ?? t.usesQuota ?? true,
        requiresDocument: t.requires_attachment ?? t.requires_document ?? t.requiresDocument ?? false,
        maxDays: Number(t.max_days ?? t.maxDays) || null,
        allowBackdate: Boolean(t.allow_backdate ?? t.allowBackdate),
        allowLateDocument: Boolean(t.allow_late_document ?? t.allowLateDocument),
        lateDocumentDays: Number(t.late_document_days ?? t.lateDocumentDays) || 3,
        description: t.description || ''
    }));
});

const selectedLeaveType = computed(() => {
    return activeLeaveTypes.value.find((t) => t.id === form.value.leaveTypeId);
});

const colleagueOptions = computed(() => {
    const curUid = currentUser.value?.uid_user_system || currentUser.value?.id;
    return colleagues.value
        .filter((u) => {
            const uid = u.uid_user_system || u.id;
            return uid !== curUid && u.status_user !== 'N';
        })
        .map((u) => ({
            label: `${u.nama || u.name} (${u.nm_dept || u.kd_dept || u.department || 'Divisi'})`,
            value: u.uid_user_system || u.id
        }));
});

const minEndDate = computed(() => parseToDate(form.value.startDate));

const holidayDateSet = computed(() => {
    const set = new Set();
    holidays.value.forEach((h) => {
        const start = String(h.holiday_date || h.date || '').split('T')[0];
        if (!start) return;
        const end = String(h.end_date || h.endDate || start).split('T')[0];
        const cur = new Date(`${start}T00:00:00Z`);
        const fin = new Date(`${end}T00:00:00Z`);
        while (cur <= fin) {
            set.add(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    });
    return set;
});

const calculatedDays = computed(() => {
    const s = formatDate(form.value.startDate);
    const e = formatDate(form.value.endDate);
    if (!s || !e) return 0;
    const start = new Date(s);
    const end = new Date(e);
    if (end < start) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const day = cur.getDay();
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${d}`;
        const isWeekend = day === 0 || day === 6;
        const isHoliday = holidayDateSet.value.has(iso);

        if (!isWeekend && !isHoliday) {
            count++;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return count;
});

const estimatedRemaining = computed(() => {
    if (!selectedLeaveType.value?.usesQuota) return remainingBalance.value;
    return remainingBalance.value - (calculatedDays.value || 0);
});

watch(
    () => form.value.startDate,
    (newStart) => {
        validationAlert.value = null;
        const sDate = parseToDate(newStart);
        const eDate = parseToDate(form.value.endDate);
        if (sDate && eDate && eDate < sDate) {
            form.value.endDate = newStart;
        }
    }
);

watch(
    () => form.value.endDate,
    () => {
        validationAlert.value = null;
    }
);

watch(selectedLeaveType, (newType, oldType) => {
    validationAlert.value = null;
    if (oldType && !newType?.requiresDocument && !form.value.existingAttachmentUrl) {
        removeFile();
    }
});

function populateFormFromData(detail) {
    if (!detail) return;
    returnNote.value = lastReturnNote(detail) || returnNote.value;
    form.value.leaveTypeId = detail.kd_leave_type || detail.leaveTypeId || detail.id_leave_type || '';
    form.value.startDate = parseToDate(detail.start_date || detail.startDate);
    form.value.endDate = parseToDate(detail.end_date || detail.endDate);
    form.value.reason = detail.reason || '';
    form.value.substituteId = detail.substitute_id || detail.substituteId || '';
    form.value.documentFile = null;
    form.value.documentName = detail.attachment_name || (detail.attachment_url ? detail.attachment_url.split('/').pop() : '');
    form.value.documentSize = 0;
    form.value.existingAttachmentUrl = detail.attachment_url || '';
}

/** Jenis cuti bawaan form: Cuti Tahunan, jika tersedia. */
function defaultLeaveTypeId() {
    const annual = leaveTypes.value.find((t) => (t.code || '').toUpperCase() === 'CT') || leaveTypes.value[0];
    return annual ? annual.kd_leave_type || annual.id || annual.code : '';
}

function resetForm() {
    returnNote.value = null;
    form.value = {
        leaveTypeId: defaultLeaveTypeId(),
        startDate: null,
        endDate: null,
        reason: '',
        substituteId: '',
        documentFile: null,
        documentName: '',
        documentSize: 0,
        existingAttachmentUrl: ''
    };
    validationAlert.value = null;
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
}

async function loadInitialData() {
    loadingInit.value = true;
    try {
        const currentY = new Date().getFullYear();
        const [types, bals, hols, users] = await Promise.all([
            leaveService.getLeaveTypes(false).catch(() => []),
            leaveService.getBalances({ year: currentY }).catch(() => []),
            leaveService.getHolidays(currentY).catch(() => []),
            leaveService.getColleagues().catch(() => [])
        ]);

        leaveTypes.value = Array.isArray(types) ? types : [];
        balances.value = Array.isArray(bals) ? bals : (bals ? [bals] : []);
        holidays.value = Array.isArray(hols) ? hols : [];
        colleagues.value = Array.isArray(users) ? users : [];

        if (isEditMode.value) {
            if (props.editingLeave && typeof props.editingLeave === 'object') {
                populateFormFromData(props.editingLeave);
            }
            if (editingId.value) {
                const detail = await leaveService.getLeaveDetail(editingId.value).catch(() => null);
                if (detail) {
                    populateFormFromData(detail);
                }
            }
        } else {
            if (leaveTypes.value.length > 0 && !form.value.leaveTypeId) {
                form.value.leaveTypeId = defaultLeaveTypeId();
            }
        }
    } catch (err) {
        console.error('Error loading leave form dependencies:', err);
    } finally {
        loadingInit.value = false;
    }
}

watch(
    () => [props.visible, props.editingLeave, props.editId],
    ([visible]) => {
        if (visible) {
            resetForm();
            if (props.editingLeave && typeof props.editingLeave === 'object') {
                populateFormFromData(props.editingLeave);
            }
            loadInitialData();
        }
    },
    { immediate: true }
);

function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Dokumen pendukung: hanya PDF, maksimal 2 MB (sama dengan backend)
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (ext !== '.pdf') {
        toast.add({
            severity: 'error',
            summary: 'Format Tidak Didukung',
            detail: 'Dokumen pendukung harus berupa PDF',
            life: 3500
        });
        if (fileInputRef.value) fileInputRef.value.value = '';
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        toast.add({
            severity: 'error',
            summary: 'Ukuran Terlalu Besar',
            detail: 'Ukuran berkas maksimal 2 MB',
            life: 3500
        });
        if (fileInputRef.value) fileInputRef.value.value = '';
        return;
    }

    form.value.documentFile = file;
    form.value.documentName = file.name;
    form.value.documentSize = file.size;
}

function removeFile() {
    form.value.documentFile = null;
    form.value.documentName = '';
    form.value.documentSize = 0;
    form.value.existingAttachmentUrl = '';
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
}

function validateForm() {
    const s = formatDate(form.value.startDate);
    const e = formatDate(form.value.endDate);

    if (!form.value.leaveTypeId) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Silakan pilih jenis cuti', life: 3000 });
        return false;
    }
    if (!s) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Pilih tanggal mulai cuti', life: 3000 });
        return false;
    }
    // Kalender menolak tanggal selesai sebelum tanggal mulai, jadi kolomnya kosong
    if (!e) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Pilih tanggal selesai yang sama dengan atau setelah tanggal mulai', life: 3000 });
        return false;
    }
    if (new Date(e) < new Date(s)) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Tanggal selesai harus setelah tanggal mulai', life: 3000 });
        return false;
    }
    if (calculatedDays.value <= 0) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Rentang tanggal tidak memuat hari kerja (akhir pekan/libur)', life: 3000 });
        return false;
    }

    // Validasi saldo di frontend sebelum kirim
    if (selectedLeaveType.value?.usesQuota && calculatedDays.value > remainingBalance.value) {
        toast.add({
            severity: 'error',
            summary: 'Saldo Kurang',
            detail: `Saldo cuti Anda (${remainingBalance.value} hari) tidak mencukupi untuk pengajuan ${calculatedDays.value} hari kerja`,
            life: 4000
        });
        return false;
    }

    // Batas hari per jenis cuti (mis. Cuti Haid maks. 2 hari) dari master Jenis Cuti
    if (selectedLeaveType.value?.maxDays && calculatedDays.value > selectedLeaveType.value.maxDays) {
        toast.add({
            severity: 'error',
            summary: 'Melebihi Batas Hari',
            detail: `${selectedLeaveType.value.name} maksimal ${selectedLeaveType.value.maxDays} hari kerja per pengajuan (dipilih ${calculatedDays.value} hari)`,
            life: 4500
        });
        return false;
    }

    // Dokumen boleh menyusul bila jenis cutinya mengizinkan (mis. Cuti Sakit)
    if (selectedLeaveType.value?.requiresDocument && !form.value.documentName && !selectedLeaveType.value.allowLateDocument) {
        toast.add({
            severity: 'error',
            summary: 'Dokumen Wajib',
            detail: `Jenis cuti ${selectedLeaveType.value.name} mensyaratkan dokumen fisik pendukung (misal: Surat Dokter)`,
            life: 4000
        });
        return false;
    }

    if (substituteRequired.value && !form.value.substituteId) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Pilih rekan pengganti tugas selama Anda cuti', life: 3000 });
        return false;
    }

    if (!form.value.reason.trim()) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Alasan pengajuan cuti wajib diisi', life: 3000 });
        return false;
    }

    return true;
}

/** Unggah dokumen baru (bila ada) lalu susun isi pengajuan; dipakai kirim & simpan draf. */
async function buildPayload() {
    let finalAttachmentUrl = form.value.existingAttachmentUrl || undefined;
    if (form.value.documentFile) {
        try {
            const uploadRes = await leaveService.uploadDocument(form.value.documentFile);
            finalAttachmentUrl = uploadRes?.url || uploadRes?.file_path || uploadRes?.data?.url || form.value.documentName;
        } catch (upErr) {
            const upMsg = upErr?.data?.message || upErr?.message || 'Gagal mengunggah berkas ke server';
            throw new Error(`Upload dokumen gagal: ${upMsg}`);
        }
    }
    return {
        kd_leave_type: form.value.leaveTypeId,
        start_date: formatDate(form.value.startDate),
        end_date: formatDate(form.value.endDate),
        total_days: calculatedDays.value,
        reason: form.value.reason.trim(),
        substitute_id: form.value.substituteId || undefined,
        attachment_url: finalAttachmentUrl,
        attachment_name: form.value.documentName || undefined
    };
}

/** Simpan draf: cukup jenis cuti dan rentang tanggal; saldo & alur approval diperiksa saat dikirim. */
async function saveDraft() {
    validationAlert.value = null;
    let problem = '';
    if (!form.value.leaveTypeId) problem = 'Pilih jenis cuti terlebih dahulu';
    else if (!form.value.startDate || !form.value.endDate) problem = 'Isi tanggal mulai dan tanggal selesai';
    else if (new Date(formatDate(form.value.endDate)) < new Date(formatDate(form.value.startDate))) problem = 'Tanggal selesai harus setelah tanggal mulai';
    else if (calculatedDays.value <= 0) problem = 'Rentang tanggal tidak memuat hari kerja (akhir pekan/libur)';
    if (problem) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: problem, life: 3000 });
        return;
    }
    isSavingDraft.value = true;
    try {
        const payload = { ...(await buildPayload()), is_draft: true };
        const res = isDraftEdit.value ? await leaveService.resubmitLeave(editingId.value, payload) : await leaveService.createLeave(payload);
        toast.add({
            severity: 'success',
            summary: 'Draf Disimpan',
            detail: 'Draf belum dikirim ke atasan. Buka tab Draf di Pengajuan Cuti untuk melanjutkan.',
            life: 4000
        });
        emit('saved', res);
        emit('refresh');
        closeDialog();
    } catch (err) {
        const rawMsg = err?.data?.message || err?.message || 'Draf gagal disimpan';
        toast.add({ severity: 'error', summary: 'Draf Gagal Disimpan', detail: Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg), life: 5000 });
    } finally {
        isSavingDraft.value = false;
    }
}

async function submitLeave() {
    validationAlert.value = null;
    if (!validateForm()) return;

    isSubmitting.value = true;
    try {
        const payload = await buildPayload();
        const finalAttachmentUrl = payload.attachment_url;

        let res;
        const targetId = editingId.value;
        if (isDraftEdit.value) {
            // Draf yang dikirim menjadi pengajuan baru bagi atasan
            res = await leaveService.resubmitLeave(targetId, payload);
            toast.add({
                severity: 'success',
                summary: 'Pengajuan Terkirim',
                detail: `Draf #${targetId} berhasil dikirim ke atasan untuk ditinjau.`,
                life: 4000
            });
        } else if (isEditMode.value && targetId) {
            res = await leaveService.resubmitLeave(targetId, payload);
            toast.add({
                severity: 'success',
                summary: 'Pengajuan Berhasil Diajukan Ulang',
                detail: `Pengajuan cuti #${targetId} berhasil diperbaiki dan diajukan ulang ke atasan.`,
                life: 4000
            });
        } else {
            res = await leaveService.createLeave(payload);
            toast.add({
                severity: 'success',
                summary: 'Pengajuan Terkirim',
                detail: finalAttachmentUrl
                    ? 'Pengajuan cuti dan dokumen pendukung berhasil dikirimkan ke atasan untuk ditinjau.'
                    : 'Pengajuan cuti berhasil dikirimkan ke atasan untuk ditinjau.',
                life: 4000
            });
        }

        emit('saved', res);
        emit('refresh');
        closeDialog();
    } catch (err) {
        const status = err?.status || err?.statusCode || (err?.response && err.response.status);
        const rawMsg = err?.data?.message || err?.message || 'Terjadi kesalahan sistem saat mengajukan cuti';
        const errorDetail = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
        const lower = errorDetail.toLowerCase();

        const isOverlap = status === 409 || lower.includes('bentrok') || lower.includes('overlap') || lower.includes('bertabrakan') || lower.includes('konflik');
        const isBackdate = (status === 400 || status === 422) && (lower.includes('lampau') || lower.includes('backdate') || lower.includes('masa lalu') || lower.includes('minimal hari ini'));

        if (isOverlap) {
            validationAlert.value = {
                severity: 'error',
                title: 'Bentrok Jadwal Cuti (Overlap)',
                message: errorDetail || 'Rentang tanggal cuti yang Anda pilih bertabrakan dengan jadwal pengajuan cuti aktif lainnya. Silakan tentukan rentang tanggal berbeda.'
            };
        } else if (isBackdate) {
            validationAlert.value = {
                severity: 'warn',
                title: 'Tanggal Lampau (Backdate) Tidak Diizinkan',
                message: errorDetail || 'Jenis cuti ini tidak boleh bertanggal lampau. Harap sesuaikan tanggal pengajuan Anda.'
            };
        } else {
            toast.add({
                severity: 'error',
                summary: isEditMode.value ? 'Gagal Mengajukan Ulang' : 'Pengajuan Gagal',
                detail: errorDetail,
                life: 5000
            });
        }
    } finally {
        isSubmitting.value = false;
    }
}

function closeDialog() {
    emit('update:visible', false);
    resetForm();
}
</script>

<template>
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        modal
        :header="isDraftEdit ? `Ubah Draf #${editingId || ''}` : isEditMode ? `Ajukan Ulang / Perbaiki Cuti #${editingId || ''}` : 'Formulir Pengajuan Cuti'"
        :breakpoints="{ '960px': '80vw', '640px': '95vw' }"
        :style="{ width: '680px' }"
        :closable="true"
        dismissableMask
    >
        <div class="space-y-4 pt-1">
            <div
                v-if="isEditMode && returnNote"
                class="p-3.5 rounded-xl border text-xs bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 flex items-start gap-2.5"
            >
                <AlertTriangle :size="18" class="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                    <strong class="font-bold block mb-0.5">Dikembalikan{{ returnNote.approverName ? ` oleh ${returnNote.approverName}` : '' }}</strong>
                    <p class="leading-relaxed">{{ returnNote.notes || 'Tidak ada catatan. Periksa kembali data pengajuan sebelum mengajukan ulang.' }}</p>
                </div>
            </div>
            <!-- Banner Peringatan Error (Overlap / Backdate) -->
            <div
                v-if="validationAlert"
                :class="[
                    'p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all shadow-xs',
                    validationAlert.severity === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                ]"
            >
                <div class="flex items-start gap-2.5">
                    <AlertTriangle
                        :size="18"
                        :class="validationAlert.severity === 'error' ? 'text-rose-600 dark:text-rose-400 mt-0.5 shrink-0' : 'text-amber-600 dark:text-amber-400 mt-0.5 shrink-0'"
                    />
                    <div>
                        <strong class="font-bold block mb-0.5">{{ validationAlert.title }}</strong>
                        <p class="leading-relaxed opacity-95">{{ validationAlert.message }}</p>
                    </div>
                </div>
                <button
                    type="button"
                    class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 p-0.5 cursor-pointer transition-colors"
                    @click="validationAlert = null"
                    title="Tutup pesan"
                >
                    <X :size="14" />
                </button>
            </div>

            <!-- Jenis Cuti -->
            <div>
                <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
                        Jenis Cuti <span class="text-red-500">*</span>
                    </label>
                    <span class="text-xs text-muted-color">
                        Saldo Tersedia: <strong class="text-surface-900 dark:text-surface-100 font-semibold">{{ remainingBalance }} hari</strong>
                    </span>
                </div>
                <Select
                    v-model="form.leaveTypeId"
                    :options="activeLeaveTypes"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Pilih Jenis Cuti"
                    class="w-full"
                />
                <div v-if="selectedLeaveType?.description" class="text-xs text-muted-color mt-1.5">
                    {{ selectedLeaveType.description }}
                    <span v-if="!selectedLeaveType.usesQuota" class="text-emerald-600 dark:text-emerald-400 font-medium ml-1">(Bebas pemotongan kuota tahunan)</span>
                </div>
                <ul v-if="selectedLeaveType && (selectedLeaveType.maxDays || selectedLeaveType.allowBackdate)" class="text-[11px] text-muted-color mt-1 flex flex-wrap gap-x-4">
                    <li v-if="selectedLeaveType.maxDays">Maksimal {{ selectedLeaveType.maxDays }} hari kerja per pengajuan</li>
                    <li v-if="selectedLeaveType.allowBackdate">Boleh untuk tanggal yang sudah lewat</li>
                </ul>
            </div>

            <!-- Periode Tanggal -->
            <div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                    <div>
                        <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                            Tanggal Mulai <span class="text-red-500">*</span>
                        </label>
                        <DatePicker
                            v-model="form.startDate"
                            dateFormat="dd M yy"
                            placeholder="Pilih Tanggal Mulai"
                            class="w-full"
                            showIcon
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                            Tanggal Selesai <span class="text-red-500">*</span>
                        </label>
                        <DatePicker
                            v-model="form.endDate"
                            :minDate="minEndDate"
                            dateFormat="dd M yy"
                            placeholder="Pilih Tanggal Selesai"
                            class="w-full"
                            showIcon
                        />
                    </div>
                </div>

                <!-- Durasi & Estimasi Sisa Inline -->
                <div v-if="calculatedDays > 0" class="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-xs">
                    <span class="text-surface-700 dark:text-surface-300">
                        Durasi Hari Kerja: <strong class="font-bold text-surface-900 dark:text-surface-0">{{ calculatedDays }} hari</strong>
                        <span class="text-muted-color ml-1">(Sabtu, Minggu & libur nasional tidak dihitung)</span>
                    </span>
                    <span v-if="selectedLeaveType?.usesQuota" :class="estimatedRemaining < 0 ? 'text-red-600 font-semibold' : 'text-muted-color'">
                        Estimasi sisa saldo: <strong :class="estimatedRemaining < 0 ? 'text-red-600' : 'text-surface-900 dark:text-surface-100 font-semibold'">{{ estimatedRemaining }} hari</strong>
                    </span>
                </div>
            </div>

            <!-- Pengganti Tugas (Handover) -->
            <div>
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                    Pengganti tugas
                    <span v-if="substituteRequired" class="text-red-500">*</span>
                    <span v-else class="text-xs font-normal text-muted-color">(opsional)</span>
                </label>
                <Select
                    v-model="form.substituteId"
                    :options="colleagueOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih rekan pengganti"
                    filter
                    :showClear="!substituteRequired"
                    class="w-full"
                />
            </div>

            <!-- Alasan Pengajuan -->
            <div>
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                    Alasan Pengajuan Cuti <span class="text-red-500">*</span>
                </label>
                <Textarea
                    v-model="form.reason"
                    rows="3"
                    class="w-full"
                    placeholder="Tuliskan alasan / keperluan permohonan cuti..."
                />
            </div>

            <!-- Dokumen Pendukung Fisik -->
            <div v-if="selectedLeaveType?.requiresDocument || form.documentName">
                <p v-if="selectedLeaveType?.requiresDocument && selectedLeaveType.allowLateDocument && !form.documentName" class="text-[11px] text-muted-color mb-1.5">
                    Belum punya dokumennya? Kirim dulu pengajuannya, lalu lengkapi dokumen dari halaman Pengajuan Cuti paling lambat
                    {{ selectedLeaveType.lateDocumentDays }} hari setelah pengajuan dikirim. Pengajuan baru bisa disetujui setelah dokumen diunggah.
                </p>
                <div class="flex items-center justify-between mb-1.5">
                    <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
                        Dokumen Pendukung Fisik
                        <span v-if="selectedLeaveType?.requiresDocument" class="text-red-500">*</span>
                    </label>
                    <span v-if="selectedLeaveType?.requiresDocument && selectedLeaveType.allowLateDocument" class="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Wajib, boleh menyusul maks. {{ selectedLeaveType.lateDocumentDays }} hari
                    </span>
                    <span v-else-if="selectedLeaveType?.requiresDocument" class="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        Wajib untuk {{ selectedLeaveType.name }}
                    </span>
                    <span v-else class="text-[11px] text-muted-color">Opsional</span>
                </div>

                <!-- Box File Terpilih -->
                <div
                    v-if="form.documentName"
                    class="p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/60 flex items-center justify-between gap-3 shadow-2xs"
                >
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <FileText :size="18" />
                        </div>
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-surface-900 dark:text-surface-0 truncate">
                                {{ form.documentName }}
                            </div>
                            <div class="text-[11px] text-muted-color flex items-center gap-2">
                                <span v-if="form.documentSize">{{ formatFileSize(form.documentSize) }}</span>
                                <span v-if="form.documentFile" class="text-emerald-600 dark:text-emerald-400 font-medium">&bull; Siap diunggah ke server</span>
                                <span v-else-if="form.existingAttachmentUrl" class="text-primary font-medium">&bull; Berkas tersimpan</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="p-1.5 rounded-lg text-surface-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                        @click="removeFile"
                        title="Hapus / Ganti Dokumen"
                    >
                        <Trash2 :size="15" />
                    </button>
                </div>

                <!-- Dropzone / Input Berkas -->
                <div v-else>
                    <label
                        class="border-2 border-dashed border-surface-300 dark:border-surface-700 hover:border-primary/60 dark:hover:border-primary/60 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-surface-50/50 dark:bg-surface-800/30 hover:bg-primary/5 transition-all text-center group"
                    >
                        <UploadCloud :size="24" class="text-muted-color group-hover:text-primary transition-colors" />
                        <div class="text-xs font-semibold text-surface-800 dark:text-surface-200">
                            Pilih Dokumen Pendukung Fisik
                        </div>
                        <p class="text-[11px] text-muted-color">
                            Unggah berkas PDF (maks. 2 MB)
                        </p>
                        <input
                            ref="fileInputRef"
                            type="file"
                            class="hidden"
                            accept=".pdf,application/pdf"
                            @change="handleFileUpload"
                        />
                    </label>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex items-center justify-between gap-2 w-full pt-3.5 border-t border-surface-100 dark:border-surface-800">
                <Button
                    label="Batal"
                    severity="secondary"
                    text
                    size="small"
                    class="text-xs font-semibold"
                    @click="closeDialog"
                />
                <div class="flex items-center gap-2">
                    <Button
                        v-if="canSaveDraft"
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs flex items-center gap-1.5 font-semibold"
                        :loading="isSavingDraft"
                        :disabled="isSubmitting"
                        @click="saveDraft"
                    >
                        <Save :size="14" :stroke-width="2" />
                        <span>Simpan Draf</span>
                    </Button>
                    <Button
                        severity="primary"
                        size="small"
                        class="text-xs flex items-center gap-1.5 font-semibold shadow-xs"
                        :loading="isSubmitting"
                        :disabled="isSavingDraft"
                        @click="submitLeave"
                    >
                        <Send :size="14" :stroke-width="2" />
                        <span>{{ isEditMode && !isDraftEdit ? 'Ajukan Ulang' : 'Kirim Pengajuan' }}</span>
                    </Button>
                </div>
            </div>
        </template>
    </Dialog>
</template>
