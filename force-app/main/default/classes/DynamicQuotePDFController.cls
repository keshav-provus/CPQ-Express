public with sharing class DynamicQuotePDFController {
    public String mergedHtml { get; private set; }

    public DynamicQuotePDFController() {
        String quoteId = ApexPages.currentPage().getParameters().get('quoteId');
        String templateId = ApexPages.currentPage().getParameters().get('templateId');

        try {
            if (String.isNotBlank(quoteId)) {
                Quote_Template__c template;
                
                if (String.isNotBlank(templateId)) {
                    template = [SELECT HTML_Content__c FROM Quote_Template__c WHERE Id = :templateId LIMIT 1];
                } else {
                    List<Quote_Template__c> defaults = [SELECT HTML_Content__c FROM Quote_Template__c WHERE Is_Default__c = true LIMIT 1];
                    if (!defaults.isEmpty()) {
                        template = defaults[0];
                    }
                }

                if (template != null) {
                    mergedHtml = QuoteTemplateController.mergeData(template.HTML_Content__c, quoteId);
                } else {
                    mergedHtml = '<div style="color: red; font-family: sans-serif; padding: 20px;">' +
                                '<h2>Template Error</h2>' +
                                '<p>No template selected and no default template found. Please select a template in the Quote Header PDF generation menu.</p>' +
                                '</div>';
                }
            } else {
                mergedHtml = '<h2 style="color: red;">Error: Missing quoteId parameter.</h2>';
            }
        } catch (Exception e) {
            mergedHtml = '<div style="color: red; font-family: sans-serif; padding: 20px;">' +
                        '<h2>Rendering Error</h2>' +
                        '<p>' + e.getMessage() + '</p>' +
                        '</div>';
        }
    }
}
