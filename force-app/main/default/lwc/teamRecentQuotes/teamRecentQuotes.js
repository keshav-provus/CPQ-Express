import { LightningElement, wire, track } from 'lwc';
import getTeamRecentQuotes from '@salesforce/apex/DashboardController.getTeamRecentQuotes';

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

    @wire(getTeamRecentQuotes)
    wiredQuotes({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.quotes = data.map(q => ({
                ...q,
                OwnerName: q.CreatedBy ? q.CreatedBy.Name : '—',
                AccountName: q.Account__r ? q.Account__r.Name : '—',
                QuoteUrl: `/lightning/r/Quote__c/${q.Id}/view`
            }));
        } else if (error) {
            console.error('Error loading team quotes:', error);
        }
    }

    get hasQuotes() {
        return this.quotes && this.quotes.length > 0;
    }
}
