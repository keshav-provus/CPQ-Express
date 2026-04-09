import { createElement } from '@lwc/engine-dom';
import CpqQuoteMap from 'c/cpqQuoteMap';
import getQuoteMapLocations from '@salesforce/apex/DashboardController.getQuoteMapLocations';
import getQuoteMapLocationsByCountry from '@salesforce/apex/DashboardController.getQuoteMapLocationsByCountry';

// Mock the Apex wire adapters
jest.mock(
    '@salesforce/apex/DashboardController.getQuoteMapLocations',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/DashboardController.getQuoteMapLocationsByCountry',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

const mockGetQuoteMapLocationsByCountry = require('./data/getQuoteMapLocationsByCountry.json');

describe('c-cpq-quote-map', () => {
    afterEach(() => {
        // The jsdom instance is shared across test cases in a single file so reset the DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders lightning-map with marker data by country on initial load', async () => {
        // Arrange
        const element = createElement('c-cpq-quote-map', {
            is: CpqQuoteMap
        });

        // Act
        document.body.appendChild(element);

        // Emit data from @wire
        getQuoteMapLocationsByCountry.emit(mockGetQuoteMapLocationsByCountry);

        // Resolve a promise to wait for any asynchronous DOM updates.
        await Promise.resolve();

        // Assert
        const lightningMapEl = element.shadowRoot.querySelector('lightning-map');
        expect(lightningMapEl).not.toBeNull();
        expect(lightningMapEl.mapMarkers.length).toBe(mockGetQuoteMapLocationsByCountry.length);
        expect(lightningMapEl.mapMarkers[0].title).toBe('United States');
        expect(lightningMapEl.mapMarkers[0].description).toBe('Quotes: 5, Revenue: $5000.00');
        expect(lightningMapEl.mapMarkers[0].location.Country).toBe('United States');
    });
});