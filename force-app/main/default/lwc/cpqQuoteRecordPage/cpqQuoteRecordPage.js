import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getQuoteById from '@salesforce/apex/QuoteController.getQuoteById';
import getLineItems from '@salesforce/apex/QuoteLineItemController.getLineItems';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqQuoteRecordPage extends LightningElement {
    @api recordId;

    @track activeTab = 'summary';
    @track isWizardOpen = false;

    get isSummary() { return this.activeTab === 'summary'; }
    get isLineItems() { return this.activeTab === 'lineitems'; }
    get isTimeline() { return this.activeTab === 'timeline'; }
    get isPdfs() { return this.activeTab === 'pdfs'; }

    get summaryTabClass() { return `tab ${this.isSummary ? 'active' : ''}`; }
    get lineitemsTabClass() { return `tab ${this.isLineItems ? 'active' : ''}`; }
    get timelineTabClass() { return `tab ${this.isTimeline ? 'active' : ''}`; }
    get pdfsTabClass() { return `tab ${this.isPdfs ? 'active' : ''}`; }

    switchTab(event) {
        this.activeTab = event.target.dataset.tab;
    }
    @track targetPhase = 'Default';

    wiredQuoteResult;
    wiredLinesResult;

    @wire(getQuoteById, { recordId: '$recordId' })
    wiredQuote(result) {
        this.wiredQuoteResult = result;
    }

    @wire(getLineItems, { quoteId: '$recordId' })
    wiredLines(result) {
        this.wiredLinesResult = result;
    }

    get quoteData() {
        return this.wiredQuoteResult?.data;
    }

    get lineItems() {
        return this.wiredLinesResult?.data || [];
    }

    handleRefresh() {
        refreshApex(this.wiredQuoteResult);
        refreshApex(this.wiredLinesResult);
        const docMgmt = this.template.querySelector('c-cpq-document-management');
        if (docMgmt) {
            docMgmt.refresh();
        }
    }

    handleOpenWizard(event) {
        this.targetPhase = event.detail.phase || 'Default';
        this.isWizardOpen = true;
    }

    handleCloseWizard() {
        this.isWizardOpen = false;
    }

    handleWizardSuccess() {
        this.isWizardOpen = false;
        this.handleRefresh();
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Line items added successfully',
                variant: 'success'
            })
        );
    }
}
