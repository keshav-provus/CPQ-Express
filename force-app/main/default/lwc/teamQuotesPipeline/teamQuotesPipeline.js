import { LightningElement, api, track } from 'lwc';

export default class TeamQuotesPipeline extends LightningElement {
    @track totalPipeline = 0;
    @track avgMargin = 0;
    @track pendingApproval = 0;
    @track thisMonthQuotes = 0;
    @track isLoading = true;

    @api 
    set dashboardData(value) {
        if (value) {
            this.totalPipeline = value.totalPipeline || 0;
            this.avgMargin = value.avgMargin || 0;
            this.pendingApproval = value.pendingApproval || 0;
            this.thisMonthQuotes = value.thisMonthQuotes || 0;
            this.isLoading = false;
        }
    }
    get dashboardData() {
        return {
            totalPipeline: this.totalPipeline,
            avgMargin: this.avgMargin,
            pendingApproval: this.pendingApproval,
            thisMonthQuotes: this.thisMonthQuotes
        };
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
