import { LightningElement, wire, track } from 'lwc';
import getMyRecentActivity from '@salesforce/apex/DashboardController.getMyRecentActivity';
import { NavigationMixin } from 'lightning/navigation';

export default class CpqMyRecentActivity extends NavigationMixin(LightningElement) {
    @track activities = [];
    @track isLoading = true;

    @wire(getMyRecentActivity)
    wiredActivity({ error, data }) {
        if (data) {
            this.activities = data.map(item => ({
                ...item,
                iconName: this.getIconForType(item.type),
                iconClass: `activity-icon icon-${item.type}`,
                timeAgo: this.getTimeAgo(item.timestamp)
            }));
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching activity:', error);
            this.isLoading = false;
        }
    }

    get hasActivity() {
        return this.activities.length > 0;
    }

    getIconForType(type) {
        switch(type) {
            case 'approved': return 'utility:success';
            case 'submitted': return 'utility:forward';
            case 'rejected': return 'utility:error';
            case 'draft': return 'utility:edit';
            default: return 'utility:event';
        }
    }

    getTimeAgo(timestamp) {
        const diff = Date.now() - new Date(timestamp).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours} hrs ago`;
        return `${Math.floor(hours / 24)} days ago`;
    }

    handleViewQuote(event) {
        const quoteId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: quoteId,
                objectApiName: 'Quote__c',
                actionName: 'view'
            }
        });
    }
}