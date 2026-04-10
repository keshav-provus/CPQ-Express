const fs = require('fs');

let cssFile = 'force-app/main/default/lwc/cpqQuoteMap/cpqQuoteMap.css';
let css = fs.readFileSync(cssFile, 'utf8');

// Ensure map takes full edges: remove padding from map-card, adjust inner elements
css = css.replace(
/\.map-card \{[\s\S]*?\}/,
`.map-card {
    background: #fff;
    border-radius: 2rem;
    border: 1px solid #f3f4f6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    padding: 0;
}`
);

css = css.replace(
/\.map-header \{[\s\S]*?\}/,
`.map-header {
    position: absolute;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 5;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    pointer-events: none;
}`
);

css = css.replace(
/\.map-container \{[\s\S]*?\}/,
`.map-container {
    width: 100%;
    height: 16rem;
    background: rgba(37, 99, 235, 0.02);
    position: relative;
}`
);

css = css.replace(
/\.tooltip \{[\s\S]*?\}/,
`.tooltip {
    position: absolute;
    background: #111827;
    color: #fff;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 11px;
    pointer-events: none;
    z-index: 10;
    opacity: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: opacity 0.2s;
}`
);

fs.writeFileSync(cssFile, css);

let jsFile = 'force-app/main/default/lwc/cpqQuoteMap/cpqQuoteMap.js';
let js = fs.readFileSync(jsFile, 'utf8');

// Modify map projection and tooltips logic to zoom to highest country
js = js.replace(
/const path = d3\.geoPath\(\)\.projection\(projection\);[\s\S]*?\/\* 4\. Draw Countries & Add Interactivity \*\//,
`const path = d3.geoPath().projection(projection);

            const countryDataRef = this.countryData;
            const highlightColorRef = this.highlightColor;
            const baseColorRef = this.baseColor;
            
            // Find max country
            let maxCountry = null;
            let maxVal = -1;
            Object.keys(countryDataRef).forEach(country => {
                if (countryDataRef[country] > maxVal) {
                    maxVal = countryDataRef[country];
                    maxCountry = country;
                }
            });

            // 4. Draw Countries & Add Interactivity`
);

js = js.replace(
/\/\/ 3\. Setup Map Projection[\s\S]*?const path = d3\.geoPath\(\)\.projection\(projection\);/,
`// 3. Setup Map Projection
            let projection = d3.geoMercator()
                .scale(width / 6.5)
                .translate([width / 2, height / 1.4]);
                
            let path = d3.geoPath().projection(projection);`
);

js = js.replace(
/g\.selectAll\('path'\)[\s\S]*?\.on\('mouseout', \(event\) => \{[\s\S]*?\}\);/g,
`g.selectAll('path')
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

            // Auto-zoom to max country
            if (maxCountry) {
                const maxFeature = geoData.features.find(f => f.properties.name === maxCountry);
                if (maxFeature) {
                    const bounds = path.bounds(maxFeature);
                    const dx = bounds[1][0] - bounds[0][0];
                    const dy = bounds[1][1] - bounds[0][1];
                    const x = (bounds[0][0] + bounds[1][0]) / 2;
                    const y = (bounds[0][1] + bounds[1][1]) / 2;
                    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
                    const translate = [width / 2 - scale * x, height / 2 - scale * y];

                    svg.transition()
                        .duration(750)
                        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
                }
            }`
);


fs.writeFileSync(jsFile, js);
console.log('patched the map component details');
