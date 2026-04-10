import { LightningElement, api, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getLineItemSummary from '@salesforce/apex/QuoteLineItemController.getLineItemSummary';
import getLineItemsByPhase from '@salesforce/apex/QuoteLineItemController.getLineItemsByPhase';
import getAuditLogs from '@salesforce/apex/QuoteLineItemController.getAuditLogs';
import { refreshApex } from '@salesforce/apex';

export default class CpqQuoteSummary extends NavigationMixin(LightningElement) {
    @api currencyCode = 'USD';

    @api recordId;
    _quoteData;
    @api 
    get quoteData() { return this._quoteData; }
    set quoteData(value) {
        this._quoteData = value;
        // Auto-refresh summary data when quote totals/headers update
        if (this.wiredSummaryResult) {
            this.refresh();
        }
    }
    @api lineItems = [];

    @track summaryData = {};
    @track phaseRows = [];
    @track showAuditHistory = true;
    @track auditLogs = [];
    @track hoveredBar = null;
    @track selectedBarGroup = null;

    wiredSummaryResult;
    wiredPhaseResult;
    wiredAuditResult;

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

    @wire(getAuditLogs, { quoteId: '$recordId' })
    wiredAudit(result) {
        this.wiredAuditResult = result;
        if (result.data) {
            this.auditLogs = result.data.map(log => ({
                id: log.Id,
                message: log.Message__c,
                fieldChanged: log.Field_Changed__c,
                oldValue: log.Old_Value__c,
                newValue: log.New_Value__c,
                changedBy: log.Changed_By__r ? log.Changed_By__r.Name : 'Unknown',
                itemName: log.Quote_Line_Item__r ? log.Quote_Line_Item__r.Name__c : '',
                timeDisplay: this.formatTime(log.CreatedDate),
                iconClass: this._getAuditIcon(log.Field_Changed__c)
            }));
        }
    }

    @api
    refresh() {
        refreshApex(this.wiredSummaryResult);
        refreshApex(this.wiredPhaseResult);
        refreshApex(this.wiredAuditResult);
    }

    // ─── Detail getters ───
    get opportunityName() { return this.quoteData?.Opportunity__r?.Name || 'N/A'; }
    get opportunityId() { return this.quoteData?.Opportunity__c || ''; }
    get accountName() { return this.quoteData?.Account__r?.Name || 'N/A'; }
    get accountId() { return this.quoteData?.Account__c || ''; }
    get validUntil() { return this.quoteData?.Valid_Until__c ? new Date(this.quoteData.Valid_Until__c).toLocaleDateString() : '-'; }
    get timePeriod() { return this.quoteData?.Time_Period_Metric__c || 'Months'; }
    get createdDate() { return this.quoteData?.CreatedDate ? new Date(this.quoteData.CreatedDate).toLocaleDateString() : '-'; }
    get createdByName() { return this.quoteData?.CreatedBy?.Name || '-'; }
    get lastModifiedByName() { return this.quoteData?.LastModifiedBy?.Name || '-'; }

    // ─── Revenue card values ───
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

    // ─── Revenue card accent ───
    get laborMarginClass() {
        return this.laborMargin >= 0 ? 'rev-pct positive' : 'rev-pct negative';
    }
    get productMarginClass() {
        return this.productMargin >= 0 ? 'rev-pct positive' : 'rev-pct negative';
    }
    get addonMarginClass() {
        return this.addonMargin >= 0 ? 'rev-pct positive' : 'rev-pct negative';
    }

    get hasPhases() { return this.phaseRows && this.phaseRows.length > 0; }

    // ─── Audit history ───
    get auditCount() { return this.auditLogs.length; }
    get hasAuditLogs() { return this.auditLogs.length > 0; }
    get auditChevronIcon() { return this.showAuditHistory ? '▾' : '▸'; }

    toggleAuditHistory() {
        this.showAuditHistory = !this.showAuditHistory;
    }

    _getAuditIcon(field) {
        if (field === 'Quantity__c') return 'audit-icon audit-qty';
        if (field === 'Discount_Percent__c' || field === 'Default_Discount__c') return 'audit-icon audit-discount';
        if (field === 'Start_Date__c' || field === 'End_Date__c') return 'audit-icon audit-date';
        if (field === 'Phase__c') return 'audit-icon audit-phase';
        return 'audit-icon audit-default';
    }

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // ─── Interactive chart data ───
    getMaxRevenue() {
        return Math.max(this.laborRevenue, this.productRevenue, this.addonRevenue, 1);
    }

    get itemTypeChartData() {
        const max = this.getMaxRevenue();
        const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(v);
        return [
            {
                key: 'labor', label: 'Labor',
                revenue: this.laborRevenue, cost: this.laborCost, margin: this.laborMargin,
                revenueFormatted: fmt(this.laborRevenue), costFormatted: fmt(this.laborCost), marginFormatted: fmt(this.laborMargin),
                costHeight: `height: ${max > 0 ? Math.max((this.laborCost / max * 120), 4) : 4}px;`,
                marginHeight: `height: ${max > 0 ? Math.max((this.laborMargin / max * 120), 4) : 4}px;`,
                barGroupClass: `bar-group ${this.selectedBarGroup === 'labor' ? 'selected' : ''}`,
                isHovered: this.hoveredBar === 'labor'
            },
            {
                key: 'products', label: 'Products',
                revenue: this.productRevenue, cost: this.productCost, margin: this.productMargin,
                revenueFormatted: fmt(this.productRevenue), costFormatted: fmt(this.productCost), marginFormatted: fmt(this.productMargin),
                costHeight: `height: ${max > 0 ? Math.max((this.productCost / max * 120), 4) : 4}px;`,
                marginHeight: `height: ${max > 0 ? Math.max((this.productMargin / max * 120), 4) : 4}px;`,
                barGroupClass: `bar-group ${this.selectedBarGroup === 'products' ? 'selected' : ''}`,
                isHovered: this.hoveredBar === 'products'
            },
            {
                key: 'addons', label: 'Add-ons',
                revenue: this.addonRevenue, cost: this.addonCost, margin: this.addonMargin,
                revenueFormatted: fmt(this.addonRevenue), costFormatted: fmt(this.addonCost), marginFormatted: fmt(this.addonMargin),
                costHeight: `height: ${max > 0 ? Math.max((this.addonCost / max * 120), 4) : 4}px;`,
                marginHeight: `height: ${max > 0 ? Math.max((this.addonMargin / max * 120), 4) : 4}px;`,
                barGroupClass: `bar-group ${this.selectedBarGroup === 'addons' ? 'selected' : ''}`,
                isHovered: this.hoveredBar === 'addons'
            }
        ];
    }

    get phaseChartData() {
        if (!this.phaseRows || this.phaseRows.length === 0) return [];
        const max = Math.max(...this.phaseRows.map(p => p.total), 1);
        const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(v);
        return this.phaseRows.map(p => {
            const cost = (p.total || 0) * 0.4;
            const margin = (p.total || 0) * 0.6;
            return {
                key: p.phase,
                label: p.phase,
                total: p.total || 0,
                totalFormatted: fmt(p.total || 0),
                costFormatted: fmt(cost),
                marginFormatted: fmt(margin),
                costHeight: `height: ${p.total > 0 ? Math.max((cost / max * 120), 4) : 4}px;`,
                marginHeight: `height: ${p.total > 0 ? Math.max((margin / max * 120), 4) : 4}px;`,
                barGroupClass: `bar-group ${this.selectedBarGroup === p.phase ? 'selected' : ''}`,
                isHovered: this.hoveredBar === p.phase
            };
        });
    }

    handleBarEnter(event) {
        this.hoveredBar = event.currentTarget.dataset.bar;
    }

    handleBarLeave() {
        this.hoveredBar = null;
    }

    handleBarClick(event) {
        const bar = event.currentTarget.dataset.bar;
        this.selectedBarGroup = this.selectedBarGroup === bar ? null : bar;
    }

    handleRecordNavigate(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.id;
        if (!recordId) return;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        });
    }
}
