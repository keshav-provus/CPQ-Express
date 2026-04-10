const fs = require('fs');
let html = fs.readFileSync('force-app/main/default/lwc/cpqSalesRepDashboardApp/cpqSalesRepDashboardApp.html', 'utf8');

// Replace Catalog Discounts
let catalogStart = html.indexOf('<div class="catalog-item">');
let catalogEndStr = '<!-- Product Feed -->';
let catalogEnd = html.indexOf(catalogEndStr);

let newCatalog = `
                        <template for:each={catalogDiscounts} for:item="cd">
                            <div class="catalog-item" key={cd.id}>
                                <div class="catalog-item-icon">
                                    <lightning-icon icon-name={cd.icon} size="x-small" variant="success"></lightning-icon>
                                </div>
                                <div class="catalog-item-text">
                                    <div class="catalog-item-title">{cd.title}</div>
                                    <div class="catalog-item-sub">{cd.text}</div>
                                </div>
                                <div class="catalog-item-val">{cd.val}</div>
                            </div>
                        </template>
                    </div>

                    `;

html = html.substring(0, catalogStart) + newCatalog + html.substring(catalogEnd);

// Replace Product Feeds
let feedStart = html.indexOf('<div class="feed-item">');
let feedEnd = html.lastIndexOf('</div>', html.lastIndexOf('</div>', html.indexOf('<!-- AI Assistant Panel -->') - 1)) + 6;

let feedEndProper = html.indexOf('</section>', feedStart);

let newFeed = `
                        <template for:each={productFeeds} for:item="pf">
                            <div class="feed-item" key={pf.id}>
                                <lightning-icon icon-name={pf.icon} size="medium" style="background:#e0e3e5; padding:0.5rem; border-radius:0.5rem; margin-right:1rem;"></lightning-icon>
                                <div>
                                    <div class={pf.tagClass}>{pf.tag}</div>
                                    <div class="feed-title">{pf.title}</div>
                                    <div class="feed-desc">{pf.desc}</div>
                                </div>
                            </div>
                        </template>
                    </div>
`;

html = html.substring(0, feedStart) + newFeed + html.substring(feedEndProper);

fs.writeFileSync('force-app/main/default/lwc/cpqSalesRepDashboardApp/cpqSalesRepDashboardApp.html', html);
console.log('HTML Updated!');
