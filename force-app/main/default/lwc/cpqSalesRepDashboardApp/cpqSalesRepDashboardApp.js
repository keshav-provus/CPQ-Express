import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getSalesRepDashboardPackage from '@salesforce/apex/DashboardController.getSalesRepDashboardPackage';
import getUserContext from '@salesforce/apex/AgentforceController.getUserContext';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqSalesRepDashboardApp extends NavigationMixin(LightningElement) {
    connectedCallback() {
        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @track dashboardData = {};
    @track userContext = {};
    @track isLoading = true;
    @track currencyCode = 'USD';

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
        // Calculate quota as pipeline value (total of all quotes)
        const pipeline = this.kpis.totalPipeline || 0;
        return pipeline > 0 ? this.formatCurrency(pipeline) : this.formatCurrency(0);
    }
    
    get quotaPercentage() {
        const rev = this.kpis.totalRevenue || 0;
        const pipeline = this.kpis.totalPipeline || 0;
        if (pipeline <= 0) return 0;
        return Math.min(Math.round((rev / pipeline) * 100), 100);
    }

    get quotaBarStyle() {
        return `width: ${this.quotaPercentage}%`;
    }

    get pendingApprovalsCount() {
        const count = this.pendingItems.length;
        if (count === 0) return '0';
        return count < 10 ? '0' + count : String(count);
    }

    get activeQuotesCount() {
        return this.kpis.activeQuotes || 0;
    }

    get pipelineValue() {
        return this.formatCurrency(this.kpis.totalPipeline || 0);
    }

    // --- Quotes Table ---
    get recentQuotes() {
        const quotes = this.dashboardData?.recentQuotes || [];
        return quotes.map((q) => {
            const isDraft = q.Status__c === 'Draft';
            const isPending = q.Status__c === 'Pending Approval';
            const isNeedsSig = q.Status__c === 'Needs Signature';

            let badgeClass = isDraft ? 'status-badge draft' : 'status-badge pending';
            if (isNeedsSig) badgeClass = 'status-badge needs-signature';

            return {
                id: q.Id,
                name: q.Name,
                subtitle: q.Name,
                client: q.Account__r?.Name || 'Unknown Client',
                value: this.formatCurrency(q.Total_Amount__c || 0),
                status: q.Status__c ? q.Status__c.toUpperCase() : 'DRAFT',
                badgeClass: badgeClass,
                iconName: isDraft ? 'utility:edit' : (isPending ? 'utility:preview' : 'utility:send'),
                isDraft
            };
        });
    }

    get hasRecentQuotes() {
        return this.recentQuotes.length > 0;
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
        return this.dashboardData?.catalogDiscounts || [];
    }

    get hasCatalogDiscounts() {
        return this.catalogDiscounts.length > 0;
    }

    get productFeeds() {
        return this.dashboardData?.productFeeds || [];
    }

    get hasProductFeeds() {
        return this.productFeeds.length > 0;
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
