public with sharing class DynamicQuotePDFController {
    public String mergedHtml { get; private set; }

    public DynamicQuotePDFController() {
        String quoteId = ApexPages.currentPage().getParameters().get('quoteId');

        try {
            if (String.isNotBlank(quoteId)) {
                List<ContentVersion> versions = [
                    SELECT VersionData 
                    FROM ContentVersion 
                    WHERE Title = 'HQ_Default_Quote_Template'
                      AND IsLatest = true 
                    LIMIT 1
                ];

                if (!versions.isEmpty()) {
                    mergedHtml = QuoteTemplateController.mergeData(versions[0].VersionData.toString(), quoteId);
                } else {
                    mergedHtml = '<div style="color: red; font-family: sans-serif; padding: 20px;">' +
                                '<h2>Template Error</h2>' +
                                '<p>No default template found. Please have your admin save a quote template first.</p>' +
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
