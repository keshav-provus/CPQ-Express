/**
 * @description Controller for Product operations exposed to LWC.
 */
public with sharing class ProductController {

    private static ProductService service = new ProductService();

    /**
     * @description Retrieves all active products for the product selector.
     * @return List of active Product__c records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Product__c> getActiveProducts() {
        try {
            return service.getActiveProducts();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching products: ' + e.getMessage());
        }
    }

    /**
     * @description Searches active products by name or product code.
     * @param searchTerm The search term to filter products.
     * @return List of matching active Product__c records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Product__c> searchProducts(String searchTerm) {
        try {
            return service.searchProducts(searchTerm);
        } catch (Exception e) {
            throw new AuraHandledException('Error searching products: ' + e.getMessage());
        }
    }
}
