import { LightningElement, api, track } from 'lwc';
import createAddOn from '@salesforce/apex/ProductController.createAddOn';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqProductAddOnModal extends LightningElement {
    @api recordId;
    @track addOn = {
        Name__c: '',
        Price__c: 0,
        Cost__c: 0,
        Billing_Unit__c: 'Each',
        Is_Active__c: true,
        Parent_Product__c: ''
    };

    handleInputChange(event) {
        const field = event.target.dataset.field;
        this.addOn[field] = event.target.value;
    }

    handleSave() {
        this.addOn.Parent_Product__c = this.recordId;
        createAddOn({ addOn: this.addOn })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: 'Add-on created successfully',
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
