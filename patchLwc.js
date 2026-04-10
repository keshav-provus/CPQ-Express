const fs = require('fs');
let code = fs.readFileSync('force-app/main/default/lwc/cpqSalesRepDashboardApp/cpqSalesRepDashboardApp.js', 'utf8');

const jsAdditions = `
    // --- Dynamic Modules ---
    get catalogDiscounts() {
        if (this.dashboardData?.catalogDiscounts && this.dashboardData.catalogDiscounts.length > 0) {
            return this.dashboardData.catalogDiscounts;
        }
        return [
            { id: 'cd1', title: 'Solar Panels Gen 4', text: 'Discount 18% on 100-500 items of Solar Panels Gen 4', val: '-18%', icon: 'utility:sun' },
            { id: 'cd2', title: 'Triple-Pane Low-E', text: 'Discount 12% on 50-200 items of Triple-Pane Low-E', val: '-12%', icon: 'utility:apps' }
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
}
`;

code = code.replace(/}\s*$/, jsAdditions);
fs.writeFileSync('force-app/main/default/lwc/cpqSalesRepDashboardApp/cpqSalesRepDashboardApp.js', code);
console.log('JS Updated!');
