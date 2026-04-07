import { LightningElement, wire, track } from 'lwc';
import getTopProducts from '@salesforce/apex/DashboardController.getTopProducts';

export default class CpqTopProducts extends LightningElement {
    @track products;

    @wire(getTopProducts)
    wiredProducts({ error, data }) {
        if (data) {
            // We only need top 2 to match the layout
            this.products = data.slice(0, 2);
        } else if (error) {
            console.error('Error fetching top products', error);
        }
    }

    get formattedProducts() {
        if (!this.products) return [];
        return this.products.map((prod, index) => ({
            ...prod,
            imageClass: index % 2 === 0 ? 'product-image-placeholder' : 'product-image-placeholder alt'
        }));
    }
}