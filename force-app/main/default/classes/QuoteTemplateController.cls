public with sharing class QuoteTemplateController {
    


    @AuraEnabled
    public static void saveTemplateData(String htmlContent, String logoData, String signatureData) {
        // 1. Save HTML
        saveFile('HQ_Default_Quote_Template', 'DefaultTemplate.html', htmlContent);
        
        // 2. Save Logo (raw base64, no data URL prefix)
        if (String.isNotBlank(logoData)) {
            saveImageFile('HQ_CPQ_Logo', 'CompanyLogo.jpg', logoData);
        }
        
        // 3. Save Signature (raw base64, no data URL prefix)
        if (String.isNotBlank(signatureData)) {
            saveImageFile('HQ_CPQ_Signature', 'AuthorizedSignature.jpg', signatureData);
        }
    }

    private static void saveFile(String title, String path, String content) {
        List<ContentDocumentLink> links = [SELECT ContentDocumentId 
                                           FROM ContentDocumentLink 
                                           WHERE LinkedEntityId = :UserInfo.getOrganizationId() 
                                           AND ContentDocument.Title = :title
                                           LIMIT 1];
        
        ContentVersion cv = new ContentVersion(
            Title = title,
            PathOnClient = path,
            VersionData = Blob.valueOf(content),
            IsMajorVersion = true
        );

        if (!links.isEmpty()) {
            cv.ContentDocumentId = links[0].ContentDocumentId;
        } else {
            insert cv;
            cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
            insert new ContentDocumentLink(
                LinkedEntityId = UserInfo.getOrganizationId(),
                ContentDocumentId = cv.ContentDocumentId,
                ShareType = 'V',
                Visibility = 'AllUsers'
            );
            return;
        }
        insert cv;
    }

    /**
     * Saves an image as raw binary bytes decoded from a base64 data URL.
     * The incoming data may be a full data URL (data:image/jpeg;base64,XXXX)
     * or just the raw base64 string. We strip the prefix and decode to binary.
     */
    private static void saveImageFile(String title, String path, String dataUrl) {
        // Strip the data URL prefix if present (data:image/...;base64,)
        String base64Data = dataUrl;
        if (dataUrl.contains(',')) {
            base64Data = dataUrl.substringAfter(',');
        }
        Blob imageBlob = EncodingUtil.base64Decode(base64Data);

        List<ContentDocumentLink> links = [SELECT ContentDocumentId 
                                           FROM ContentDocumentLink 
                                           WHERE LinkedEntityId = :UserInfo.getOrganizationId() 
                                           AND ContentDocument.Title = :title
                                           LIMIT 1];
        
        ContentVersion cv = new ContentVersion(
            Title = title,
            PathOnClient = path,
            VersionData = imageBlob,
            IsMajorVersion = true
        );

        if (!links.isEmpty()) {
            cv.ContentDocumentId = links[0].ContentDocumentId;
        } else {
            insert cv;
            cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
            insert new ContentDocumentLink(
                LinkedEntityId = UserInfo.getOrganizationId(),
                ContentDocumentId = cv.ContentDocumentId,
                ShareType = 'V',
                Visibility = 'AllUsers'
            );
            return;
        }
        insert cv;
    }

    public class TemplateData {
        @AuraEnabled public String html;
        @AuraEnabled public String logo;
        @AuraEnabled public String signature;
    }

    @AuraEnabled(cacheable=true)
    public static TemplateData getTemplateData() {
        TemplateData data = new TemplateData();
        
        Map<String, ContentVersion> files = new Map<String, ContentVersion>();
        for (ContentVersion cv : [SELECT Title, VersionData FROM ContentVersion 
                                  WHERE Title IN ('HQ_Default_Quote_Template', 'HQ_CPQ_Logo', 'HQ_CPQ_Signature') 
                                  AND IsLatest = true]) {
            files.put(cv.Title, cv);
        }
        
        if (files.containsKey('HQ_Default_Quote_Template')) {
            data.html = files.get('HQ_Default_Quote_Template').VersionData.toString();
        }
        if (files.containsKey('HQ_CPQ_Logo')) {
            // Re-encode binary back to base64 data URL for LWC display
            data.logo = 'data:image/jpeg;base64,' + EncodingUtil.base64Encode(files.get('HQ_CPQ_Logo').VersionData);
        }
        if (files.containsKey('HQ_CPQ_Signature')) {
            // Re-encode binary back to base64 data URL for LWC display
            data.signature = 'data:image/jpeg;base64,' + EncodingUtil.base64Encode(files.get('HQ_CPQ_Signature').VersionData);
        }
        
        return data;
    }

    // Deprecate old method by linking to new one
    @AuraEnabled
    public static void saveTemplate(String htmlContent) {
        saveTemplateData(htmlContent, null, null);
    }

    /**
     * @description Core merging logic. Replaces placeholders with real data.
     */
    public static String mergeData(String html, Id quoteId) {
        if (String.isBlank(html)) return '';

        // 1. Fetch Quote and related data
        Quote__c q = [
            SELECT Id, Name, Status__c, Total_Amount__c, Start_Date__c, End_Date__c,
                   Account__c, Account__r.Name, Account__r.BillingStreet, Account__r.BillingCity,
                   Account__r.BillingState, Account__r.BillingPostalCode, Account__r.BillingCountry,
                   CreatedBy.Name, Total_Cost__c, Margin_Amount__c, Margin_Percent__c
            FROM Quote__c 
            WHERE Id = :quoteId
            LIMIT 1
        ];

        // 2. Simple Quote/Account Replacements
        html = replacePlaceholder(html, '[[Quote.Name]]', q.Name);
        html = replacePlaceholder(html, '[[Quote.Status__c]]', q.Status__c);
        html = replacePlaceholder(html, '[[Quote.Total_Amount__c]]', formatCurrency(q.Total_Amount__c));
        html = replacePlaceholder(html, '[[Quote.Total_Cost__c]]', formatCurrency(q.Total_Cost__c));
        html = replacePlaceholder(html, '[[Quote.Margin_Amount__c]]', formatCurrency(q.Margin_Amount__c));
        html = replacePlaceholder(html, '[[Quote.Margin_Percent__c]]', (q.Margin_Percent__c != null ? (q.Margin_Percent__c * 100).setScale(2) + '%' : '0%'));
        html = replacePlaceholder(html, '[[Quote.Start_Date__c]]', formatDate(q.Start_Date__c));
        html = replacePlaceholder(html, '[[Quote.End_Date__c]]', formatDate(q.End_Date__c));
        
        html = replacePlaceholder(html, '[[Account.Name]]', q.Account__r.Name);
        
        String accAddress = '';
        if (q.Account__r.BillingStreet != null) accAddress += q.Account__r.BillingStreet + '<br/>';
        if (q.Account__r.BillingCity != null) accAddress += q.Account__r.BillingCity + ', ';
        if (q.Account__r.BillingState != null) accAddress += q.Account__r.BillingState + ' ';
        if (q.Account__r.BillingPostalCode != null) accAddress += q.Account__r.BillingPostalCode;
        if (q.Account__r.BillingCountry != null) accAddress += '<br/>' + q.Account__r.BillingCountry;
        
        html = replacePlaceholder(html, '[[Account.Address]]', accAddress);
        
        html = replacePlaceholder(html, '[[User.Name]]', q.CreatedBy.Name);
        html = replacePlaceholder(html, '[[Today]]', Date.today().format());

        // 3. Inject Company Settings fields
        Company_Settings__c cs = Company_Settings__c.getOrgDefaults();
        if (cs != null) {
            html = replacePlaceholder(html, '[[Company.Name]]', cs.Company_Name__c);
            
            String compAddress = '';
            if (cs.Street_Address__c != null) compAddress += cs.Street_Address__c + '<br/>';
            if (cs.City__c != null) compAddress += cs.City__c + ' ';
            if (cs.State_Province__c != null) compAddress += cs.State_Province__c + ' ';
            if (cs.Zip_Postal_Code__c != null) compAddress += cs.Zip_Postal_Code__c;
            if (cs.Country__c != null) compAddress += '<br/>' + cs.Country__c;
            
            html = replacePlaceholder(html, '[[Company.Address]]', compAddress);
            html = replacePlaceholder(html, '[[Company.Phone]]', cs.Company_Phone__c);
            html = replacePlaceholder(html, '[[Company.Email]]', cs.Company_Email__c);
            html = replacePlaceholder(html, '[[Signer.Title]]', cs.Signer_Title__c);
        }

        // 4. Inject Dynamic Image Placeholders (Logo & Signature)
        // For Visualforce PDF (Flying Saucer/iText), we must use base64-encoded data URIs.
        // We use EncodingUtil.base64Encode() on the raw binary VersionData blob.
        if (html.contains('[[Company.Logo]]') || html.contains('[[Company.Signature]]')) {
            Map<String, String> imageMap = new Map<String, String>();
            for (ContentVersion cv : [SELECT Title, VersionData FROM ContentVersion 
                                      WHERE Title IN ('HQ_CPQ_Logo', 'HQ_CPQ_Signature') 
                                      AND IsLatest = true]) {
                // Build proper data URI from raw binary blob
                String dataUri = 'data:image/jpeg;base64,' + EncodingUtil.base64Encode(cv.VersionData);
                imageMap.put(cv.Title, dataUri);
            }
            
            html = replacePlaceholder(html, '[[Company.Logo]]', imageMap.get('HQ_CPQ_Logo'));
            html = replacePlaceholder(html, '[[Company.Signature]]', imageMap.get('HQ_CPQ_Signature'));
        }

        // 3. Handle Line Item Loop
        if (html.contains('[[LINE_ITEMS_START]]') && html.contains('[[LINE_ITEMS_END]]')) {
            String part1 = html.substringBefore('[[LINE_ITEMS_START]]');
            String part2 = html.substringAfter('[[LINE_ITEMS_END]]');
            String loopTemplate = html.substringBetween('[[LINE_ITEMS_START]]', '[[LINE_ITEMS_END]]');

            List<Quote_Line_Item__c> items = [
                SELECT Name__c, Item_Type__c, Task__c, Phase__c, Quantity__c, Unit_Price__c, Net_Total__c 
                FROM Quote_Line_Item__c 
                WHERE Quote__c = :quoteId 
                ORDER BY Phase__c, CreatedDate
            ];

            String itemsHtml = '';
            for (Quote_Line_Item__c item : items) {
                String row = loopTemplate;
                row = replacePlaceholder(row, '[[Item.Name__c]]', item.Name__c);
                row = replacePlaceholder(row, '[[Item.Item_Type__c]]', item.Item_Type__c);
                row = replacePlaceholder(row, '[[Item.Task__c]]', item.Task__c);
                row = replacePlaceholder(row, '[[Item.Phase__c]]', item.Phase__c);
                row = replacePlaceholder(row, '[[Item.Quantity__c]]', String.valueOf(item.Quantity__c));
                row = replacePlaceholder(row, '[[Item.Unit_Price__c]]', formatCurrency(item.Unit_Price__c));
                row = replacePlaceholder(row, '[[Item.Net_Total__c]]', formatCurrency(item.Net_Total__c));
                itemsHtml += row;
            }
            html = part1 + itemsHtml + part2;
        }

        return html;
    }

    private static String replacePlaceholder(String text, String placeholder, String value) {
        if (text == null) return null;
        return text.replace(placeholder, value != null ? value : '');
    }

    private static String formatCurrency(Decimal val) {
        if (val == null) return '$0.00';
        return '$' + val.setScale(2).toPlainString();
    }

    private static String formatDate(Date d) {
        if (d == null) return '-';
        return d.format();
    }
}
