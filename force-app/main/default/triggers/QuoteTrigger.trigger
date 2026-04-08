trigger QuoteTrigger on Quote__c (before insert) {
    if (Trigger.isBefore && Trigger.isInsert) {
        QuoteTriggerHandler.beforeInsert(Trigger.new);
    }
}