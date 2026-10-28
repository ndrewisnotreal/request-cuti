<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { leaveService } from '@/service/leaveService';
import {
    sicutiState,
    getDivisionUsers,
    getUserBalance,
    calculateWorkingDays,
    syncFromBackend,
    isSubstituteRequired,
    ROLE_LABELS
} from '@/service/sicutiService';
import { FilePlus2, Send } from 'lucide-vue-next';

const toast = useToast();
const router = useRouter();
const saving = ref(false);

const form = ref({ userId: null, leaveTypeId: null, startDate: null, endDate: null, substituteId: null, reason: '' });

const applicantIds = computed(() => new Set(sicutiState.leaveBalances.map((b) => b.userId)));
const employees = computed(() =>
    getDivisionUsers()
        .filter((u) => u.isActive && applicantIds.value.has(u.id))
        .map((u) => ({ ...u, label: `${u.name} (${u.namecode})`, roleLabel: ROLE_LABELS[u.role] || u.role }))
        .sort((a, b) => a.name.localeCompare(b.name))
);
const substitutes = computed(() => employees.value.filter((u) => u.id !== form.value.userId));
const substituteRequired = computed(() => isSubstituteRequired(employees.value.find((u) => u.id === form.value.userId)));
const leaveTypes = computed(() => sicutiState.leaveTypes.filter((t) => t.isActive));
const selectedType = computed(() => leaveTypes.value.find((t) => t.id === form.value.leaveTypeId));

const toIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
const workingDays = computed(() => calculateWorkingDays(toIso(form.value.startDate), toIso(form.value.endDate)));
const balance = computed(() => (form.value.userId ? getUserBalance(form.value.userId) : null));

const problem = computed(() => {
    const f = form.value;
    if (!f.userId || !f.leaveTypeId || !f.startDate || !f.endDate || (substituteRequired.value && !f.substituteId) || !f.reason.trim()) {
        return 'Lengkapi semua kolom bertanda *.';
    }
    if (f.endDate < f.startDate) return 'Tanggal selesai harus setelah tanggal mulai.';
    if (workingDays.value === 0) return 'Rentang tanggal tidak berisi hari kerja.';
    if (selectedType.value?.usesQuota && balance.value && workingDays.value > balance.value.remaining) {
        return 'Saldo cuti karyawan tidak mencukupi.';
    }
    return null;
});

