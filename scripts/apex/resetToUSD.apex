// ─── STEP 1: Reset Catalog Objects to original USD prices ───
List<Resource_Role__c> roles = [SELECT Id, Name, Price__c, Cost__c, CurrencyIsoCode FROM Resource_Role__c];
Map<String, Decimal[]> origPrices = new Map<String, Decimal[]>{
    'RR-0000' => new Decimal[]{ 100, 60 },
    'RR-0001' => new Decimal[]{ 60, 35 },
    'RR-0002' => new Decimal[]{ 40, 25 },
    'RR-0003' => new Decimal[]{ 120, 70 },
    'RR-0004' => new Decimal[]{ 110, 65 },
    'RR-0005' => new Decimal[]{ 80, 50 }
};
for (Resource_Role__c r : roles) {
    if (origPrices.containsKey(r.Name)) {
        r.Price__c = origPrices.get(r.Name)[0];
        r.Cost__c = origPrices.get(r.Name)[1];
    }
    r.CurrencyIsoCode = 'USD';
}
update roles;
System.debug('✓ Roles reset to USD');

List<Product__c> prods = [SELECT Id, Price__c, Cost__c, CurrencyIsoCode FROM Product__c];
for (Product__c p : prods) {
    if (p.CurrencyIsoCode != 'USD') {
        p.Price__c = p.Price__c / 83;
        p.Cost__c = p.Cost__c != null ? p.Cost__c / 83 : null;
    }
    p.CurrencyIsoCode = 'USD';
}
update prods;
System.debug('✓ Products reset to USD');

List<Add_On__c> addons = [SELECT Id, Price__c, Cost__c, CurrencyIsoCode FROM Add_On__c];
for (Add_On__c a : addons) {
    if (a.CurrencyIsoCode != 'USD') {
        a.Price__c = a.Price__c / 83;
        a.Cost__c = a.Cost__c != null ? a.Cost__c / 83 : null;
    }
    a.CurrencyIsoCode = 'USD';
}
update addons;
System.debug('✓ Add-Ons reset to USD');

// ─── STEP 2: Get multiplier settings ───
Company_Settings__c cs = Company_Settings__c.getOrgDefaults();
cs.Default_Currency__c = 'USD';
upsert cs;

Decimal hpd = cs.Working_Hours_Per_Day__c != null ? cs.Working_Hours_Per_Day__c : 8;
Decimal dpw = 5;
if (cs.Work_Policy__c == '6 Days') dpw = 6;
if (cs.Work_Policy__c == '7 Days') dpw = 7;
Decimal hpw = hpd * dpw;
Decimal hpm = hpw * 4;

// ─── STEP 3: Build lookup maps ───
Map<Id, Resource_Role__c> roleMap = new Map<Id, Resource_Role__c>(
    [SELECT Id, Name__c, Price__c, Cost__c FROM Resource_Role__c]
);
Map<Id, Product__c> prodMap = new Map<Id, Product__c>(
    [SELECT Id, Name, Price__c, Cost__c, Billing_Unit__c FROM Product__c]
);
Map<Id, Add_On__c> addonMap = new Map<Id, Add_On__c>(
    [SELECT Id, Name__c, Price__c, Cost__c, Billing_Unit__c FROM Add_On__c]
);

// ─── STEP 4: Recalculate & link QLIs ───
List<Quote__c> draftQuotes = [SELECT Id, Time_Period_Metric__c FROM Quote__c WHERE Status__c = 'Draft'];
Set<Id> qIds = new Set<Id>();
for (Quote__c q : draftQuotes) qIds.add(q.Id);

List<Quote_Line_Item__c> qlis = [
    SELECT Id, Quote__c, Item_Type__c, Name__c,
           Resource_Role__c, Product__c, Add_On__c,
           Billing_Unit__c, Unit_Price__c, Unit_Cost__c, Base_Rate__c, CurrencyIsoCode
    FROM Quote_Line_Item__c WHERE Quote__c IN :qIds
];

