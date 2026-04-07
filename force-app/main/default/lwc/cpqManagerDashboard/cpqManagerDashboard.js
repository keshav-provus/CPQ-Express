import { LightningElement, wire, track } from 'lwc';
import getManagerDashboardPackage from '@salesforce/apex/DashboardController.getManagerDashboardPackage';
import { refreshApex } from '@salesforce/apex';

export default class CpqManagerDashboard extends LightningElement {
    @track dashboardData = {};
    @track isLoading = true;
    @track isReady = false;
    wiredDashboardResult;

    @wire(getManagerDashboardPackage)
    wiredPackage(result) {
        this.wiredDashboardResult = result;
        const { data, error } = result;
        if (data) {
            this.dashboardData = data;
            this.isLoading = false;
            // Delay rendering of heavy components slightly for "snap" feel
            setTimeout(() => {
                this.isReady = true;
            }, 100);
        } else if (error) {
            console.error('Error loading dashboard package:', error);
            this.isLoading = false;
        }
    }

    handleRefresh() {
        this.isLoading = true;
        this.isReady = false;
        return refreshApex(this.wiredDashboardResult);
    }
}