import { isAdmin, isApprover, isSuperAdmin, roleOf } from '@/utils/roleUtils';

export const TOUR_PERSONAS = ['karyawan', 'approval', 'kepala', 'admin', 'superadmin'];

const HEAD_ROLES = ['kepala_it', 'kepala_dept'];

export function getTourPersona(user) {
    if (!user) return null;
    if (isSuperAdmin(user)) return 'superadmin';
    if (isAdmin(user)) return 'admin';
    if (isApprover(user)) return HEAD_ROLES.includes(roleOf(user)) ? 'kepala' : 'approval';
    return 'karyawan';
}
