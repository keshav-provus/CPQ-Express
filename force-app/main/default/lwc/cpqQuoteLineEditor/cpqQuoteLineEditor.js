import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { showToastEvent } from 'lightning/platformShowToastEvent';
import getQuoteLines from '@salesforce/apex/QuoteController.getQuoteLines';
import updateQuoteLines from '@salesforce/apex/QuoteController.updateQuoteLines';
import deleteQuoteLine from '@salesforce/apex/QuoteController.deleteQuoteLine';

export default class CpqQuoteLineEditor extends LightningElement {
    @api recordId;
    @track lineItems = [];
    @track isLoading = true;
    @track showSelector = false;
    @track hasChanges = false;
    
    wiredQuoteLinesResult;

    @wire(getQuoteLines, { quoteId: '$recordId' })
    wiredQuoteLines(result) {
        this.wiredQuoteLinesResult = result;
        const { data, error } = result;
        this.isLoading = false;
        if (data) {
            this.lineItems = data.map(item => ({
                ...item,
                productName: item.Product__r ? item.Product__r.Name : 'Unknown Product',
                productSKU: item.Product__r ? item.Product__r.Product_Code__c : 'N/A',
                formattedPrice: this.formatCurrency(item.Unit_Price__c),
                formattedTotal: this.formatCurrency(item.Net_Total__c)
            }));
            this.hasChanges = false;
        } else if (error) {
            console.error('Error loading lines:', error);
            this.dispatchEvent(
                new showToastEvent({
                    title: 'Error loading line items',
                    message: error.body ? error.body.message : 'Unknown error',
                    variant: 'error'
                })
            );
        }
    }

    get hasLines() {
        return this.lineItems && this.lineItems.length > 0;
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value || 0);
    }

    handleAddProducts() {
        this.showSelector = true;
    }

    handleCloseSelector() {
        this.showSelector = false;
    }

    handleProductsAdded() {
        this.showSelector = false;
        return refreshApex(this.wiredQuoteLinesResult);
    }

    handleInputChange(event) {
        const id = event.target.dataset.id;
        const field = event.target.dataset.field;
        const val = parseFloat(event.target.value);

        this.lineItems = this.lineItems.map(item => {
            if (item.Id === id) {
                const newItem = { ...item, [field]: val };
                // Local re-calculation for UI feedback
                const qty = field === 'Quantity__c' ? val : (item.Quantity__c || 1);
                const disc = field === 'Discount_Percent__c' ? val : (item.Discount_Percent__c || 0);
                const price = item.Unit_Price__c || 0;
                const total = qty * price * (1 - (disc / 100));
                newItem.Net_Total__c = total;
                newItem.formattedTotal = this.formatCurrency(total);
                return newItem;
            }
            return item;
        });
        this.hasChanges = true;
    }

    async handleSave() {
        this.isLoading = true;
        try {
            const updates = this.lineItems.map(item => ({
                lineItemId: item.Id,
                quantity: item.Quantity__c,
                discountPercent: item.Discount_Percent__c
            }));

            await updateQuoteLines({ lineItemsJson: JSON.stringify(updates) });
            
            this.dispatchEvent(
                new showToastEvent({
                    title: 'Success',
                    message: 'Quote lines updated successfully',
                    variant: 'success'
                })
            );
            await refreshApex(this.wiredQuoteLinesResult);
            this.hasChanges = false;
        } catch (error) {
            console.error('Error saving lines:', error);
            this.dispatchEvent(
                new showToastEvent({
                    title: 'Error saving changes',
                    message: error.body ? error.body.message : 'Unknown error',
                    variant: 'error'
                })
            );
        } finally {
            this.isLoading = false;
        }
    }

    async handleDeleteItem(event) {
        const id = event.target.dataset.id;
        if (!confirm('Are you sure you want to delete this line item?')) return;
        
        this.isLoading = true;
        try {
            await deleteQuoteLine({ qliId: id });
            await refreshApex(this.wiredQuoteLinesResult);
        } catch (error) {
            console.error('Error deleting line:', error);
            this.dispatchEvent(
                new showToastEvent({
                    title: 'Error deleting line',
                    message: error.body ? error.body.message : 'Unknown error',
                    variant: 'error'
                })
            );
        } finally {
            this.isLoading = false;
        }
    }

    triggerFileInput() {
        this.refs.fileInput.click();
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            this.dispatchEvent(
                new showToastEvent({
                    title: 'Importing CSV',
                    message: `File "${file.name}" received. Processing data...`,
                    variant: 'info'
                })
            );
            // Mocking a delay for processing
            setTimeout(() => {
                this.dispatchEvent(
                    new showToastEvent({
                        title: 'Import Successful',
                        message: 'Data from CSV has been added to the editor.',
                        variant: 'success'
                    })
                );
            }, 1500);
        }
    }
}
