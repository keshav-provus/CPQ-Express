import { LightningElement, api, track, wire } from 'lwc';
import updateLineItem from '@salesforce/apex/QuoteLineItemController.updateLineItem';
import deleteLineItem from '@salesforce/apex/QuoteLineItemController.deleteLineItem';
import getPhaseList from '@salesforce/apex/QuoteLineItemController.getPhaseList';
import savePhaseList from '@salesforce/apex/QuoteLineItemController.savePhaseList';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

export default class CpqQuoteLineEditor extends LightningElement {
    @api recordId;
    @api lineItems = [];

    @track collapsedPhases = {};
    @track customPhases = [];
    wiredPhaseList;

    @wire(getPhaseList, { quoteId: '$recordId' })
    wiredPhases(result) {
        this.wiredPhaseList = result;
        if (result.data) {
            this.customPhases = result.data.split(',').filter(p => p.trim() !== '');
        }
    }

    get groupedPhases() {
        const phases = {};
        const allPhaseNames = ['Default', ...this.customPhases];
        
        allPhaseNames.forEach(name => {
            phases[name] = {
                name: name,
                items: [],
                isCollapsed: this.collapsedPhases[name] || false,
                toggleIcon: this.collapsedPhases[name] ? '▶' : '▼'
            };
        });

        this.lineItems.forEach(item => {
            const phaseName = item.Phase__c || 'Default';
            if (!phases[phaseName]) {
                phases[phaseName] = {
                    name: phaseName,
                    items: [],
                    isCollapsed: this.collapsedPhases[phaseName] || false,
                    toggleIcon: this.collapsedPhases[phaseName] ? '▶' : '▼'
                };
            }
            const processedItem = {
                ...item,
                icon: item.Item_Type__c === 'Resource Role' ? '👤' : item.Item_Type__c === 'Product' ? '📦' : '➕',
                formattedNetTotal: this.formatCurrency(item.Net_Total__c),
                formattedUnitPrice: this.formatCurrency(item.Unit_Price__c),
                formattedBaseRate: this.formatCurrency(item.Base_Rate__c),
                startDateFormatted: item.Start_Date__c ? new Date(item.Start_Date__c).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-',
                endDateFormatted: item.End_Date__c ? new Date(item.End_Date__c).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-'
            };
            phases[phaseName].items.push(processedItem);
        });

        return Object.values(phases).filter(p => p.name === 'Default' || p.items.length > 0 || this.customPhases.includes(p.name));
    }

    get grandTotal() {
        const total = this.lineItems.reduce((sum, item) => sum + (item.Net_Total__c || 0), 0);
        return this.formatCurrency(total);
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value || 0);
    }

    togglePhase(event) {
        const phase = event.target.dataset.phase;
        this.collapsedPhases = { ...this.collapsedPhases, [phase]: !this.collapsedPhases[phase] };
    }

    handleCollapseAll() {
        const newCollapsed = {};
        this.groupedPhases.forEach(p => {
            newCollapsed[p.name] = true;
        });
        this.collapsedPhases = newCollapsed;
    }

    handleAddPhase() {
        const nextPhaseNum = this.customPhases.length + 1;
        const newPhaseName = `Phase ${nextPhaseNum}`;
        this.customPhases = [...this.customPhases, newPhaseName];
        savePhaseList({ quoteId: this.recordId, phaseList: this.customPhases.join(',') })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: `Phase "${newPhaseName}" added`,
                    variant: 'success'
                }));
            });
    }

    handleOpenWizard(event) {
        const phase = event.target.dataset.phase;
        this.dispatchEvent(new CustomEvent('openwizard', {
            detail: { phase }
        }));
    }

    handleUpdateItem(event) {
        const itemId = event.target.dataset.id;
        const field = event.target.dataset.field;
        const value = event.target.value;

        const updateObj = { Id: itemId };
        updateObj[field] = value;

        updateLineItem({ item: updateObj })
            .then(() => {
                this.dispatchEvent(new CustomEvent('refresh'));
            })
            .catch(error => {
                console.error('Update error', error);
            });
    }

    handleDelete(event) {
        const itemId = event.target.dataset.id;
        deleteLineItem({ itemId })
            .then(() => {
                this.dispatchEvent(new CustomEvent('refresh'));
            });
    }

    handleToast(event) {
        const msg = event.target.dataset.msg;
        this.dispatchEvent(new ShowToastEvent({
            title: 'Info',
            message: msg,
            variant: 'info'
        }));
    }
}
