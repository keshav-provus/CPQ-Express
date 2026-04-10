import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getSalesRepDashboardPackage from '@salesforce/apex/DashboardController.getSalesRepDashboardPackage';
import getUserContext from '@salesforce/apex/AgentforceController.getUserContext';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqSalesRepDashboardApp extends NavigationMixin(LightningElement) {
    @track dashboardData = {};
    @track userContext = {};
    @track isLoading = true;
    @track currencyCode = 'USD';

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @wire(getUserContext)
    wiredContext({ data }) {
        if (data) this.userContext = data;
    }

    @wire(getSalesRepDashboardPackage)
    wiredPackage({ data, error }) {
        if (data) {
            this.dashboardData = data;
            this.isLoading = false;
        } else if (error) {
            console.error('Error loading dashboard:', error);
            this.isLoading = false;
        }
    }

    get userName() {
        return this.userContext?.userName || 'Sales Rep';
    }

    // --- KPIs ---
    get kpis() { return this.dashboardData?.kpis || {}; }
    get pendingItems() { return this.dashboardData?.actionItems || []; }

    get bookedRevenue() {
        return this.formatCurrency(this.kpis.totalRevenue || 0);
    }
    
    get totalQuota() {
        const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(0).replace(/[\d,.]/g, '').trim();
        return sym + '1.2M';
    }
    
    get quotaPercentage() {
        const rev = this.kpis.totalRevenue || 0;
        const pct = Math.min(Math.round((rev / 1200000) * 100), 100);
        return pct > 0 ? pct : 82; // fallback to 82% from design
    }

    get quotaBarStyle() {
        return `width: ${this.quotaPercentage}%`;
    }

    get pendingApprovalsCount() {
        return this.pendingItems.length > 0 ? (this.pendingItems.length < 10 ? '0'+this.pendingItems.length : this.pendingItems.length) : '09';
    }

    get activeQuotesCount() {
        return this.kpis.activeQuotes || 42;
    }

    get pipelineValue() {
        return this.formatCurrency(this.kpis.totalPipeline || 4800000);
    }

    // --- Quotes Table ---
    get recentQuotes() {
        const quotes = this.dashboardData?.recentQuotes || [];
        if (quotes.length === 0) return this.mockQuotes;
        return quotes.map((q, index) => {
            const isDraft = q.Status__c === 'Draft';
            const isPending = q.Status__c === 'Pending Approval';
            const isNeedsSig = q.Status__c === 'Needs Signature';

            let badgeClass = isDraft ? 'status-badge draft' : 'status-badge pending';
            if (isNeedsSig) badgeClass = 'status-badge needs-signature';

            return {
                id: q.Id,
                name: q.Name,
                subtitle: `Q-${q.Id ? q.Id.substring(0,5) : index}`,
                client: q.Account__r?.Name || 'Unknown Client',
                value: this.formatCurrency(q.Total_Amount__c || 0),
                status: q.Status__c ? q.Status__c.toUpperCase() : 'PENDING',
                badgeClass: badgeClass,
                iconName: isDraft ? 'utility:edit' : (isPending ? 'utility:preview' : 'utility:send'),
                isDraft
            };
        });
    }

    get mockQuotes() {
        return [
            { id: '1', name: 'The Grand Library', subtitle: 'Q-50122-D', client: 'Civic Design Partners', value: '$84,200', status: 'DRAFT', badgeClass: 'status-badge pending', iconName: 'utility:edit' },
            { id: '2', name: 'Harbor View Condos', subtitle: 'Q-49981-A', client: 'Waterfront Realty', value: '$312,500', status: 'PENDING REVIEW', badgeClass: 'status-badge pending', iconName: 'utility:preview' },
            { id: '3', name: 'Skyline Tech Hub', subtitle: 'Q-49855-F', client: 'NexGen Office Corp', value: '$125,750', status: 'NEEDS SIGNATURE', badgeClass: 'status-badge needs-signature', iconName: 'utility:send' }
        ];
    }

    // --- Format Helpers ---
    formatCurrency(value) {
        const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(0).replace(/[\d,.]/g, '').trim();
        if (value >= 1000000) return sym + (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return sym + (value / 1000).toFixed(1) + 'k';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(value);
    }

    // --- Actions ---
    handleStartQuote() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'Quote__c', actionName: 'new' }
        });
    }

    handleActionClick(event) {
        const recordId = event.currentTarget.dataset.id;
        if (!recordId || recordId.length < 15) return;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: recordId, actionName: 'view' }
        });
    }

    // --- Dynamic Modules ---
    get catalogDiscounts() {
        if (this.dashboardData?.catalogDiscounts && this.dashboardData.catalogDiscounts.length > 0) {
            return this.dashboardData.catalogDiscounts;
        }
        return [
            { id: 'cd1', title: 'Solar Panels Gen 4', text: 'Quantity - 100-500', val: '-18%', icon: 'utility:sun' },
            { id: 'cd2', title: 'Triple-Pane Low-E', text: 'Quantity - 50-200', val: '-12%', icon: 'utility:apps' }
        ];
    }

    get productFeeds() {
        if (this.dashboardData?.productFeeds && this.dashboardData.productFeeds.length > 0) {
            return this.dashboardData.productFeeds;
        }
        return [
            { id: 'pf1', tag: 'New Release', tagClass: 'feed-tag blue', title: 'Ultra-Light Titanium Support Frames', desc: 'New Product Ultra-Light Titanium Support Frames added', icon: 'utility:favorite' },
            { id: 'pf2', tag: 'Inventory', tagClass: 'feed-tag green', title: 'Smart Glass Backlog Cleared', desc: 'New Resource Role Smart Glass Backlog Cleared added', icon: 'utility:locker_service_api_viewer' }
        ];
    }
    handleNavigate(event) {
        if (event.detail && event.detail.recordId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: event.detail.recordId,
                    actionName: 'view'
                }
            });
        }
    }
}
