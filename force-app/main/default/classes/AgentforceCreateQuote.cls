public with sharing class AgentforceCreateQuote {
    
    public class QuoteInput {
        @InvocableVariable(label='Account ID' required=true description='The ID of the Account. Ask the user for the Account name if not provided.')
        public Id accountId;
        
        @InvocableVariable(label='Opportunity ID' description='The ID of the Opportunity, if applicable.')
        public Id opportunityId;
    }

    @InvocableMethod(label='Create New CPQ Quote' description='Use this action when the user asks to create a new quote, proposal, or estimate.')
    public static List<Id> createQuote(List<QuoteInput> requests) {
        List<Quote__c> quotesToInsert = new List<Quote__c>();
        
        for (QuoteInput req : requests) {
            quotesToInsert.add(new Quote__c(
                Account__c = req.accountId,
                Opportunity__c = req.opportunityId,
                Status__c = 'Draft'
            ));
        }
        
        insert quotesToInsert;
        
        List<Id> quoteIds = new List<Id>();
        for (Quote__c q : quotesToInsert) { 
            quoteIds.add(q.Id); 
        }
        return quoteIds;
    }
}