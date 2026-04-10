public with sharing class QuoteTemplateController {

    // ─── Constants ────────────────────────────────────────────────────────────
    private static final String LOGO_RESOURCE      = 'HQ_CPQ_Logo';
    private static final String SIGNATURE_RESOURCE = 'HQ_CPQ_Signature';
    private static final String TEMPLATE_TITLE     = 'HQ_Default_Quote_Template';
    private static final String API_VERSION        = 'v62.0';

    // ─── Save ─────────────────────────────────────────────────────────────────

    @AuraEnabled
    public static void saveTemplateData(String htmlContent, String logoData, String signatureData) {
        // 1. Save HTML template to ContentVersion (DML only — no callouts in this transaction)
        saveHtmlFile(TEMPLATE_TITLE, 'DefaultTemplate.html', htmlContent);

        // 2. Async Tooling API callout to update Static Resources (must be @future to separate from DML)
        if (String.isNotBlank(logoData) && logoData.startsWith('data:')) {
            String base64 = logoData.substringAfter(',');
            updateStaticResourceAsync(LOGO_RESOURCE, base64, 'image/jpeg');
        }
        if (String.isNotBlank(signatureData) && signatureData.startsWith('data:')) {
            String base64 = signatureData.substringAfter(',');
            updateStaticResourceAsync(SIGNATURE_RESOURCE, base64, 'image/jpeg');
        }
    }

    /**
     * Saves (or updates) the HTML template in a ContentVersion linked to the org.
     */
    private static void saveHtmlFile(String title, String path, String content) {
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :UserInfo.getOrganizationId()
              AND ContentDocument.Title = :title
            LIMIT 1
        ];

        ContentVersion cv = new ContentVersion(
            Title          = title,
            PathOnClient   = path,
            VersionData    = Blob.valueOf(content),
            IsMajorVersion = true
        );

        if (!links.isEmpty()) {
            cv.ContentDocumentId = links[0].ContentDocumentId;
        } else {
            insert cv;
            cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
            insert new ContentDocumentLink(
                LinkedEntityId    = UserInfo.getOrganizationId(),
                ContentDocumentId = cv.ContentDocumentId,
                ShareType         = 'V',
                Visibility        = 'AllUsers'
            );
            return;
        }
        insert cv;
    }

    /**
     * Uses the Salesforce Tooling API to update a Static Resource's body.
     * Must be @future(callout=true) to run after the DML transaction commits.
     * SessionId is captured before the future call as it's unavailable cross-transaction.
     */
    @future(callout=true)
    private static void updateStaticResourceAsync(String resourceName, String base64Data, String contentType) {
        String baseUrl = URL.getOrgDomainUrl().toExternalForm();
        String endpoint = baseUrl + '/services/data/' + API_VERSION + '/tooling/sobjects/StaticResource';

        // Query for existing resource ID
        String soqlUrl = baseUrl + '/services/data/' + API_VERSION +
            '/tooling/query?q=' + EncodingUtil.urlEncode(
                'SELECT Id FROM StaticResource WHERE Name = \'' + resourceName + '\' LIMIT 1', 'UTF-8');

        HttpRequest queryReq = new HttpRequest();
        queryReq.setEndpoint(soqlUrl);
        queryReq.setMethod('GET');
        queryReq.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        queryReq.setHeader('Content-Type', 'application/json');

        HttpResponse queryRes = new Http().send(queryReq);
        Map<String, Object> queryBody = (Map<String, Object>) JSON.deserializeUntyped(queryRes.getBody());
        List<Object> records = (List<Object>) queryBody.get('records');

        String method;
        String requestEndpoint;
        Map<String, Object> payload = new Map<String, Object>{
            'Body'        => base64Data,
            'ContentType' => contentType
        };

        if (records != null && !records.isEmpty()) {
            // Update existing
            Map<String, Object> record = (Map<String, Object>) records[0];
            requestEndpoint = endpoint + '/' + (String) record.get('Id');
            method = 'PATCH';
        } else {
            // Create new
            requestEndpoint = endpoint;
            method = 'POST';
            payload.put('Name', resourceName);
            payload.put('CacheControl', 'Public');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint(requestEndpoint);
        req.setMethod(method);
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(payload));
        req.setTimeout(120000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            System.debug('Static Resource update failed [' + res.getStatusCode() + ']: ' + res.getBody());
        } else {
            System.debug('Static Resource "' + resourceName + '" updated successfully.');
        }
    }

    // ─── Load ─────────────────────────────────────────────────────────────────

    public class TemplateData {
        @AuraEnabled public String html;
        @AuraEnabled public String logo;
        @AuraEnabled public String signature;
    }

    @AuraEnabled(cacheable=true)
    public static TemplateData getTemplateData() {
        TemplateData data = new TemplateData();

        // Load saved HTML template
        List<ContentVersion> versions = [
            SELECT VersionData
            FROM ContentVersion
            WHERE Title = :TEMPLATE_TITLE
              AND IsLatest = true
            LIMIT 1
        ];
        if (!versions.isEmpty()) {
            data.html = versions[0].VersionData.toString();
        }

        // Return static resource URL paths — the LWC displays them as <img src="...">
        // Only return a URL if the resource has been uploaded (exists in the org)
        Set<String> names = new Set<String>{ LOGO_RESOURCE, SIGNATURE_RESOURCE };
        for (StaticResource sr : [SELECT Name FROM StaticResource WHERE Name IN :names]) {
            if (sr.Name == LOGO_RESOURCE)      data.logo      = '/resource/' + LOGO_RESOURCE;
            if (sr.Name == SIGNATURE_RESOURCE) data.signature = '/resource/' + SIGNATURE_RESOURCE;
        }

        return data;
    }

    // ─── Legacy shim ──────────────────────────────────────────────────────────

    @AuraEnabled
    public static void saveTemplate(String htmlContent) {
        saveTemplateData(htmlContent, null, null);
    }

    // ─── PDF Merge ────────────────────────────────────────────────────────────

    /**
     * Core merging logic – replaces all placeholders with live data.
     * Images use absolute Static Resource URLs so Flying Saucer can fetch them.
     */
    public static String mergeData(String html, Id quoteId) {
        if (String.isBlank(html)) return '';

        // 1. Fetch Quote data
        Quote__c q = [
            SELECT Id, Name, Status__c, Total_Amount__c, Start_Date__c, End_Date__c,
                   Account__c, Account__r.Name, Account__r.BillingStreet, Account__r.BillingCity,
                   Account__r.BillingState, Account__r.BillingPostalCode, Account__r.BillingCountry,
                   CreatedBy.Name, Total_Cost__c, Margin_Amount__c, Margin_Percent__c
            FROM Quote__c
            WHERE Id = :quoteId
            LIMIT 1
        ];

        // 2. Quote & Account replacements
        html = replacePlaceholder(html, '[[Quote.Name]]',             q.Name);
        html = replacePlaceholder(html, '[[Quote.Status__c]]',        q.Status__c);
        html = replacePlaceholder(html, '[[Quote.Total_Amount__c]]',  formatCurrency(q.Total_Amount__c));
        html = replacePlaceholder(html, '[[Quote.Total_Cost__c]]',    formatCurrency(q.Total_Cost__c));
        html = replacePlaceholder(html, '[[Quote.Margin_Amount__c]]', formatCurrency(q.Margin_Amount__c));
        html = replacePlaceholder(html, '[[Quote.Margin_Percent__c]]',
            q.Margin_Percent__c != null ? (q.Margin_Percent__c * 100).setScale(2) + '%' : '0%');
        html = replacePlaceholder(html, '[[Quote.Start_Date__c]]', formatDate(q.Start_Date__c));
        html = replacePlaceholder(html, '[[Quote.End_Date__c]]',   formatDate(q.End_Date__c));
        html = replacePlaceholder(html, '[[Account.Name]]',        q.Account__r.Name);

        String accAddress = '';
        if (q.Account__r.BillingStreet     != null) accAddress += q.Account__r.BillingStreet + '<br/>';
        if (q.Account__r.BillingCity       != null) accAddress += q.Account__r.BillingCity + ', ';
        if (q.Account__r.BillingState      != null) accAddress += q.Account__r.BillingState + ' ';
        if (q.Account__r.BillingPostalCode != null) accAddress += q.Account__r.BillingPostalCode;
        if (q.Account__r.BillingCountry    != null) accAddress += '<br/>' + q.Account__r.BillingCountry;
        html = replacePlaceholder(html, '[[Account.Address]]', accAddress);
        html = replacePlaceholder(html, '[[User.Name]]', q.CreatedBy.Name);
        html = replacePlaceholder(html, '[[Today]]',     Date.today().format());

        // 3. Company Settings replacements
        Company_Settings__c cs = Company_Settings__c.getOrgDefaults();
        if (cs != null) {
            html = replacePlaceholder(html, '[[Company.Name]]',  cs.Company_Name__c);
            html = replacePlaceholder(html, '[[Company.Phone]]', cs.Company_Phone__c);
            html = replacePlaceholder(html, '[[Company.Email]]', cs.Company_Email__c);
            html = replacePlaceholder(html, '[[Signer.Title]]',  cs.Signer_Title__c);

            String compAddress = '';
            if (cs.Street_Address__c   != null) compAddress += cs.Street_Address__c + '<br/>';
            if (cs.City__c             != null) compAddress += cs.City__c + ' ';
            if (cs.State_Province__c   != null) compAddress += cs.State_Province__c + ' ';
            if (cs.Zip_Postal_Code__c  != null) compAddress += cs.Zip_Postal_Code__c;
            if (cs.Country__c          != null) compAddress += '<br/>' + cs.Country__c;
            html = replacePlaceholder(html, '[[Company.Address]]', compAddress);
        }

        // 4. Image placeholders — use absolute Static Resource URLs so the
        //    Visualforce PDF renderer (Flying Saucer) can fetch them via HTTP.
        if (html.contains('[[Company.Logo]]') || html.contains('[[Company.Signature]]')) {
            String baseUrl = URL.getOrgDomainUrl().toExternalForm();
            html = replacePlaceholder(html, '[[Company.Logo]]',
                baseUrl + '/resource/' + LOGO_RESOURCE);
            html = replacePlaceholder(html, '[[Company.Signature]]',
                baseUrl + '/resource/' + SIGNATURE_RESOURCE);
        }

        // 5. Line item loop
        if (html.contains('[[LINE_ITEMS_START]]') && html.contains('[[LINE_ITEMS_END]]')) {
            String part1        = html.substringBefore('[[LINE_ITEMS_START]]');
            String part2        = html.substringAfter('[[LINE_ITEMS_END]]');
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
                row = replacePlaceholder(row, '[[Item.Name__c]]',       item.Name__c);
                row = replacePlaceholder(row, '[[Item.Item_Type__c]]',  item.Item_Type__c);
                row = replacePlaceholder(row, '[[Item.Task__c]]',       item.Task__c);
                row = replacePlaceholder(row, '[[Item.Phase__c]]',      item.Phase__c);
                row = replacePlaceholder(row, '[[Item.Quantity__c]]',   String.valueOf(item.Quantity__c));
                row = replacePlaceholder(row, '[[Item.Unit_Price__c]]', formatCurrency(item.Unit_Price__c));
                row = replacePlaceholder(row, '[[Item.Net_Total__c]]',  formatCurrency(item.Net_Total__c));
                itemsHtml += row;
            }
            html = part1 + itemsHtml + part2;
        }

        return html;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static String replacePlaceholder(String text, String placeholder, String value) {
        if (text == null) return null;
        return text.replace(placeholder, value != null ? value : '');
    }

    private static String formatCurrency(Decimal val) {
        if (val == null) val = 0;
        String isoCode = 'USD';
        Company_Settings__c cs = Company_Settings__c.getOrgDefaults();
        if (cs != null && cs.Default_Currency__c != null) {
            isoCode = cs.Default_Currency__c;
        }
        Map<String, String> symbolMap = new Map<String, String>{
            'USD' => '$', 'EUR' => '€', 'GBP' => '£', 'JPY' => '¥',
            'CNY' => '¥', 'INR' => '₹', 'KRW' => '₩', 'BRL' => 'R$',
            'AUD' => 'A$', 'CAD' => 'C$', 'CHF' => 'CHF ', 'MXN' => 'MX$',
            'SGD' => 'S$', 'HKD' => 'HK$', 'NZD' => 'NZ$', 'SEK' => 'kr',
            'NOK' => 'kr', 'DKK' => 'kr', 'ZAR' => 'R', 'RUB' => '₽',
            'TRY' => '₺', 'PLN' => 'zł', 'THB' => '฿', 'IDR' => 'Rp',
            'MYR' => 'RM', 'PHP' => '₱', 'CZK' => 'Kč', 'ILS' => '₪',
            'CLP' => 'CLP$', 'AED' => 'AED ', 'SAR' => 'SAR ', 'TWD' => 'NT$'
        };
        String symbol = symbolMap.containsKey(isoCode) ? symbolMap.get(isoCode) : isoCode + ' ';
        return symbol + val.setScale(2).toPlainString();
    }

    private static String formatDate(Date d) {
        if (d == null) return '-';
        return d.format();
    }
}
