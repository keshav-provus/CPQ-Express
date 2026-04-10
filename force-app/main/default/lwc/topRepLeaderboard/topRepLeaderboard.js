import { LightningElement, api, track, wire } from 'lwc';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class TopRepLeaderboard extends LightningElement {
    connectedCallback() {
        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @track reps = [];
    @track isLoading = true;
    @track currencyCode = 'USD';

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
        if (!value) return this._symbol() + '0';
        if (value >= 1000000) return this._symbol() + (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return this._symbol() + (value / 1000).toFixed(1) + 'K';
        return this._symbol() + value.toFixed(0);
    }

    _symbol() {
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(0).replace(/[\d.,\s]/g, '');
        } catch (e) {
            return '$';
        }
    }
}
