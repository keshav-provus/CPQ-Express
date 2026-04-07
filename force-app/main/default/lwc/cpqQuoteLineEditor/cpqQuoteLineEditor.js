import { LightningElement, api, track } from 'lwc';
import updateQuoteLines from '@salesforce/apex/QuoteController.updateQuoteLines';
import deleteQuoteLine from '@salesforce/apex/QuoteController.deleteQuoteLine';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqQuoteLineEditor extends LightningElement {
    @api recordId;
    @api lineItems = [];

    @track draftValues = {}; // Track changes by QLI Id

    get groupedPhases() {
        const phases = {};
        
        // Group items by Phase__c
        this.lineItems.forEach(item => {
            const phaseName = item.Phase__c || 'Default';
            if (!phases[phaseName]) {
                phases[phaseName] = {
                    name: phaseName,
                    items: [],
                    itemCount: 0
                };
            }
            phases[phaseName].items.push(item);
            phases[phaseName].itemCount++;
        });

        return Object.values(phases);
    }

    handleQtyChange(event) {
        const qliId = event.target.dataset.id;
        const value = parseInt(event.target.value, 10);
        this.updateDraft(qliId, { quantity: value });
    }

    handleDiscountChange(event) {
        const qliId = event.target.dataset.id;
        const value = parseFloat(event.target.value);
        this.updateDraft(qliId, { discountPercent: value });
    }

    updateDraft(id, changes) {
        if (!this.draftValues[id]) {
            this.draftValues[id] = { lineItemId: id };
        }
        Object.assign(this.draftValues[id], changes);
    }

    handleSaveAll() {
        const updates = Object.values(this.draftValues);
        if (updates.length === 0) return;

        updateQuoteLines({ lineItemsJson: JSON.stringify(updates) })
            .then(() => {
                this.draftValues = {};
                this.dispatchEvent(new CustomEvent('refresh'));
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'All changes saved',
                        variant: 'success'
                    })
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body.message,
                        variant: 'error'
                    })
                );
            });
    }

    handleDeleteItem(event) {
        const qliId = event.target.dataset.id;
        deleteQuoteLine({ qliId })
            .then(() => {
                this.dispatchEvent(new CustomEvent('refresh'));
            });
    }

    handleAddPhase() {
        // Implementation for adding a new phase name dynamically
        // For now, let's just trigger a toast
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Add Phase',
                message: 'Phase management dialog coming soon',
                variant: 'info'
            })
        );
    }

    handleOpenWizard(event) {
        const phase = event.target.dataset.phase;
        this.dispatchEvent(new CustomEvent('openwizard', {
            detail: { phase }
        }));
    }
}
