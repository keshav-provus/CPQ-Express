Map<String, Schema.SObjectField> dtFields = Schema.SObjectType.Discount_Tier__c.fields.getMap();
for (String fieldName : dtFields.keySet()) {
    System.debug('Discount_Tier__c Field: ' + fieldName);
}
Map<String, Schema.SObjectField> rrFields = Schema.SObjectType.Resource_Role__c.fields.getMap();
for (String fieldName : rrFields.keySet()) {
    System.debug('Resource_Role__c Field: ' + fieldName);
}
Map<String, Schema.SObjectField> aoFields = Schema.SObjectType.Add_On__c.fields.getMap();
for (String fieldName : aoFields.keySet()) {
    System.debug('Add_On__c Field: ' + fieldName);
}
