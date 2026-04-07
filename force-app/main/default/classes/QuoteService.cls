/**
 * @description Service layer for Quote-related business logic.
 */
public with sharing class QuoteService {
    
    /**
     * @description Creates a New Quote record for the specified Opportunity.
     * @param oppId The ID of the Opportunity.
     * @return Resulting Quote ID.
     */
    public Id createQuoteForOpportunity(Id oppId) {
        if (oppId == null) {
            throw new IllegalArgumentException('Opportunity ID cannot be null');
        }
        
        Quote__c newQuote = new Quote__c();
        newQuote.Opportunity__c = oppId;
        newQuote.Status__c = 'Draft';
        
        // You could add logic here to fetch and set more fields from the Opportunity if needed (e.g., Account lookup)
        
        return QuoteDAO.insertQuote(newQuote);
    }

    /**
     * @description Submits a Quote by updating its status to 'Submitted'.
     * @param quoteId The ID of the Quote to submit.
     */
    public void submitQuote(Id quoteId) {
        if (quoteId == null) return;
        
        Quote__c quote = new Quote__c(
            Id = quoteId,
            Status__c = 'Submitted'
        );
        QuoteDAO.updateQuote(quote);
    }
}
