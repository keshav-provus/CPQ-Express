import { LightningElement, wire, track } from 'lwc';
import getTopTransactions from '@salesforce/apex/DashboardController.getTopTransactions';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqTopTransactions extends LightningElement {
    connectedCallback() {
        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @track currencyCode = 'USD';

        @track transactions;

    @wire(getTopTransactions)
    wiredTransactions({ error, data }) {
        if (data) {
            this.transactions = data;
        } else if (error) {
            console.error('Error fetching top transactions', error);
        }
    }

    get formattedTransactions() {
        if (!this.transactions) return [];
        return this.transactions.map(tx => ({
            ...tx,
            accountName: tx.Account__r ? tx.Account__r.Name : 'No Account',
            formattedDate: new Date(tx.CreatedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            formattedAmount: new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(tx.Total_Amount__c || 0)
        }));
    }
}