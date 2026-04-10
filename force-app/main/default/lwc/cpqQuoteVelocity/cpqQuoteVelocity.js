import { LightningElement, wire, track } from 'lwc';
import getQuoteVelocity from '@salesforce/apex/DashboardController.getQuoteVelocity';

export default class CpqQuoteVelocity extends LightningElement {
    @track velocityData = {};

    @wire(getQuoteVelocity)
    wiredVelocity({ data, error }) {
        if (data) {
            this.velocityData = data;
        } else if (error) {
            console.error('Error fetching quote velocity:', error);
        }
    }

    get averageDays() {
        return this.velocityData.averageDays || '0.0';
    }

    get trendLabel() {
        const trend = this.velocityData.trend || 0;
        return trend < 0 ? trend + ' days' : '+' + trend + ' days';
    }

    get trendClass() {
        const trend = this.velocityData.trend || 0;
        return trend <= 0 ? 'velocity-trend trend-positive' : 'velocity-trend trend-negative';
    }
}
