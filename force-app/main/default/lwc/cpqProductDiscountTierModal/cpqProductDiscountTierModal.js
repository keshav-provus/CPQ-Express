import { LightningElement, api, track } from 'lwc';
import createDiscountTier from '@salesforce/apex/ProductController.createDiscountTier';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqProductDiscountTierModal extends LightningElement {
    @api recordId;
    @api objectApiName;
    
    @track tier = {
        Name: '',
        Lower_Bound__c: null,
        Upper_Bound__c: null,
        Discount_Percent__c: 0,
        Product__c: null,
        Resource_Role__c: null,
        Add_On__c: null
    };

    handleInputChange(event) {
        const field = event.target.dataset.field;
        this.tier[field] = event.target.value;
    }

    handleSave() {
        if (this.objectApiName === 'Product__c' || !this.objectApiName) {
            this.tier.Product__c = this.recordId;
        } else if (this.objectApiName === 'Resource_Role__c') {
            this.tier.Resource_Role__c = this.recordId;
        } else if (this.objectApiName === 'Add_On__c') {
            this.tier.Add_On__c = this.recordId;
        }

        let max = this.tier.Upper_Bound__c ? this.tier.Upper_Bound__c : '+';
        this.tier.Name = `${this.tier.Lower_Bound__c || 0} - ${max}`;
        
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
