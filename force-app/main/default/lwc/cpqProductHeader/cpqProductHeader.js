import { LightningElement, api, track } from 'lwc';
import updateProduct from '@salesforce/apex/ProductController.updateProduct';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqProductHeader extends LightningElement {
    @api recordId;
    @api product;

    @track isEditingDiscount = false;
    @track editedDiscount;

    get productName() { return this.product?.Name || 'N/A'; }
    get productCode() { return this.product?.Product_Code__c || 'N/A'; }
    get productType() { return this.product?.Product_Type__c || 'N/A'; }
    get status() { return this.product?.Active__c ? 'Active' : 'Inactive'; }
    get statusClass() { return this.product?.Active__c ? 'bg-primary/10 text-primary' : 'bg-on-surface-variant/10 text-on-surface-variant'; }
    get statusDotClass() { return `w-1.5 h-1.5 rounded-full ${this.product?.Active__c ? 'bg-primary' : 'bg-on-surface-variant'}`; }

    get avgSalesPrice() { return this.product?.Price__c || 0; }
    get marginPct() { return 64.5; } // Placeholder
    get defaultDiscount() { return this.product?.Default_Discount__c || 0; }

    handleEditDiscount() {
        this.isEditingDiscount = true;
        this.editedDiscount = this.defaultDiscount;
    }

    handleDiscountChange(event) {
        this.editedDiscount = event.target.value;
    }

    handleSaveDiscount() {
        const productUpdate = {
            Id: this.recordId,
            Default_Discount__c: this.editedDiscount
        };

        updateProduct({ product: productUpdate })
            .then(() => {
                this.isEditingDiscount = false;
                this.dispatchEvent(new CustomEvent('refresh'));
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: 'Default discount updated',
                    variant: 'success'
                }));
            })
            .catch(error => {
                console.error('Update error', error);
            });
    }

    handleCancelDiscount() {
        this.isEditingDiscount = false;
    }
}
