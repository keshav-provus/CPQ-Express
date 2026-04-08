public with sharing class QuoteTemplateController {
    
    @AuraEnabled(cacheable=true)
    public static List<Quote_Template__c> getTemplates() {
        return [
            SELECT Id, Name, Description__c, Is_Default__c, CreatedDate 
            FROM Quote_Template__c 
            ORDER BY Name ASC
        ];
    }

    @AuraEnabled
    public static Id saveTemplate(String name, String description, String htmlContent) {
        Quote_Template__c qt = new Quote_Template__c(
            Name = name,
            Description__c = description,
            HTML_Content__c = htmlContent
        );
        insert qt;
        return qt.Id;
    }

    @AuraEnabled
    public static void setDefaultTemplate(Id templateId) {
        List<Quote_Template__c> templates = [SELECT Id, Is_Default__c FROM Quote_Template__c];
        for (Quote_Template__c qt : templates) {
            qt.Is_Default__c = (qt.Id == templateId);
        }
        update templates;
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
        html = replacePlaceholder(html, '[[Account.Address]]', 
            (q.Account__r.BillingStreet != null ? q.Account__r.BillingStreet + ', ' : '') + 
            (q.Account__r.BillingCity != null ? q.Account__r.BillingCity + ' ' : '') + 
            (q.Account__r.BillingState != null ? q.Account__r.BillingState : '')
        );
        
        html = replacePlaceholder(html, '[[User.Name]]', q.CreatedBy.Name);
        html = replacePlaceholder(html, '[[Today]]', Date.today().format());

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
