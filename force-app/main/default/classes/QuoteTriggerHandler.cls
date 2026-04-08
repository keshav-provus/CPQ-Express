public with sharing class QuoteTriggerHandler {
    
    public static void beforeInsert(List<Quote__c> newQuotes) {
        assignRecordTypes(newQuotes);
    }
    
    private static void assignRecordTypes(List<Quote__c> newQuotes) {
        String role = QuoteController.getCurrentUserRole();
        
        Id salesRepRtId = Schema.SObjectType.Quote__c.getRecordTypeInfosByDeveloperName().get('Sales_Rep').getRecordTypeId();
        Id salesManagerRtId = Schema.SObjectType.Quote__c.getRecordTypeInfosByDeveloperName().get('Sales_Manager').getRecordTypeId();
        
        for (Quote__c q : newQuotes) {
            // If they are a Manager or Admin, give them the Manager layout/RT. Otherwise Sales Rep.
            if (role == 'Manager' || role == 'Admin') {
                q.RecordTypeId = salesManagerRtId;
            } else {
                q.RecordTypeId = salesRepRtId;
            }
        }
    }
}