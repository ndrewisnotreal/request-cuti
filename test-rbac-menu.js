import assert from 'node:assert/strict';
import { ref } from 'vue';

// Test verification of RBAC logic and alias mapping
const MENU_CODE_ALIASES = {
    MN_APPRV_PEND: ['MN_APPRV_PEND', 'MN_PNDAPP', 'MN_AP_PEND'],
    MN_PNDAPP: ['MN_PNDAPP', 'MN_APPRV_PEND', 'MN_AP_PEND'],
    MN_AP_PEND: ['MN_AP_PEND', 'MN_APPRV_PEND', 'MN_PNDAPP'],
    MN_APPRV_HIST: ['MN_APPRV_HIST', 'MN_AP_HIST'],
    MN_AP_HIST: ['MN_AP_HIST', 'MN_APPRV_HIST'],
    MN_USER: ['MN_USER', 'MN_ADMACC'],
    MN_ADMACC: ['MN_ADMACC', 'MN_USER'],
    MN_PERM: ['MN_PERM', 'MN_ADMPERM', 'MN_PPRV'],
    MN_ADMPERM: ['MN_ADMPERM', 'MN_PERM', 'MN_PPRV']
};

const userMenus = ref([]);
const currentUser = ref(null);

function isSuperAdmin(user = currentUser.value) {
    if (!user) return false;
    const r = user.kd_role || user.role;
    return ['RS001', 'super', 'superadmin'].includes(r);
}

function hasMenuPermission(menuCode) {
    if (!menuCode) return false;
    const profile = currentUser.value;
    const role = profile?.kd_role || profile?.role;
    if (['RS001', 'super', 'superadmin'].includes(role)) return true;

    const list = userMenus.value || [];
    if (!Array.isArray(list) || list.length === 0) return false;

    const codes = Array.isArray(menuCode) ? menuCode : [menuCode];
    const targets = new Set();
    for (const c of codes) {
        targets.add(c);
        if (MENU_CODE_ALIASES[c]) {
            for (const alias of MENU_CODE_ALIASES[c]) {
                targets.add(alias);
            }
        }
    }

    return list.some((item) => {
        const itemCode = typeof item === 'string' ? item : item?.kd_menu;
        if (!itemCode || !targets.has(itemCode)) return false;
        if (Array.isArray(item.permissions)) {
            return item.permissions.length > 0;
        }
        return true;
    });
}

function isApprover(user = currentUser.value) {
    if (!user) return false;
    const r = user.kd_role || user.role;
    if (['RS001', 'RS004', 'RS005', 'RS006', 'kepala_it', 'kepala_dept', 'approval'].includes(r)) {
        return true;
    }
    if (user === currentUser.value || user.id === currentUser.value?.id) {
        return hasMenuPermission(['MN_APPRV_PEND', 'MN_PNDAPP', 'MN_AP_PEND', 'MN_APPRV_HIST', 'MN_AP_HIST']);
    }
    return false;
}

// Case 1: staff_it with permission revoked
currentUser.value = { id: 'USR101', role: 'staff_it' };
userMenus.value = [
    { kd_menu: 'MN_PENGAJ', permissions: ['AC', 'IN'] },
    { kd_menu: 'MN_HISTCU', permissions: ['AC', 'VW'] }
];

assert.equal(isApprover(currentUser.value), false, 'staff_it must not be approver when permission revoked');
assert.equal(hasMenuPermission('MN_APPRV_PEND'), false, 'MN_APPRV_PEND must be false');
assert.equal(hasMenuPermission('MN_PNDAPP'), false, 'MN_PNDAPP must be false');
assert.equal(hasMenuPermission('MN_AP_PEND'), false, 'MN_AP_PEND alias must be false');

// Case 2: staff_it granted MN_PNDAPP permission
userMenus.value.push({ kd_menu: 'MN_PNDAPP', permissions: ['AC', 'CF'] });
assert.equal(hasMenuPermission('MN_APPRV_PEND'), true, 'MN_APPRV_PEND should match MN_PNDAPP');
assert.equal(hasMenuPermission('MN_AP_PEND'), true, 'MN_AP_PEND should match MN_PNDAPP');
assert.equal(isApprover(currentUser.value), true, 'staff_it is approver when permission granted');

// Case 3: superadmin
currentUser.value = { id: 'USR001', role: 'RS001' };
assert.equal(isApprover(currentUser.value), true, 'superadmin is approver');
assert.equal(hasMenuPermission('MN_ANY'), true, 'superadmin has all permissions');

console.log('RBAC unit check: all assertions passed!');
