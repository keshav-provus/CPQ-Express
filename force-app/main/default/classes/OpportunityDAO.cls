/**
 * @description Data Access Object for Opportunity queries related to CPQ functionalities.
 */
public with sharing class OpportunityDAO {
    
    /**
     * @description Returns all Open Opportunities for the given owners that do NOT have any associated Quote__c records.
     * @param ownerIds The set of Opportunity Owner IDs to filter by.
     * @return List of Opportunity records.
     */
    public static List<Opportunity> getOpportunitiesWithoutQuotes(Set<Id> ownerIds) {
        return [
            SELECT Id, Name, Amount, CloseDate, StageName, Account.Name
            FROM Opportunity
            WHERE OwnerId IN :ownerIds
            AND IsClosed = false
            AND Id NOT IN (SELECT Opportunity__c FROM Quote__c)
            WITH SECURITY_ENFORCED
            ORDER BY CloseDate ASC
            LIMIT 50
        ];
    }
}
