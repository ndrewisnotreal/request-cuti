<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, can } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { GitFork, Plus, Pencil, Trash2, Users, UserMinus, RefreshCw, Layers, Settings2, X } from 'lucide-vue-next';
import ReadOnlyNotice from '../shared/ReadOnlyNotice.vue';
import { approverChoices, defaultApprovers, flowFormProblem, memberChoices } from './approvalFlowOptions';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const flowsLoading = ref(false);
const membersLoading = ref(false);
const reordering = ref(false);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
// Prototype: Admin Seksi hanya melihat, kecuali diberi izin manage_approval
const canManage = computed(() => isSuper.value || can('master_data.manage_approval'));

// Master data
const templates = ref([]);
const departments = ref([]);
// Peran yang punya izin Approve/Reject: pilihan isi setiap tingkat
const approverRoles = ref([]);
// Akun yang boleh dijadikan approver (peran apa pun yang punya izin Approve/Reject atau Validasi)
const eligibleApprovers = ref([]);

// Selected state
const selectedTemplateId = ref('');
const flows = ref([]);
const members = ref([]);

// Dialog States
const templateDialogVisible = ref(false);
const isEditingTemplate = ref(false);
const templateForm = ref({ id_template: '', kd_dept: '', nm_template: '', is_active: true });

const flowDialogVisible = ref(false);
const flowForm = ref({ id_flow: '', assigned_role: '', users: [] });
const savingFlow = ref(false);
// Chip approver yang sedang dikeluarkan (tombol ×)
const removingApprover = ref('');

const memberDialogVisible = ref(false);
const memberCandidates = ref([]);
const selectedCandidateUids = ref([]);
const savingMembers = ref(false);

async function loadInitialData() {
    loading.value = true;
    try {
        const [tplData, deptsData, rolesData, eligibleData] = await Promise.all([
            adminService.getApprovalTemplates(),
            adminService.getDepartments().catch(() => []),
            adminService.getApproverRoles().catch(() => []),
            adminService.getEligibleApprovers().catch(() => [])
        ]);
        departments.value = Array.isArray(deptsData) ? deptsData : [];
        approverRoles.value = Array.isArray(rolesData) ? rolesData : [];
        eligibleApprovers.value = Array.isArray(eligibleData) ? eligibleData : [];

        // Scoped templates
        const rawTemplates = Array.isArray(tplData) ? tplData : [];
        templates.value = rawTemplates.filter((t) => !(adminDivision.value && t.kd_dept && t.kd_dept !== adminDivision.value));

        if (!templates.value.some((t) => t.id_template === selectedTemplateId.value)) {
            selectedTemplateId.value = templates.value[0]?.id_template || '';
        } else {
            await loadTemplateDetail(selectedTemplateId.value);
        }
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Memuat Data', detail: err.message || 'Gagal mengambil data templat alur approval', life: 3000 });
    } finally {
        loading.value = false;
    }
}

async function loadFlows(templateId) {
    if (!templateId) {
        flows.value = [];
        return;
    }
    flowsLoading.value = true;
    try {
        const data = await adminService.getApprovalFlows(templateId);
        flows.value = Array.isArray(data) ? data : [];
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Memuat Alur', detail: err.message || 'Gagal memuat tingkat approval', life: 3000 });
    } finally {
        flowsLoading.value = false;
    }
}

async function loadMembers(templateId) {
    if (!templateId) {
        members.value = [];
        return;
    }
    membersLoading.value = true;
    try {
        const data = await adminService.getTemplateMembers(templateId);
        members.value = Array.isArray(data) ? data : [];
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Memuat Anggota', detail: err.message || 'Gagal memuat anggota templat', life: 3000 });
    } finally {
        membersLoading.value = false;
    }
}

function loadTemplateDetail(templateId) {
    return Promise.all([loadFlows(templateId), loadMembers(templateId)]);
}

watch(selectedTemplateId, (newId) => {
    if (newId) loadTemplateDetail(newId);
    else {
        flows.value = [];
        members.value = [];
    }
});

const currentTemplate = computed(() => templates.value.find((t) => t.id_template === selectedTemplateId.value));

function deptName(kd) {
    return departments.value.find((d) => d.kd_dept === kd)?.nm_dept || kd;
}

