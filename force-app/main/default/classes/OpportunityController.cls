/**
 * @description Controller for the Opportunities Needing Quotes dashboard component.
 */
public with sharing class OpportunityController {
    
    private static OpportunityService service = new OpportunityService();
    
    /**
     * @description Returns all Opportunities needing a quote for the current user.
     * @return List of Opportunity records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getOpportunitiesNeedingQuotes() {
        try {
            return service.getOpportunitiesNeedingQuotes();
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching opportunities Needing Quotes: ' + e.getMessage());
        }
    }
}
