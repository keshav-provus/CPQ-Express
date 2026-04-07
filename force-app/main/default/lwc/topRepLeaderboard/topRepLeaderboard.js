import { LightningElement, api, track } from 'lwc';

export default class TopRepLeaderboard extends LightningElement {
    @track reps = [];
    @track isLoading = true;

    @api 
    set dashboardData(value) {
        if (value) {
            this.reps = value;
            this.isLoading = false;
        }
    }
    get dashboardData() {
        return this.reps;
    }

    get hasReps() {
        return this.reps && this.reps.length > 0;
    }

    get rankedReps() {
        return this.reps.map((rep, index) => ({
            ...rep,
            rank: index + 1,
            rankClass: `rank-badge rank-${index + 1}`,
            formattedValue: this.formatCurrency(rep.totalValue)
        }));
    }

    formatCurrency(value) {
        if (!value) return '$0';
        if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K';
        return '$' + value.toFixed(0);
    }
}
