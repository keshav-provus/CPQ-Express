import { LightningElement, wire, track } from 'lwc';
import getMyTopProducts from '@salesforce/apex/DashboardController.getMyTopProducts';

export default class CpqMyTopProducts extends LightningElement {
    @track products;

    @wire(getMyTopProducts)
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