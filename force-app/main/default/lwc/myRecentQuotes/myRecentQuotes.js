import { LightningElement, wire, track } from 'lwc';
import getPendingActionItems from '@salesforce/apex/DashboardController.getPendingActionItems';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class MyRecentQuotes extends LightningElement {
    connectedCallback() {
        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @track currencyCode = 'USD';

        @track items = [];
    @track isLoading = true;

    @wire(getPendingActionItems)
    wiredItems({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.items = data.map(q => ({
                ...q,
                oppName: q.Opportunity__r ? q.Opportunity__r.Name : '—',
                accountName: q.Account__r ? q.Account__r.Name : '—',
                quoteUrl: `/lightning/r/Quote__c/${q.Id}/view`,
                editUrl: `/lightning/r/Quote__c/${q.Id}/edit`,
                formattedValue: this.formatCurrency(q.Total_Amount__c),
                formattedDate: this.formatDueDate(q.Valid_Until__c),
                dueDateClass: this.getDueDateClass(q.Valid_Until__c),
                statusLabel: this.getStatusLabel(q.Status__c),
                statusBadgeClass: `status-badge badge-${(q.Status__c || 'draft').toLowerCase()}`
            }));
        } else if (error) {
            console.error('Error loading action items:', error);
        }
    }

    get hasItems() {
        return this.items && this.items.length > 0;
    }

    formatCurrency(value) {
        if (!value && value !== 0) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: this.currencyCode,
            minimumFractionDigits: 2
        }).format(value);
    }

    formatDueDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (date < today) {
            return `Overdue (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    getDueDateClass(dateStr) {
        if (!dateStr) return 'td-date';
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today ? 'td-date overdue-date' : 'td-date';
    }

    getStatusLabel(status) {
        const labels = {
            'Draft': 'DRAFT',
            'Submitted': 'PENDING APPROVAL',
            'Rejected': 'REVISION NEEDED'
        };
        return labels[status] || status;
    }
}
