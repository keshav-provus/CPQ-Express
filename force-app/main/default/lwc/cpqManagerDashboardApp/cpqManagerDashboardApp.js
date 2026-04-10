import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getManagerDashboardPackage from '@salesforce/apex/DashboardController.getManagerDashboardPackage';
import getUserContext from '@salesforce/apex/AgentforceController.getUserContext';

export default class CpqManagerDashboardApp extends NavigationMixin(LightningElement) {
    @track dashboardData = {};
    @track userContext = {};
    @track isLoading = true;

    @wire(getUserContext)
    wiredContext({ data }) {
        if (data) this.userContext = data;
    }

    @wire(getManagerDashboardPackage)
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
        return this.userContext?.userName || 'Manager';
    }

    get kpiData() {
        return this.dashboardData?.kpis || {};
    }

    get topReps() {
        return this.dashboardData?.topReps || [];
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