import { LightningElement, api, track, wire } from 'lwc';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqQuotePricingAnalytics extends LightningElement {
    connectedCallback() {
        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @api recordId;
    @api competitiveMatch = 92;
    @track currencyCode = 'USD';

        get historicalAverage() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(39400);
    }
}
