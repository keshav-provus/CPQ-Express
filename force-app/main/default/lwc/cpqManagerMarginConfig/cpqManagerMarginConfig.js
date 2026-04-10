import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCompanySettings from '@salesforce/apex/AdminSettingsController.getCompanySettings';
import saveCompanySettings from '@salesforce/apex/AdminSettingsController.saveCompanySettings';

export default class CpqManagerMarginConfig extends LightningElement {
    @track marginValue = 15;
    @track isLoading = true;

    connectedCallback() {
        this.loadSettings();
    }

    async loadSettings() {
        this.isLoading = true;
        try {
            const settings = await getCompanySettings();
            if (settings && settings.Minimum_Margin__c != null) {
                this.marginValue = settings.Minimum_Margin__c;
            }
        } catch (error) {
            console.error('Error loading settings', error);
            this.showToast('Error', 'Failed to load minimum margin setting', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    get marginDisplay() {
        return this.marginValue + '%';
    }

    handleMarginInput(event) {
        this.marginValue = event.target.value;
    }

    async handleMarginChange(event) {
        this.marginValue = event.target.value;
        // Auto-save on change
        try {
            const settings = {
                Minimum_Margin__c: parseFloat(this.marginValue)
            };
            await saveCompanySettings({ settings });
            this.showToast('Success', `Auto-approval minimum margin set to ${this.marginValue}%`, 'success');
        } catch (error) {
            console.error('Error saving settings', error);
            this.showToast('Error', 'Failed to save minimum margin setting', 'error');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}
