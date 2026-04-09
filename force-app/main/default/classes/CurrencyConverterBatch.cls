public with sharing class CurrencyConverterBatch implements Database.Batchable<sObject>, Database.Stateful {
    
    private String targetCurrencyIsoCode;
    private String objectName;
    private Map<String, Decimal> currencyRateMap;

    public CurrencyConverterBatch(String newCurrencyIsoCode) {
        this(newCurrencyIsoCode, 'Resource_Role__c');
    }

    public CurrencyConverterBatch(String newCurrencyIsoCode, String objectName) {
        this.targetCurrencyIsoCode = newCurrencyIsoCode;
        this.objectName = objectName;
        this.currencyRateMap = new Map<String, Decimal>();
        
        List<SObject> currencies = Database.query('SELECT IsoCode, ConversionRate FROM CurrencyType WHERE IsActive = true');
        for (SObject c : currencies) {
            currencyRateMap.put((String)c.get('IsoCode'), (Decimal)c.get('ConversionRate'));
        }
    }

    public Database.QueryLocator start(Database.BatchableContext BC) {
        String query = '';
        if (objectName == 'Resource_Role__c') {
            query = 'SELECT Id, CurrencyIsoCode, Price__c, Cost__c FROM Resource_Role__c';
        } else if (objectName == 'Product__c') {
            query = 'SELECT Id, CurrencyIsoCode, Price__c, Cost__c FROM Product__c';
        } else if (objectName == 'Add_On__c') {
            query = 'SELECT Id, CurrencyIsoCode, Price__c, Cost__c FROM Add_On__c';
        } else if (objectName == 'Quote__c') {
            // Process ALL quotes
            query = 'SELECT Id, CurrencyIsoCode, Time_Period_Metric__c, Status__c FROM Quote__c';
        }
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<sObject> scope) {
        Decimal targetRate = currencyRateMap.containsKey(targetCurrencyIsoCode) ? currencyRateMap.get(targetCurrencyIsoCode) : 1.0;

        if (objectName == 'Quote__c') {
            // Special handling: recalculate QLIs from source records, then flip Quote currency
            processQuotesAndQLIs(scope);
            return;
        }

        // Standard catalog object conversion
        List<SObject> toUpdate = new List<SObject>();
        for (SObject record : scope) {
            String oldIsoCode = (String)record.get('CurrencyIsoCode');
            if (oldIsoCode == targetCurrencyIsoCode) continue;

            Decimal oldRate = currencyRateMap.containsKey(oldIsoCode) ? currencyRateMap.get(oldIsoCode) : 1.0;
            convertField(record, 'Price__c', oldRate, targetRate);
            convertField(record, 'Cost__c', oldRate, targetRate);
            record.put('CurrencyIsoCode', targetCurrencyIsoCode);
            toUpdate.add(record);
        }
        if (!toUpdate.isEmpty()) update toUpdate;
    }

    /**
     * For each Quote:
     *   1. Query its QLIs
     *   2. For each QLI, look up the source record (Resource_Role__c / Product__c / Add_On__c)
     *      which has ALREADY been converted to the target currency
     *   3. Recalculate Unit_Price__c and Unit_Cost__c from the source's new Price__c/Cost__c
     *   4. Update QLI CurrencyIsoCode
     *   5. Update Quote CurrencyIsoCode
     */
    private void processQuotesAndQLIs(List<SObject> quotes) {
        Set<Id> quoteIds = new Set<Id>();
        Map<Id, String> quoteTimePeriodMap = new Map<Id, String>();
        for (SObject q : quotes) {
            quoteIds.add(q.Id);
            quoteTimePeriodMap.put(q.Id, (String)q.get('Time_Period_Metric__c'));
        }

        // Get all QLIs for these quotes
        List<Quote_Line_Item__c> qlis = [
            SELECT Id, Quote__c, Item_Type__c, Billing_Unit__c,
                   Resource_Role__c, Product__c, Add_On__c,
                   Unit_Price__c, Unit_Cost__c, Base_Rate__c, CurrencyIsoCode
            FROM Quote_Line_Item__c
            WHERE Quote__c IN :quoteIds
        ];

        if (qlis.isEmpty()) {
            // Just update Quote CurrencyIsoCode
            List<SObject> toUpdateQuotes = new List<SObject>();
            for (SObject q : quotes) {
                if ((String)q.get('CurrencyIsoCode') != targetCurrencyIsoCode) {
                    q.put('CurrencyIsoCode', targetCurrencyIsoCode);
                    toUpdateQuotes.add(q);
                }
            }
            if (!toUpdateQuotes.isEmpty()) update toUpdateQuotes;
            return;
        }

        // Collect source record IDs
        Set<Id> roleIds = new Set<Id>();
        Set<Id> productIds = new Set<Id>();
        Set<Id> addonIds = new Set<Id>();
        for (Quote_Line_Item__c qli : qlis) {
            if (qli.Resource_Role__c != null) roleIds.add(qli.Resource_Role__c);
            if (qli.Product__c != null)       productIds.add(qli.Product__c);
            if (qli.Add_On__c != null)        addonIds.add(qli.Add_On__c);
        }

        // Query source records (ALREADY converted to target currency)
        Map<Id, Resource_Role__c> rolesMap = new Map<Id, Resource_Role__c>();
        Map<Id, Product__c> productsMap = new Map<Id, Product__c>();
        Map<Id, Add_On__c> addonsMap = new Map<Id, Add_On__c>();

        if (!roleIds.isEmpty()) {
            rolesMap = new Map<Id, Resource_Role__c>([
                SELECT Id, Price__c, Cost__c FROM Resource_Role__c WHERE Id IN :roleIds
            ]);
        }
        if (!productIds.isEmpty()) {
            productsMap = new Map<Id, Product__c>([
                SELECT Id, Price__c, Cost__c, Billing_Unit__c FROM Product__c WHERE Id IN :productIds
            ]);
        }
        if (!addonIds.isEmpty()) {
            addonsMap = new Map<Id, Add_On__c>([
                SELECT Id, Price__c, Cost__c, Billing_Unit__c FROM Add_On__c WHERE Id IN :addonIds
            ]);
        }

        // Recalculate each QLI from its source
        List<Quote_Line_Item__c> qlisToUpdate = new List<Quote_Line_Item__c>();
        for (Quote_Line_Item__c qli : qlis) {
            String timePeriod = quoteTimePeriodMap.get(qli.Quote__c);
            Decimal multiplier = getHoursMultiplier(timePeriod);
            Decimal newPrice = null;
            Decimal newCost = null;

            if (qli.Item_Type__c == 'Resource Role' && qli.Resource_Role__c != null && rolesMap.containsKey(qli.Resource_Role__c)) {
                Resource_Role__c role = rolesMap.get(qli.Resource_Role__c);
                // Resource Roles are always hourly → multiply by period
                newPrice = role.Price__c * multiplier;
                newCost  = role.Cost__c  * multiplier;
                qli.Base_Rate__c = role.Price__c;
            } else if (qli.Item_Type__c == 'Product' && qli.Product__c != null && productsMap.containsKey(qli.Product__c)) {
                Product__c prod = productsMap.get(qli.Product__c);
                if (prod.Billing_Unit__c == 'Subscription') {
                    newPrice = prod.Price__c * multiplier;
                    newCost  = prod.Cost__c  * multiplier;
                } else {
                    newPrice = prod.Price__c;
                    newCost  = prod.Cost__c;
                }
                qli.Base_Rate__c = prod.Price__c;
            } else if (qli.Item_Type__c == 'Add-on' && qli.Add_On__c != null && addonsMap.containsKey(qli.Add_On__c)) {
                Add_On__c addon = addonsMap.get(qli.Add_On__c);
                if (addon.Billing_Unit__c == 'Subscription') {
                    newPrice = addon.Price__c * multiplier;
                    newCost  = addon.Cost__c  * multiplier;
                } else {
                    newPrice = addon.Price__c;
                    newCost  = addon.Cost__c;
                }
                qli.Base_Rate__c = addon.Price__c;
            }

            if (newPrice != null) {
                qli.Unit_Price__c = newPrice;
                qli.Unit_Cost__c  = newCost;
                qli.CurrencyIsoCode = targetCurrencyIsoCode;
                qlisToUpdate.add(qli);
            }
        }

        // Update QLIs first so Roll-Up recalculates correctly
        if (!qlisToUpdate.isEmpty()) update qlisToUpdate;

        // Then update Quote CurrencyIsoCode
        List<SObject> quotesToUpdate = new List<SObject>();
        for (SObject q : quotes) {
            if ((String)q.get('CurrencyIsoCode') != targetCurrencyIsoCode) {
                q.put('CurrencyIsoCode', targetCurrencyIsoCode);
                quotesToUpdate.add(q);
            }
        }
        if (!quotesToUpdate.isEmpty()) update quotesToUpdate;
    }

    // ─── Hours multiplier (mirrors QuoteLineItemController logic) ───
    private Decimal getHoursMultiplier(String timePeriod) {
        List<Company_Settings__c> settings = [SELECT Working_Hours_Per_Day__c, Work_Policy__c FROM Company_Settings__c LIMIT 1];
        Decimal hpd = 8;
        Decimal hpw = 40;
        Decimal hpm = 160;

        if (!settings.isEmpty()) {
            Company_Settings__c s = settings[0];
            if (s.Working_Hours_Per_Day__c != null) hpd = s.Working_Hours_Per_Day__c;
            Decimal daysPerWeek = 5;
            if (s.Work_Policy__c == '6 Days') daysPerWeek = 6;
            if (s.Work_Policy__c == '7 Days') daysPerWeek = 7;
            hpw = hpd * daysPerWeek;
            hpm = hpw * 4;
        }

        if (timePeriod == 'Days')      return hpd;
        if (timePeriod == 'Weeks')     return hpw;
        if (timePeriod == 'Months')    return hpm;
        if (timePeriod == 'Quarters')  return hpm * 3;
        return hpd;
    }

    private void convertField(SObject record, String fieldName, Decimal oldRate, Decimal newRate) {
        Decimal val = (Decimal)record.get(fieldName);
        if (val != null) {
            record.put(fieldName, (val / oldRate) * newRate);
        }
    }

    public void finish(Database.BatchableContext BC) {
        String nextObj = getNextObject(objectName);
        if (nextObj != null) {
            Database.executeBatch(new CurrencyConverterBatch(targetCurrencyIsoCode, nextObj));
        }
    }

    // Chain: Catalog objects → Quotes (which internally recalculates QLIs)
    private String getNextObject(String current) {
        if (current == 'Resource_Role__c') return 'Product__c';
        if (current == 'Product__c') return 'Add_On__c';
        if (current == 'Add_On__c') return 'Quote__c';
        return null;
    }
}
