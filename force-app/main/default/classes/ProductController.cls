public with sharing class ProductController {

    /**
     * @description Fetches product details by ID.
     * @param productId Product__c ID.
     * @return Product__c record.
     */
    @AuraEnabled(cacheable=true)
    public static Product__c getProductById(Id productId) {
        try {
            return [
                SELECT Id, Name, Product_Code__c, Product_Type__c, Price__c, Cost__c,
                       Active__c, Billing_Unit__c, Default_Discount__c, Description__c
                FROM Product__c
                WHERE Id = :productId
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching product: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches related Add-ons for a product.
     * @param productId Product__c ID.
     * @return List of Add_On__c records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Add_On__c> getProductAddOns(Id productId) {
        return [
            SELECT Id, Name, Name__c, Price__c, Cost__c, Billing_Unit__c
            FROM Add_On__c
            WHERE Parent_Product__c = :productId
            ORDER BY Name ASC
        ];
    }

    /**
     * @description Fetches related Discount Tiers for a product.
     * @param productId Product__c ID.
     * @return List of Discount_Tier__c records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Discount_Tier__c> getProductDiscountTiers(Id productId) {
        return [
            SELECT Id, Name, Lower_Bound__c, Upper_Bound__c, Discount_Percent__c
            FROM Discount_Tier__c
            WHERE Product__c = :productId
            ORDER BY Lower_Bound__c ASC
        ];
    }

    /**
     * @description Creates a new Add-on record linked to a product.
     * @param addOn Add_On__c record to create.
     */
    @AuraEnabled
    public static void createAddOn(Add_On__c addOn) {
        try {
            insert addOn;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating Add-on: ' + e.getMessage());
        }
    }

    /**
     * @description Creates a new Discount Tier record linked to a product.
     * @param tier Discount_Tier__c record to create.
     */
    @AuraEnabled
    public static void createDiscountTier(Discount_Tier__c tier) {
        try {
            insert tier;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating Discount Tier: ' + e.getMessage());
        }
    }

    /**
     * @description Updates a product record.
     * @param product Product__c record to update.
     */
    @AuraEnabled
    public static void updateProduct(Product__c product) {
        try {
            update product;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating product: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches all active products with their categories.
     * @return List of Product__c records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Product__c> getActiveProducts() {
        return [
            SELECT Id, Name, Product_Code__c, Product_Type__c, Price__c, Cost__c,
                   Active__c, Billing_Unit__c, Description__c
            FROM Product__c
            WHERE Active__c = true
            ORDER BY Name ASC
        ];
    }

    /**
     * @description Fetches usage history (Quote Line Items) for a specific product.
     * @param productId Product__c ID.
     * @return List of Quote_Line_Item__c records revealing product usage patterns across accounts.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote_Line_Item__c> getProductUsage(Id productId) {
        return [
            SELECT Id, Net_Total__c, Start_Date__c, End_Date__c, 
                   Quote__r.Name, Quote__r.Account__c, Quote__r.Account__r.Name
            FROM Quote_Line_Item__c
            WHERE Product__c = :productId
            AND Quote__r.Account__c != null
            AND Quote__r.Status__c = 'Approved'
            AND Start_Date__c != null
            AND End_Date__c != null
            ORDER BY Start_Date__c ASC
        ];
    }

    // ─── Resource Roles ───

    @AuraEnabled(cacheable=true)
    public static Resource_Role__c getResourceRoleById(Id roleId) {
        try {
            return [
                SELECT Id, Name, Name__c, Price__c, Cost__c, Billing_Unit__c
                FROM Resource_Role__c
                WHERE Id = :roleId
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching resource role: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Quote_Line_Item__c> getResourceRoleUsage(Id roleId) {
        return [
            SELECT Id, Net_Total__c, Start_Date__c, End_Date__c, 
                   Quote__r.Name, Quote__r.Account__c, Quote__r.Account__r.Name
            FROM Quote_Line_Item__c
            WHERE Resource_Role__c = :roleId
            AND Quote__r.Account__c != null
            AND Quote__r.Status__c = 'Approved'
            AND Start_Date__c != null
            AND End_Date__c != null
            ORDER BY Start_Date__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Discount_Tier__c> getResourceRoleDiscountTiers(Id roleId) {
        return [
            SELECT Id, Name, Lower_Bound__c, Upper_Bound__c, Discount_Percent__c
            FROM Discount_Tier__c
            WHERE Resource_Role__c = :roleId
            ORDER BY Lower_Bound__c ASC
        ];
    }

    // ─── Add-ons ───

    @AuraEnabled(cacheable=true)
    public static Add_On__c getAddOnById(Id addOnId) {
        try {
            return [
                SELECT Id, Name, Name__c, Price__c, Cost__c, Billing_Unit__c
                FROM Add_On__c
                WHERE Id = :addOnId
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching add-on: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Quote_Line_Item__c> getAddOnUsage(Id addOnId) {
        return [
            SELECT Id, Net_Total__c, Start_Date__c, End_Date__c, 
                   Quote__r.Name, Quote__r.Account__c, Quote__r.Account__r.Name
            FROM Quote_Line_Item__c
            WHERE Add_On__c = :addOnId
            AND Quote__r.Account__c != null
            AND Quote__r.Status__c = 'Approved'
            AND Start_Date__c != null
            AND End_Date__c != null
            ORDER BY Start_Date__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Discount_Tier__c> getAddOnDiscountTiers(Id addOnId) {
        return [
            SELECT Id, Name, Lower_Bound__c, Upper_Bound__c, Discount_Percent__c
            FROM Discount_Tier__c
            WHERE Add_On__c = :addOnId
            ORDER BY Lower_Bound__c ASC
        ];
    }
}
