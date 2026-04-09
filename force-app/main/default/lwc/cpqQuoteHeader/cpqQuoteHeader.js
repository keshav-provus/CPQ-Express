import { LightningElement, api, track, wire} from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import submitForApproval from '@salesforce/apex/QuoteController.submitForApproval';
import recallApproval from '@salesforce/apex/QuoteController.recallApproval';
import approveQuote from '@salesforce/apex/QuoteController.approveQuote';
import rejectQuote from '@salesforce/apex/QuoteController.rejectQuote';
import generateQuotePdf from '@salesforce/apex/QuoteController.generateQuotePdf';
import getTemplates from '@salesforce/apex/QuoteTemplateController.getTemplates';
import getCurrentUserRole from '@salesforce/apex/QuoteController.getCurrentUserRole';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqQuoteHeader extends LightningElement {
    @track currencyCode = 'USD';

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @api recordId;
    @api quoteData;
    @api lineItems = [];

    get quoteName() {
        return this.quoteData?.Name || 'N/A';
    }

    get totalAmount() {
        return this.quoteData?.Total_Amount__c || 0;
    }

    get subtotal() {
        // Subtotal = sum of Qty * UnitPrice (before discount)
        if (!this.lineItems || this.lineItems.length === 0) return this.totalAmount;
        let sub = 0;
        this.lineItems.forEach(item => {
            sub += (item.Quantity__c || 0) * (item.Unit_Price__c || 0);
        });
        return sub;
    }

    get discountAmount() {
        // Discount is subtotal - totalAmount (net)
        const sub = this.subtotal;
        const net = this.totalAmount;
        return sub > 0 ? sub - net : 0;
    }

    get discountDisplayAmount() {
        const disc = this.discountAmount;
        // Show as negative
        return disc > 0 ? -disc : 0;
    }

    get discountPercent() {
        const sub = this.subtotal;
        if (sub <= 0) return '0.0';
        const pct = (this.discountAmount / sub) * 100;
        return pct.toFixed(1);
    }

    get margin() {
        // Margin_Percent__c is a Percent field type: Salesforce stores 49.2 for 49.2%
        const pct = this.quoteData?.Margin_Percent__c;
        return pct != null ? pct.toFixed(1) : '0.0';
    }

    get marginAmount() {
        return this.quoteData?.Margin_Amount__c || 0;
    }

    get status() {
        return this.quoteData?.Status__c || 'Draft';
    }

    get isDraft() {
        return this.status === 'Draft';
    }

    get isPendingApproval() {
        return this.status === 'Pending Approval';
    }

    get badgeClass() {
        const s = this.status;
        if (s === 'Pending Approval') return 'badge badge-pending';
        if (s === 'Approved') return 'badge badge-approved';
        if (s === 'Rejected') return 'badge badge-rejected';
        return 'badge badge-draft';
    }

    get startDate() {
        if (!this.quoteData?.Start_Date__c) return '-';
        return new Date(this.quoteData.Start_Date__c).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    get endDate() {
        const d = this.quoteData?.Calculated_End_Date__c || this.quoteData?.End_Date__c;
        if (!d) return '-';
        return new Date(d).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    get timePeriod() {
        return this.quoteData?.Time_Period_Metric__c || 'Months';
    }

    @wire(getCurrentUserRole)
    wiredRole;

    get isManagerOrAdmin() {
        const role = this.wiredRole?.data;
        return role === 'Manager' || role === 'Admin';
    }

    handleRefresh() {
        this.dispatchEvent(new CustomEvent('refresh'));
    }

    handleSave() {
        this.dispatchEvent(new CustomEvent('refresh'));
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Quote saved successfully',
                variant: 'success'
            })
        );
    }

    @track isPdfModalOpen = false;
    @track pdfTitle = '';
    @track pdfDescription = '';
    @track isGenerating = false;
    @track templateOptions = [];
    @track selectedTemplateId = '';

    @wire(getTemplates)
    wiredTemplates({ error, data }) {
        if (data) {
            this.templateOptions = data.map(t => ({
                label: t.Name,
                value: t.Id
            }));
            const defaultTemplate = data.find(t => t.Is_Default__c);
            if (defaultTemplate) {
                this.selectedTemplateId = defaultTemplate.Id;
            } else if (data.length > 0) {
                this.selectedTemplateId = data[0].Id;
            }
        }
    }

    handleTemplateChange(event) {
        this.selectedTemplateId = event.detail.value;
    }

    handleGeneratePdf() {
        this.isPdfModalOpen = true;
    }

    closePdfModal() {
        this.isPdfModalOpen = false;
    }

    handlePdfTitleChange(event) {
        this.pdfTitle = event.target.value;
    }

    handlePdfDescChange(event) {
        this.pdfDescription = event.target.value;
    }

    async confirmGeneratePdf() {
        this.isGenerating = true;
        try {
            await generateQuotePdf({
                quoteId: this.recordId,
                title: this.pdfTitle,
                description: this.pdfDescription,
                templateId: this.selectedTemplateId
            });

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Quote PDF generated successfully',
                    variant: 'success'
                })
            );

            this.isPdfModalOpen = false;
            this.isGenerating = false;
            this.handleRefresh();
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error'
                })
            );
            this.isGenerating = false;
        }
    }

    handleAiAssistant() {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Sparkle!',
                message: 'AI Assistant is analyzing your quote...',
                variant: 'info'
            })
        );
    }

    async handleSubmitForApproval() {
        try {
            await submitForApproval({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Quote submitted for approval',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error submitting for approval',
                    variant: 'error'
                })
            );
        }
    }

    async handleRecall() {
        try {
            await recallApproval({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Recalled',
                    message: 'Approval has been recalled. Quote is back in Draft.',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error recalling approval',
                    variant: 'error'
                })
            );
        }
    }

    async handleApprove() {
        try {
            await approveQuote({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Approved',
                    message: 'Quote has been approved.',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error approving quote',
                    variant: 'error'
                })
            );
        }
    }

    async handleReject() {
        try {
            await rejectQuote({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Rejected',
                    message: 'Quote has been rejected.',
                    variant: 'warning'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error rejecting quote',
                    variant: 'error'
                })
            );
        }
    }
}