async function submit() {
    if (problem.value) {
        toast.add({ severity: 'warn', summary: 'Periksa kembali isian', detail: problem.value, life: 3500 });
        return;
    }
    saving.value = true;
    try {
        const f = form.value;
        const res = await leaveService.createLeave({
            uid_user_system: f.userId,
            kd_leave_type: f.leaveTypeId,
            start_date: toIso(f.startDate),
            end_date: toIso(f.endDate),
            substitute_id: f.substituteId || undefined,
            reason: f.reason.trim()
        });
        await syncFromBackend();
        const employee = employees.value.find((u) => u.id === f.userId);
        toast.add({
            severity: 'success',
            summary: 'Pengajuan dibuat',
            detail: `Pengajuan ${res?.id_request || ''} untuk ${employee?.name || 'karyawan'} masuk ke alur approval.`,
            life: 4000
        });
        router.push('/admin/monitoring');
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Pengajuan gagal dibuat', detail: err.message, life: 4500 });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div class="space-y-6 max-w-3xl">
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                <FilePlus2 class="text-primary w-5 h-5" />
                <span>Buat Pengajuan Cuti Karyawan</span>
            </h1>
            <p class="text-xs text-muted-color">Ajukan cuti atas nama karyawan di divisi Anda. Pengajuan tetap melewati alur approval.</p>
        </div>

        <form class="card !p-0 border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm" @submit.prevent="submit">
            <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                <div data-tour="create-employee">
                    <span id="acl-user-label" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Nama karyawan <span class="text-rose-500">*</span></span>
                    <Select
                        v-model="form.userId"
                        inputId="acl-user"
                        ariaLabelledby="acl-user-label"
                        :options="employees"
                        optionLabel="label"
                        optionValue="id"
                        filter
                        placeholder="Pilih karyawan"
                        emptyMessage="Tidak ada karyawan di divisi ini"
                        fluid
                    >
                        <template #option="{ option }">
                            <div class="flex flex-col">
                                <span class="font-medium">{{ option.name }}</span>
                                <span class="text-xs text-muted-color">{{ option.namecode }} · {{ option.roleLabel }}</span>
                            </div>
                        </template>
                    </Select>
                </div>
                <div data-tour="create-type">
                    <span id="acl-type-label" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Jenis cuti <span class="text-rose-500">*</span></span>
                    <Select
                        v-model="form.leaveTypeId"
                        inputId="acl-type"
                        ariaLabelledby="acl-type-label"
                        :options="leaveTypes"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Pilih jenis cuti"
                        fluid
                    />
                </div>
                <div>
                    <label for="acl-start" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Tanggal mulai <span class="text-rose-500">*</span></label>
                    <DatePicker v-model="form.startDate" inputId="acl-start" dateFormat="dd MM yy" showIcon iconDisplay="input" placeholder="Pilih tanggal" fluid />
                </div>
                <div>
                    <label for="acl-end" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Tanggal selesai <span class="text-rose-500">*</span></label>
                    <DatePicker
                        v-model="form.endDate"
                        inputId="acl-end"
                        dateFormat="dd MM yy"
                        showIcon
                        iconDisplay="input"
                        placeholder="Pilih tanggal"
                        :minDate="form.startDate || undefined"
                        fluid
                    />
                </div>
                <div class="sm:col-span-2">
                    <span id="acl-sub-label" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                        Pengganti tugas
                        <span v-if="substituteRequired" class="text-rose-500">*</span>
                        <span v-else class="text-xs font-normal text-muted-color">(opsional untuk Staff IT)</span>
                    </span>
                    <Select
                        v-model="form.substituteId"
                        inputId="acl-sub"
                        ariaLabelledby="acl-sub-label"
                        :options="substitutes"
                        optionLabel="label"
                        optionValue="id"
                        filter
                        placeholder="Pilih pengganti"
                        :disabled="!form.userId"
                        :showClear="!substituteRequired"
                        fluid
                    />
                </div>
                <div class="sm:col-span-2">
                    <label for="acl-reason" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Alasan <span class="text-rose-500">*</span></label>
                    <Textarea id="acl-reason" v-model="form.reason" rows="3" autoResize placeholder="Masukkan alasan pengajuan" class="w-full" />
                </div>

                <div data-tour="create-summary" class="sm:col-span-2 grid grid-cols-2 gap-px rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-200 dark:bg-surface-700">
                    <div class="bg-surface-50 dark:bg-surface-800 px-4 py-3">
                        <div class="text-xs text-muted-color">Jumlah hari kerja</div>
                        <div class="text-lg font-bold tabular-nums text-surface-900 dark:text-surface-0">{{ workingDays }} hari</div>
                    </div>
                    <div class="bg-surface-50 dark:bg-surface-800 px-4 py-3">
                        <div class="text-xs text-muted-color">Sisa saldo karyawan</div>
                        <div class="text-lg font-bold tabular-nums text-surface-900 dark:text-surface-0">
                            {{ balance ? `${balance.remaining} hari` : '-' }}
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-6 py-4 flex items-center justify-end gap-3 border-t border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-800/30 rounded-b-xl">
                <Button type="button" label="Batal" severity="secondary" text size="small" @click="router.push('/')" />
                <Button data-tour="create-submit" type="submit" size="small" class="font-semibold flex items-center gap-1.5" :loading="saving">
                    <Send :size="15" />
                    <span>Buat Pengajuan</span>
                </Button>
            </div>
        </form>
    </div>
</template>
