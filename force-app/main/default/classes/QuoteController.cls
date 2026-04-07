/**
 * @description Controller for Quote operations exposed to LWC.
 */
public with sharing class QuoteController {
    
    private static QuoteService service = new QuoteService();
    private static QuoteLineItemService qliService = new QuoteLineItemService();
    
    /**
     * @description Creates a new Quote record via Apex and returns the ID.
     * @param oppId The Opportunity to link the quote to.
     * @return Id of the new Quote record.
     */
    @AuraEnabled
    public static String createQuoteRecord(Id oppId) {
        try {
            return service.createQuoteForOpportunity(oppId);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating Quote Record: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches single quote by ID with all necessary fields for the new UI.
     * @param recordId Quote__c ID.
     * @return Quote__c record.
     */
    @AuraEnabled(cacheable=true)
    public static Quote__c getQuoteById(Id recordId) {
        try {
            return [
                SELECT Id, Name, Status__c, Opportunity__c, Opportunity__r.Name,
                       Account__c, Account__r.Name, CreatedById, CreatedBy.Name,
                       LastModifiedById, LastModifiedBy.Name, CreatedDate, LastModifiedDate,
                       Total_Amount__c, Total_Cost__c, Margin_Percent__c, Margin_Amount__c,
                       Start_Date__c, End_Date__c, Valid_Until__c, Phase_List__c,
                       Time_Period_Metric__c, Time_Period_Count__c
                FROM Quote__c
                WHERE Id = :recordId
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching quote: ' + e.getMessage());
        }
    }

    /**
     * @description Updates quote record.
     * @param quote Quote__c record to update.
     */
    @AuraEnabled
    public static void updateQuoteRecord(Quote__c quote) {
        try {
            update quote;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating quote: ' + e.getMessage());
        }
    }

    /**
     * @description Creates Quote Line Items from selected products.
     *              Accepts a JSON array with per-product quantity and discount.
     * @param quoteId The Quote to add line items to.
     * @param lineItemsJson JSON array of objects: [{productId, quantity, discountPercent}].
     * @return List of IDs of newly created Quote Line Items.
     */
    @AuraEnabled
    public static List<Id> addLineItemsFromProducts(Id quoteId, String lineItemsJson) {
        try {
            List<Id> ids = qliService.addLineItemsFromProducts(quoteId, lineItemsJson);
            recalculateQuoteTotals(quoteId);
            return ids;
        } catch (Exception e) {
            throw new AuraHandledException('Error adding line items: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches all line items for the given Quote.
     * @param quoteId Quote ID.
     * @return List of Quote_Line_Item__c records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote_Line_Item__c> getQuoteLines(Id quoteId) {
        try {
            return qliService.getQuoteLines(quoteId);
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching quote lines: ' + e.getMessage());
        }
    }

    /**
     * @description Updates quote line items (quantity, discount).
     * @param lineItemsJson JSON representing updates.
     */
    @AuraEnabled
    public static void updateQuoteLines(String lineItemsJson) {
        try {
            qliService.updateQuoteLines(lineItemsJson);
            // We need the quoteId to recalculate.
            // The JSON might not have it, so we might need to fetch it from one of the QLIs.
            List<QuoteLineItemService.LineItemUpdate> updates = (List<QuoteLineItemService.LineItemUpdate>) JSON.deserialize(
                lineItemsJson, List<QuoteLineItemService.LineItemUpdate>.class
            );
            if (!updates.isEmpty()) {
                Quote_Line_Item__c qli = [SELECT Quote__c FROM Quote_Line_Item__c WHERE Id = :updates[0].lineItemId LIMIT 1];
                recalculateQuoteTotals(qli.Quote__c);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error updating quote lines: ' + e.getMessage());
        }
    }

    /**
     * @description Deletes a quote line item.
     * @param qliId ID of the line item to delete.
     */
    @AuraEnabled
    public static void deleteQuoteLine(Id qliId) {
        try {
            Quote_Line_Item__c qli = [SELECT Quote__c FROM Quote_Line_Item__c WHERE Id = :qliId LIMIT 1];
            Id quoteId = qli.Quote__c;
            qliService.deleteQuoteLine(qliId);
            recalculateQuoteTotals(quoteId);
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting quote line: ' + e.getMessage());
        }
    }

    /**
     * @description Submits a Quote via Apex.
     * @param quoteId Quote ID.
     */
    @AuraEnabled
    public static void submitQuote(Id quoteId) {
        try {
            service.submitQuote(quoteId);
        } catch (Exception e) {
            throw new AuraHandledException('Error submitting quote: ' + e.getMessage());
        }
    }

    /**
     * @description Recalculates quote totals (Margin Amount, Margin Percent, End Date).
     * @param quoteId Quote ID.
     */
    @AuraEnabled
    public static void recalculateQuoteTotals(Id quoteId) {
        try {
            List<Quote_Line_Item__c> qlis = [
                SELECT Net_Total__c, Total_Line_Cost__c, Quantity__c, End_Date__c
                FROM Quote_Line_Item__c
                WHERE Quote__c = :quoteId
            ];

            Decimal revenue = 0;
            Decimal totalCost = 0;
            Date maxEnd = null;

            for(Quote_Line_Item__c item : qlis) {
                if(item.Net_Total__c != null) revenue += item.Net_Total__c;
                if(item.Total_Line_Cost__c != null) totalCost += item.Total_Line_Cost__c;
                if(item.End_Date__c != null) {
                    if(maxEnd == null || item.End_Date__c > maxEnd) maxEnd = item.End_Date__c;
                }
            }

            Quote__c q = [SELECT Id, End_Date__c FROM Quote__c WHERE Id = :quoteId LIMIT 1];

            q.Margin_Amount__c = revenue - totalCost;
            q.Margin_Percent__c = (revenue > 0) ? (q.Margin_Amount__c / revenue) * 100 : 0;

            if (maxEnd != null && (q.End_Date__c == null || maxEnd > q.End_Date__c)) {
                q.End_Date__c = maxEnd;
            }

            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Error recalculating quote: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches all available Resource Roles.
     * @return List of Resource_Role__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Resource_Role__c> getResourceRoles() {
        return [SELECT Id, Name, Name__c, Cost__c, Price__c, Billing_Unit__c FROM Resource_Role__c WHERE Is_Active__c = true];
    }

    /**
     * @description Fetches all available Add-ons.
     * @return List of Add_On__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Add_On__c> getAddOns() {
        return [SELECT Id, Name, Name__c, Cost__c, Price__c, Billing_Unit__c FROM Add_On__c WHERE Is_Active__c = true];
    }

    /**
     * @description Fetches all available Products.
     * @return List of Product__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Product__c> getProducts() {
        return [SELECT Id, Name, Product_Code__c, Product_Type__c, Price__c, Cost__c FROM Product__c];
    }
}
