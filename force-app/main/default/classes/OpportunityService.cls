/**
 * @description Service layer for Opportunity business logic.
 */
public with sharing class OpportunityService {
    
    /**
     * @description Fetches all Opportunities owned by the current user that require a quote.
     * @return List of Opportunity records.
     */
    public List<Opportunity> getOpportunitiesNeedingQuotes() {
        Set<Id> ownerIds = new Set<Id>{ UserInfo.getUserId() };
        return OpportunityDAO.getOpportunitiesWithoutQuotes(ownerIds);
    }
}
