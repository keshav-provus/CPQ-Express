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
        Opportunity opp = [SELECT AccountId FROM Opportunity WHERE Id = :oppId LIMIT 1];
        
        Quote__c newQuote = new Quote__c();
        newQuote.Opportunity__c = oppId;
        newQuote.Account__c = opp.AccountId;
        newQuote.Status__c = 'Draft';
        
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
