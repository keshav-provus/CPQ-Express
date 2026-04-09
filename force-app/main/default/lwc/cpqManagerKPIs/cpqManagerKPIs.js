import { LightningElement, wire, track } from 'lwc';
import getManagerKPIs from '@salesforce/apex/DashboardController.getManagerKPIs';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqManagerKPIs extends LightningElement {
    @track currencyCode = 'USD';

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @track kpis;

    @wire(getManagerKPIs)
    wiredKPIs({ error, data }) {
        if (data) {
            this.kpis = {
                ...data,
                formattedPipeline: this.formatCurrency(data.totalPipeline || 0)
            };
        } else if (error) {
            console.error('Error fetching manager KPIs:', error);
        }
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: this.currencyCode,
            maximumFractionDigits: 0
        }).format(value);
    }
}