// Tahan-dan-geser: simpan urutan baru; bila gagal kembalikan urutan sebelumnya
async function onRowReorder(event) {
    const previous = flows.value;
    flows.value = event.value.map((f, i) => ({ ...f, level: i + 1 }));
    reordering.value = true;
    try {
        const data = await adminService.reorderApprovalFlows(
            selectedTemplateId.value,
            flows.value.map((f) => f.id_flow)
        );
        if (Array.isArray(data) && data.length) flows.value = data;
        toast.add({ severity: 'success', summary: 'Urutan disimpan', detail: flows.value.map((f) => f.nm_flow).join(' → '), life: 3000 });
    } catch (err) {
        flows.value = previous;
        toast.add({ severity: 'error', summary: 'Urutan gagal disimpan', detail: err.message || 'Muat ulang halaman lalu coba lagi', life: 4000 });
    } finally {
        reordering.value = false;
    }
}

// Template CRUD
function openCreateTemplate() {
    isEditingTemplate.value = false;
    templateForm.value = {
        id_template: '',
        kd_dept: adminDivision.value || departments.value[0]?.kd_dept || 'SIT',
        nm_template: '',
        is_active: true
    };
    templateDialogVisible.value = true;
}

function openEditTemplate() {
    if (!currentTemplate.value) return;
    isEditingTemplate.value = true;
    const { id_template, kd_dept, nm_template, is_active } = currentTemplate.value;
    templateForm.value = { id_template, kd_dept, nm_template, is_active };
    templateDialogVisible.value = true;
}

const savingTemplate = ref(false);

async function saveTemplate() {
    const nameTrimmed = templateForm.value.nm_template?.trim();
    if (!nameTrimmed) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama templat wajib diisi', life: 3000 });
        return;
    }
    const dupName = templates.value.find(
        (t) => t.id_template !== templateForm.value.id_template && t.nm_template?.trim().toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (dupName) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: `Templat dengan nama "${nameTrimmed}" sudah ada`, life: 3000 });
        return;
    }
    savingTemplate.value = true;
    try {
        if (isEditingTemplate.value) {
            await adminService.updateApprovalTemplate(templateForm.value);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Templat berhasil diperbarui', life: 3000 });
        } else {
            const created = await adminService.createApprovalTemplate(templateForm.value);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Templat baru berhasil dibuat', life: 3000 });
            if (created?.id_template) selectedTemplateId.value = created.id_template;
        }
        templateDialogVisible.value = false;
        await loadInitialData();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menyimpan template', life: 3000 });
    } finally {
        savingTemplate.value = false;
    }
}

function deleteTemplate(template) {
    if (!template) return;
    confirm.require({
        header: 'Hapus Templat Approval?',
        message: `Templat "${template.nm_template}" akan dihapus. Anggotanya tidak bisa mengajukan cuti sampai dimasukkan ke templat lain. Lanjutkan?`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: async () => {
            try {
                await adminService.deleteApprovalTemplate(template.id_template);
                toast.add({ severity: 'success', summary: 'Berhasil Dihapus', detail: `Templat "${template.nm_template}" berhasil dihapus`, life: 3000 });
                selectedTemplateId.value = '';
                await loadInitialData();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal Hapus', detail: err.message || 'Gagal menghapus templat', life: 3000 });
            }
        }
    });
}

// Tingkat = peran
const usedRoles = computed(() => new Set(flows.value.filter((f) => f.id_flow !== flowForm.value.id_flow).map((f) => f.assigned_role)));
const roleOptions = computed(() => approverRoles.value.filter((r) => !usedRoles.value.has(r.kd_role)).map((r) => ({ label: r.nm_role, value: r.kd_role })));

// Approver per tingkat: akun mana pun yang berizin approve; satu akun satu tingkat per templat
const approverOptions = computed(() =>
    approverChoices(eligibleApprovers.value, flows.value, flowForm.value.id_flow, currentTemplate.value?.kd_dept)
);

function openAddFlow() {
    flowForm.value = { id_flow: '', assigned_role: '', users: [] };
    flowDialogVisible.value = true;
}

function openEditFlow(flow) {
    flowForm.value = { id_flow: flow.id_flow, assigned_role: flow.assigned_role, users: (flow.approvers || []).map((a) => a.uid_user_system) };
    flowDialogVisible.value = true;
}

