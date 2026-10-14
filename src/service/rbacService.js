import api from './api';

export const rbacService = {
    async getRoles() {
        const res = await api.get('/master/user/roles');
        return res?.data || res || [];
    },

    // Permission Management prototype: role × modul × aksi (hanya Admin Super App)
    async getRoleAbilities() {
        const res = await api.get('/master/role-ability');
        return res?.data || res || { catalog: [], roles: [] };
    },

    async createRole({ nm_role, abilities = [], level }) {
        // level ikut peran sumber ("Salin hak akses dari"); kosong = bawaan backend (Karyawan)
        const res = await api.post('/master/role-ability', { nm_role, abilities, ...(level !== undefined ? { level } : {}) });
        return res?.data || res;
    },

    async updateRole(kdRole, data) {
        const res = await api.put(`/master/role-ability/${encodeURIComponent(kdRole)}`, data);
        return res?.data || res;
    },

    async deleteRole(kdRole) {
        const res = await api.delete(`/master/role-ability/${encodeURIComponent(kdRole)}`, {});
        return res?.data || res;
    }
};

export default rbacService;
