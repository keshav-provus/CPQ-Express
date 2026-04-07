import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { createRecord } from 'lightning/uiRecordApi';
import QUOTE_OBJECT from '@salesforce/schema/Quote__c';
import START_DATE_FIELD from '@salesforce/schema/Quote__c.Start_Date__c';
import END_DATE_FIELD from '@salesforce/schema/Quote__c.End_Date__c';
import METRIC_FIELD from '@salesforce/schema/Quote__c.Time_Period_Metric__c';
import COUNT_FIELD from '@salesforce/schema/Quote__c.Time_Period_Count__c';
import NAME_FIELD from '@salesforce/schema/Quote__c.Name';
import STATUS_FIELD from '@salesforce/schema/Quote__c.Status__c';

export default class CpqCreateQuoteModal extends NavigationMixin(LightningElement) {
    @api opportunityId;
    @api accountId;

    @track startDate = new Date().toISOString().split('T')[0];
    @track metric = 'Months';
    @track count = 1;
    @track quoteName = 'New Quote';

    metricOptions = [
        { label: 'Days', value: 'Days' },
        { label: 'Weeks', value: 'Weeks' },
        { label: 'Months', value: 'Months' },
        { label: 'Quarters', value: 'Quarters' }
    ];

    get endDate() {
        if (!this.startDate || !this.count) return 'Select start date and duration';
        
        let start = new Date(this.startDate);
        let end = new Date(start);

        switch(this.metric) {
            case 'Days':
                end.setDate(start.getDate() + parseInt(this.count));
                break;
            case 'Weeks':
                end.setDate(start.getDate() + (parseInt(this.count) * 7));
                break;
            case 'Months':
                end.setMonth(start.getMonth() + parseInt(this.count));
                break;
            case 'Quarters':
                end.setMonth(start.getMonth() + (parseInt(this.count) * 3));
                break;
        }

        return end.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        });
    }

    handleInputChange(event) {
        const field = event.target.dataset.id;
        if (field === 'name') this.quoteName = event.target.value;
        if (field === 'startDate') this.startDate = event.target.value;
        if (field === 'metric') this.metric = event.target.value;
        if (field === 'count') this.count = event.target.value;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    async handleSave() {
        const fields = {};
        fields[NAME_FIELD.fieldApiName] = this.quoteName;
        fields[START_DATE_FIELD.fieldApiName] = this.startDate;
        fields[METRIC_FIELD.fieldApiName] = this.metric;
        fields[COUNT_FIELD.fieldApiName] = parseInt(this.count);
        fields[STATUS_FIELD.fieldApiName] = 'Draft';
        
        // Add relationship fields if provided
        if (this.opportunityId) fields['Opportunity__c'] = this.opportunityId;
        if (this.accountId) fields['Account__c'] = this.accountId;

        const recordInput = { apiName: QUOTE_OBJECT.objectApiName, fields };

        try {
            const quote = await createRecord(recordInput);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Quote created successfully',
                    variant: 'success'
                })
            );
            
            // Navigate to the new record
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: quote.id,
                    objectApiName: QUOTE_OBJECT.objectApiName,
                    actionName: 'view'
                }
            });

            this.dispatchEvent(new CustomEvent('close'));
        } catch (error) {
            console.error('Error creating quote:', error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error creating quote',
                    message: error.body ? error.body.message : 'Unknown error',
                    variant: 'error'
                })
            );
        }
    }
}