// Tingkat baru: begitu peran dipilih, approver terisi pemegang peran itu (bisa diubah sebelum disimpan)
function onFlowRoleChange(kdRole) {
    if (flowForm.value.id_flow) return;
    flowForm.value.users = defaultApprovers(eligibleApprovers.value, flows.value, kdRole, currentTemplate.value?.kd_dept);
}

async function saveFlow() {
    const problem = flowFormProblem(flowForm.value);
    if (problem) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: problem, life: 3000 });
        return;
    }
    savingFlow.value = true;
    try {
        await adminService.upsertApprovalFlow({
            id_flow: flowForm.value.id_flow || undefined,
            id_template: selectedTemplateId.value,
            assigned_role: flowForm.value.assigned_role,
            users: flowForm.value.users
        });
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Tingkat approval disimpan', life: 3000 });
        flowDialogVisible.value = false;
        await loadFlows(selectedTemplateId.value);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menyimpan tingkat approval', life: 3000 });
    } finally {
        savingFlow.value = false;
    }
}

// Tombol × pada chip: keluarkan satu approver dari tingkat itu
async function removeApprover(flow, approver) {
    removingApprover.value = `${flow.id_flow}:${approver.uid_user_system}`;
    try {
        await adminService.assignFlowUsers({
            id_flow: flow.id_flow,
            users: (flow.approvers || []).map((a) => a.uid_user_system).filter((uid) => uid !== approver.uid_user_system)
        });
        toast.add({ severity: 'info', summary: 'Approver dikeluarkan', detail: `${approver.nama} tidak lagi menjadi approver tingkat ${flow.nm_flow}`, life: 3000 });
        await loadFlows(selectedTemplateId.value);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal mengeluarkan approver', life: 3000 });
    } finally {
        removingApprover.value = '';
    }
}

function deleteFlow(flow) {
    confirm.require({
        header: 'Hapus tingkat approval?',
        message: `Tingkat ${flow.level} (${flow.nm_flow}) akan dihapus dan tingkat di bawahnya naik satu urutan. Pengajuan yang sudah berjalan tidak terpengaruh.`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: async () => {
            try {
                await adminService.deleteApprovalFlow(flow.id_flow);
                toast.add({ severity: 'info', summary: 'Dihapus', detail: `Tingkat ${flow.nm_flow} telah dihapus`, life: 3000 });
                await loadFlows(selectedTemplateId.value);
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal Hapus', detail: err.message || 'Gagal menghapus tingkat approval', life: 3000 });
            }
        }
    });
}

// Anggota templat
// Satu karyawan satu templat: anggota templat lain tampil redup dan tidak bisa dipilih
const candidateOptions = computed(() => memberChoices(memberCandidates.value, currentTemplate.value?.kd_dept));

async function openAddMembers() {
    selectedCandidateUids.value = [];
    memberCandidates.value = [];
    memberDialogVisible.value = true;
    try {
        const data = await adminService.getMemberCandidates(selectedTemplateId.value);
        memberCandidates.value = Array.isArray(data) ? data : [];
    } catch (err) {
        memberDialogVisible.value = false;
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal memuat daftar karyawan', life: 3000 });
    }
}

