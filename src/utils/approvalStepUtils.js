export function lastReturnNote(req) {
    const records = req?.approvalRecords || req?.approval_records || [];
    const ret = records
        .filter((r) => r.action === 'return')
        .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))[0];
    if (!ret) return null;
    return { approverName: ret.approverName || ret.approver_name || '', notes: (ret.notes || '').trim() };
}

export function stepApproverName(step, record) {
    const candidates = Array.isArray(step?.candidate_names) ? step.candidate_names.filter(Boolean) : [];
    return step?.approver_name || record?.approver_name || (candidates.length ? candidates.join(' / ') : '') || step?.uid_approver || 'Pejabat Penyetuju';
}

export function isStepApprover(step, uid) {
    if (!step || !uid) return false;
    if ((step.uid_approver || step.approver_id || step.approverId) === uid) return true;
    return Array.isArray(step.uid_candidates) && step.uid_candidates.includes(uid);
}

export function getUserApprovalLevel(userId, flows = [], getUserFn = null) {
    if (!userId) return null;
    const flowList = Array.isArray(flows) ? flows : [];
    const flow = flowList.find(
        (f) => f.isActive && Array.isArray(f.assignedUserIds) && f.assignedUserIds.includes(userId)
    );
    if (flow) return flow.level;

    const user = typeof getUserFn === 'function' ? getUserFn(userId) : null;
    const roleFlow = flowList.find(
        (f) => f.isActive && f.assignedRole === user?.role
    );
    return roleFlow ? roleFlow.level : null;
}

export function getApprovalFlowsForRequest(leaveRequest, flows = [], getUserFn = null) {
    const flowList = Array.isArray(flows) ? flows : [];
    const applicant = leaveRequest?.userId && typeof getUserFn === 'function' ? getUserFn(leaveRequest.userId) : null;
    return flowList
        .filter((f) => f.isActive && f.isMandatory)
        .filter((f) => {
            if (!applicant) return true;
            if (!Array.isArray(f.assignedUserIds)) return true;
            return !f.assignedUserIds.includes(applicant.id);
        })
        .sort((a, b) => a.level - b.level);
}

export function getCurrentApprovalLevel(req, flows = [], getUserFn = null) {
    if (!req) return null;
    const activeFlows = getApprovalFlowsForRequest(req, flows, getUserFn);

    for (const flow of activeFlows) {
        const isLevelApproved = req.approvalRecords?.some(
            (a) => a.level === flow.level && a.action === 'approve'
        );
        if (!isLevelApproved) {
            return flow.level;
        }
    }
    return null;
}

export function canUserApprove(req, user, flows = [], options = {}) {
    if (!req || !user) return false;
    if (!['submitted', 'pending_validation'].includes(req.status)) return false;
    if (req.userId === user.id) return false;

    const isSuperAdminFn = options.isSuperAdminFn || (() => false);
    const isApproverFn = options.isApproverFn || (() => false);
    const getUserFn = options.getUserFn || null;

    if (isSuperAdminFn(user)) return true;

    const activeFlows = getApprovalFlowsForRequest(req, flows, getUserFn);
    const userLevel = getUserApprovalLevel(user.id, flows, getUserFn);
    if (!userLevel) return isApproverFn(user);

    const currentLevel = getCurrentApprovalLevel(req, flows, getUserFn);
    if (currentLevel === null || currentLevel !== userLevel) return false;

    const alreadyApproved = req.approvalRecords?.some(
        (a) => a.approverId === user.id && a.level === userLevel && a.action === 'approve'
    );
    if (alreadyApproved) return false;

    const flow = activeFlows.find((f) => f.level === userLevel);
    if (!flow) return false;
    if (Array.isArray(flow.assignedUserIds) && flow.assignedUserIds.length > 0) {
        return flow.assignedUserIds.includes(user.id);
    }
    return flow.assignedRole === user.role;
}
