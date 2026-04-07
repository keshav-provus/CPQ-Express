import { LightningElement, wire, track } from 'lwc';
import getManagerKPIs from '@salesforce/apex/DashboardController.getManagerKPIs';

export default class CpqManagerKPIs extends LightningElement {
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
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(value);
    }
}