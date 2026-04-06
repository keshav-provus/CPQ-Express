import { LightningElement, wire, track } from 'lwc';
import getOpportunitiesNeedingQuotes from '@salesforce/apex/OpportunityController.getOpportunitiesNeedingQuotes';
import { NavigationMixin } from 'lightning/navigation';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';
import { refreshApex } from '@salesforce/apex';
import createQuoteRecord from '@salesforce/apex/QuoteController.createQuoteRecord';

const COLUMNS = [
    { 
        label: 'Name', 
        fieldName: 'OppLink', 
        type: 'url', 
        typeAttributes: { label: { fieldName: 'Name' }, target: '_blank' },
        sortable: true
    },
    { label: 'Account', fieldName: 'AccountName', type: 'text' },
    { label: 'Amount', fieldName: 'Amount', type: 'currency' },
    { label: 'Close Date', fieldName: 'CloseDate', type: 'date' },
    { 
        type: 'button', 
        typeAttributes: { 
            label: 'Create Quote', 
            name: 'create_quote', 
            title: 'Create Quote', 
            variant: 'border-filled',
            iconPosition: 'left'
        } 
    }
];

export default class OppsNeedingQuotes extends NavigationMixin(LightningElement) {
    @track opportunities = [];
    @track error;
    @track isLoading = false;
    columns = COLUMNS;
    wiredOppResult;
    subscription = {};
    channelName = '/data/OpportunityChangeEvent';

    @wire(getOpportunitiesNeedingQuotes)
    wiredOpportunities(result) {
        this.wiredOppResult = result;
        const { error, data } = result;
        if (data) {
            // Flattening the relationship data for the datatable
            this.opportunities = data.map(opp => ({
                ...opp,
                AccountName: opp.Account ? opp.Account.Name : '',
                OppLink: `/lightning/r/Opportunity/${opp.Id}/view`
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error.body ? error.body.message : error;
            this.opportunities = undefined;
        }
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        if (actionName === 'create_quote') {
            console.log('Starting background quote creation for Opp:', row.Id);
            this.isLoading = true;
            createQuoteRecord({ oppId: row.Id })
                .then(quoteId => {
                    this.isLoading = false;
                    // Directly navigate to the newly created record page in a new tab
                    this[NavigationMixin.GenerateUrl]({
                        type: 'standard__recordPage',
                        attributes: {
                            recordId: quoteId,
                            objectApiName: 'Quote__c',
                            actionName: 'view'
                        }
                    }).then(url => {
                        window.open(url, '_blank');
                    });
                })
                .catch(error => {
                    this.isLoading = false;
                    this.error = error.body ? error.body.message : error;
                });
        }
    }

    connectedCallback() {
        this.handleSubscribe();
        this.registerErrorListener();
    }

    disconnectedCallback() {
        this.handleUnsubscribe();
    }

    handleSubscribe() {
        // Callback invoked whenever a new event message is received
        const messageCallback = (response) => {
            console.log('New message received: ', JSON.stringify(response));
            // Automatically refresh the dashboard data
            refreshApex(this.wiredOppResult);
        };

        // Invoke subscribe method of empApi. Pass reference to messageCallback
        subscribe(this.channelName, -1, messageCallback).then(response => {
            console.log('Subscription request sent to: ', JSON.stringify(response.channel));
            this.subscription = response;
        });
    }

    handleUnsubscribe() {
        unsubscribe(this.subscription, response => {
            console.log('Unsubscribe response: ', JSON.stringify(response));
        });
    }

    registerErrorListener() {
        onError(error => {
            console.log('Received error from server: ', JSON.stringify(error));
        });
    }
}
