import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), RouterLink: { render: () => null } }));
vi.mock('@/layout/composables/layout', async () => {
    const { ref } = await import('vue');
    return {
        useLayout: () => ({
            toggleMobileMenu: vi.fn(),
            toggleDarkMode: vi.fn(),
            isDarkTheme: ref(false),
            isSidebarCollapsed: ref(false),
            toggleSidebarCollapse: vi.fn()
        })
    };
});
vi.mock('@/layout/composables/sidebarMenu', async () => {
    const { ref } = await import('vue');
    return { showSidebar: ref(true) };
});
vi.mock('@/tour/useTour', () => ({ useTour: () => ({ pageTour: vi.fn(), introTour: vi.fn() }) }));
vi.mock('@/service/sicutiService', async () => {
    const { ref } = await import('vue');
    return {
        currentUser: ref(null),
        logout: vi.fn(),
        persistCurrentUser: vi.fn(),
        ROLE_LABELS: {},
        isAdmin: () => false,
        isSuperAdmin: () => false,
        can: () => true
    };
});
vi.mock('@/service/api', () => ({
    default: { get: vi.fn() },
    assetUrl: (p) => (p ? `/api${p}` : null)
}));
vi.mock('@/layout/AppNotificationMenu.vue', () => ({ default: { render: () => null } }));
vi.mock('@/layout/AppTourMenu.vue', () => ({ default: { render: () => null } }));
vi.mock('@/layout/AppTourMenuItems.vue', () => ({ default: { render: () => null } }));

import AppTopbar from '@/layout/AppTopbar.vue';
import api from '@/service/api';
import { currentUser, persistCurrentUser } from '@/service/sicutiService';

const LAMA = '/uploads/avatars/lama.png';
const BARU = '/uploads/avatars/baru.png';
const foto = (wrapper) => wrapper.find('header img[alt^="Foto profil"]');

async function pasang(fotoTersimpan) {
    currentUser.value = { id: 'ADM000', name: 'Admin Super', foto_profil: fotoTersimpan };
    const wrapper = mount(AppTopbar);
    await flushPromises();
    return wrapper;
}

describe('AppTopbar: foto profil', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({ data: { foto_profil: LAMA } });
    });

    it('mengambil path terbaru dari server walau browser sudah menyimpan path lama', async () => {
        api.get.mockResolvedValue({ data: { foto_profil: BARU } });
        const wrapper = await pasang(LAMA);

        expect(api.get).toHaveBeenCalledWith('/master/user/profile');
        expect(foto(wrapper).attributes('src')).toBe(`/api${BARU}`);
        expect(persistCurrentUser).toHaveBeenCalled();
    });

    it('tetap memakai path tersimpan saat server gagal menjawab', async () => {
        api.get.mockRejectedValue(new Error('Gateway Timeout'));
        const wrapper = await pasang(LAMA);

        expect(foto(wrapper).attributes('src')).toBe(`/api${LAMA}`);
    });

    it('menampilkan inisial saat foto dihapus dari perangkat lain', async () => {
        api.get.mockResolvedValue({ data: { foto_profil: null } });
        const wrapper = await pasang(LAMA);

        expect(foto(wrapper).exists()).toBe(false);
        expect(wrapper.text()).toContain('AS');
    });

    it('gambar gagal dimuat: mengambil ulang dan memakai path baru', async () => {
        const wrapper = await pasang(LAMA);
        api.get.mockResolvedValue({ data: { foto_profil: BARU } });

        await foto(wrapper).trigger('error');
        await flushPromises();

        expect(foto(wrapper).attributes('src')).toBe(`/api${BARU}`);
    });

    it('gambar tetap gagal dengan path yang sama: menampilkan inisial, bukan gambar rusak', async () => {
        const wrapper = await pasang(LAMA);

        await foto(wrapper).trigger('error');
        await flushPromises();

        expect(foto(wrapper).exists()).toBe(false);
        expect(wrapper.text()).toContain('AS');
        expect(api.get).toHaveBeenCalledTimes(2);
    });

    it('foto kembali tampil setelah path berubah, misalnya sesudah upload baru', async () => {
        const wrapper = await pasang(LAMA);
        await foto(wrapper).trigger('error');
        await flushPromises();
        expect(foto(wrapper).exists()).toBe(false);

        currentUser.value.foto_profil = BARU;
        await flushPromises();

        expect(foto(wrapper).attributes('src')).toBe(`/api${BARU}`);
    });

    it('mengabaikan error dari path lama yang sudah diganti', async () => {
        const wrapper = await pasang(LAMA);
        const gambar = foto(wrapper);
        currentUser.value.foto_profil = BARU;
        await flushPromises();
        api.get.mockClear();
        gambar.element.setAttribute('src', `/api${LAMA}`);

        await gambar.trigger('error');
        await flushPromises();

        expect(api.get).not.toHaveBeenCalled();
    });
});
