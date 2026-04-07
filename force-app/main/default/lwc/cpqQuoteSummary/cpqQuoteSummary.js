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

    get laborWidth() {
        return this.grandTotal > 0 ? (this.laborTotal / this.grandTotal) * 100 : 0;
    }

    get productWidth() {
        return this.grandTotal > 0 ? (this.productTotal / this.grandTotal) * 100 : 0;
    }

    get addonWidth() {
        return this.grandTotal > 0 ? (this.addonTotal / this.grandTotal) * 100 : 0;
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
            pct: (phases[name] / maxTotal) * 100
        }));
    }

    renderedCallback() {
        // Set Item Type breakdown bar widths
        const laborBar = this.template.querySelector('.bar.labor');
        const productBar = this.template.querySelector('.bar.products');
        const addonBar = this.template.querySelector('.bar.addons');

        if (laborBar) laborBar.style.width = `${this.laborWidth}%`;
        if (productBar) productBar.style.width = `${this.productWidth}%`;
        if (addonBar) addonBar.style.width = `${this.addonWidth}%`;

        // Set Phase Breakdown progress widths
        const phaseRows = this.template.querySelectorAll('.phase-row');
        phaseRows.forEach((row, index) => {
            const progressFill = row.querySelector('.progress-fill');
            if (progressFill && this.phaseBreakdown[index]) {
                progressFill.style.width = `${this.phaseBreakdown[index].pct}%`;
            }
        });
    }
}