Map<Id, String> qTimePeriods = new Map<Id, String>();
for (Quote__c q : draftQuotes) qTimePeriods.put(q.Id, q.Time_Period_Metric__c);

// Build name-to-ID maps for linking QLIs that have null lookups
Map<String, Id> roleNameMap = new Map<String, Id>();
for (Resource_Role__c r : roleMap.values()) {
    if (r.Name__c != null) roleNameMap.put(r.Name__c, r.Id);
}
Map<String, Id> prodNameMap = new Map<String, Id>();
for (Product__c p : prodMap.values()) {
    prodNameMap.put(p.Name, p.Id);
}
Map<String, Id> addonNameMap = new Map<String, Id>();
for (Add_On__c a : addonMap.values()) {
    if (a.Name__c != null) addonNameMap.put(a.Name__c, a.Id);
}

Integer fixed = 0;
for (Quote_Line_Item__c qli : qlis) {
    String tp = qTimePeriods.get(qli.Quote__c);
    Decimal mult = hpd;
    if (tp == 'Weeks') mult = hpw;
    else if (tp == 'Months') mult = hpm;
    else if (tp == 'Quarters') mult = hpm * 3;

    // Try to link if lookup is null
    if (qli.Item_Type__c == 'Resource Role' && qli.Resource_Role__c == null && qli.Name__c != null) {
        if (roleNameMap.containsKey(qli.Name__c)) qli.Resource_Role__c = roleNameMap.get(qli.Name__c);
    }
    if (qli.Item_Type__c == 'Product' && qli.Product__c == null && qli.Name__c != null) {
        if (prodNameMap.containsKey(qli.Name__c)) qli.Product__c = prodNameMap.get(qli.Name__c);
    }
    if (qli.Item_Type__c == 'Add-on' && qli.Add_On__c == null && qli.Name__c != null) {
        if (addonNameMap.containsKey(qli.Name__c)) qli.Add_On__c = addonNameMap.get(qli.Name__c);
    }

    // Recalculate from source
    if (qli.Item_Type__c == 'Resource Role' && qli.Resource_Role__c != null && roleMap.containsKey(qli.Resource_Role__c)) {
        Resource_Role__c r = roleMap.get(qli.Resource_Role__c);
        qli.Base_Rate__c = r.Price__c;
        qli.Unit_Price__c = r.Price__c * mult;
        qli.Unit_Cost__c = r.Cost__c * mult;
        fixed++;
    } else if (qli.Item_Type__c == 'Product' && qli.Product__c != null && prodMap.containsKey(qli.Product__c)) {
        Product__c p = prodMap.get(qli.Product__c);
        qli.Base_Rate__c = p.Price__c;
        if (p.Billing_Unit__c == 'Subscription') {
            qli.Unit_Price__c = p.Price__c * mult;
            qli.Unit_Cost__c = p.Cost__c * mult;
        } else {
            qli.Unit_Price__c = p.Price__c;
            qli.Unit_Cost__c = p.Cost__c;
        }
        fixed++;
    } else if (qli.Item_Type__c == 'Add-on' && qli.Add_On__c != null && addonMap.containsKey(qli.Add_On__c)) {
        Add_On__c a = addonMap.get(qli.Add_On__c);
        qli.Base_Rate__c = a.Price__c;
        if (a.Billing_Unit__c == 'Subscription') {
            qli.Unit_Price__c = a.Price__c * mult;
            qli.Unit_Cost__c = a.Cost__c * mult;
        } else {
            qli.Unit_Price__c = a.Price__c;
            qli.Unit_Cost__c = a.Cost__c;
        }
        fixed++;
    }
    qli.CurrencyIsoCode = 'USD';
}
update qlis;
System.debug('✓ QLIs recalculated: ' + fixed + ' / ' + qlis.size());

// ─── STEP 5: Set Draft Quotes to USD ───
for (Quote__c q : draftQuotes) {
    q.CurrencyIsoCode = 'USD';
}
update draftQuotes;
System.debug('✓ Quotes set to USD: ' + draftQuotes.size());
System.debug('=== ALL DATA RESET TO CLEAN USD ===');
