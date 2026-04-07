import { LightningElement, api, track } from 'lwc';

const COLUMNS = [
    {
        label: 'Quote',
        fieldName: 'QuoteUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'Name' }, target: '_blank' }
    },
    { label: 'Owner', fieldName: 'OwnerName', type: 'text' },
    { label: 'Account', fieldName: 'AccountName', type: 'text' },
    { label: 'Amount', fieldName: 'Total_Amount__c', type: 'currency' },
    { label: 'Status', fieldName: 'Status__c', type: 'text' },
    { label: 'Created', fieldName: 'CreatedDate', type: 'date' }
];

export default class TeamRecentQuotes extends LightningElement {
    @track quotes = [];
    @track isLoading = true;
    columns = COLUMNS;

    @api 
    set dashboardData(value) {
        if (value) {
            this.quotes = value.map(q => ({
                ...q,
                OwnerName: q.CreatedBy ? q.CreatedBy.Name : '—',
                AccountName: q.Account__r ? q.Account__r.Name : '—',
                QuoteUrl: `/lightning/r/Quote__c/${q.Id}/view`
            }));
            this.isLoading = false;
        }
    }
    get dashboardData() {
        return this.quotes;
    }

    get hasQuotes() {
        return this.quotes && this.quotes.length > 0;
    }
}
