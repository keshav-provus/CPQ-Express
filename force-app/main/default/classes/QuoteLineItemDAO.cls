/**
 * @description Data Access Object for Quote_Line_Item__c database operations.
 */
public with sharing class QuoteLineItemDAO {

    /**
     * @description Fetches all line items for a specific Quote record.
     * @param quoteId The ID of the Quote.
     * @return List of Quote_Line_Item__c records.
     */
    public static List<Quote_Line_Item__c> getQuoteLinesByQuoteId(Id quoteId) {
        return [
            SELECT Id, Name, Product__c, Product__r.Name, Product__r.Product_Code__c,
                   Product__r.Product_Type__c, Quantity__c, Unit_Price__c, 
                   Discount_Percent__c, Default_Discount__c, Net_Total__c, Unit_Cost__c, Margin_Percent__c,
                   Phase__c
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            ORDER BY Phase__c ASC, CreatedDate ASC
        ];
    }

    /**
     * @description Inserts a list of Quote Line Item records.
     * @param qlis The list of Quote_Line_Item__c records to insert.
     * @return List of IDs of the inserted records.
     */
    public static List<Id> insertQuoteLineItems(List<Quote_Line_Item__c> qlis) {
        if (qlis != null && !qlis.isEmpty()) {
            insert qlis;
            List<Id> insertedIds = new List<Id>();
            for (Quote_Line_Item__c qli : qlis) {
                insertedIds.add(qli.Id);
            }
            return insertedIds;
        }
        return new List<Id>();
    }

    /**
     * @description Updates a list of Quote Line Item records.
     * @param qlis The list of Quote_Line_Item__c records to update.
     */
    public static void updateQuoteLineItems(List<Quote_Line_Item__c> qlis) {
        if (qlis != null && !qlis.isEmpty()) {
            update qlis;
        }
    }

    /**
     * @description Deletes a single Quote Line Item record.
     * @param qliId The ID of the record to delete.
     */
    public static void deleteQuoteLineItem(Id qliId) {
        if (qliId != null) {
            delete [SELECT Id FROM Quote_Line_Item__c WHERE Id = :qliId];
        }
    }
}
