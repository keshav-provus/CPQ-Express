import { LightningElement, api } from 'lwc';

export default class CpqQuoteSummary extends LightningElement {
    @api recordId;
    @api quoteData;
    @api lineItems = [];

    get laborTotal() {
        return this.lineItems
            .filter(item => item.Product__r?.Product_Type__c === 'Resource Role')
            .reduce((sum, item) => sum + (item.Net_Total__c || 0), 0);
    }

    get productTotal() {
        return this.lineItems
            .filter(item => item.Product__r?.Product_Type__c === 'Product')
            .reduce((sum, item) => sum + (item.Net_Total__c || 0), 0);
    }

    get addonTotal() {
        return this.lineItems
            .filter(item => item.Product__r?.Product_Type__c === 'Add-on')
            .reduce((sum, item) => sum + (item.Net_Total__c || 0), 0);
    }

    get grandTotal() {
        return this.laborTotal + this.productTotal + this.addonTotal;
    }

    get laborBarStyle() {
        const pct = this.grandTotal > 0 ? (this.laborTotal / this.grandTotal) * 100 : 0;
        return `width: ${pct}%;`;
    }

    get productBarStyle() {
        const pct = this.grandTotal > 0 ? (this.productTotal / this.grandTotal) * 100 : 0;
        return `width: ${pct}%;`;
    }

    get addonBarStyle() {
        const pct = this.grandTotal > 0 ? (this.addonTotal / this.grandTotal) * 100 : 0;
        return `width: ${pct}%;`;
    }

    get phaseBreakdown() {
        const phases = {};
        this.lineItems.forEach(item => {
            const phaseName = item.Phase__c || 'Default';
            if (!phases[phaseName]) phases[phaseName] = 0;
            phases[phaseName] += (item.Net_Total__c || 0);
        });

        const maxTotal = Math.max(...Object.values(phases), 1);
        return Object.keys(phases).map(name => ({
            name,
            total: phases[name],
            widthStyle: `width: ${(phases[name] / maxTotal) * 100}%;`
        }));
    }
}
