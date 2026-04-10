import { LightningElement, api, track, wire } from 'lwc';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqQuotePricingAnalytics extends LightningElement {
    @api recordId;
    @api competitiveMatch = 92;
    @track currencyCode = 'USD';

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    get historicalAverage() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(39400);
    }
}
