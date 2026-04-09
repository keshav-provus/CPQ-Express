public with sharing class CurrencyConverterBatch implements Database.Batchable<sObject>, Database.Stateful {
    
    private String targetCurrencyIsoCode;
    private String objectName;
    private Map<String, Decimal> currencyRateMap;

    public CurrencyConverterBatch(String newCurrencyIsoCode) {
        this(newCurrencyIsoCode, 'Quote_Line_Item__c');
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
        if (objectName == 'Quote_Line_Item__c') {
            query = 'SELECT Id, CurrencyIsoCode, Base_Rate__c, Unit_Price__c, Unit_Cost__c, Custom_Price__c, Custom_Cost__c FROM Quote_Line_Item__c';
        } else if (objectName == 'Product__c') {
            query = 'SELECT Id, CurrencyIsoCode, Price__c, Cost__c FROM Product__c';
        } else if (objectName == 'Add_On__c') {
            query = 'SELECT Id, CurrencyIsoCode, Price__c, Cost__c FROM Add_On__c';
        } else if (objectName == 'Resource_Role__c') {
            query = 'SELECT Id, CurrencyIsoCode, Price__c, Cost__c FROM Resource_Role__c';
        }
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<sObject> scope) {
        Decimal targetRate = currencyRateMap.containsKey(targetCurrencyIsoCode) ? currencyRateMap.get(targetCurrencyIsoCode) : 1.0;
        
        for (SObject record : scope) {
            String oldIsoCode = (String)record.get('CurrencyIsoCode');
            if (oldIsoCode == targetCurrencyIsoCode) continue;

            Decimal oldRate = currencyRateMap.containsKey(oldIsoCode) ? currencyRateMap.get(oldIsoCode) : 1.0;

            if (objectName == 'Quote_Line_Item__c') {
                convertField(record, 'Base_Rate__c', oldRate, targetRate);
                convertField(record, 'Unit_Price__c', oldRate, targetRate);
                convertField(record, 'Unit_Cost__c', oldRate, targetRate);
                convertField(record, 'Custom_Price__c', oldRate, targetRate);
                convertField(record, 'Custom_Cost__c', oldRate, targetRate);
            } else {
                convertField(record, 'Price__c', oldRate, targetRate);
                convertField(record, 'Cost__c', oldRate, targetRate);
            }

            record.put('CurrencyIsoCode', targetCurrencyIsoCode);
        }
        update scope;
    }

    private void convertField(SObject record, String fieldName, Decimal oldRate, Decimal newRate) {
        Decimal val = (Decimal)record.get(fieldName);
        if (val != null) {
            record.put(fieldName, (val / oldRate) * newRate);
        }
    }

    public void finish(Database.BatchableContext BC) {
        // Chain next object
        String nextObj = getNextObject(objectName);
        if (nextObj != null) {
            Database.executeBatch(new CurrencyConverterBatch(targetCurrencyIsoCode, nextObj));
        }
    }

    private String getNextObject(String current) {
        if (current == 'Quote_Line_Item__c') return 'Product__c';
        if (current == 'Product__c') return 'Add_On__c';
        if (current == 'Add_On__c') return 'Resource_Role__c';
        return null;
    }
}
