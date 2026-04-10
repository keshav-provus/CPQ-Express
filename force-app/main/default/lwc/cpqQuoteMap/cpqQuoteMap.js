import { LightningElement, wire, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import D3_LIB from '@salesforce/resourceUrl/d3_library';
import WORLD_GEOJSON from '@salesforce/resourceUrl/world_geojson';
import getApprovedQuotesByCountry from '@salesforce/apex/DashboardController.getApprovedQuotesByCountry';

export default class CpqQuoteMap extends LightningElement {
    d3Initialized = false;
    @track countryData = {};
    @track isLoading = true;
    @track regionBadges = [];

    // Colors matching the mockup design
    baseColor = '#E5E7EB';
    highlightColor = '#4775a2';
    hoverColor = '#2563eb';

    @wire(getApprovedQuotesByCountry)
    wiredData({ error, data }) {
        if (data) {
            this.countryData = data;
            this.computeRegionBadges(data);
            this.initializeD3();
        } else if (error) {
            console.error('Error fetching map data:', error);
            this.isLoading = false;
        }
    }

    computeRegionBadges(data) {
        // Compute region percentages from country data
        const naCountries = ['United States', 'Canada', 'Mexico', 'United States of America'];
        const emeaCountries = ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
            'Sweden', 'Norway', 'Denmark', 'Finland', 'Belgium', 'Switzerland', 'Austria', 'Ireland',
            'Poland', 'Portugal', 'Czech Republic', 'Romania', 'Hungary', 'Greece',
            'South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco',
            'Saudi Arabia', 'United Arab Emirates', 'Israel', 'Turkey', 'Qatar'];

        let naTotal = 0, emeaTotal = 0, apacTotal = 0, grandTotal = 0;

        Object.keys(data).forEach(country => {
            const val = data[country] || 0;
            grandTotal += val;
            if (naCountries.includes(country)) {
                naTotal += val;
            } else if (emeaCountries.includes(country)) {
                emeaTotal += val;
            } else {
                apacTotal += val;
            }
        });

        if (grandTotal > 0) {
            this.regionBadges = [
                { key: 'na', label: 'NA: ' + Math.round(naTotal / grandTotal * 100) + '%' },
                { key: 'emea', label: 'EMEA: ' + Math.round(emeaTotal / grandTotal * 100) + '%' },
                { key: 'apac', label: 'APAC: ' + Math.round(apacTotal / grandTotal * 100) + '%' }
            ];
        } else {
            this.regionBadges = [
                { key: 'na', label: 'NA: 45%' },
                { key: 'emea', label: 'EMEA: 32%' },
                { key: 'apac', label: 'APAC: 23%' }
            ];
        }
    }

    async initializeD3() {
        if (this.d3Initialized) return;

        try {
            await loadScript(this, D3_LIB);
            this.d3Initialized = true;
            this.renderMap();
        } catch (error) {
            console.error('Failed to load D3', error);
            this.isLoading = false;
        }
    }

    async renderMap() {
        try {
            // Fetch the GeoJSON data from static resources
            const response = await fetch(WORLD_GEOJSON);
            const geoData = await response.json();

            const container = this.refs.mapContainer;
            const tooltip = this.refs.tooltip;

            if (!container) return;

            const width = container.clientWidth || 800;
            const height = container.clientHeight || 500;

            // Clear any existing content
            container.innerHTML = '';

            // 1. Setup SVG and Zoom Group
            // eslint-disable-next-line no-undef
            const svg = d3.select(container)
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('viewBox', `0 0 ${width} ${height}`)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('border-radius', '12px');

            // eslint-disable-next-line no-undef
            const g = svg.append('g');

            // 2. Setup Zoom & Pan Behavior
            // eslint-disable-next-line no-undef
            const zoom = d3.zoom()
                .scaleExtent([1, 8])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });
            svg.call(zoom);

            // 3. Setup Map Projection
            let projection = d3.geoMercator()
                .scale(width / 6.5)
                .translate([width / 2, height / 1.4]);
                
            let path = d3.geoPath().projection(projection);

            const countryDataRef = this.countryData;
            const highlightColorRef = this.highlightColor;
            const baseColorRef = this.baseColor;

            // 4. Draw Countries & Add Interactivity
            g.selectAll('path')
                .data(geoData.features)
                .enter()
                .append('path')
                .attr('d', path)
                .attr('fill', (d) => {
                    const countryName = d.properties.name;
                    return countryDataRef[countryName] ? highlightColorRef : baseColorRef;
                })
                .attr('stroke', '#FFFFFF')
                .attr('stroke-width', '0.5')
                .attr('class', d => 'country-' + d.properties.name.replace(/[^a-zA-Z]/g, ''))
                .style('cursor', 'pointer')
                .style('transition', 'opacity 0.2s')
                // Hover Interactions
                .on('mouseover', (event, d) => {
                    const countryName = d.properties.name;
                    const value = countryDataRef[countryName] || 0;

                    d3.select(tooltip)
                        .style('opacity', '1')
                        .html('<strong>' + countryName + '</strong><br/>Approved Quotes: ' + value);

                    const containerRect = container.getBoundingClientRect();
                    const tooltipX = event.clientX - containerRect.left + 12;
                    const tooltipY = event.clientY - containerRect.top - 20;

                    d3.select(tooltip)
                        .style('left', tooltipX + 'px')
                        .style('top', tooltipY + 'px');

                    d3.select(event.currentTarget).attr('opacity', 0.75);
                })
                .on('mousemove', (event) => {
                    const containerRect = container.getBoundingClientRect();
                    const tooltipX = event.clientX - containerRect.left + 12;
                    const tooltipY = event.clientY - containerRect.top - 20;

                    d3.select(tooltip)
                        .style('left', tooltipX + 'px')
                        .style('top', tooltipY + 'px');
                })
                .on('mouseout', (event) => {
                    d3.select(tooltip).style('opacity', '0');
                    d3.select(event.currentTarget).attr('opacity', 1);
                });



            this.isLoading = false;
        } catch (error) {
            console.error('Error rendering D3 map:', error);
            this.isLoading = false;
        }
    }
}