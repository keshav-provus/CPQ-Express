/**
 * @description Controller for Quote operations exposed to LWC.
 */
public with sharing class QuoteController {
    
    private static QuoteService service = new QuoteService();
    
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
}
