const fs = require('fs');
let jsFile = 'force-app/main/default/lwc/cpqQuoteMap/cpqQuoteMap.js';
let js = fs.readFileSync(jsFile, 'utf8');

js = js.replace(
`            // Auto-zoom to max country
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
            }

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
            }`,
`            // Auto-zoom to max country
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
