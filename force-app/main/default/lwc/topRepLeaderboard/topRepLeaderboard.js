import { LightningElement, wire, track } from 'lwc';
import getTopReps from '@salesforce/apex/DashboardController.getTopReps';

export default class TopRepLeaderboard extends LightningElement {
    @track reps = [];
    @track isLoading = true;

    @wire(getTopReps)
    wiredReps({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.reps = data;
        } else if (error) {
            console.error('Error loading leaderboard:', error);
        }
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
