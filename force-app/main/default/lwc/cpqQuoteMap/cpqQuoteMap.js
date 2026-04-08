import { LightningElement, track, wire } from 'lwc';
import getQuoteMapLocations from '@salesforce/apex/DashboardController.getQuoteMapLocations';
import getQuoteMapLocationsByCountry from '@salesforce/apex/DashboardController.getQuoteMapLocationsByCountry';

export default class CpqQuoteMap extends LightningElement {
    @track mapMarkers = [];
    @track isLoading = true;
    @track filterBy = 'country';

    @wire(getQuoteMapLocations)
    wiredCityLocations(result) {
        this.cityLocationsResult = result;
        if (this.filterBy === 'city') {
            this.processData(result);
        }
    }

    @wire(getQuoteMapLocationsByCountry)
    wiredCountryLocations(result) {
        this.countryLocationsResult = result;
        if (this.filterBy === 'country') {
            this.processData(result);
        }
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

    handleFilterChange(event) {
        this.filterBy = event.target.value;
        this.isLoading = true;
        const result = this.filterBy === 'country' ? this.countryLocationsResult : this.cityLocationsResult;
        if (result) {
            this.processData(result);
        }
    }

    get hasMarkers() {
        return this.mapMarkers.length > 0;
    }
}