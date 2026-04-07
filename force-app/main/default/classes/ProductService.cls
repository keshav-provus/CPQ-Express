/**
 * @description Service layer for Product-related business logic.
 */
public with sharing class ProductService {

    /**
     * @description Retrieves all active products from the catalog.
     * @return List of active Product__c records.
     */
    public List<Product__c> getActiveProducts() {
        return ProductDAO.getActiveProducts();
    }

    /**
     * @description Searches active products by name or product code.
     * @param searchTerm The search term to filter products.
     * @return List of matching active Product__c records.
     */
    public List<Product__c> searchProducts(String searchTerm) {
        if (String.isBlank(searchTerm)) {
            return ProductDAO.getActiveProducts();
        }
        return ProductDAO.searchProducts(searchTerm);
    }
}
