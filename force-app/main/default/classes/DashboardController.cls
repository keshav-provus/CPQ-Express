/**
 * @description Controller for dashboard LWC components.
 */
public with sharing class DashboardController {

    private static DashboardService service = new DashboardService();

    /**
     * @description Returns quote counts by status for the current user.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getMyQuoteStats() {
        try {
            return service.getMyQuoteStats();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching quote stats: ' + e.getMessage());
        }
    }

    /**
     * @description Returns recent quotes for the current user.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote__c> getMyRecentQuotes() {
        try {
            return service.getMyRecentQuotes();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching recent quotes: ' + e.getMessage());
        }
    }

    /**
     * @description Returns recent activity items for the current user.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getMyRecentActivity() {
        try {
            return service.getMyRecentActivity();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching activity: ' + e.getMessage());
        }
    }

    /**
     * @description Returns pending action items for the current user.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote__c> getPendingActionItems() {
        try {
            return service.getPendingActionItems();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching action items: ' + e.getMessage());
        }
    }

    /**
     * @description Returns aggregate team-level quote stats.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Decimal> getTeamQuoteStats() {
        try {
            return service.getTeamQuoteStats();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching team stats: ' + e.getMessage());
        }
    }

    /**
     * @description Returns recent quotes across all users.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote__c> getTeamRecentQuotes() {
        try {
            return service.getTeamRecentQuotes();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching team quotes: ' + e.getMessage());
        }
    }

    /**
     * @description Returns quote counts grouped by status for charting.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getQuotesByStatus() {
        try {
            return service.getQuotesByStatus();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching chart data: ' + e.getMessage());
        }
    }

    /**
     * @description Returns top reps ranked by total quote value.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getTopReps() {
        try {
            return service.getTopReps();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching leaderboard: ' + e.getMessage());
        }
    }

    /**
     * @description Premium Dashboard: Returns Manager KPIs.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Decimal> getManagerKPIs() {
        try {
            return service.getManagerKPIs();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching Manager KPIs: ' + e.getMessage());
        }
    }

    /**
     * @description Premium Dashboard: Returns Weekly Pipeline chart data.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getWeeklyPipeline() {
        try {
            return service.getWeeklyPipeline();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching weekly pipeline: ' + e.getMessage());
        }
    }

    /**
     * @description Premium Dashboard: Returns Quote map marker data.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getQuoteMapLocations() {
        try {
            return service.getQuoteMapLocations();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching map markers: ' + e.getMessage());
        }
    }

    /**
     * @description Premium Dashboard: Returns the top selling products.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getTopProducts() {
        try {
            return service.getTopProducts();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching top products: ' + e.getMessage());
        }
    }

    /**
     * @description Premium Dashboard: Returns the top approved transactions.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote__c> getTopTransactions() {
        try {
            return service.getTopTransactions();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching top transactions: ' + e.getMessage());
        }
    }

    /**
     * @description Premium Dashboard: Returns quotes awaiting approval.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote__c> getQuotesNeedingApproval() {
        try {
            return service.getQuotesNeedingApproval();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching quotes needing approval: ' + e.getMessage());
        }
    }

    /**
     * @description Product Page: Returns occupancy timeline for a Resource Role.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getResourceUsageTimeline(String productId) {
        try {
            return service.getResourceUsageTimeline((Id) productId);
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching resource timeline: ' + e.getMessage());
        }
    }

    /**
     * @description Premium Dashboard: Returns a consolidated data package for performance.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getManagerDashboardPackage() {
        try {
            return service.getManagerDashboardPackage();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching dashboard package: ' + e.getMessage());
        }
    }
}
