import { LightningElement, wire, api, track } from 'lwc';
import getResourceUsageTimeline from '@salesforce/apex/DashboardController.getResourceUsageTimeline';
import { refreshApex } from '@salesforce/apex';
import { NavigationMixin } from 'lightning/navigation';

export default class CpqResourceTimeline extends NavigationMixin(LightningElement) {
    @api recordId;
    @track usageData = [];
    wiredTimelineResult;

    // Timeline Configuration (1-year view)
    startDate = new Date(new Date().getFullYear(), 0, 1); // Jan 1st of current year
    endDate = new Date(new Date().getFullYear(), 11, 31); // Dec 31st of current year
    
    legendItems = [
        { label: 'New Business', dotClass: 'dot blue' },
        { label: 'Renewal', dotClass: 'dot pink' },
        { label: 'Expansion', dotClass: 'dot yellow' },
        { label: 'Internal', dotClass: 'dot green' },
        { label: 'Seasonal', dotClass: 'dot purple' }
    ];

    colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple'];

    @wire(getResourceUsageTimeline, { productId: '$recordId' })
    wiredTimeline(result) {
        this.wiredTimelineResult = result;
        if (result.data) {
            this.usageData = result.data;
        } else if (result.error) {
            console.error('Error fetching timeline:', result.error);
        }
    }

    get hasData() {
        return this.usageData && this.usageData.length > 0;
    }

    get gridLines() {
        // One line per month
        const lines = [];
        for (let i = 0; i <= 12; i++) {
            lines.push({ id: i });
        }
        return lines;
    }

    get dateLabels() {
        const labels = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        for (let i = 0; i < 12; i++) {
            labels.push({ 
                id: i, 
                text: months[i] + ' ' + (this.startDate.getFullYear() % 100) 
            });
        }
        return labels;
    }

    get usageBlocks() {
        if (!this.usageData) return [];

        const totalDays = (this.endDate - this.startDate) / (1000 * 60 * 60 * 24);
        
        return this.usageData.map((entry, index) => {
            const start = new Date(entry.startDate);
            const end = new Date(entry.endDate);
            
            // Calculate offsets
            const offsetDays = (start - this.startDate) / (1000 * 60 * 60 * 24);
            const durationDays = (end - start) / (1000 * 60 * 60 * 24);
            
            const left = (offsetDays / totalDays) * 100;
            const width = (durationDays / totalDays) * 100;
            
            // Staggering rows to avoid overlap
            const top = (index % 4) * 40; 

            const colorClass = this.colors[index % this.colors.length];

            return {
                id: entry.id,
                quoteId: entry.quoteId,
                className: `usage-block ${colorClass}`,
                style: `left: ${left}%; width: ${width}%; top: ${top}px;`,
                text: entry.quoteName,
                label: `${entry.quoteName} - ${entry.accountName} (Qty: ${entry.quantity}) | Duration: ${entry.startDate} to ${entry.endDate}`
            };
        });
    }

    handleBlockClick(event) {
        const quoteId = event.target.dataset.quoteId;
        if (quoteId) {
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

    handleRefresh() {
        refreshApex(this.wiredTimelineResult);
    }
}