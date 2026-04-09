import { LightningElement, track, wire } from 'lwc';
import getCompanySettings from '@salesforce/apex/AdminSettingsController.getCompanySettings';
import saveCompanySettings from '@salesforce/apex/AdminSettingsController.saveCompanySettings';
import getHolidays from '@salesforce/apex/AdminSettingsController.getHolidays';
import saveHoliday from '@salesforce/apex/AdminSettingsController.saveHoliday';
import deleteHolidayByDate from '@salesforce/apex/AdminSettingsController.deleteHolidayByDate';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

export default class CpqWorkCalendar extends LightningElement {
    @track workPolicy = '5 Days';
    @track workingHoursPerDay = 8;
    @track isLoading = false;

    // Calendar state
    @track currentDate = new Date();
    @track calendarDays = [];
    @track holidayMap = {}; // 'YYYY-MM-DD' -> Title
    
    // Modal state
    @track isModalOpen = false;
    @track selectedDateStr = '';
    @track selectedDayIsHoliday = false;
    @track holidayTitleInput = '';

    wiredHolidaysResult;

    policyOptions = [
        { label: '5 Days (Mon-Fri)', value: '5 Days' },
        { label: '6 Days (Mon-Sat)', value: '6 Days' },
        { label: '7 Days (All Days)', value: '7 Days' }
    ];

    @wire(getCompanySettings)
    wiredSettings({ error, data }) {
        if (data) {
            this.workingHoursPerDay = data.Working_Hours_Per_Day__c || 8;
            this.workPolicy = data.Work_Policy__c || '5 Days';
            this.buildCalendar();
        }
    }

    @wire(getHolidays)
    wiredHolidays(result) {
        this.wiredHolidaysResult = result;
        if (result.data) {
            this.holidayMap = {};
            result.data.forEach(h => {
                this.holidayMap[h.Date__c] = h.Title__c;
            });
            this.buildCalendar();
        }
    }

    get calculatedWeeklyHours() {
        let days = 5;
        if (this.workPolicy === '6 Days') days = 6;
        if (this.workPolicy === '7 Days') days = 7;
        return this.workingHoursPerDay * days;
    }

    get calculatedMonthlyHours() {
        return this.calculatedWeeklyHours * 4;
    }

    get currentMonthName() {
        return this.currentDate.toLocaleString('default', { month: 'long' });
    }

    get currentYear() {
        return this.currentDate.getFullYear();
    }

    handlePolicyChange(event) {
        this.workPolicy = event.detail.value;
        this.buildCalendar();
    }

    handleHoursChange(event) {
        this.workingHoursPerDay = parseFloat(event.detail.value) || 0;
    }

    async savePolicies() {
        this.isLoading = true;
        try {
            // we use the partial map for saveCompanySettings
            await saveCompanySettings({
                settings: {
                    Working_Hours_Per_Day__c: this.workingHoursPerDay,
                    Work_Policy__c: this.workPolicy
                }
            });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Work Policy & Hours Saved.',
                variant: 'success'
            }));
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: 'Failed to save settings.', variant: 'error' }));
        } finally {
            this.isLoading = false;
        }
    }

    handlePrevMonth() {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
        this.buildCalendar();
    }

    handleNextMonth() {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
        this.buildCalendar();
    }

    handleToday() {
        this.currentDate = new Date();
        this.buildCalendar();
    }

    buildCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const days = [];

        // Previous month padding
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, daysInPrevMonth - i);
            days.push(this.createDayObject(date, false));
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            days.push(this.createDayObject(date, true));
        }

        // Next month padding (to fill the grid to 42 cells, i.e., 6 rows)
        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(year, month + 1, i);
            days.push(this.createDayObject(date, false));
        }

        this.calendarDays = days;
    }

    createDayObject(date, isCurrentMonth) {
        // Date format YYYY-MM-DD
        const year = date.toLocaleString('default', {year: 'numeric'});
        const month = date.toLocaleString('default', {month: '2-digit'});
        const dayNum = date.toLocaleString('default', {day: '2-digit'});
        const dateStr = `${year}-${month}-${dayNum}`;

        const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

        // Determine if weekend based on work policy
        let isWeekend = false;
        if (this.workPolicy === '5 Days' && (dayOfWeek === 0 || dayOfWeek === 6)) {
            isWeekend = true;
        } else if (this.workPolicy === '6 Days' && dayOfWeek === 0) {
            isWeekend = true;
        }

        const isHoliday = !!this.holidayMap[dateStr];
        const holidayTitle = this.holidayMap[dateStr] || '';

        let classes = 'calendar-cell';
        if (!isCurrentMonth) classes += ' other-month';
        if (isWeekend && !isHoliday) classes += ' weekend';
        if (isHoliday) classes += ' holiday';

        return {
            date,
            dateStr,
            dayNum: date.getDate(),
            isCurrentMonth,
            isWeekend,
            isHoliday,
            holidayTitle,
            classes
        };
    }

    handleDayClick(event) {
        const targetDate = event.currentTarget.dataset.date;
        const dayInfo = this.calendarDays.find(d => d.dateStr === targetDate);
        if (!dayInfo) return;

        this.selectedDateStr = targetDate;
        this.selectedDayIsHoliday = dayInfo.isHoliday;
        this.holidayTitleInput = dayInfo.holidayTitle;
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    handleHolidayTitleChange(event) {
        this.holidayTitleInput = event.target.value;
    }

    async handleSaveHoliday() {
        if (!this.holidayTitleInput) {
            this.dispatchEvent(new ShowToastEvent({title: 'Error', message: 'Holiday Title is required', variant: 'error'}));
            return;
        }

        this.isLoading = true;
        try {
            // Need to parse Date properly to pass to Apex. 
            // In Apex, Date expects YYYY-MM-DD
            await saveHoliday({ holidayDate: this.selectedDateStr, title: this.holidayTitleInput });
            this.dispatchEvent(new ShowToastEvent({title: 'Success', message: 'Holiday saved.', variant: 'success'}));
            await refreshApex(this.wiredHolidaysResult);
            this.closeModal();
        } catch (e) {
            this.dispatchEvent(new ShowToastEvent({title: 'Error', message: e.body?.message || 'Error', variant: 'error'}));
        } finally {
            this.isLoading = false;
        }
    }

    async handleRemoveHoliday() {
        this.isLoading = true;
        try {
            await deleteHolidayByDate({ holidayDate: this.selectedDateStr });
            this.dispatchEvent(new ShowToastEvent({title: 'Success', message: 'Holiday removed.', variant: 'success'}));
            await refreshApex(this.wiredHolidaysResult);
            this.closeModal();
        } catch(e) {
            this.dispatchEvent(new ShowToastEvent({title: 'Error', message: e.body?.message || 'Error', variant: 'error'}));
        } finally {
            this.isLoading = false;
        }
    }
}