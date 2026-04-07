import { LightningElement, wire, track } from 'lwc';
import getTeamQuoteStats from '@salesforce/apex/DashboardController.getTeamQuoteStats';

export default class TeamQuotesPipeline extends LightningElement {
    @track totalPipeline = 0;
    @track avgMargin = 0;
    @track pendingApproval = 0;
    @track thisMonthQuotes = 0;
    @track isLoading = true;

    @wire(getTeamQuoteStats)
    wiredStats({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.totalPipeline = data.totalPipeline || 0;
            this.avgMargin = data.avgMargin || 0;
            this.pendingApproval = data.pendingApproval || 0;
            this.thisMonthQuotes = data.thisMonthQuotes || 0;
        } else if (error) {
            console.error('Error loading team stats:', error);
        }
    }

    get formattedPipeline() {
        if (this.totalPipeline >= 1000000) {
            return '$' + (this.totalPipeline / 1000000).toFixed(1) + 'M';
        }
        if (this.totalPipeline >= 1000) {
            return '$' + (this.totalPipeline / 1000).toFixed(1) + 'K';
        }
        return '$' + this.totalPipeline.toFixed(0);
    }

    get formattedMargin() {
        return this.avgMargin.toFixed(1);
    }
}
