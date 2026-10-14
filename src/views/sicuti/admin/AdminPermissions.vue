<script setup>
import { ref, computed, onMounted } from 'vue';
import { rbacService } from '@/service/rbacService';
import { authService } from '@/service/authService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { ShieldCheck, Save, RefreshCw, Lock, Plus, Trash2 } from 'lucide-vue-next';
import { roleDeleteBlock } from './permissionRules';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const saving = ref(false);

// Katalog & role dari backend (prototype: permissionModules + permissions per role)
const catalog = ref([]);
const roles = ref([]);
const selectedRole = ref('');
const current = ref(new Set());
const savedSnapshot = ref('');

// level = nilai yang dipakai saat peran dipindah ke kelompok itu
const ROLE_GROUPS = [
    { label: 'Super admin', match: (l) => l <= 0 },
    { label: 'Admin', level: 10, match: (l) => l > 0 && l <= 15 },
    { label: 'Kepala / atasan', level: 30, match: (l) => l > 15 && l <= 35 },
    { label: 'Approval', level: 40, match: (l) => l > 35 && l <= 50 },
    { label: 'Karyawan', level: 90, match: (l) => l > 50 }
];
const groupOf = (level) => ROLE_GROUPS.find((g) => g.match(Number(level ?? 90)));
const groupOptions = ROLE_GROUPS.filter((g) => g.level !== undefined).map((g) => ({ label: g.label, value: g.label }));

const roleGroups = computed(() =>
    ROLE_GROUPS.map((g) => ({ label: g.label, roles: roles.value.filter((r) => g.match(Number(r.level ?? 90))) })).filter(
        (g) => g.roles.length > 0
    )
);

const selectedRoleObj = computed(() => roles.value.find((r) => r.kd_role === selectedRole.value));
const isSuper = computed(() => Boolean(selectedRoleObj.value?.is_super));
const allKeys = computed(() => catalog.value.flatMap((m) => m.actions.map((a) => `${m.key}.${a.key}`)));
const activeCount = computed(() => (isSuper.value ? allKeys.value.length : current.value.size));

const snapshotOf = (set) => JSON.stringify([...set].sort());
const isDirty = computed(() => !isSuper.value && snapshotOf(current.value) !== savedSnapshot.value);

function applyRole(kdRole) {
    selectedRole.value = kdRole;
    const role = roles.value.find((r) => r.kd_role === kdRole);
    current.value = new Set(role?.abilities || []);
    savedSnapshot.value = snapshotOf(current.value);
}

