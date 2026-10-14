import { leaveService } from './leaveService';

export const leaveBalanceService = {
    getBalances: (params) => leaveService.getBalances(params),
    getBalanceMutations: (params) => leaveService.getBalanceMutations(params),
    getBalanceHistory: (params) => leaveService.getBalanceHistory(params)
};

export default leaveBalanceService;
