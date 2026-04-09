import { LightningElement, track, wire } from 'lwc';
import getMyQuoteMapLocationsByCountry from '@salesforce/apex/DashboardController.getMyQuoteMapLocationsByCountry';

export default class CpqMyQuoteMap extends LightningElement {
    @track mapMarkers = [];
    @track isLoading = true;

    @wire(getMyQuoteMapLocationsByCountry)
    wiredCountryLocations(result) {
        this.processData(result);
    }

    processData({ error, data }) {
        if (data) {
            this.mapMarkers = data.map(item => ({
                location: item.location,
                title: item.title,
                description: item.description,
                value: item.value
            }));
            this.isLoading = false;
        } else if (error) {
            console.error('Error loading map locations', error);
            this.isLoading = false;
        } else {
            this.isLoading = true;
        }
    }

    get hasMarkers() {
        return this.mapMarkers.length > 0;
    }
}