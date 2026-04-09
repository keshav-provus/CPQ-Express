Company_Settings__c s = Company_Settings__c.getOrgDefaults();
s.Default_Currency__c = 'USD';
upsert s;
Database.executeBatch(new CurrencyConverterBatch('USD'), 200);
System.debug('=== CONVERSION BACK TO USD STARTED ===');
