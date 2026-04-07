import { LightningElement, wire, track } from 'lwc';
import getMyRecentActivity from '@salesforce/apex/DashboardController.getMyRecentActivity';

export default class RecentActivity extends LightningElement {
    @track activities = [];
    @track isLoading = true;

    @wire(getMyRecentActivity)
    wiredActivities({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.activities = data.map(item => ({
                ...item,
                timeAgo: this.formatTimeAgo(item.timestamp),
                dotClass: `timeline-dot dot-${item.type}`
            }));
        } else if (error) {
            console.error('Error loading activity:', error);
        }
    }

    get hasActivities() {
        return this.activities && this.activities.length > 0;
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const now = Date.now();
        const then = new Date(timestamp).getTime();
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}
