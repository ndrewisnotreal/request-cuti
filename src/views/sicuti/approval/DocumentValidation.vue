<script setup>
// Halaman publik yang terbuka saat QR pada surat cuti dipindai (biasanya dari HP)
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { API_BASE, APP_KEY } from '@/service/api';
import { formatDate } from '@/service/sicutiService';
import { BadgeCheck, ShieldAlert, Loader2 } from 'lucide-vue-next';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const route = useRoute();
const loading = ref(true);
const error = ref(null);
const result = ref(null);

const secret = computed(() => {
    const s = route.params.secret;
    return Array.isArray(s) ? s.join('/') : s || '';
});

const isValid = computed(() => !error.value && result.value?.is_valid === true);
const message = computed(() => error.value || result.value?.keterangan || '');
const doc = computed(() => result.value?.document || null);

/** "25 September 2026 11:02:26" dalam waktu lokal perangkat. */
function formatWaktu(value) {
    if (!value || value === '-') return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const t = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${t}`;
}

// Pengesah = pejabat yang sudah menyetujui, urut sesuai tingkat approval
const pengesah = computed(() =>
    (result.value?.all_signers || [])
        .filter((s) => String(s.status || '').toLowerCase() === 'approved')
        .sort((a, b) => Number(a.level) - Number(b.level))
        .map((s, i) => ({ no: i + 1, nama: s.nama || '-', jabatan: s.jabatan || '-', waktu: formatWaktu(s.waktu) }))
);

const docRows = computed(() => {
    const d = doc.value;
    if (!d) return [];
    return [
        { label: 'Nomor Dokumen', value: d.nomor_surat || d.id_request },
        { label: 'Pemohon', value: d.requester_name },
        { label: 'No. Pegawai', value: d.requester_nik },
        { label: 'Jenis Cuti', value: d.nm_leave_type },
        { label: 'Periode Cuti', value: `${formatDate(d.start_date)} – ${formatDate(d.end_date)} (${d.total_days || 0} hari kerja)` }
    ];
});

async function validate() {
    loading.value = true;
    error.value = null;
    if (!secret.value) {
        error.value = 'Kode QR tidak berisi data dokumen.';
        loading.value = false;
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/sicuti/leave-request/validation/${encodeURIComponent(secret.value)}`, {
            headers: { 'Content-Type': 'application/json', 'x-api-key': APP_KEY }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            throw new Error(json.error || 'Dokumen tidak ditemukan di sistem.');
        }
        result.value = json.data;
    } catch (err) {
        error.value = err.message || 'Dokumen tidak dapat diverifikasi.';
    } finally {
        loading.value = false;
    }
}

onMounted(validate);
</script>

<template>
    <div class="min-h-screen bg-[#f1f4f9] text-[#1f2a44] antialiased">
        <header class="bg-white border-b border-[#e3e8f0]">
            <div class="max-w-xl mx-auto px-4 h-14 flex items-center gap-2.5">
                <img src="/logo-inalum.png" alt="Logo PT INALUM" class="h-7 w-auto" />
                <div class="leading-tight">
                    <div class="font-bold text-primary">Lebur</div>
                    <div class="text-[11px] text-[#6b7a90]">Validasi dokumen cuti</div>
                </div>
            </div>
        </header>

        <main class="max-w-xl mx-auto px-4 py-5 space-y-4">
            <div v-if="loading" class="bg-white rounded-2xl p-10 text-center text-sm text-[#6b7a90] shadow-[0_1px_3px_rgba(16,24,40,0.08)]">
                <Loader2 class="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                Memeriksa keabsahan dokumen…
            </div>

            <template v-else>
                <div
                    role="status"
                    :class="[
                        'rounded-2xl px-4 py-3.5 flex items-start gap-3 border',
                        isValid ? 'bg-[#ecfdf3] border-[#abefc6] text-[#067647]' : 'bg-[#fef3f2] border-[#fecdca] text-[#b42318]'
                    ]"
                >
                    <component :is="isValid ? BadgeCheck : ShieldAlert" class="w-6 h-6 shrink-0" />
                    <div>
                        <div class="font-semibold">{{ isValid ? 'Dokumen Valid' : 'Dokumen Tidak Valid' }}</div>
                        <div class="text-sm opacity-90">{{ message }}</div>
                    </div>
                </div>

                <section v-if="doc" class="bg-white rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.08)] px-5 py-5">
                    <div class="inline-block bg-primary text-white text-lg font-semibold px-4 py-2 rounded-md">Formulir Permohonan Cuti</div>
                    <div class="mt-3 text-sm text-[#6b7a90]">{{ doc.nm_dept }}</div>
                    <dl class="mt-4 space-y-3 text-sm">
                        <div v-for="row in docRows" :key="row.label">
                            <dt class="inline text-[#6b7a90]">{{ row.label }}:</dt>
                            <dd class="inline ml-1">{{ row.value || '-' }}</dd>
                        </div>
                    </dl>
                </section>

                <section v-if="doc" class="bg-white rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.08)] px-5 py-6">
                    <h2 class="font-semibold text-[15px] mb-6">Pejabat Pengesah</h2>
                    <p v-if="pengesah.length === 0" class="text-sm text-[#6b7a90]">Belum ada pejabat yang mengesahkan dokumen ini.</p>
                    <ol v-else class="relative ml-1.5 border-l-2 border-primary">
                        <li v-for="p in pengesah" :key="p.no" class="relative pl-6 pb-8 last:pb-3">
                            <span class="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-primary" aria-hidden="true"></span>
                            <div class="font-semibold text-sm">Pengesah {{ p.no }}</div>
                            <dl class="mt-3.5 space-y-3.5 text-sm">
                                <div><dt class="inline text-[#6b7a90]">Nama:</dt><dd class="inline ml-1">{{ p.nama }}</dd></div>
                                <div><dt class="inline text-[#6b7a90]">Jabatan:</dt><dd class="inline ml-1">{{ p.jabatan }}</dd></div>
                                <div><dt class="inline text-[#6b7a90]">Waktu Pengesahan:</dt><dd class="inline ml-1">{{ p.waktu }}</dd></div>
                            </dl>
                        </li>
                    </ol>
                </section>
            </template>
        </main>

        <footer class="max-w-xl mx-auto px-4 pb-8 text-center text-[11px] text-[#8a97ab]">
            Diverifikasi oleh Lebur · PT Indonesia Asahan Aluminium (Persero)
        </footer>
    </div>
</template>
