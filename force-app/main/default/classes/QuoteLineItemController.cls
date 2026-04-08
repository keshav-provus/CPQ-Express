public with sharing class QuoteLineItemController {

    /**
     * @description Fetches all line items for a quote with full details for the new UI.
     * @param quoteId Quote__c ID.
     * @return List of Quote_Line_Item__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote_Line_Item__c> getLineItems(Id quoteId) {
        return [
            SELECT Id, Name, Name__c, Item_Type__c,
                   Resource_Role__c, Resource_Role__r.Name, Resource_Role__r.Name__c,
                   Product__c, Product__r.Name, Product__r.Product_Code__c,
                   Add_On__c, Add_On__r.Name, Add_On__r.Name__c,
                   Phase__c, Task__c,
                   Start_Date__c, End_Date__c,
                   Quantity__c, Base_Rate__c,
                   Unit_Price__c, Discount_Percent__c,
                   Net_Total__c, Total_Line_Cost__c, Margin_Percent__c
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            ORDER BY CreatedDate ASC
        ];
    }

    /**
     * @description Get empty phases stored on the Quote.
     * @param quoteId Quote__c ID.
     * @return Phase List string.
     */
    @AuraEnabled(cacheable=true)
    public static String getPhaseList(Id quoteId) {
        Quote__c q = [SELECT Phase_List__c FROM Quote__c WHERE Id = :quoteId LIMIT 1];
        return q.Phase_List__c;
    }

    private static void checkQuoteDraftStatus(Id quoteId) {
        Quote__c q = [SELECT Status__c FROM Quote__c WHERE Id = :quoteId LIMIT 1];
        if (q.Status__c != 'Draft') {
            throw new AuraHandledException('Quote cannot be modified because it is not in Draft status.');
        }
    }

    /**
     * @description Save empty phases back to the Quote.
     * @param quoteId Quote__c ID.
     * @param phaseList Phase List string.
     */
    @AuraEnabled
    public static void savePhaseList(Id quoteId, String phaseList) {
        checkQuoteDraftStatus(quoteId);
        Quote__c q = new Quote__c(Id = quoteId);
        q.Phase_List__c = phaseList;
        update q;
    }

    /**
     * @description Add line items from modal selection.
     * @param quoteId Quote__c ID.
     * @param resourceRoleIds List of Resource_Role__c IDs.
     * @param productIds List of Product__c IDs.
     * @param addonIds List of Add_On__c IDs.
     * @param phase Optional phase name for the items.
     */
    @AuraEnabled
    public static void addLineItems(
            Id quoteId,
            List<Id> resourceRoleIds,
            List<Id> productIds,
            List<Id> addonIds,
            String phase) {

        Quote__c parentQuote = [
            SELECT Start_Date__c, End_Date__c, Time_Period_Metric__c, Time_Period_Count__c
            FROM Quote__c
            WHERE Id = :quoteId
            LIMIT 1
        ];

        List<Quote_Line_Item__c> itemsToInsert = new List<Quote_Line_Item__c>();

        // Add Resource Roles
        if (resourceRoleIds != null && !resourceRoleIds.isEmpty()) {
            List<Resource_Role__c> roles = [
                SELECT Id, Name, Name__c, Price__c, Cost__c, Billing_Unit__c
                FROM Resource_Role__c
                WHERE Id IN :resourceRoleIds
            ];

            for (Resource_Role__c role : roles) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Item_Type__c        = 'Resource Role';
                item.Resource_Role__c    = role.Id;
                item.Base_Rate__c        = role.Price__c;
                item.Unit_Price__c       = role.Price__c;
                item.Unit_Cost__c        = role.Cost__c;
                item.Quantity__c         = 1;
                item.Discount_Percent__c = 0;
                item.Name__c             = role.Name__c != null ? role.Name__c : role.Name;
                if (String.isNotBlank(phase)) item.Phase__c = phase;
                populateDates(item, parentQuote);
                itemsToInsert.add(item);
            }
        }

        // Add Products
        if (productIds != null && !productIds.isEmpty()) {
            List<Product__c> products = [
                SELECT Id, Name, Price__c, Cost__c
                FROM Product__c
                WHERE Id IN :productIds
            ];

            for (Product__c product : products) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Item_Type__c        = 'Product';
                item.Product__c          = product.Id;
                item.Base_Rate__c        = product.Price__c;
                item.Unit_Price__c       = product.Price__c;
                item.Unit_Cost__c        = product.Cost__c;
                item.Quantity__c         = 1;
                item.Discount_Percent__c = 0;
                item.Name__c             = product.Name;
                if (String.isNotBlank(phase)) item.Phase__c = phase;
                populateDates(item, parentQuote);
                itemsToInsert.add(item);
            }
        }

        // Add Add-ons
        if (addonIds != null && !addonIds.isEmpty()) {
            List<Add_On__c> addons = [
                SELECT Id, Name, Name__c, Price__c, Cost__c
                FROM Add_On__c
                WHERE Id IN :addonIds
            ];

            for (Add_On__c addon : addons) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Item_Type__c        = 'Add-on';
                item.Add_On__c           = addon.Id;
                item.Base_Rate__c        = addon.Price__c;
                item.Unit_Price__c       = addon.Price__c;
                item.Unit_Cost__c        = addon.Cost__c;
                item.Quantity__c         = 1;
                item.Discount_Percent__c = 0;
                item.Name__c             = addon.Name__c != null ? addon.Name__c : addon.Name;
                if (String.isNotBlank(phase)) item.Phase__c = phase;
                populateDates(item, parentQuote);
                itemsToInsert.add(item);
            }
        }

        if (!itemsToInsert.isEmpty()) {
            insert itemsToInsert;
            QuoteController.recalculateQuoteTotals(quoteId);
        }
    }

    /**
     * @description Update a single line item.
     * @param item Quote_Line_Item__c record.
     */
    @AuraEnabled
    public static void updateLineItem(Quote_Line_Item__c item) {
        Quote_Line_Item__c existing = [
            SELECT Quantity__c, Start_Date__c, End_Date__c, Quote__c,
                   Quote__r.Start_Date__c, Quote__r.End_Date__c, Quote__r.Time_Period_Metric__c
            FROM Quote_Line_Item__c
            WHERE Id = :item.Id
            LIMIT 1
        ];

        checkQuoteDraftStatus(existing.Quote__c);

        if (existing.Quote__r.Time_Period_Metric__c != null) {
            Boolean hasChange = (item.Quantity__c != null || item.Start_Date__c != null);
            if (hasChange) {
                Decimal qty = item.Quantity__c != null ? item.Quantity__c : existing.Quantity__c;
                Date start = item.Start_Date__c != null ? item.Start_Date__c : existing.Start_Date__c;
                item.End_Date__c = calculateEndDate(start, qty, existing.Quote__r.Time_Period_Metric__c);
            }
        }

        update item;
        QuoteController.recalculateQuoteTotals(existing.Quote__c);
    }

    private static void populateDates(Quote_Line_Item__c item, Quote__c parentQuote) {
        if (parentQuote.Start_Date__c != null) {
            item.Start_Date__c = parentQuote.Start_Date__c;
            if (parentQuote.Time_Period_Metric__c != null) {
                item.End_Date__c = calculateEndDate(parentQuote.Start_Date__c, item.Quantity__c, parentQuote.Time_Period_Metric__c);
            } else if (parentQuote.End_Date__c != null) {
                item.End_Date__c = parentQuote.End_Date__c;
            }
        }
    }

    private static Date calculateEndDate(Date startDate, Decimal quantity, String timePeriod) {
        if (startDate == null || quantity == null || String.isBlank(timePeriod)) return null;
        if (timePeriod == 'Days') return startDate.addDays((Integer)Math.round(quantity));
        if (timePeriod == 'Weeks') return startDate.addDays((Integer)Math.round(quantity * 7));
        if (timePeriod == 'Months' || timePeriod == 'Quarters' || timePeriod == 'Years') {
            Decimal totalMonths = (timePeriod == 'Months') ? quantity : (timePeriod == 'Quarters') ? quantity * 3 : quantity * 12;
            Integer wholeMonths = (Integer)Math.floor(totalMonths);
            Decimal fraction = totalMonths - wholeMonths;
            Date d = startDate.addMonths(wholeMonths);
            if (fraction > 0) d = d.addDays((Integer)Math.round(fraction * 30));
            return d;
        }
        return null;
    }

    /**
     * @description Delete a single line item.
     * @param itemId Quote_Line_Item__c ID.
     */
    @AuraEnabled
    public static void deleteLineItem(Id itemId) {
        Quote_Line_Item__c item = [SELECT Quote__c FROM Quote_Line_Item__c WHERE Id = :itemId LIMIT 1];
        Id quoteId = item.Quote__c;
        checkQuoteDraftStatus(quoteId);
        delete item;
        QuoteController.recalculateQuoteTotals(quoteId);
    }

    /**
     * @description Cascade delete all line items for a given phase and quote.
     * @param quoteId Quote__c ID.
     * @param phaseName Name of the phase.
     */
    @AuraEnabled
    public static void deletePhaseItems(Id quoteId, String phaseName) {
        checkQuoteDraftStatus(quoteId);
        List<Quote_Line_Item__c> items = [
            SELECT Id FROM Quote_Line_Item__c 
            WHERE Quote__c = :quoteId AND Phase__c = :phaseName
        ];
        if (!items.isEmpty()) {
            delete items;
            QuoteController.recalculateQuoteTotals(quoteId);
        }
    }

    /**
     * @description Get line items grouped by type for summary cards.
     * @param quoteId Quote__c ID.
     * @return Summary map.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getLineItemSummary(Id quoteId) {
        AggregateResult[] results = [
            SELECT Item_Type__c type,
                   SUM(Net_Total__c) totalRevenue,
                   SUM(Total_Line_Cost__c) totalCost,
                   COUNT(Id) itemCount
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            GROUP BY Item_Type__c
        ];

        Map<String, Object> summary = new Map<String, Object>();
        Decimal grandTotal = 0;

        for (AggregateResult r : results) {
            Decimal rev = (Decimal) r.get('totalRevenue');
            if (rev != null) grandTotal += rev;
        }

        for (AggregateResult r : results) {
            String type = (String) r.get('type');
            Decimal revenue = (Decimal) r.get('totalRevenue') != null ? (Decimal) r.get('totalRevenue') : 0;
            Decimal cost = (Decimal) r.get('totalCost') != null ? (Decimal) r.get('totalCost') : 0;
            Decimal margin = revenue - cost;
            Integer count = (Integer) r.get('itemCount');
            Decimal percentage = grandTotal > 0 ? (revenue / grandTotal * 100).setScale(1) : 0;

            summary.put(type, new Map<String, Object>{
                'revenue'    => revenue,
                'cost'       => cost,
                'margin'     => margin,
                'count'      => count,
                'percentage' => percentage
            });
        }

        List<Quote_Line_Item__c> items = [SELECT Unit_Price__c, Quantity__c FROM Quote_Line_Item__c WHERE Quote__c = :quoteId];
        Decimal subtotal = 0;
        for (Quote_Line_Item__c item : items) {
            if (item.Unit_Price__c != null && item.Quantity__c != null) subtotal += (item.Unit_Price__c * item.Quantity__c);
        }

        summary.put('grandTotal', grandTotal);
        summary.put('subtotal', subtotal);
        return summary;
    }

    /**
     * @description Get line items grouped by phase for phase table.
     * @param quoteId Quote__c ID.
     * @return List of phase data maps.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getLineItemsByPhase(Id quoteId) {
        AggregateResult[] results = [
            SELECT Phase__c phase,
                   Item_Type__c type,
                   SUM(Net_Total__c) totalPrice,
                   COUNT(Id) itemCount
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            GROUP BY Phase__c, Item_Type__c
            ORDER BY Phase__c
        ];

        Map<String, Map<String, Object>> phaseMap = new Map<String, Map<String, Object>>();

        for (AggregateResult r : results) {
            String  phase = (String)  r.get('phase');
            String  type  = (String)  r.get('type');
            Decimal price = (Decimal) r.get('totalPrice');
            Integer count = (Integer) r.get('itemCount');

            if (phase == null) phase = 'Default';
            if (price == null) price = 0;

            if (!phaseMap.containsKey(phase)) {
                phaseMap.put(phase, new Map<String, Object>{
                    'phase'    => phase,
                    'labor'    => 0,
                    'products' => 0,
                    'addons'   => 0,
                    'total'    => 0,
                    'items'    => 0
                });
            }

            Map<String, Object> phaseData = phaseMap.get(phase);
            Decimal currentTotal = (Decimal) phaseData.get('total');
            Integer currentItems = (Integer) phaseData.get('items');

            if (type == 'Resource Role') phaseData.put('labor', (Decimal)phaseData.get('labor') + price);
            else if (type == 'Product') phaseData.put('products', (Decimal)phaseData.get('products') + price);
            else if (type == 'Add-on') phaseData.put('addons', (Decimal)phaseData.get('addons') + price);

            phaseData.put('total', currentTotal + price);
            phaseData.put('items', currentItems + count);
        }

        return phaseMap.values();
    }
}
