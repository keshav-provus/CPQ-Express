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
     * @description Creates Quote Line Items from selected products.
     *              Accepts a JSON array with per-product quantity and discount.
     * @param quoteId The Quote to add line items to.
     * @param lineItemsJson JSON array of objects: [{productId, quantity, discountPercent}].
     * @return List of IDs of newly created Quote Line Items.
     */
    @AuraEnabled
    public static List<Id> addLineItemsFromProducts(Id quoteId, String lineItemsJson) {
        try {
            return qliService.addLineItemsFromProducts(quoteId, lineItemsJson);
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
            qliService.deleteQuoteLine(qliId);
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
}
