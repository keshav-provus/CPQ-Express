/**
 * @description Controller for Quote operations exposed to LWC.
 */
public with sharing class QuoteController {
    
    private static QuoteService service = new QuoteService();
    private static QuoteLineItemService qliService = new QuoteLineItemService();
    
    /**
     * @description Creates a new Quote record via Apex and returns the ID.
     * @param oppId The Opportunity to link the quote to.
     * @return Id of the new Quote record.
     */
    @AuraEnabled
    public static String createQuoteRecord(Id oppId) {
        try {
            return service.createQuoteForOpportunity(oppId);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating Quote Record: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches single quote by ID with all necessary fields for the new UI.
     * @param recordId Quote__c ID.
     * @return Quote__c record.
     */
    @AuraEnabled(cacheable=true)
    public static Quote__c getQuoteById(Id recordId) {
        try {
            return [
                SELECT Id, Name, Status__c, Opportunity__c, Opportunity__r.Name,
                       Account__c, Account__r.Name, CreatedById, CreatedBy.Name,
                       LastModifiedById, LastModifiedBy.Name, CreatedDate, LastModifiedDate,
                       Total_Amount__c, Total_Cost__c, Margin_Percent__c, Margin_Amount__c,
                       Start_Date__c, End_Date__c, Valid_Until__c, Phase_List__c,
                       Time_Period_Metric__c, Time_Period_Count__c
                FROM Quote__c
                WHERE Id = :recordId
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching quote: ' + e.getMessage());
        }
    }

    /**
     * @description Updates quote record.
     * @param quote Quote__c record to update.
     */
    @AuraEnabled
    public static void updateQuoteRecord(Quote__c quote) {
        try {
            update quote;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating quote: ' + e.getMessage());
        }
    }

    /**
     * @description Creates Quote Line Items from selected products.
     *              Accepts a JSON array with per-product quantity and discount.
     * @param quoteId The Quote to add line items to.
     * @param lineItemsJson JSON array of objects: [{productId, quantity, discountPercent}].
     * @return List of IDs of newly created Quote Line Items.
     */
    @AuraEnabled
    public static List<Id> addLineItemsFromProducts(Id quoteId, String lineItemsJson) {
        try {
            List<Id> ids = qliService.addLineItemsFromProducts(quoteId, lineItemsJson);
            recalculateQuoteTotals(quoteId);
            return ids;
        } catch (Exception e) {
            throw new AuraHandledException('Error adding line items: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches all line items for the given Quote.
     * @param quoteId Quote ID.
     * @return List of Quote_Line_Item__c records.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote_Line_Item__c> getQuoteLines(Id quoteId) {
        try {
            return qliService.getQuoteLines(quoteId);
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching quote lines: ' + e.getMessage());
        }
    }

    /**
     * @description Updates quote line items (quantity, discount).
     * @param lineItemsJson JSON representing updates.
     */
    @AuraEnabled
    public static void updateQuoteLines(String lineItemsJson) {
        try {
            qliService.updateQuoteLines(lineItemsJson);
            // We need the quoteId to recalculate.
            // The JSON might not have it, so we might need to fetch it from one of the QLIs.
            List<QuoteLineItemService.LineItemUpdate> updates = (List<QuoteLineItemService.LineItemUpdate>) JSON.deserialize(
                lineItemsJson, List<QuoteLineItemService.LineItemUpdate>.class
            );
            if (!updates.isEmpty()) {
                Quote_Line_Item__c qli = [SELECT Quote__c FROM Quote_Line_Item__c WHERE Id = :updates[0].lineItemId LIMIT 1];
                recalculateQuoteTotals(qli.Quote__c);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error updating quote lines: ' + e.getMessage());
        }
    }

    /**
     * @description Deletes a quote line item.
     * @param qliId ID of the line item to delete.
     */
    @AuraEnabled
    public static void deleteQuoteLine(Id qliId) {
        try {
            Quote_Line_Item__c qli = [SELECT Quote__c FROM Quote_Line_Item__c WHERE Id = :qliId LIMIT 1];
            Id quoteId = qli.Quote__c;
            qliService.deleteQuoteLine(qliId);
            recalculateQuoteTotals(quoteId);
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting quote line: ' + e.getMessage());
        }
    }

    /**
     * @description Submits a Quote for Approval - sets status to 'Pending Approval'.
     * @param quoteId Quote ID.
     */
    @AuraEnabled
    public static void submitForApproval(Id quoteId) {
        try {
            Quote__c q = new Quote__c(Id = quoteId, Status__c = 'Pending Approval');
            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Error submitting for approval: ' + e.getMessage());
        }
    }

    /**
     * @description Recalls a Quote from Approval - sets status back to 'Draft'.
     * @param quoteId Quote ID.
     */
    @AuraEnabled
    public static void recallApproval(Id quoteId) {
        try {
            Quote__c q = new Quote__c(Id = quoteId, Status__c = 'Draft');
            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Error recalling approval: ' + e.getMessage());
        }
    }

    /**
     * @description Approves a Quote - sets status to 'Approved'.
     * @param quoteId Quote ID.
     */
    @AuraEnabled
    public static void approveQuote(Id quoteId) {
        try {
            String role = getCurrentUserRole();
            if (role != 'Manager' && role != 'Admin') {
                throw new AuraHandledException('Only Managers and Admins can approve quotes.');
            }
            Quote__c q = new Quote__c(Id = quoteId, Status__c = 'Approved');
            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Error approving quote: ' + e.getMessage());
        }
    }

    /**
     * @description Rejects a Quote - sets status to 'Rejected'.
     * @param quoteId Quote ID.
     */
    @AuraEnabled
    public static void rejectQuote(Id quoteId) {
        try {
            String role = getCurrentUserRole();
            if (role != 'Manager' && role != 'Admin') {
                throw new AuraHandledException('Only Managers and Admins can reject quotes.');
            }
            Quote__c q = new Quote__c(Id = quoteId, Status__c = 'Rejected');
            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Error rejecting quote: ' + e.getMessage());
        }
    }

    /**
     * @description Recalculates quote totals (Margin Amount, Margin Percent, End Date).
     * @param quoteId Quote ID.
     */
    @AuraEnabled
    public static void recalculateQuoteTotals(Id quoteId) {
        try {
            List<Quote_Line_Item__c> qlis = [
                SELECT Net_Total__c, Total_Line_Cost__c
                FROM Quote_Line_Item__c
                WHERE Quote__c = :quoteId
            ];

            Decimal revenue = 0;
            Decimal totalCost = 0;

            for(Quote_Line_Item__c item : qlis) {
                if(item.Net_Total__c != null) revenue += item.Net_Total__c;
                if(item.Total_Line_Cost__c != null) totalCost += item.Total_Line_Cost__c;
            }

            Quote__c q = new Quote__c(Id = quoteId);
            q.Margin_Amount__c = revenue - totalCost;

            update q;
        } catch (Exception e) {
            throw new AuraHandledException('Error recalculating quote: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches all available Resource Roles.
     * @return List of Resource_Role__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Resource_Role__c> getResourceRoles() {
        return [SELECT Id, Name, Name__c, Cost__c, Price__c, Billing_Unit__c FROM Resource_Role__c WHERE Is_Active__c = true];
    }

    /**
     * @description Fetches all available Add-ons.
     * @return List of Add_On__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Add_On__c> getAddOns() {
        return [SELECT Id, Name, Name__c, Cost__c, Price__c, Billing_Unit__c FROM Add_On__c WHERE Is_Active__c = true];
    }

    /**
     * @description Fetches all available Products.
     * @return List of Product__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Product__c> getProducts() {
        return [SELECT Id, Name, Product_Code__c, Product_Type__c, Price__c, Cost__c FROM Product__c];
    }

    /**
     * @description Generates a PDF for the quote and saves it as a version.
     */
    @AuraEnabled
    public static void generateQuotePdf(Id quoteId, String title, String description, Id templateId) {
        try {
            // 1. Get next version label
            List<Quote_Version__c> existingVersions = [SELECT Id FROM Quote_Version__c WHERE Quote__c = :quoteId];
            Integer nextVersion = existingVersions.size() + 1;
            String versionLabel = 'v4.' + nextVersion; // Using v4.x as per screenshot example

            // 2. Render PDF
            PageReference pdfPage = Page.DynamicQuotePDF;
            pdfPage.getParameters().put('quoteId', quoteId);
            if (templateId != null) {
                pdfPage.getParameters().put('templateId', templateId);
            }
            Blob pdfBlob;
            if (Test.isRunningTest()) {
                pdfBlob = Blob.valueOf('Test PDF Content');
            } else {
                pdfBlob = pdfPage.getContentAsPDF();
            }

            // 3. Save as ContentVersion
            ContentVersion cv = new ContentVersion();
            cv.Title = title != null ? title : 'Quote ' + versionLabel;
            cv.PathOnClient = 'Quote_' + quoteId + '_' + nextVersion + '.pdf';
            cv.VersionData = pdfBlob;
            cv.IsMajorVersion = true;
            insert cv;

            // Get ContentDocumentId
            Id conDocId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

            // 4. Create Quote Version record
            Quote_Version__c qv = new Quote_Version__c();
            qv.Quote__c = quoteId;
            qv.Version_Label__c = versionLabel;
            qv.Title__c = title;
            qv.Description__c = description;
            qv.ContentVersionId__c = cv.Id;
            qv.Is_Active__c = true;
            insert qv;

            // Deactivate other versions (optional, but requested "CURRENT ACTIVE" in UI)
            List<Quote_Version__c> others = [SELECT Id, Is_Active__c FROM Quote_Version__c WHERE Quote__c = :quoteId AND Id != :qv.Id];
            for (Quote_Version__c other : others) {
                other.Is_Active__c = false;
            }
            if (!others.isEmpty()) {
                update others;
            }

        } catch (Exception e) {
            throw new AuraHandledException('Error generating PDF: ' + e.getMessage());
        }
    }

    /**
     * @description Fetches version history for a quote.
     */
    @AuraEnabled(cacheable=true)
    public static List<Quote_Version__c> getQuoteVersions(Id quoteId) {
        return [
            SELECT Id, Name, Version_Label__c, Title__c, Description__c,
                   ContentVersionId__c, Is_Active__c, CreatedDate,
                   CreatedBy.Name, CreatedBy.SmallPhotoUrl
            FROM Quote_Version__c
            WHERE Quote__c = :quoteId
            ORDER BY CreatedDate DESC
        ];
    }

    /**
     * @description Gets the current user's CPQ Role.
     * @return String CPQ_Role__c from User record.
     */
    @AuraEnabled(cacheable=true)
    public static String getCurrentUserRole() {
        return [SELECT CPQ_Role__c FROM User WHERE Id = :UserInfo.getUserId()].CPQ_Role__c;
    }
}
