import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import USER_ID from '@salesforce/user/Id';
import USER_NAME_FIELD from '@salesforce/schema/User.Name';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';

export default class CpqWelcomeBanner extends NavigationMixin(LightningElement) {
    @api role = 'rep';
    @api statValue = 0;
    @api statLabel = '';

    @wire(getRecord, { recordId: USER_ID, fields: [USER_NAME_FIELD] })
    user;

    get userName() {
        const fullName = getFieldValue(this.user.data, USER_NAME_FIELD);
        return fullName ? fullName.split(' ')[0] : 'there';
    }

    handleQuickCreate() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Quote__c',
                actionName: 'new'
            }
        });
    }
}
