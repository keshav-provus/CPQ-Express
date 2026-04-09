// ═══════════════════════════════════════════════════════════════
// CPQ Express — Mock Data Loading Script
// Run via: sfdx apex run --file scripts/apex/loadMockData.apex
// ═══════════════════════════════════════════════════════════════

// ── 1. Company Settings: ensure Working Hours Per Day is set ──
List<Company_Settings__c> existingSettings = [SELECT Id FROM Company_Settings__c LIMIT 1];
if (existingSettings.isEmpty()) {
    insert new Company_Settings__c(
        Company_Name__c = 'CPQ Express Demo',
        Working_Hours_Per_Day__c = 8
    );
    System.debug('Created Company_Settings__c with 8 hrs/day');
} else {
    Company_Settings__c s = existingSettings[0];
    s.Working_Hours_Per_Day__c = 8;
    update s;
    System.debug('Updated existing Company_Settings__c to 8 hrs/day');
}

// ── 2. Resource Roles (all hourly) ──
List<Resource_Role__c> oldRoles = [SELECT Id FROM Resource_Role__c];
if (!oldRoles.isEmpty()) {
    delete oldRoles;
}

List<Resource_Role__c> roles = new List<Resource_Role__c>{
    new Resource_Role__c(Name__c = 'QA Lead',                   Price__c = 100, Cost__c = 60, Billing_Unit__c = 'Hour'),
    new Resource_Role__c(Name__c = 'Test Automation Engineer',  Price__c = 60,  Cost__c = 35, Billing_Unit__c = 'Hour'),
    new Resource_Role__c(Name__c = 'Functional QA Engineer',    Price__c = 40,  Cost__c = 25, Billing_Unit__c = 'Hour'),
    new Resource_Role__c(Name__c = 'Senior Software Engineer',  Price__c = 120, Cost__c = 70, Billing_Unit__c = 'Hour'),
    new Resource_Role__c(Name__c = 'DevOps Engineer',           Price__c = 110, Cost__c = 65, Billing_Unit__c = 'Hour'),
    new Resource_Role__c(Name__c = 'Business Analyst',          Price__c = 80,  Cost__c = 50, Billing_Unit__c = 'Hour')
};
insert roles;
System.debug('Inserted ' + roles.size() + ' Resource Roles');

// ── 3. Products (mix of Subscription & Each) ──
List<Product__c> oldProducts = [SELECT Id FROM Product__c];
if (!oldProducts.isEmpty()) {
    delete oldProducts;
}

List<Product__c> products = new List<Product__c>{
    new Product__c(Name = 'JIRA License',           Product_Code__c = 'PROD-JIRA',  Product_Type__c = 'Software',  Billing_Unit__c = 'Subscription', Price__c = 15,   Cost__c = 8,    Active__c = true),
    new Product__c(Name = 'Confluence License',     Product_Code__c = 'PROD-CONF',  Product_Type__c = 'Software',  Billing_Unit__c = 'Subscription', Price__c = 10,   Cost__c = 5,    Active__c = true),
    new Product__c(Name = 'Load Testing Tool',      Product_Code__c = 'PROD-LT',    Product_Type__c = 'Software',  Billing_Unit__c = 'Each',         Price__c = 5000, Cost__c = 3000, Active__c = true),
    new Product__c(Name = 'Test Environment Setup', Product_Code__c = 'PROD-TES',   Product_Type__c = 'Hardware',  Billing_Unit__c = 'Each',         Price__c = 3000, Cost__c = 1800, Active__c = true),
    new Product__c(Name = 'CI/CD Pipeline Setup',   Product_Code__c = 'PROD-CICD',  Product_Type__c = 'Software',  Billing_Unit__c = 'Each',         Price__c = 8000, Cost__c = 4500, Active__c = true),
    new Product__c(Name = 'Cloud Infrastructure',   Product_Code__c = 'PROD-CLOUD', Product_Type__c = 'Software',  Billing_Unit__c = 'Subscription', Price__c = 25,   Cost__c = 15,   Active__c = true)
};
insert products;
System.debug('Inserted ' + products.size() + ' Products');

// ── 4. Add-ons (mix of Subscription & Each) ──
List<Add_On__c> oldAddons = [SELECT Id FROM Add_On__c];
if (!oldAddons.isEmpty()) {
    delete oldAddons;
}

List<Add_On__c> addons = new List<Add_On__c>{
    new Add_On__c(Name__c = 'Priority Support',     Billing_Unit__c = 'Subscription', Price__c = 20,   Cost__c = 10),
    new Add_On__c(Name__c = '24/7 Monitoring',       Billing_Unit__c = 'Subscription', Price__c = 30,   Cost__c = 18),
    new Add_On__c(Name__c = 'Training Session',      Billing_Unit__c = 'Each',         Price__c = 2500, Cost__c = 1000),
    new Add_On__c(Name__c = 'Documentation Package', Billing_Unit__c = 'Each',         Price__c = 1500, Cost__c = 800)
};
insert addons;
System.debug('Inserted ' + addons.size() + ' Add-ons');

System.debug('════ Mock Data Loading Complete ════');
System.debug('Resource Roles: 6 (all hourly)');
System.debug('Products: 6 (3 Subscription, 3 Each)');
System.debug('Add-ons: 4 (2 Subscription, 2 Each)');