async function load(keepSelection = true) {
    loading.value = true;
    try {
        const res = await rbacService.getRoleAbilities();
        catalog.value = res.catalog || [];
        roles.value = res.roles || [];
        const target = keepSelection && roles.value.some((r) => r.kd_role === selectedRole.value) ? selectedRole.value : roles.value[0]?.kd_role;
        if (target) applyRole(target);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Hak akses gagal dimuat', detail: err.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

function confirmDiscard(onAccept) {
    if (!isDirty.value) return onAccept();
    confirm.require({
        header: 'Perubahan belum disimpan',
        message: `Perubahan hak akses ${selectedRoleObj.value?.nm_role || ''} akan hilang.`,
        acceptLabel: 'Buang perubahan',
        rejectLabel: 'Tetap di sini',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: onAccept
    });
}

function selectRole(kdRole) {
    if (kdRole === selectedRole.value) return;
    confirmDiscard(() => applyRole(kdRole));
}

// Hapus peran: hanya peran buatan sendiri yang tidak dipakai pengguna (aturan sama dengan backend)
const deleting = ref(false);

function removeRole() {
    const role = selectedRoleObj.value;
    const block = roleDeleteBlock(role);
    if (block) {
        toast.add({ severity: 'warn', summary: 'Peran tidak bisa dihapus', detail: block, life: 4500 });
        return;
    }
    confirm.require({
        header: 'Hapus peran?',
        message: `Peran "${role.nm_role}" beserta seluruh hak aksesnya akan dihapus.`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: async () => {
            deleting.value = true;
            try {
                await rbacService.deleteRole(role.kd_role);
                toast.add({ severity: 'success', summary: 'Peran dihapus', detail: `Peran "${role.nm_role}" berhasil dihapus`, life: 3000 });
                await load(false);
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal menghapus peran', detail: err.message || 'Coba lagi beberapa saat.', life: 4500 });
            } finally {
                deleting.value = false;
            }
        }
    });
}

function has(key) {
    return isSuper.value || current.value.has(key);
}

function toggle(key) {
    if (isSuper.value) return;
    const next = new Set(current.value);
    next.has(key) ? next.delete(key) : next.add(key);
    current.value = next;
}

function moduleKeys(mod) {
    return mod.actions.map((a) => `${mod.key}.${a.key}`);
}

function moduleState(mod) {
    const keys = moduleKeys(mod);
    const on = keys.filter(has).length;
    return on === 0 ? 'none' : on === keys.length ? 'all' : 'some';
}

function toggleModule(mod) {
    if (isSuper.value) return;
    const next = new Set(current.value);
    const turnOn = moduleState(mod) !== 'all';
    moduleKeys(mod).forEach((k) => (turnOn ? next.add(k) : next.delete(k)));
    current.value = next;
}

async function save() {
    saving.value = true;
    try {
        const updated = await rbacService.updateRole(selectedRole.value, { abilities: [...current.value] });
        const idx = roles.value.findIndex((r) => r.kd_role === updated.kd_role);
        if (idx >= 0) roles.value[idx] = updated;
        applyRole(updated.kd_role);
        await authService.getMenu().catch(() => {});
        toast.add({ severity: 'success', summary: 'Hak akses disimpan', detail: `Hak akses ${updated.nm_role} sudah diperbarui.`, life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Hak akses gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

// ---- Kelompok peran (level) untuk peran yang dipilih
const selectedGroup = computed(() => groupOf(selectedRoleObj.value?.level)?.label);
const groupSaving = ref(false);

function changeGroup(label) {
    const role = selectedRoleObj.value;
    const group = ROLE_GROUPS.find((g) => g.label === label);
    if (!role || !group || label === selectedGroup.value) return;
    const run = async () => {
        groupSaving.value = true;
        try {
            const updated = await rbacService.updateRole(role.kd_role, { level: group.level });
            const idx = roles.value.findIndex((r) => r.kd_role === role.kd_role);
            // Hanya level yang diganti; centang izin yang belum disimpan tetap
            if (idx >= 0) roles.value[idx] = { ...roles.value[idx], level: updated.level };
            toast.add({ severity: 'success', summary: 'Kelompok peran diubah', detail: `${role.nm_role} sekarang masuk kelompok ${label}.`, life: 3000 });
        } catch (err) {
            toast.add({ severity: 'error', summary: 'Kelompok peran gagal diubah', detail: err.message, life: 4000 });
        } finally {
            groupSaving.value = false;
        }
    };
    if (role.user_count > 0) {
        confirm.require({
            header: 'Ubah kelompok peran',
            message: `${role.nm_role} dipakai ${role.user_count} pengguna. Pindahkan ke kelompok ${label}?`,
            acceptLabel: 'Pindahkan',
            rejectLabel: 'Batal',
            rejectProps: { severity: 'secondary', outlined: true },
            accept: run
        });
    } else {
        run();
    }
}

// ---- Tambah Role (prototype addPermissionRole)
const roleDialog = ref({ visible: false, name: '', copyFrom: null, saving: false });
const copyOptions = computed(() => roles.value.filter((r) => !r.is_super).map((r) => ({ label: r.nm_role, value: r.kd_role })));
const copySource = computed(() => roles.value.find((r) => r.kd_role === roleDialog.value.copyFrom));

function openCreate() {
    confirmDiscard(() => {
        roleDialog.value = { visible: true, name: '', copyFrom: null, saving: false };
    });
}

async function submitRoleDialog() {
    const d = roleDialog.value;
    const name = d.name.trim();
    if (!name) {
        toast.add({ severity: 'warn', summary: 'Nama peran wajib diisi', life: 3000 });
        return;
    }
    d.saving = true;
    try {
        const source = copySource.value;
        const created = await rbacService.createRole({ nm_role: name, abilities: source?.abilities || [], level: source?.level });
        roles.value.push(created);
        applyRole(created.kd_role);
        toast.add({ severity: 'success', summary: 'Peran ditambahkan', detail: `Peran ${created.nm_role} siap diatur hak aksesnya.`, life: 3000 });
        d.visible = false;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Peran gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        d.saving = false;
    }
}

onMounted(() => load(false));
</script>

<template>
    <div class="space-y-5">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <ShieldCheck class="text-primary w-5 h-5" />
                    <span>Manajemen Hak Akses</span>
                </h2>
                <p class="text-xs text-muted-color">Kelola peran dan izin fitur yang boleh dipakai setiap peran.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Button severity="secondary" outlined size="small" class="font-semibold flex items-center gap-1.5" :loading="loading" @click="confirmDiscard(() => load())">
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
                <Button severity="secondary" outlined size="small" class="font-semibold flex items-center gap-1.5" @click="openCreate">
                    <Plus :size="14" :stroke-width="2" />
                    <span>Tambah Peran</span>
                </Button>
                <Button severity="primary" size="small" class="font-semibold flex items-center gap-1.5" :loading="saving" :disabled="isSuper || !isDirty" @click="save">
                    <Save :size="14" :stroke-width="2" />
                    <span>Simpan Perubahan</span>
                </Button>
            </div>
        </div>

        <!-- Role Selector -->
        <section class="card !p-0 border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm overflow-hidden">
            <div class="px-5 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100">Pilih peran</h3>
                <span class="text-xs text-muted-color">{{ roles.length }} peran</span>
            </div>
            <div class="divide-y divide-surface-100 dark:divide-surface-800">
                <div v-for="group in roleGroups" :key="group.label" class="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-2 sm:gap-4 px-5 py-3">
                    <span class="text-xs font-semibold text-muted-color sm:pt-1.5">{{ group.label }}</span>
                    <div class="flex flex-wrap gap-1.5">
                        <button
                            v-for="r in group.roles"
                            :key="r.kd_role"
                            type="button"
                            :title="`Kode role: ${r.kd_role}`"
                            :aria-pressed="selectedRole === r.kd_role"
                            :class="[
                                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                selectedRole === r.kd_role
                                    ? 'bg-primary text-primary-contrast border-primary shadow-sm'
                                    : 'bg-surface-0 dark:bg-surface-800 text-surface-700 dark:text-surface-200 border-surface-200 dark:border-surface-700 hover:border-primary/50 hover:bg-primary/5'
                            ]"
                            @click="selectRole(r.kd_role)"
                        >
                            {{ r.nm_role }}
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Permission Matrix -->
        <section v-if="selectedRoleObj" class="card !p-0 border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-surface-200 dark:border-surface-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="min-w-0 space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-base font-bold text-surface-900 dark:text-surface-100">{{ selectedRoleObj.nm_role }}</h3>
                        <span class="text-xs text-muted-color">
                            {{ selectedRoleObj.user_count > 0 ? `Dipakai ${selectedRoleObj.user_count} pengguna` : 'Belum dipakai pengguna' }}
                        </span>
                        <span
                            v-if="isDirty"
                            class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                        >
                            Belum disimpan
                        </span>
                        <Button
                            v-if="!isSuper"
                            size="small"
                            severity="danger"
                            text
                            class="text-xs font-semibold flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            :loading="deleting"
                            @click="removeRole"
                        >
                            <Trash2 :size="14" />
                            <span>Hapus Peran</span>
                        </Button>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="h-1.5 w-40 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden" aria-hidden="true">
                            <div class="h-full bg-primary transition-[width] duration-300" :style="{ width: `${allKeys.length ? (activeCount / allKeys.length) * 100 : 0}%` }" />
                        </div>
                        <span class="text-xs text-muted-color">{{ activeCount }} dari {{ allKeys.length }} izin aktif</span>
                    </div>
                </div>

                <div v-if="isSuper" class="shrink-0 text-xs font-semibold text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2 md:max-w-sm">
                    <Lock :size="14" class="shrink-0" />
                    <span>Admin Super App otomatis punya semua akses. Hak akses hanya untuk dilihat.</span>
                </div>
                <div v-else class="shrink-0 flex items-center gap-2">
                    <label for="role-group" class="text-xs font-semibold text-muted-color">Kelompok peran</label>
                    <Select
                        :modelValue="selectedGroup"
                        inputId="role-group"
                        :options="groupOptions"
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                        class="w-44"
                        :loading="groupSaving"
                        :disabled="groupSaving"
                        @update:modelValue="changeGroup"
                    />
                </div>
            </div>

            <!-- Modul × aksi -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-px bg-surface-100 dark:bg-surface-800">
                <fieldset v-for="mod in catalog" :key="mod.key" class="bg-surface-0 dark:bg-surface-900 px-5 py-4">
                    <legend class="sr-only">{{ mod.label }}</legend>
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <h4 class="text-sm font-bold text-primary">{{ mod.label }}</h4>
                        <button
                            v-if="!isSuper"
                            type="button"
                            class="text-xs font-semibold text-surface-500 hover:text-primary cursor-pointer focus-visible:outline-2 focus-visible:outline-primary rounded"
                            @click="toggleModule(mod)"
                        >
                            {{ moduleState(mod) === 'all' ? 'Kosongkan modul' : 'Pilih semua' }}
                        </button>
                    </div>
                    <ul class="space-y-0.5">
                        <li v-for="act in mod.actions" :key="act.key">
                            <label
                                class="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 text-sm text-surface-800 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800/50"
                                :class="isSuper ? 'cursor-default' : 'cursor-pointer'"
                            >
                                <input
                                    type="checkbox"
                                    class="size-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                    :checked="has(`${mod.key}.${act.key}`)"
                                    :disabled="isSuper"
                                    @change="toggle(`${mod.key}.${act.key}`)"
                                />
                                {{ act.label }}
                            </label>
                        </li>
                    </ul>
                </fieldset>
            </div>
        </section>

        <!-- Dialog tambah role -->
        <Dialog
            v-model:visible="roleDialog.visible"
            modal
            header="Tambah Peran"
            :style="{ width: '420px' }"
            :breakpoints="{ '640px': '92vw' }"
        >
            <form class="space-y-4 pt-1 text-sm" @submit.prevent="submitRoleDialog">
                <div>
                    <label for="role-name" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Nama peran <span class="text-rose-500">*</span></label>
                    <InputText id="role-name" v-model="roleDialog.name" class="w-full" placeholder="Contoh: Staff HRD" autofocus />
                </div>
                <div>
                    <label for="role-copy" class="block font-medium text-surface-700 dark:text-surface-300 mb-1.5">Salin hak akses dari</label>
                    <Select
                        v-model="roleDialog.copyFrom"
                        inputId="role-copy"
                        :options="copyOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Mulai dari kosong"
                        showClear
                        fluid
                    />
                    <p class="text-[11px] text-muted-color mt-1">
                        {{
                            copySource
                                ? `Kelompok peran ikut ${copySource.nm_role} (${groupOf(copySource.level)?.label}).`
                                : 'Tanpa salinan, peran masuk kelompok Karyawan. Kelompok bisa diubah setelah peran dibuat.'
                        }}
                    </p>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <Button type="button" label="Batal" severity="secondary" text size="small" @click="roleDialog.visible = false" />
                    <Button type="submit" label="Tambah Peran" size="small" class="font-semibold" :loading="roleDialog.saving" />
                </div>
            </form>
        </Dialog>
    </div>
</template>
