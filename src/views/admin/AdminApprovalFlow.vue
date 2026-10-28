<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, can } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { GitFork, Plus, Pencil, Trash2, Users, RefreshCw, Layers, Settings2, X } from 'lucide-vue-next';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import ApprovalFlowStepDialog from '@/components/admin/ApprovalFlowStepDialog.vue';
import ApprovalFlowMembersDialog from '@/components/admin/ApprovalFlowMembersDialog.vue';
import ApprovalTemplateDialog from '@/components/admin/ApprovalTemplateDialog.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const flowsLoading = ref(false);
const reordering = ref(false);

const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));
const canManage = computed(() => isSuper.value || can('master_data.manage_approval'));

const templates = ref([]);
const departments = ref([]);
const approverRoles = ref([]);
const eligibleApprovers = ref([]);

const selectedTemplateId = ref('');
const flows = ref([]);
const members = ref([]);

const templateDialogVisible = ref(false);
const isEditingTemplate = ref(false);
const templateForm = ref({ id_template: '', kd_dept: '', nm_template: '', is_active: true });

const flowDialogVisible = ref(false);
const selectedFlow = ref(null);
const removingApprover = ref('');

const membersDialogVisible = ref(false);

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
    try {
        const data = await adminService.getTemplateMembers(templateId);
        members.value = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('Failed to load members count:', err);
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

async function handleTemplateSaved(savedResult) {
    if (savedResult?.id_template) {
        selectedTemplateId.value = savedResult.id_template;
    }
    await loadInitialData();
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

function openAddFlow() {
    selectedFlow.value = null;
    flowDialogVisible.value = true;
}

function openEditFlow(flow) {
    selectedFlow.value = flow;
    flowDialogVisible.value = true;
}

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

onMounted(() => {
    loadInitialData();
});
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="alur approval" />
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <GitFork class="text-primary w-5 h-5" />
                    <span>Konfigurasi Alur Approval</span>
                </h1>
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
                <Button data-tour="flow-new-template"
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
                <Button data-tour="flow-add-level"
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

        <div data-tour="flow-template" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm space-y-3">
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

        <div data-tour="flow-levels" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
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

        <div v-if="currentTemplate" data-tour="flow-members" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Users class="w-5 h-5" />
                </div>
                <div>
                    <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                        <span>Anggota Templat</span>
                        <Tag :value="`${members.length} Karyawan`" severity="info" class="text-xs" />
                    </h3>
                    <p class="text-xs text-muted-color">
                        Karyawan yang alur persetujuan cutinya mengikuti templat {{ currentTemplate.nm_template }}.
                    </p>
                </div>
            </div>
            <Button
                severity="primary"
                outlined
                size="small"
                class="text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
                @click="membersDialogVisible = true"
            >
                <Users :size="14" :stroke-width="2" />
                <span>Kelola Anggota Templat</span>
            </Button>
        </div>

        <ApprovalFlowStepDialog
            v-model:visible="flowDialogVisible"
            :flow-data="selectedFlow"
            :template-id="selectedTemplateId"
            :template-dept="currentTemplate?.kd_dept"
            :flows="flows"
            :eligible-approvers="eligibleApprovers"
            :approver-roles="approverRoles"
            @saved="loadFlows(selectedTemplateId)"
        />

        <ApprovalFlowMembersDialog
            v-model:visible="membersDialogVisible"
            :template="currentTemplate"
            :departments="departments"
            :can-manage="canManage"
            @changed="loadMembers(selectedTemplateId)"
        />

        <ApprovalTemplateDialog
            v-model:visible="templateDialogVisible"
            :is-editing="isEditingTemplate"
            :template-data="templateForm"
            :departments="departments"
            :admin-division="adminDivision"
            :templates="templates"
            @saved="handleTemplateSaved"
        />
    </div>
</template>
