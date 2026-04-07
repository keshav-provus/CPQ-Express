/**
 * @description Data Access Object for Product__c database operations.
 */
public with sharing class ProductDAO {

    /**
     * @description Retrieves all active products from the catalog.
     * @return List of active Product__c records with related Category name.
     */
    public static List<Product__c> getActiveProducts() {
        return [
            SELECT Id, Name, Product_Code__c, Product_Type__c,
                   Category__c, Category__r.Name,
                   Price__c, Cost__c, Billing_Unit__c, Active__c
            FROM Product__c
            WHERE Active__c = true
            ORDER BY Name ASC
        ];
    }

    /**
     * @description Searches active products by name or product code.
     * @param searchTerm The search term to filter products.
     * @return List of matching active Product__c records.
     */
    public static List<Product__c> searchProducts(String searchTerm) {
        String searchPattern = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        return [
            SELECT Id, Name, Product_Code__c, Product_Type__c,
                   Category__c, Category__r.Name,
                   Price__c, Cost__c, Billing_Unit__c, Active__c
            FROM Product__c
            WHERE Active__c = true
            AND (Name LIKE :searchPattern OR Product_Code__c LIKE :searchPattern)
            ORDER BY Name ASC
        ];
    }

    /**
     * @description Retrieves products by their IDs.
     * @param productIds Set of Product IDs to retrieve.
     * @return List of Product__c records.
     */
    public static List<Product__c> getProductsByIds(Set<Id> productIds) {
        return [
            SELECT Id, Name, Price__c, Cost__c
            FROM Product__c
            WHERE Id IN :productIds
        ];
    }
}
