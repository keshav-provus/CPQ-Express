/**
 * @description Service layer for dashboard data queries.
 *              Provides methods for both Sales Rep (personal) and Sales Manager (team) views.
 */
public with sharing class DashboardService {

    /**
     * @description Returns quote counts grouped by status for the current user.
     * @return Map of status label to count.
     */
    public Map<String, Integer> getMyQuoteStats() {
        Id currentUserId = UserInfo.getUserId();
        Map<String, Integer> stats = new Map<String, Integer>{
            'Draft' => 0,
            'Submitted' => 0,
            'Approved' => 0,
            'Rejected' => 0
        };

        List<AggregateResult> results = [
            SELECT Status__c status, COUNT(Id) cnt
            FROM Quote__c
            WHERE CreatedById = :currentUserId
            GROUP BY Status__c
        ];

        for (AggregateResult ar : results) {
            String status = (String) ar.get('status');
            Integer cnt = (Integer) ar.get('cnt');
            if (stats.containsKey(status)) {
                stats.put(status, cnt);
            }
        }
        return stats;
    }

    /**
     * @description Returns the 10 most recent quotes for the current user.
     * @return List of Quote__c records.
     */
    public List<Quote__c> getMyRecentQuotes() {
        Id currentUserId = UserInfo.getUserId();
        return [
            SELECT Id, Name, Account__c, Account__r.Name, Total_Amount__c,
                   Status__c, Margin_Percent__c, CreatedDate
            FROM Quote__c
            WHERE CreatedById = :currentUserId
            ORDER BY CreatedDate DESC
            LIMIT 10
        ];
    }

    /**
     * @description Returns recent quote activity items for the current user.
     *              Derives activity events from quote status and timestamps.
     * @return List of maps representing activity timeline items.
     */
    public List<Map<String, Object>> getMyRecentActivity() {
        Id currentUserId = UserInfo.getUserId();
        List<Map<String, Object>> activities = new List<Map<String, Object>>();

        List<Quote__c> recentQuotes = [
            SELECT Id, Name, Status__c, Account__r.Name, CreatedDate, LastModifiedDate
            FROM Quote__c
            WHERE CreatedById = :currentUserId
            ORDER BY LastModifiedDate DESC
            LIMIT 8
        ];

        for (Quote__c q : recentQuotes) {
            Map<String, Object> activity = new Map<String, Object>();
            activity.put('quoteId', q.Id);
            activity.put('quoteName', q.Name);
            activity.put('accountName', q.Account__r != null ? q.Account__r.Name : '');
            activity.put('status', q.Status__c);
            activity.put('timestamp', q.LastModifiedDate);

            if (q.Status__c == 'Approved') {
                activity.put('title', q.Name + ' Approved');
                activity.put('type', 'approved');
            } else if (q.Status__c == 'Submitted') {
                activity.put('title', 'Quote Submitted for Approval');
                activity.put('type', 'submitted');
            } else if (q.Status__c == 'Rejected') {
                activity.put('title', 'Revision Requested');
                activity.put('type', 'rejected');
            } else {
                activity.put('title', 'New Draft Created');
                activity.put('type', 'draft');
            }
            activities.add(activity);
        }
        return activities;
    }

    /**
     * @description Returns quotes needing action (non-Approved) for the current user.
     * @return List of Quote__c records with opportunity info.
     */
    public List<Quote__c> getPendingActionItems() {
        Id currentUserId = UserInfo.getUserId();
        return [
            SELECT Id, Name, Opportunity__c, Opportunity__r.Name,
                   Account__c, Account__r.Name, Total_Amount__c,
                   Status__c, Valid_Until__c, CreatedDate
            FROM Quote__c
            WHERE CreatedById = :currentUserId
              AND Status__c != 'Approved'
            ORDER BY CreatedDate DESC
            LIMIT 10
        ];
    }

    /**
     * @description Returns aggregate team-level stats across all quotes.
     * @return Map of metric name to value.
     */
    public Map<String, Decimal> getTeamQuoteStats() {
        Map<String, Decimal> stats = new Map<String, Decimal>();

        // Total pipeline value and count
        List<AggregateResult> pipeline = [
            SELECT COUNT(Id) cnt, SUM(Total_Amount__c) totalAmount, AVG(Margin_Percent__c) avgMargin
            FROM Quote__c
        ];
        if (!pipeline.isEmpty()) {
            AggregateResult ar = pipeline[0];
            stats.put('totalQuotes', ar.get('cnt') != null ? (Decimal) ar.get('cnt') : 0);
            stats.put('totalPipeline', ar.get('totalAmount') != null ? (Decimal) ar.get('totalAmount') : 0);
            stats.put('avgMargin', ar.get('avgMargin') != null ? (Decimal) ar.get('avgMargin') : 0);
        }

        // Pending approval count
        List<AggregateResult> pending = [
            SELECT COUNT(Id) cnt
            FROM Quote__c
            WHERE Status__c = 'Submitted'
        ];
        stats.put('pendingApproval', !pending.isEmpty() && pending[0].get('cnt') != null
            ? (Decimal) pending[0].get('cnt') : 0);

        // This month's quotes
        List<AggregateResult> thisMonth = [
            SELECT COUNT(Id) cnt
            FROM Quote__c
            WHERE CreatedDate = THIS_MONTH
        ];
        stats.put('thisMonthQuotes', !thisMonth.isEmpty() && thisMonth[0].get('cnt') != null
            ? (Decimal) thisMonth[0].get('cnt') : 0);

        return stats;
    }

    /**
     * @description Returns the 15 most recent quotes across all users.
     * @return List of Quote__c records with Creator info.
     */
    public List<Quote__c> getTeamRecentQuotes() {
        return [
            SELECT Id, Name, CreatedBy.Name, Account__c, Account__r.Name,
                   Total_Amount__c, Status__c, Margin_Percent__c, CreatedDate
            FROM Quote__c
            ORDER BY CreatedDate DESC
            LIMIT 15
        ];
    }

    /**
     * @description Returns quote counts grouped by status (for charts).
     * @return List of maps with 'status' and 'count' keys.
     */
    public List<Map<String, Object>> getQuotesByStatus() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        List<AggregateResult> groups = [
            SELECT Status__c status, COUNT(Id) cnt
            FROM Quote__c
            GROUP BY Status__c
            ORDER BY Status__c
        ];
        for (AggregateResult ar : groups) {
            result.add(new Map<String, Object>{
                'status' => (String) ar.get('status'),
                'count' => (Integer) ar.get('cnt')
            });
        }
        return result;
    }

    /**
     * @description Returns the top 5 reps ranked by total quote value.
     * @return List of maps with rep info and totals.
     */
    public List<Map<String, Object>> getTopReps() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        List<AggregateResult> reps = [
            SELECT CreatedById, CreatedBy.Name creatorName, COUNT(Id) cnt, SUM(Total_Amount__c) totalValue
            FROM Quote__c
            GROUP BY CreatedById, CreatedBy.Name
            ORDER BY SUM(Total_Amount__c) DESC NULLS LAST
            LIMIT 5
        ];
        for (AggregateResult ar : reps) {
            result.add(new Map<String, Object>{
                'ownerId' => (Id) ar.get('CreatedById'),
                'ownerName' => (String) ar.get('creatorName'),
                'quoteCount' => (Integer) ar.get('cnt'),
                'totalValue' => ar.get('totalValue') != null ? (Decimal) ar.get('totalValue') : 0
            });
        }
        return result;
    }

    /**
     * @description Premium Dashboard: Returns Manager KPIs: Total Pipeline (all Time), Active Quotes (Draft/Submitted), Approved Count, Catalog Size (Product count).
     * @return Map of metric values.
     */
    public Map<String, Decimal> getManagerKPIs() {
        Map<String, Decimal> kpis = new Map<String, Decimal>();

        // Total Pipeline & Pipeline Count
        AggregateResult[] pipeline = [SELECT SUM(Total_Amount__c) totalAmount FROM Quote__c];
        kpis.put('totalPipeline', !pipeline.isEmpty() && pipeline[0].get('totalAmount') != null ? (Decimal) pipeline[0].get('totalAmount') : 0);

        // Active Quotes (Draft or Submitted)
        AggregateResult[] active = [SELECT COUNT(Id) cnt FROM Quote__c WHERE Status__c IN ('Draft', 'Submitted')];
        kpis.put('activeQuotes', !active.isEmpty() && active[0].get('cnt') != null ? (Decimal) active[0].get('cnt') : 0);

        // Approved Transactions
        AggregateResult[] approved = [SELECT COUNT(Id) cnt FROM Quote__c WHERE Status__c = 'Approved'];
        kpis.put('approvedCount', !approved.isEmpty() && approved[0].get('cnt') != null ? (Decimal) approved[0].get('cnt') : 0);

        // Catalog Size (Products)
        AggregateResult[] products = [SELECT COUNT(Id) cnt FROM Product__c WHERE Active__c = true];
        kpis.put('totalProducts', !products.isEmpty() && products[0].get('cnt') != null ? (Decimal) products[0].get('cnt') : 0);

        return kpis;
    }

    /**
     * @description Premium Dashboard: Returns Quote pipeline generated per day for the last 7 days.
     * @return List of map containing date label and amount.
     */
    public List<Map<String, Object>> getWeeklyPipeline() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        DateTime sevenDaysAgo = System.now().addDays(-7);
        
        List<AggregateResult> pipeline = [
            SELECT DAY_ONLY(CreatedDate) dt, SUM(Total_Amount__c) val
            FROM Quote__c
            WHERE CreatedDate >= :sevenDaysAgo
            GROUP BY DAY_ONLY(CreatedDate)
            ORDER BY DAY_ONLY(CreatedDate) ASC
        ];
        
        for (AggregateResult ar : pipeline) {
            result.add(new Map<String, Object>{
                'date' => String.valueOf((Date) ar.get('dt')),
                'amount' => ar.get('val') != null ? (Decimal) ar.get('val') : 0
            });
        }
        return result;
    }

    /**
     * @description Premium Dashboard: Returns Lightning Map marker data based on Opportunity Account addresses.
     * @return List of maps for lightning-map component.
     */
    public List<Map<String, Object>> getQuoteMapLocations() {
        List<Map<String, Object>> markers = new List<Map<String, Object>>();
        // Get recent quotes associated with an Account that has billing city/country
        List<Quote__c> quotesWithLoc = [
            SELECT Id, Name, Account__c, Account__r.Name, Account__r.BillingCity, Account__r.BillingCountry, Total_Amount__c
            FROM Quote__c
            WHERE Account__r.BillingCity != null OR Account__r.BillingCountry != null
            ORDER BY CreatedDate DESC
            LIMIT 50
        ];
        
        for (Quote__c q : quotesWithLoc) {
            Map<String, Object> marker = new Map<String, Object>();
            marker.put('value', q.Id);
            marker.put('title', q.Name + ' (' + q.Account__r.Name + ')');
            marker.put('description', 'Value: $' + q.Total_Amount__c);
            
            Map<String, String> location = new Map<String, String>();
            if (String.isNotBlank(q.Account__r.BillingCity)) {
                location.put('City', q.Account__r.BillingCity);
            }
            if (String.isNotBlank(q.Account__r.BillingCountry)) {
                location.put('Country', q.Account__r.BillingCountry);
            }
            marker.put('location', location);
            
            markers.add(marker);
        }
        return markers;
    }

    /**
     * @description Premium Dashboard: Returns Lightning Map marker data aggregated by country.
     * @return List of maps for lightning-map component.
     */
    public List<Map<String, Object>> getQuoteMapLocationsByCountry() {
        List<Map<String, Object>> markers = new List<Map<String, Object>>();

        List<AggregateResult> results = [
            SELECT Account__r.BillingCountry country, COUNT(Id) quoteCount, SUM(Total_Amount__c) totalRevenue
            FROM Quote__c
            WHERE Status__c = 'Approved' AND Account__r.BillingCountry != null
            GROUP BY Account__r.BillingCountry
        ];

        for (AggregateResult ar : results) {
            String country = (String) ar.get('country');
            Integer count = (Integer) ar.get('quoteCount');
            Decimal totalRevenue = (Decimal) ar.get('totalRevenue');
            if (totalRevenue != null) {
                totalRevenue = totalRevenue.setScale(2);
            } else {
                totalRevenue = 0.00;
            }

            Map<String, Object> marker = new Map<String, Object>();
            marker.put('value', country);
            marker.put('title', country);
            marker.put('description', 'Quotes: ' + count + ', Revenue: $' + totalRevenue);

            Map<String, String> location = new Map<String, String>();
            location.put('Country', country);
            marker.put('location', location);

            markers.add(marker);
        }
        return markers;
    }

    /**
     * @description Premium Dashboard: Returns the top 3 selling products based on Quote Line Items.
     * @return List of map containing Product info.
     */
    public List<Map<String, Object>> getTopProducts() {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        List<AggregateResult> topSelling = [
            SELECT Product__c, Product__r.Name prodName, SUM(Quantity__c) qtySold
            FROM Quote_Line_Item__c
            GROUP BY Product__c, Product__r.Name
            ORDER BY SUM(Quantity__c) DESC NULLS LAST
            LIMIT 3
        ];
        
        for (AggregateResult ar : topSelling) {
            result.add(new Map<String, Object>{
                'productId' => (Id) ar.get('Product__c'),
                'productName' => (String) ar.get('prodName'),
                'quantitySold' => (Decimal) ar.get('qtySold')
            });
        }
        return result;
    }

    /**
     * @description Premium Dashboard: Returns top 4 transactions (Quotes).
     * @return List of Quote__c records.
     */
    public List<Quote__c> getTopTransactions() {
        return [
            SELECT Id, Name, Account__r.Name, Total_Amount__c, CreatedDate
            FROM Quote__c
            WHERE Status__c = 'Approved'
            ORDER BY Total_Amount__c DESC
            LIMIT 4
        ];
    }

    /**
     * @description Premium Dashboard: Returns quotes awaiting approval.
     * @return List of Quote__c records.
     */
    public List<Quote__c> getQuotesNeedingApproval() {
        return [
            SELECT Id, Name, Account__r.Name, Total_Amount__c, CreatedDate, Status__c
            FROM Quote__c
            WHERE Status__c = 'Submitted'
            ORDER BY CreatedDate ASC
            LIMIT 10
        ];
    }

    /**
     * @description Product Page: Returns occupancy timeline for a Resource Role product.
     * @param productId The ID of the Product__c (Resource Role).
     * @return List of map containing quote and duration info.
     */
    public List<Map<String, Object>> getResourceUsageTimeline(Id productId) {
        List<Map<String, Object>> timeline = new List<Map<String, Object>>();
        
        List<Quote_Line_Item__c> items = [
            SELECT Id, Quote__c, Quote__r.Name, Quote__r.Account__r.Name, 
                   Quote__r.Start_Date__c, Quote__r.End_Date__c, Quote__r.Status__c,
                   Quantity__c
            FROM Quote_Line_Item__c
            WHERE Product__c = :productId
              AND Quote__r.Status__c = 'Approved'
              AND Quote__r.Start_Date__c != null
              AND Quote__r.End_Date__c != null
            ORDER BY Quote__r.Start_Date__c ASC
        ];
        
        for (Quote_Line_Item__c item : items) {
            Map<String, Object> entry = new Map<String, Object>();
            entry.put('id', item.Id);
            entry.put('quoteId', item.Quote__c);
            entry.put('quoteName', item.Quote__r.Name);
            entry.put('accountName', item.Quote__r.Account__r.Name);
            entry.put('startDate', item.Quote__r.Start_Date__c);
            entry.put('endDate', item.Quote__r.End_Date__c);
            entry.put('quantity', item.Quantity__c);
            entry.put('type', 'Occupied'); 
            timeline.add(entry);
        }
        
        return timeline;
    }

    /**
     * @description Returns a consolidated data package for the Manager Dashboard.
     *              Optimized for performance by reducing multiple round-trips.
     * @return Map containing KPIs, Status Counts, Weekly Pipeline, Top Reps, and Recent Quotes.
     */
    public Map<String, Object> getManagerDashboardPackage() {
        return new Map<String, Object>{
            'kpis' => getManagerKPIs(),
            'quotesByStatus' => getQuotesByStatus(),
            'weeklyPipeline' => getWeeklyPipeline(),
            'topReps' => getTopReps(),
            'recentQuotes' => getTeamRecentQuotes()
        };
    }
}
