import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getSalesRepDashboardPackage from '@salesforce/apex/DashboardController.getSalesRepDashboardPackage';
import getUserContext from '@salesforce/apex/AgentforceController.getUserContext';

export default class CpqSalesRepDashboardApp extends NavigationMixin(LightningElement) {
    @track dashboardData = {};
    @track userContext = {};
    @track isLoading = true;

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

    get kpiData() {
        return this.dashboardData?.kpis || {};
    }

    handleStartQuote() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Opportunity',
                actionName: 'list'
            }
        });
    }
}