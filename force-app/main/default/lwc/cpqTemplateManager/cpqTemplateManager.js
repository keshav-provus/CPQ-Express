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
                    @page { size: A4; margin: 0.7in 0.7in 0.9in 0.7in; }
                    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10px; color: #1e293b; margin: 0; padding: 0; line-height: 1.5; }
                    table { width: 100%; border-collapse: collapse; }
                    .clear { clear: both; }
                    .text-right { text-align: right; }
                    .text-muted { color: #64748b; }

                    /* Header */
                    .header-bar { background-color: #1e293b; color: #fff; padding: 20px 24px; }
                    .logo-img { max-height: 48px; max-width: 180px; display: block; }
                    .co-name-header { font-size: 18px; font-weight: 700; letter-spacing: 1px; color: #fff; }
                    .quote-title-text { font-size: 28px; font-weight: 800; letter-spacing: 3px; color: #fff; text-align: right; }
                    .quote-ref { font-size: 11px; color: #94a3b8; text-align: right; margin-top: 4px; }

                    /* Info Cards */
                    .info-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin-top: 20px; }
                    .card-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
                    .card-field { margin-bottom: 5px; }
                    .card-field-label { font-size: 9px; color: #94a3b8; display: inline-block; width: 85px; }
                    .card-field-value { font-size: 10px; font-weight: 600; color: #1e293b; }
                    .client-name { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
                    .client-address { font-size: 10px; color: #64748b; line-height: 1.5; }

                    /* Description */
                    .desc-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
                    .desc-block p { margin: 0; font-size: 10px; color: #475569; line-height: 1.6; }

                    /* Phase Header */
                    .phase-header { background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 6px 12px; margin-top: 16px; margin-bottom: 2px; }
                    .phase-name { font-size: 11px; font-weight: 700; color: #1e293b; }

                    /* Line Items */
                    .items-table th { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; padding: 8px 6px; border-bottom: 2px solid #e2e8f0; text-align: left; }
                    .items-table th.col-right { text-align: right; }
                    .items-table td { padding: 8px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 10px; }
                    .items-table td.col-right { text-align: right; }
                    .item-name { font-weight: 600; color: #1e293b; }
                    .item-task { font-size: 9px; color: #94a3b8; margin-top: 1px; }
                    .type-label { font-size: 8px; color: #64748b; padding: 1px 6px; background: #f1f5f9; border-radius: 3px; }
                    .discount-tag { font-size: 8px; color: #2563eb; font-weight: 700; }

                    /* Summary */
                    .summary-box { width: 280px; float: right; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-top: 20px; }
                    .summary-row { padding: 8px 16px; border-bottom: 1px solid #f1f5f9; }
                    .summary-row-label { font-size: 10px; color: #64748b; display: inline-block; width: 130px; }
                    .summary-row-value { font-size: 10px; font-weight: 600; color: #1e293b; float: right; }
                    .grand-total-row { background: #1e293b; padding: 12px 16px; }
                    .grand-total-label { font-size: 12px; font-weight: 700; color: #e2e8f0; display: inline-block; width: 130px; }
                    .grand-total-value { font-size: 16px; font-weight: 800; color: #fff; float: right; }

                    /* Terms */
                    .terms-title { font-size: 10px; font-weight: 700; color: #1e293b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; margin-top: 28px; }
                    .terms-list { margin: 0; padding: 0 0 0 16px; color: #64748b; font-size: 9px; line-height: 1.7; }

                    /* Signature */
                    .sig-img { max-height: 50px; max-width: 160px; margin-bottom: 6px; display: block; }
                    .sig-block { border-top: 1px solid #cbd5e1; padding-top: 8px; }
                    .sig-label-text { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; margin-top: 30px; }
                    .sig-name { font-size: 11px; font-weight: 700; color: #1e293b; }
                    .sig-title-text { font-size: 9px; color: #64748b; }
                    .sig-date { font-size: 9px; color: #64748b; margin-top: 2px; }
                </style>
            </head>
            <body>
                <!-- Dark Header -->
                <div class="header-bar">
                    <table>
                        <tr>
                            <td style="width:55%; vertical-align:middle;">
                                <img src="[[Company.Logo]]" class="logo-img" />
                            </td>
                            <td style="width:45%; vertical-align:middle;">
                                <div class="quote-title-text">QUOTE</div>
                                <div class="quote-ref">[[Quote.Name]]</div>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Info Cards -->
                <table style="margin-top:20px;">
                    <tr>
                        <td style="width:48%; vertical-align:top;">
                            <div class="info-card">
                                <div class="card-label">Quote Details</div>
                                <div class="card-field"><span class="card-field-label">Quote #</span><span class="card-field-value">[[Quote.Name]]</span></div>
                                <div class="card-field"><span class="card-field-label">Date Issued</span><span class="card-field-value">[[Today]]</span></div>
                                <div class="card-field"><span class="card-field-label">Valid Until</span><span class="card-field-value">[[Quote.Valid_Until__c]]</span></div>
                                <div class="card-field"><span class="card-field-label">Period</span><span class="card-field-value">[[Quote.Start_Date__c]] — [[Quote.End_Date__c]]</span></div>
                                <div class="card-field"><span class="card-field-label">Billing</span><span class="card-field-value">[[Quote.Time_Period_Metric__c]]</span></div>
                                <div class="card-field"><span class="card-field-label">Prepared By</span><span class="card-field-value">[[User.Name]]</span></div>
                                <div class="card-field"><span class="card-field-label">Currency</span><span class="card-field-value">[[Quote.Currency]]</span></div>
                            </div>
                        </td>
                        <td style="width:4%;"></td>
                        <td style="width:48%; vertical-align:top;">
                            <div class="info-card">
                                <div class="card-label">Prepared For</div>
                                <div class="client-name">[[Account.Name]]</div>
                                <div class="client-address">[[Account.Address]]</div>
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- Description -->
                <div class="desc-block">
                    <div class="card-label" style="margin-bottom:6px;">Description</div>
                    <p>[[Quote.Description__c]]</p>
                </div>

                <!-- Line Items -->
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width:38%;">Description</th>
                            <th style="width:12%;">Type</th>
                            <th style="width:10%;">Phase</th>
                            <th class="col-right" style="width:8%;">Qty</th>
                            <th class="col-right" style="width:12%;">Unit Price</th>
                            <th class="col-right" style="width:8%;">Disc.</th>
                            <th class="col-right" style="width:12%;">Net Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        [[LINE_ITEMS_START]]
                        <tr>
                            <td>
                                <div class="item-name">[[Item.Name__c]]</div>
                                <div class="item-task">[[Item.Task__c]]</div>
                            </td>
                            <td><span class="type-label">[[Item.Item_Type__c]]</span></td>
                            <td><span class="type-label">[[Item.Phase__c]]</span></td>
                            <td class="col-right">[[Item.Quantity__c]]</td>
                            <td class="col-right">[[Item.Unit_Price__c]]</td>
                            <td class="col-right"><span class="discount-tag">[[Item.Discount_Percent__c]]</span></td>
                            <td class="col-right" style="font-weight:600;">[[Item.Net_Total__c]]</td>
                        </tr>
                        [[LINE_ITEMS_END]]
                    </tbody>
                </table>

                <!-- Financial Summary -->
                <div class="summary-box">
                    <div class="summary-row">
                        <span class="summary-row-label">Total Cost</span>
                        <span class="summary-row-value">[[Quote.Total_Cost__c]]</span>
                        <div class="clear"></div>
                    </div>
                    <div class="summary-row">
                        <span class="summary-row-label">Margin</span>
                        <span class="summary-row-value">[[Quote.Margin_Amount__c]] ([[Quote.Margin_Percent__c]])</span>
                        <div class="clear"></div>
                    </div>
                    <div class="grand-total-row">
                        <span class="grand-total-label">TOTAL</span>
                        <span class="grand-total-value">[[Quote.Total_Amount__c]]</span>
                        <div class="clear"></div>
                    </div>
                </div>
                <div class="clear"></div>

                <!-- Terms -->
                <div class="terms-title">Terms &amp; Conditions</div>
                <ol class="terms-list">
                    <li>This quote is valid until the expiry date stated above.</li>
                    <li>All prices are in [[Quote.Currency]] and exclusive of applicable taxes unless otherwise stated.</li>
                    <li>Payment is due within 30 days of invoice date unless otherwise agreed in writing.</li>
                    <li>Delivery timelines are estimates and subject to resource availability.</li>
                    <li>Changes to scope after acceptance may result in additional charges.</li>
                    <li>This quote constitutes an offer and is subject to our standard terms and conditions of sale.</li>
                </ol>

                <!-- Signature -->
                <table style="margin-top:30px;">
                    <tr>
                        <td style="width:48%; vertical-align:bottom;">
                            <div class="sig-label-text">Authorized by [[Company.Name]]</div>
                            <img src="[[Company.Signature]]" class="sig-img" />
                            <div class="sig-block">
                                <div class="sig-name">[[User.Name]]</div>
                                <div class="sig-title-text">[[Signer.Title]]</div>
                                <div class="sig-date">Date: [[Today]]</div>
                            </div>
                        </td>
                        <td style="width:4%;"></td>
                        <td style="width:48%; vertical-align:bottom;">
                            <div class="sig-label-text">Accepted by [[Account.Name]]</div>
                            <div style="height:50px;"></div>
                            <div class="sig-block">
                                <div class="sig-name" style="color:#94a3b8;">Authorized Signatory</div>
                                <div class="sig-date">Date: ___________________</div>
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
