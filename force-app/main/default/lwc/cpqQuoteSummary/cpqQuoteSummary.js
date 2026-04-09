import { LightningElement, api, wire, track } from 'lwc';
import getLineItemSummary from '@salesforce/apex/QuoteLineItemController.getLineItemSummary';
import getLineItemsByPhase from '@salesforce/apex/QuoteLineItemController.getLineItemsByPhase';
import { refreshApex } from '@salesforce/apex';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqQuoteSummary extends LightningElement {
    @track currencyCode = 'USD';

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @api recordId;
    @api quoteData;
    @api lineItems = [];

    @track summaryData = {};
    @track phaseRows = [];
    @track showAuditHistory = false;

    wiredSummaryResult;
    wiredPhaseResult;

    @wire(getLineItemSummary, { quoteId: '$recordId' })
    wiredSummary(result) {
        this.wiredSummaryResult = result;
        if (result.data) {
            this.summaryData = result.data;
        }
    }

    @wire(getLineItemsByPhase, { quoteId: '$recordId' })
    wiredPhases(result) {
        this.wiredPhaseResult = result;
        if (result.data) {
            this.phaseRows = result.data;
        }
    }

    @api
    refresh() {
        refreshApex(this.wiredSummaryResult);
        refreshApex(this.wiredPhaseResult);
    }

    get opportunityName() { return this.quoteData?.Opportunity__r?.Name || 'N/A'; }
    get accountName() { return this.quoteData?.Account__r?.Name || 'N/A'; }
    get validUntil() { return this.quoteData?.Valid_Until__c ? new Date(this.quoteData.Valid_Until__c).toLocaleDateString() : '-'; }
    get timePeriod() { return this.quoteData?.Time_Period_Metric__c || 'Months'; }
    get createdDate() { return this.quoteData?.CreatedDate ? new Date(this.quoteData.CreatedDate).toLocaleDateString() : '-'; }
    get createdByName() { return this.quoteData?.CreatedBy?.Name || '-'; }
    get lastModifiedByName() { return this.quoteData?.LastModifiedBy?.Name || '-'; }

    get laborRevenue() { return this.summaryData['Resource Role']?.revenue || 0; }
    get laborCost() { return this.summaryData['Resource Role']?.cost || 0; }
    get laborMargin() { return this.summaryData['Resource Role']?.margin || 0; }
    get laborPercentage() { return this.summaryData['Resource Role']?.percentage || 0; }
    get laborCount() { return this.summaryData['Resource Role']?.count || 0; }

    get productRevenue() { return this.summaryData['Product']?.revenue || 0; }
    get productCost() { return this.summaryData['Product']?.cost || 0; }
    get productMargin() { return this.summaryData['Product']?.margin || 0; }
    get productPercentage() { return this.summaryData['Product']?.percentage || 0; }
    get productCount() { return this.summaryData['Product']?.count || 0; }

    get addonRevenue() { return this.summaryData['Add-on']?.revenue || 0; }
    get addonCost() { return this.summaryData['Add-on']?.cost || 0; }
    get addonMargin() { return this.summaryData['Add-on']?.margin || 0; }
    get addonPercentage() { return this.summaryData['Add-on']?.percentage || 0; }
    get addonCount() { return this.summaryData['Add-on']?.count || 0; }

    get hasPhases() { return this.phaseRows && this.phaseRows.length > 0; }

    get auditChevronClass() { return this.showAuditHistory ? 'chevron up' : 'chevron down'; }

    toggleAuditHistory() {
        this.showAuditHistory = !this.showAuditHistory;
    }

    get laborChartStyle() {
        const max = this.getMaxRevenue();
        return `height: ${max > 0 ? (this.laborRevenue / max * 80) : 0}px;`;
    }

    get laborCostStyle() {
        const max = this.getMaxRevenue();
        return `height: ${max > 0 ? (this.laborCost / max * 80) : 0}px;`;
    }

    get laborMarginStyle() {
        const max = this.getMaxRevenue();
        return `height: ${max > 0 ? (this.laborMargin / max * 80) : 0}px;`;
    }

    get productCostStyle() {
        const max = this.getMaxRevenue();
        return `height: ${max > 0 ? (this.productCost / max * 80) : 0}px;`;
    }

    get productMarginStyle() {
        const max = this.getMaxRevenue();
        return `height: ${max > 0 ? (this.productMargin / max * 80) : 0}px;`;
    }

    get addonCostStyle() {
        const max = this.getMaxRevenue();
        return `height: ${max > 0 ? (this.addonCost / max * 80) : 0}px;`;
    }

    get addonMarginStyle() {
        const max = this.getMaxRevenue();
        return `height: ${max > 0 ? (this.addonMargin / max * 80) : 0}px;`;
    }

    getMaxRevenue() {
        return Math.max(this.laborRevenue, this.productRevenue, this.addonRevenue, 1);
    }

    get phaseChartData() {
        const max = Math.max(...this.phaseRows.map(p => p.total), 1);
        return this.phaseRows.map(p => ({
            label: p.phase,
            costStyle: `height: ${p.total > 0 ? (p.total * 0.4 / max * 80) : 0}px;`, // Mocking cost/margin split for demo
            marginStyle: `height: ${p.total > 0 ? (p.total * 0.6 / max * 80) : 0}px;`
        }));
    }
}
