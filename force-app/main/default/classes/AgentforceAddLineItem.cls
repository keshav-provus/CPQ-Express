public with sharing class AgentforceAddLineItem {
    
    public class LineItemInput {
        @InvocableVariable(label='Quote ID' required=true description='The ID of the Quote to add the line item to.')
        public Id quoteId;
        
        @InvocableVariable(label='Product Name' required=true description='The exact name of the Product, Resource Role, or Add-On to add.')
        public String productName;
        
        @InvocableVariable(label='Quantity' description='The quantity of the product. Defaults to 1 if not specified.')
        public Decimal quantity;
    }

    @InvocableMethod(label='Add CPQ Line Item' description='Use this action to add a product or line item to an existing quote.')
    public static List<String> addLineItem(List<LineItemInput> requests) {
        List<String> results = new List<String>();
        
        for (LineItemInput req : requests) {
            Decimal qty = (req.quantity != null && req.quantity > 0) ? req.quantity : 1;

            // Search Resource Roles first
            List<Resource_Role__c> roles = [SELECT Id, Name, Price__c, Cost__c FROM Resource_Role__c WHERE Name = :req.productName LIMIT 1];
            if (!roles.isEmpty()) {
                Resource_Role__c role = roles[0];
                Quote_Line_Item__c newItem = new Quote_Line_Item__c(
                    Quote__c = req.quoteId,
                    Resource_Role__c = role.Id,
                    Item_Type__c = 'Resource Role',
                    Name__c = role.Name,
                    Quantity__c = qty,
                    Unit_Price__c = role.Price__c != null ? role.Price__c : 0,
                    Unit_Cost__c = role.Cost__c != null ? role.Cost__c : 0,
                    Base_Rate__c = role.Price__c != null ? role.Price__c : 0
                );
                insert newItem;
                results.add('Added ' + qty.intValue() + 'x ' + role.Name + ' (Resource Role) to the quote.');
                continue;
            }

            // Search Products
            List<Product__c> products = [SELECT Id, Name, Price__c, Cost__c FROM Product__c WHERE Name = :req.productName LIMIT 1];
            if (!products.isEmpty()) {
                Product__c prod = products[0];
                Quote_Line_Item__c newItem = new Quote_Line_Item__c(
                    Quote__c = req.quoteId,
                    Product__c = prod.Id,
                    Item_Type__c = 'Product',
                    Name__c = prod.Name,
                    Quantity__c = qty,
                    Unit_Price__c = prod.Price__c != null ? prod.Price__c : 0,
                    Unit_Cost__c = prod.Cost__c != null ? prod.Cost__c : 0,
                    Base_Rate__c = prod.Price__c != null ? prod.Price__c : 0
                );
                insert newItem;
                results.add('Added ' + qty.intValue() + 'x ' + prod.Name + ' (Product) to the quote.');
                continue;
            }

            // Search Add-Ons
            List<Add_On__c> addons = [SELECT Id, Name, Price__c, Cost__c FROM Add_On__c WHERE Name = :req.productName LIMIT 1];
            if (!addons.isEmpty()) {
                Add_On__c addon = addons[0];
                Quote_Line_Item__c newItem = new Quote_Line_Item__c(
                    Quote__c = req.quoteId,
                    Add_On__c = addon.Id,
                    Item_Type__c = 'Add-on',
                    Name__c = addon.Name,
                    Quantity__c = qty,
                    Unit_Price__c = addon.Price__c != null ? addon.Price__c : 0,
                    Unit_Cost__c = addon.Cost__c != null ? addon.Cost__c : 0,
                    Base_Rate__c = addon.Price__c != null ? addon.Price__c : 0
                );
                insert newItem;
                results.add('Added ' + qty.intValue() + 'x ' + addon.Name + ' (Add-on) to the quote.');
                continue;
            }

            results.add('Could not find a product, resource role, or add-on named "' + req.productName + '". Please check the exact name.');
        }
        return results;
    }
}