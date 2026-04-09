import { LightningElement, track } from 'lwc';
import saveTemplateData from '@salesforce/apex/QuoteTemplateController.saveTemplateData';
import getTemplateData from '@salesforce/apex/QuoteTemplateController.getTemplateData';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqTemplateManager extends LightningElement {
    @track isSaving = false;

    @track logoDataUrl = '';
    @track signatureDataUrl = '';

    connectedCallback() {
        this.loadExistingTemplate();
    }

    async loadExistingTemplate() {
        try {
            const data = await getTemplateData();
            if (data) {
                // Note: We don't restore the full HTML to the 'canvas' because the builder 
                // generates it fresh based on Logo and Signature.
                if (data.logo) this.logoDataUrl = data.logo;
                if (data.signature) this.signatureDataUrl = data.signature;
            }
        } catch (error) {
            console.error('Error loading template:', error);
        }
    }

    triggerLogoUpload() {
        const input = this.template.querySelector('[data-id="logoInput"]');
        if (input) input.click();
    }

    triggerSignatureUpload() {
        const input = this.template.querySelector('[data-id="signatureInput"]');
        if (input) input.click();
    }

    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.readFileAsResizedDataURL(file, 400, (dataUrl) => {
                this.logoDataUrl = dataUrl;
            });
        }
    }

    handleSignatureUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.readFileAsResizedDataURL(file, 400, (dataUrl) => {
                this.signatureDataUrl = dataUrl;
            });
        }
    }

    readFileAsResizedDataURL(file, maxWidth, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress as JPEG - reduced to 0.6 quality for better PDF compatibility
                callback(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    generateHTMLContent() {
        // Note: Images are stored as Static Resources and injected by Apex's mergeData().
        // The [[Company.Logo]] and [[Company.Signature]] placeholders are replaced
        // server-side with the static resource URL — no display toggling needed here.
        return `
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    .header-table { margin-bottom: 40px; }
                    .header-left { width: 60%; vertical-align: top; }
                    .header-right { width: 40%; text-align: right; vertical-align: top; }
                    .company-logo { max-height: 50px; max-width: 200px; margin-bottom: 20px; display: block; }
                    .company-info { color: #666; line-height: 1.4; }
                    .quote-badge { background-color: #f0f2f6; color: #5a6b8c; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 10px; display: inline-block; margin-bottom: 10px; }
                    .quote-number { font-size: 24px; color: #2563eb; font-weight: bold; margin-bottom: 15px; }
                    .quote-meta { color: #555; line-height: 1.5; font-size: 11px; }
                    .meta-label { color: #888; margin-right: 5px; }

                    .prepared-for { text-align: right; margin-bottom: 50px; }
                    .prep-label { color: #8b9bb4; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; }
                    .prep-name { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 2px; }
                    .prep-attn { color: #666; font-size: 11px; }

                    .items-table { margin-bottom: 40px; }
                    .items-table th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #eee; color: #8b9bb4; font-size: 10px; letter-spacing: 1px; font-weight: bold; }
                    .items-table th.right { text-align: right; }
                    .items-table td { padding: 16px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
                    .items-table td.right { text-align: right; }
                    .item-name { font-weight: bold; color: #333; margin-bottom: 4px; font-size: 13px; }
                    .item-desc { color: #888; font-size: 11px; font-style: italic; }
                    .item-val { font-size: 13px; }
                    .item-disc { color: #2563eb; font-size: 13px; }

                    .summary-table { width: 50%; float: right; margin-bottom: 50px; }
                    .summary-table td { padding: 8px; }
                    .summary-table .s-label { color: #666; }
                    .summary-table .s-val { text-align: right; font-weight: bold; }
                    .summary-table .highlight { color: #2563eb; font-weight: bold; }
                    .grand-total-row td { border-top: 2px solid #eee; padding-top: 15px !important; margin-top: 5px; }
                    .grand-total-row .s-label { font-weight: bold; color: #333; font-size: 14px; }
                    .grand-total-row .s-val { font-size: 24px; color: #333; }

                    .clear { clear: both; }

                    .footer-table { width: 100%; margin-top: 50px; page-break-inside: avoid; }
                    .signature-box { width: 250px; text-align: center; margin: 0 auto; }
                    .sig-label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 10px; }
                    .sig-img-container { height: 60px; margin-bottom: 10px; }
                    .sig-img { max-height: 60px; max-width: 200px; }
                    .sig-line { border-bottom: 1px solid #333; margin-bottom: 5px; }
                    .sig-title { font-size: 11px; color: #666; }
                </style>
            </head>
            <body>
                <table class="header-table">
                    <tr>
                        <td class="header-left">
                            <img src="[[Company.Logo]]" class="company-logo" />
                            <div class="company-info">
                                <strong>[[Company.Name]]</strong><br/>
                                [[Company.Address]]<br/><br/>
                                [[Company.Phone]]<br/>
                                [[Company.Email]]
                            </div>
                        </td>
                        <td class="header-right">
                            <div class="quote-badge">SALES QUOTE</div>
                            <div class="quote-number">[[Quote.Name]]</div>
                            <div class="quote-meta">
                                <div><span class="meta-label">Created:</span> [[Today]]</div>
                                <div><span class="meta-label">Expires:</span> [[Quote.End_Date__c]]</div>
                                <div><span class="meta-label">Owner:</span> [[User.Name]]</div>
                            </div>
                        </td>
                    </tr>
                </table>

                <div class="prepared-for">
                    <div class="prep-label">PREPARED FOR</div>
                    <div class="prep-name">[[Account.Name]]</div>
                    <div class="prep-attn">[[Account.Address]]</div>
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th>PRODUCT DETAILS</th>
                            <th class="right">QTY</th>
                            <th class="right">LIST PRICE</th>
                            <th class="right">NET TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        [[LINE_ITEMS_START]]
                        <tr>
                            <td>
                                <div class="item-name">[[Item.Name__c]]</div>
                                <div class="item-desc">[[Item.Item_Type__c]] - [[Item.Phase__c]]</div>
                            </td>
                            <td class="right item-val">[[Item.Quantity__c]]</td>
                            <td class="right item-val">[[Item.Unit_Price__c]]</td>
                            <td class="right item-val">[[Item.Net_Total__c]]</td>
                        </tr>
                        [[LINE_ITEMS_END]]
                    </tbody>
                </table>

                <table class="summary-table">
                    <tr>
                        <td class="s-label">Total Cost</td>
                        <td class="s-val">[[Quote.Total_Cost__c]]</td>
                    </tr>
                    <tr>
                        <td class="s-label">Margin Amount</td>
                        <td class="s-val">[[Quote.Margin_Amount__c]]</td>
                    </tr>
                    <tr>
                        <td class="s-label highlight">Margin %</td>
                        <td class="s-val highlight">[[Quote.Margin_Percent__c]]</td>
                    </tr>
                    <tr class="grand-total-row">
                        <td class="s-label">GRAND TOTAL</td>
                        <td class="s-val">[[Quote.Total_Amount__c]]</td>
                    </tr>
                </table>
                <div class="clear"></div>

                <table class="footer-table">
                    <tr>
                        <td align="center">
                            <div class="signature-box">
                                <div class="sig-label">Authorized Signature</div>
                                <div class="sig-img-container">
                                    <img src="[[Company.Signature]]" class="sig-img" />
                                </div>
                                <div class="sig-line"></div>
                                <div class="sig-title">[[Signer.Title]]</div>
                            </div>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;
    }

    async handleSaveTemplate() {
        this.isSaving = true;
        try {
            const htmlContent = this.generateHTMLContent();

            if (htmlContent.length > 130000) {
                this.showToast('Error', 'Template size exceeds the maximum limit. Please provide smaller texts or images.', 'error');
                this.isSaving = false;
                return;
            }

            // Only pass image data to Apex if the user uploaded a fresh image.
            // If logoDataUrl is a static resource URL ('/resource/...'), we skip it
            // so the existing static resource is not overwritten.
            const logoData = (this.logoDataUrl && this.logoDataUrl.startsWith('data:')) ? this.logoDataUrl : null;
            const signatureData = (this.signatureDataUrl && this.signatureDataUrl.startsWith('data:')) ? this.signatureDataUrl : null;

            // Save the new template with separate image components
            await saveTemplateData({
                htmlContent: htmlContent,
                logoData: logoData,
                signatureData: signatureData
            });

            // Reset to static resource URL so next load shows the saved image
            if (logoData)      this.logoDataUrl      = '/resource/HQ_CPQ_Logo?t=' + Date.now();
            if (signatureData) this.signatureDataUrl = '/resource/HQ_CPQ_Signature?t=' + Date.now();

            this.showToast('Success', 'Quote template saved as the Global Default!', 'success');
        } catch (error) {
            console.error('Error saving template:', error);
            this.showToast('Error', error.body?.message || 'Error saving template.', 'error');
        } finally {
            this.isSaving = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