async function saveMembers() {
    if (!selectedCandidateUids.value.length) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Pilih minimal satu karyawan', life: 3000 });
        return;
    }
    savingMembers.value = true;
    try {
        const count = selectedCandidateUids.value.length;
        const data = await adminService.addTemplateMembers(selectedTemplateId.value, selectedCandidateUids.value);
        members.value = Array.isArray(data) ? data : members.value;
        memberDialogVisible.value = false;
        toast.add({ severity: 'success', summary: 'Anggota disimpan', detail: `${count} karyawan dimasukkan ke ${currentTemplate.value?.nm_template || 'templat'}`, life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menyimpan anggota', life: 3000 });
    } finally {
        savingMembers.value = false;
    }
}

function removeMember(member) {
    confirm.require({
        header: 'Keluarkan dari templat?',
        message: `${member.nama} dikeluarkan dari ${currentTemplate.value?.nm_template || 'templat ini'}. Ia tidak bisa mengajukan cuti sampai dimasukkan ke templat lain.`,
        acceptLabel: 'Keluarkan',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: async () => {
            try {
                await adminService.removeTemplateMember(member.uid_user_system);
                toast.add({ severity: 'info', summary: 'Dikeluarkan', detail: `${member.nama} dikeluarkan dari templat`, life: 3000 });
                await loadMembers(selectedTemplateId.value);
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal mengeluarkan anggota', life: 3000 });
            }
        }
    });
}

onMounted(() => {
    loadInitialData();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice v-if="!canManage" module="alur approval" />
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <GitFork class="text-primary w-5 h-5" />
                    <span>Konfigurasi Alur Approval</span>
                </h2>
                <p class="text-xs text-muted-color">
                    Atur templat, anggota, dan urutan tingkat approval cuti. Setiap tingkat diisi satu peran.
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    :loading="loading || flowsLoading"
                    @click="loadInitialData"
                >
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
                <Button
                    v-if="canManage"
                    severity="primary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    @click="openCreateTemplate"
                >
                    <Plus :size="14" :stroke-width="2" />
                    <span>Templat Baru</span>
                </Button>
                <Button
                    v-if="canManage"
                    severity="primary"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    :disabled="!selectedTemplateId"
                    @click="openAddFlow"
                >
                    <Plus :size="14" :stroke-width="2" />
                    <span>Tambah Level</span>
                </Button>
            </div>
        </div>

        <!-- Template Selector Card -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-2">
                        <Layers class="w-4 h-4 text-primary" />
                        <span class="text-xs font-bold text-surface-800 dark:text-surface-200">Pilih Templat Approval:</span>
                    </div>
                    <Select
                        v-model="selectedTemplateId"
                        :options="templates"
                        optionLabel="nm_template"
                        optionValue="id_template"
                        placeholder="Pilih Templat"
                        class="w-full sm:w-80 text-xs"
                        size="small"
                    />
                </div>

                <div v-if="currentTemplate" class="flex items-center gap-2">
                    <Button
                        v-if="canManage"
                        size="small"
                        severity="secondary"
                        text
                        class="text-xs font-semibold flex items-center gap-1.5"
                        @click="openEditTemplate"
                    >
                        <Settings2 :size="14" />
                        <span>Ubah Templat</span>
                    </Button>
                    <Button
                        v-if="canManage"
                        size="small"
                        severity="danger"
                        text
                        class="text-xs font-semibold flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        @click="deleteTemplate(currentTemplate)"
                    >
                        <Trash2 :size="14" />
                        <span>Hapus Templat</span>
                    </Button>
                </div>
            </div>

            <!-- Template Meta Info Banner -->
            <div v-if="currentTemplate" class="p-3 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex flex-wrap items-center gap-4">
                    <div>
                        <span class="text-muted-color">Departemen:</span>
                        <Tag :value="currentTemplate.kd_dept ? deptName(currentTemplate.kd_dept) : 'Semua Departemen'" severity="secondary" class="ml-1 text-[11px]" />
                    </div>
                    <div>
                        <span class="text-muted-color">Anggota:</span>
                        <strong class="ml-1 text-surface-900 dark:text-surface-100">{{ members.length }}</strong> karyawan
                    </div>
                </div>
                <div class="text-muted-color">
                    Total: <strong class="text-surface-900 dark:text-surface-100">{{ flows.length }}</strong> Tingkat Approval
                </div>
            </div>
        </div>

        <!-- DataTable Urutan Level Approval -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <p v-if="canManage && flows.length > 1" class="text-[11px] text-muted-color mb-2">Tahan ikon ≡ lalu geser untuk mengubah urutan tingkat.</p>
            <DataTable
                :value="flows"
                :loading="flowsLoading || reordering"
                dataKey="id_flow"
                :reorderableRows="canManage"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
                @rowReorder="onRowReorder"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color">
                        Belum ada tingkat approval untuk templat ini. Klik <strong>"Tambah Level"</strong> lalu pilih peran.
                    </div>
                </template>

                <Column v-if="canManage" rowReorder style="width: 3rem" />

                <Column field="level" header="Urutan" style="width: 10%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1.5">
                            <span class="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold inline-flex items-center justify-center text-xs tabular-nums">
                                {{ data.level }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column field="nm_flow" header="Peran" style="width: 24%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nm_flow }}</div>
                    </template>
                </Column>

                <Column header="Approver" style="width: 46%">
                    <template #body="{ data }">
                        <div v-if="data.approvers && data.approvers.length > 0" class="flex flex-wrap gap-1">
                            <span
                                v-for="a in data.approvers"
                                :key="a.uid_user_system"
                                class="inline-flex items-center gap-1 py-0.5 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-[11px] text-surface-800 dark:text-surface-200"
                                :class="[canManage ? 'pl-2 pr-1' : 'px-2', a.is_locked || a.can_approve === false ? 'opacity-70' : '']"
                                :title="a.nm_role ? `Peran: ${a.nm_role}` : undefined"
                            >
                                {{ a.nama }}{{ a.is_locked ? ' (terkunci)' : a.can_approve === false ? ' (tanpa izin)' : '' }}
                                <button
                                    v-if="canManage"
                                    type="button"
                                    class="w-4 h-4 inline-flex items-center justify-center rounded text-surface-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                                    :disabled="removingApprover === `${data.id_flow}:${a.uid_user_system}`"
                                    :aria-label="`Keluarkan ${a.nama} dari tingkat ${data.nm_flow}`"
                                    :title="`Keluarkan ${a.nama} dari tingkat ini`"
                                    @click="removeApprover(data, a)"
                                >
                                    <X :size="11" :stroke-width="2.25" />
                                </button>
                            </span>
                        </div>
                    </template>
                </Column>

                <Column v-if="canManage" header="Aksi" style="width: 12%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openEditFlow(data)"
                                title="Ubah Tingkat"
                            >
                                <Pencil :size="15" :stroke-width="1.75" />
                            </button>
                            <button
                                type="button"
                                class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                                @click="deleteFlow(data)"
                                title="Hapus Tingkat"
                            >
                                <Trash2 :size="15" :stroke-width="1.75" />
                            </button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Anggota Templat -->
        <div v-if="currentTemplate" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <Users class="w-4 h-4 text-primary" />
                    <span class="text-xs font-bold text-surface-800 dark:text-surface-200">Anggota Templat ({{ members.length }})</span>
                </div>
                <Button v-if="canManage" severity="primary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5" @click="openAddMembers">
                    <Plus :size="14" :stroke-width="2" />
                    <span>Tambah Anggota</span>
                </Button>
            </div>
            <DataTable :value="members" :loading="membersLoading" dataKey="uid_user_system" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <template #empty>
                    <div class="text-center py-6 text-muted-color">Belum ada anggota. Karyawan yang belum masuk templat tidak bisa mengajukan cuti.</div>
                </template>
                <Column field="nama" header="Nama" style="width: 34%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-900 dark:text-surface-100">{{ data.nama }}</span>
                    </template>
                </Column>
                <Column field="username" header="NIK / Username" style="width: 20%" />
                <Column header="Departemen" style="width: 16%">
                    <template #body="{ data }">{{ data.kd_dept ? deptName(data.kd_dept) : '-' }}</template>
                </Column>
                <Column header="Peran" style="width: 20%">
                    <template #body="{ data }">{{ data.nm_role || data.kd_role }}</template>
                </Column>
                <Column v-if="canManage" header="Aksi" style="width: 10%">
                    <template #body="{ data }">
                        <button
                            type="button"
                            class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                            title="Keluarkan dari templat"
                            @click="removeMember(data)"
                        >
                            <UserMinus :size="15" :stroke-width="1.75" />
                        </button>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Dialog Template -->
        <Dialog
            v-model:visible="templateDialogVisible"
            modal
            :header="isEditingTemplate ? 'Ubah Templat Approval' : 'Buat Templat Approval Baru'"
            :style="{ width: '480px' }"
            :breakpoints="{ '640px': '92vw' }"
        >
            <div class="space-y-3.5 pt-2 text-xs">
                <div>
                    <label class="block font-medium mb-1">Nama Templat *</label>
                    <InputText
                        v-model="templateForm.nm_template"
                        class="w-full text-xs"
                        placeholder="Contoh: SIT Developer"
                    />
                </div>

                <div>
                    <label class="block font-medium mb-1">Departemen</label>
                    <Select
                        v-model="templateForm.kd_dept"
                        :options="[{ kd_dept: null, nm_dept: 'Semua Departemen' }, ...departments]"
                        optionLabel="nm_dept"
                        optionValue="kd_dept"
                        :disabled="Boolean(adminDivision)"
                        placeholder="Pilih Departemen"
                        class="w-full text-xs"
                    />
                    <p class="text-[11px] text-muted-color mt-1">Menentukan Admin Seksi mana yang melihat templat ini. Karyawan dimasukkan lewat kartu Anggota.</p>
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Batal" severity="secondary" size="small" text :disabled="savingTemplate" @click="templateDialogVisible = false" />
                    <Button label="Simpan Templat" severity="primary" size="small" class="font-bold" :loading="savingTemplate" :disabled="savingTemplate" @click="saveTemplate" />
                </div>
            </template>
        </Dialog>

        <!-- Dialog Tambah/Ubah Tingkat -->
        <Dialog
            v-model:visible="flowDialogVisible"
            modal
            :header="flowForm.id_flow ? 'Ubah Tingkat Approval' : 'Tambah Tingkat Approval'"
            :style="{ width: '480px' }"
            :breakpoints="{ '640px': '92vw' }"
        >
            <div class="space-y-2 pt-2 text-xs">
                <label for="flow-role" class="block font-medium mb-1">Peran *</label>
                <Select
                    v-model="flowForm.assigned_role"
                    inputId="flow-role"
                    :options="roleOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih peran"
                    emptyMessage="Semua peran approver sudah dipakai di templat ini"
                    class="w-full text-xs"
                    @change="onFlowRoleChange($event.value)"
                />
                <p class="text-[11px] text-muted-color">
                    Peran menjadi nama tingkat.{{ flowForm.id_flow ? '' : ' Tingkat baru ditaruh paling akhir; geser untuk mengubah urutan.' }}
                </p>

                <label for="flow-approvers" class="block font-medium mb-1 pt-2">Approver{{ flowForm.id_flow ? '' : ' *' }}</label>
                <MultiSelect
                    v-model="flowForm.users"
                    inputId="flow-approvers"
                    :options="approverOptions"
                    optionLabel="label"
                    optionValue="value"
                    optionDisabled="disabled"
                    filter
                    display="chip"
                    :maxSelectedLabels="6"
                    placeholder="Pilih akun approver"
                    emptyMessage="Belum ada akun yang punya izin approve"
                    emptyFilterMessage="Tidak ada akun yang cocok"
                    class="w-full text-xs"
                />
                <p class="text-[11px] text-muted-color">
                    Akun dari departemen templat yang perannya punya izin Approve/Reject atau Validasi; cukup salah satu yang menyetujui. Satu akun hanya di satu tingkat per templat.
                </p>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Batal" severity="secondary" size="small" text @click="flowDialogVisible = false" />
                    <Button label="Simpan Tingkat" severity="primary" size="small" class="font-bold" :loading="savingFlow" @click="saveFlow" />
                </div>
            </template>
        </Dialog>

        <!-- Dialog Tambah Anggota -->
        <Dialog v-model:visible="memberDialogVisible" modal header="Tambah Anggota Templat" :style="{ width: '520px' }" :breakpoints="{ '640px': '92vw' }">
            <div class="space-y-2 pt-2 text-xs">
                <label for="member-select" class="block font-medium mb-1">Karyawan *</label>
                <MultiSelect
                    v-model="selectedCandidateUids"
                    inputId="member-select"
                    :options="candidateOptions"
                    optionLabel="label"
                    optionValue="value"
                    optionDisabled="disabled"
                    filter
                    display="chip"
                    :maxSelectedLabels="4"
                    placeholder="Pilih karyawan"
                    emptyMessage="Tidak ada karyawan yang bisa ditambahkan"
                    emptyFilterMessage="Tidak ada karyawan yang cocok"
                    class="w-full text-xs"
                />
                <p class="text-[11px] text-muted-color">Hanya karyawan dari departemen templat yang bisa dipilih. Satu karyawan hanya di satu templat: yang sudah ada di templat lain tidak bisa dipilih, keluarkan dulu dari templat itu. Approver sebaiknya tidak dimasukkan.</p>
            </div>
            <template #footer>
                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Batal" severity="secondary" size="small" text @click="memberDialogVisible = false" />
                    <Button label="Simpan Anggota" severity="primary" size="small" class="font-bold" :loading="savingMembers" @click="saveMembers" />
                </div>
            </template>
        </Dialog>

    </div>
</template>
