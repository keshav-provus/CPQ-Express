/**
 * @description Service layer for Quote Line Item business logic.
 */
public with sharing class QuoteLineItemService {

    /**
     * @description Inner class to deserialize per-product line item data from JSON.
     */
    public class LineItemInput {
        public Id productId;
        public Integer quantity;
        public Decimal discountPercent;
    }

    /**
     * @description Inner class to deserialize existing line item updates from JSON.
     */
    public class LineItemUpdate {
        public Id lineItemId;
        public Integer quantity;
        public Decimal discountPercent;
    }

    /**
     * @description Creates Quote Line Items from selected products, auto-populating
     *              Unit Price and Unit Cost from the Product catalog.
     *              Each product can have its own quantity and discount.
     * @param quoteId The ID of the Quote to add line items to.
     * @param lineItemsJson JSON array of {productId, quantity, discountPercent} objects.
     * @return List of IDs of the newly created Quote Line Items.
     */
    public List<Id> addLineItemsFromProducts(Id quoteId, String lineItemsJson) {
        if (quoteId == null) {
            throw new IllegalArgumentException('Quote ID cannot be null');
        }
        if (String.isBlank(lineItemsJson)) {
            throw new IllegalArgumentException('At least one Product must be selected');
        }

        // Parse per-product inputs
        List<LineItemInput> inputs = (List<LineItemInput>) JSON.deserialize(
            lineItemsJson, List<LineItemInput>.class
        );

        if (inputs == null || inputs.isEmpty()) {
            throw new IllegalArgumentException('At least one Product must be selected');
        }

        // Collect product IDs and build a lookup map for per-product options
        Set<Id> productIds = new Set<Id>();
        Map<Id, LineItemInput> inputMap = new Map<Id, LineItemInput>();
        for (LineItemInput input : inputs) {
            productIds.add(input.productId);
            inputMap.put(input.productId, input);
        }

        // Fetch product data for pricing
        List<Product__c> products = ProductDAO.getProductsByIds(productIds);

        if (products.isEmpty()) {
            throw new AuraHandledException('No valid products found for the given IDs');
        }

        // Build QLI records with per-product quantity, discount, and auto-populated pricing
        List<Quote_Line_Item__c> newQLIs = new List<Quote_Line_Item__c>();
        for (Product__c product : products) {
            LineItemInput opts = inputMap.get(product.Id);

            Integer qty = (opts != null && opts.quantity != null && opts.quantity > 0)
                ? opts.quantity : 1;

            Decimal discount = 0;
            if (opts != null && opts.discountPercent != null && opts.discountPercent > 0) {
                discount = opts.discountPercent;
            }

            Quote_Line_Item__c qli = new Quote_Line_Item__c();
            qli.Quote__c = quoteId;
            qli.Product__c = product.Id;
            qli.Unit_Price__c = product.Price__c;
            qli.Unit_Cost__c = product.Cost__c;
            qli.Quantity__c = qty;
            qli.Discount_Percent__c = discount;
            newQLIs.add(qli);
        }

        return QuoteLineItemDAO.insertQuoteLineItems(newQLIs);
    }

    /**
     * @description Fetches all line items for a quote.
     * @param quoteId Quote ID.
     * @return List of Quote_Line_Item__c records.
     */
    public List<Quote_Line_Item__c> getQuoteLines(Id quoteId) {
        return QuoteLineItemDAO.getQuoteLinesByQuoteId(quoteId);
    }

    /**
     * @description Updates existing quote line items from JSON.
     * @param lineItemsJson JSON array of {lineItemId, quantity, discountPercent}.
     */
    public void updateQuoteLines(String lineItemsJson) {
        if (String.isBlank(lineItemsJson)) return;

        List<LineItemUpdate> updates = (List<LineItemUpdate>) JSON.deserialize(
            lineItemsJson, List<LineItemUpdate>.class
        );

        List<Quote_Line_Item__c> qlisToUpdate = new List<Quote_Line_Item__c>();
        for (LineItemUpdate up : updates) {
            Quote_Line_Item__c qli = new Quote_Line_Item__c(Id = up.lineItemId);
            if (up.quantity != null) qli.Quantity__c = up.quantity;
            if (up.discountPercent != null) qli.Discount_Percent__c = up.discountPercent;
            qlisToUpdate.add(qli);
        }

        QuoteLineItemDAO.updateQuoteLineItems(qlisToUpdate);
    }

    /**
     * @description Deletes a quote line item.
     * @param qliId ID of the line item to delete.
     */
    public void deleteQuoteLine(Id qliId) {
        QuoteLineItemDAO.deleteQuoteLineItem(qliId);
    }
}
