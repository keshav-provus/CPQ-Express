/**
 * @description Data Access Object for Quote database operations.
 */
public with sharing class QuoteDAO {
    
    /**
     * @description Inserts a new Quote record.
     * @param quoteToInsert The Quote record to be inserted.
     * @return The ID of the inserted record.
     */
    public static Id insertQuote(Quote__c quoteToInsert) {
        if (quoteToInsert != null && Schema.sObjectType.Quote__c.isCreateable()) {
            insert quoteToInsert;
            return quoteToInsert.Id;
        }
        return null;
    }

    /**
     * @description Updates an existing Quote record.
     * @param quoteToUpdate The Quote record to be updated.
     */
    public static void updateQuote(Quote__c quoteToUpdate) {
        if (quoteToUpdate != null && Schema.sObjectType.Quote__c.isUpdateable()) {
            update quoteToUpdate;
        }
    }
}
