public with sharing class QuotePDFController {
    public Quote__c quote { get; private set; }
    public List<Quote_Line_Item__c> lineItems { get; private set; }

    // Company settings from Admin
    public String companyName { get; private set; }
    public String companyAddress { get; private set; }
    public String companyEmail { get; private set; }
    public String companyPhone { get; private set; }
    public String signerTitle { get; private set; }
    public String todayDate { get; private set; }
    public String currencySymbol { get; private set; }
    public String currencyIso { get; private set; }

    // Image URLs (absolute for PDF renderer)
    public String logoUrl { get; private set; }
    public String signatureUrl { get; private set; }
    public Boolean hasLogo { get; private set; }
    public Boolean hasSignature { get; private set; }

    // Phase-grouped line items
    public List<PhaseGroup> phaseGroups { get; private set; }

    // Computed totals
    public String formattedSubtotal { get; private set; }
    public String formattedTotalCost { get; private set; }
    public String formattedMarginAmount { get; private set; }
    public String formattedTotalAmount { get; private set; }
    public String formattedMarginPercent { get; private set; }
    public Integer totalLineItemCount { get; private set; }

    // Status badge
    public String statusClass { get; private set; }

    public QuotePDFController() {
        Id quoteId = ApexPages.currentPage().getParameters().get('id');
        if (quoteId == null) {
            quoteId = ApexPages.currentPage().getParameters().get('quoteId');
        }

        // 1. Load Company Settings
        Company_Settings__c cs = Company_Settings__c.getOrgDefaults();
        if (cs != null) {
            companyName = cs.Company_Name__c != null ? cs.Company_Name__c : 'Your Company';
            companyEmail = cs.Company_Email__c;
            companyPhone = cs.Company_Phone__c;
            signerTitle = cs.Signer_Title__c;
            currencyIso = cs.Default_Currency__c != null ? cs.Default_Currency__c : 'USD';

            String addr = '';
            if (cs.Street_Address__c != null) addr += cs.Street_Address__c;
            if (cs.City__c != null) addr += (addr.length() > 0 ? ', ' : '') + cs.City__c;
            if (cs.State_Province__c != null) addr += ' ' + cs.State_Province__c;
            if (cs.Zip_Postal_Code__c != null) addr += ' ' + cs.Zip_Postal_Code__c;
            if (cs.Country__c != null) addr += (addr.length() > 0 ? ', ' : '') + cs.Country__c;
            companyAddress = addr;
        } else {
            companyName = 'Your Company';
            companyAddress = '';
            companyEmail = '';
            companyPhone = '';
            signerTitle = '';
            currencyIso = 'USD';
        }
        currencySymbol = getCurrencySymbol(currencyIso);
        todayDate = Date.today().format();

        // 2. Resolve logo & signature static resource URLs
        String baseUrl = URL.getOrgDomainUrl().toExternalForm();
        hasLogo = false;
        hasSignature = false;
        try {
            Set<String> names = new Set<String>{ 'HQ_CPQ_Logo', 'HQ_CPQ_Signature' };
            for (StaticResource sr : [SELECT Name FROM StaticResource WHERE Name IN :names]) {
                if (sr.Name == 'HQ_CPQ_Logo') {
                    logoUrl = baseUrl + '/resource/HQ_CPQ_Logo';
                    hasLogo = true;
                }
                if (sr.Name == 'HQ_CPQ_Signature') {
                    signatureUrl = baseUrl + '/resource/HQ_CPQ_Signature';
                    hasSignature = true;
                }
            }
        } catch (Exception e) {
            // Static resources may not exist yet
        }

        // 3. Load Quote and Line Items
        if (quoteId != null) {
            quote = [
                SELECT Id, Name, Status__c, Description__c,
                       Opportunity__c, Opportunity__r.Name,
                       Account__c, Account__r.Name,
                       Account__r.BillingStreet, Account__r.BillingCity,
                       Account__r.BillingState, Account__r.BillingPostalCode,
                       Account__r.BillingCountry,
                       CreatedById, CreatedBy.Name, CreatedBy.Email,
                       Total_Amount__c, Total_Cost__c,
                       Margin_Percent__c, Margin_Amount__c,
                       Start_Date__c, End_Date__c, Calculated_End_Date__c,
                       Valid_Until__c, Phase_List__c,
                       Time_Period_Metric__c, Time_Period_Count__c
                FROM Quote__c
                WHERE Id = :quoteId
                LIMIT 1
            ];

            lineItems = [
                SELECT Id, Name__c, Item_Type__c, Task__c, Phase__c,
                       Quantity__c, Unit_Price__c, Unit_Cost__c,
                       Discount_Percent__c, Net_Total__c, Total_Line_Cost__c
                FROM Quote_Line_Item__c
                WHERE Quote__c = :quoteId
                ORDER BY Phase__c NULLS LAST, Item_Type__c, CreatedDate
            ];

            totalLineItemCount = lineItems.size();

            // Format totals
            Decimal subtotal = 0;
            for (Quote_Line_Item__c item : lineItems) {
                subtotal += (item.Quantity__c != null ? item.Quantity__c : 0) * (item.Unit_Price__c != null ? item.Unit_Price__c : 0);
            }
            formattedSubtotal = fmtCurrency(subtotal);
            formattedTotalCost = fmtCurrency(quote.Total_Cost__c);
            formattedMarginAmount = fmtCurrency(quote.Margin_Amount__c);
            formattedTotalAmount = fmtCurrency(quote.Total_Amount__c);
            formattedMarginPercent = quote.Margin_Percent__c != null
                ? String.valueOf(quote.Margin_Percent__c.setScale(1)) + '%' : '0.0%';

            // Status class
            if (quote.Status__c == 'Approved') statusClass = 'status-approved';
            else if (quote.Status__c == 'Pending Approval') statusClass = 'status-pending';
            else if (quote.Status__c == 'Rejected') statusClass = 'status-rejected';
            else statusClass = 'status-draft';

            // 4. Phase grouping
            buildPhaseGroups();
        }
    }

    // ─── Phase Grouping ────────────────────────────────────────────────────

    private void buildPhaseGroups() {
        Map<String, List<LineItemWrapper>> phaseMap = new Map<String, List<LineItemWrapper>>();
        List<String> phaseOrder = new List<String>();
        Integer rowNum = 0;

        for (Quote_Line_Item__c item : lineItems) {
            String phase = item.Phase__c != null ? item.Phase__c : 'General';
            if (!phaseMap.containsKey(phase)) {
                phaseMap.put(phase, new List<LineItemWrapper>());
                phaseOrder.add(phase);
            }
            rowNum++;
            phaseMap.get(phase).add(new LineItemWrapper(item, rowNum, currencySymbol));
        }

        phaseGroups = new List<PhaseGroup>();
        for (String phase : phaseOrder) {
            List<LineItemWrapper> items = phaseMap.get(phase);
            Decimal phaseTotal = 0;
            for (LineItemWrapper w : items) {
                phaseTotal += w.netTotalRaw;
            }
            phaseGroups.add(new PhaseGroup(phase, items, fmtCurrency(phaseTotal)));
        }
    }

    // ─── Inner Classes ─────────────────────────────────────────────────────

    public class PhaseGroup {
        public String phaseName { get; set; }
        public List<LineItemWrapper> items { get; set; }
        public String phaseTotal { get; set; }
        public Integer itemCount { get; set; }

        public PhaseGroup(String name, List<LineItemWrapper> items, String total) {
            this.phaseName = name;
            this.items = items;
            this.phaseTotal = total;
            this.itemCount = items.size();
        }
    }

    public class LineItemWrapper {
        public String name { get; set; }
        public String itemType { get; set; }
        public String task { get; set; }
        public String formattedQty { get; set; }
        public String formattedUnitPrice { get; set; }
        public String formattedNetTotal { get; set; }
        public String discountLabel { get; set; }
        public Boolean hasDiscount { get; set; }
        public Decimal netTotalRaw { get; set; }
        public Integer rowNumber { get; set; }
        public String rowClass { get; set; }
        public String typeIcon { get; set; }

        public LineItemWrapper(Quote_Line_Item__c item, Integer num, String sym) {
            this.name = item.Name__c;
            this.itemType = item.Item_Type__c;
            this.task = item.Task__c;
            this.formattedQty = item.Quantity__c != null ? String.valueOf(item.Quantity__c.intValue()) : '0';
            this.formattedUnitPrice = sym + formatDecimal(item.Unit_Price__c);
            this.netTotalRaw = item.Net_Total__c != null ? item.Net_Total__c : 0;
            this.formattedNetTotal = sym + formatDecimal(item.Net_Total__c);
            this.hasDiscount = item.Discount_Percent__c != null && item.Discount_Percent__c > 0;
            this.discountLabel = hasDiscount ? '-' + item.Discount_Percent__c.setScale(0).toPlainString() + '%' : '';
            this.rowNumber = num;
            this.rowClass = Math.mod(num, 2) == 0 ? 'row-even' : 'row-odd';
            if (item.Item_Type__c == 'Resource Role') this.typeIcon = '●';
            else if (item.Item_Type__c == 'Product') this.typeIcon = '■';
            else this.typeIcon = '▲';
        }

        private String formatDecimal(Decimal val) {
            if (val == null) return '0.00';
            return val.setScale(2).toPlainString();
        }
    }

    // ─── Currency Helpers ──────────────────────────────────────────────────

    private String fmtCurrency(Decimal val) {
        if (val == null) val = 0;
        return currencySymbol + val.setScale(2).toPlainString();
    }

    private static String getCurrencySymbol(String isoCode) {
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
        return symbolMap.containsKey(isoCode) ? symbolMap.get(isoCode) : isoCode + ' ';
    }
}
