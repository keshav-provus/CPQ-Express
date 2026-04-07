import { LightningElement, track, wire } from 'lwc';
import getQuoteMapLocations from '@salesforce/apex/DashboardController.getQuoteMapLocations';

export default class CpqQuoteMap extends LightningElement {
    @track mapMarkers = [];
    @track isLoading = true;

    @wire(getQuoteMapLocations)
    wiredLocations({ error, data }) {
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
        }
    }

    get hasMarkers() {
        return this.mapMarkers.length > 0;
    }
}