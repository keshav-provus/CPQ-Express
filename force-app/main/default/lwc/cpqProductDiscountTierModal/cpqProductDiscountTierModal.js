import { LightningElement, api, track } from 'lwc';
import createDiscountTier from '@salesforce/apex/ProductController.createDiscountTier';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqProductDiscountTierModal extends LightningElement {
    @api recordId;
    @track tier = {
        Name: '',
        Quantity_Range__c: '',
        Discount_Percent__c: 0,
        Product__c: ''
    };

    handleInputChange(event) {
        const field = event.target.dataset.field;
        this.tier[field] = event.target.value;
    }

    handleSave() {
        this.tier.Product__c = this.recordId;
        this.tier.Name = this.tier.Quantity_Range__c;
        createDiscountTier({ tier: this.tier })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: 'Discount tier created successfully',
                    variant: 'success'
                }));
                this.dispatchEvent(new CustomEvent('success'));
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body.message,
                    variant: 'error'
                }));
            });
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}
