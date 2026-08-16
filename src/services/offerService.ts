import type { Offer } from '../types/offer'

export const demoOffers: Record<string, Offer> = {
  current: { id: 'POST-500', name: '500 GB', price: 59.9, benefit: 'Más datos', bonus: 'Movistar TV App Lite', banner: '/promos/lucia-normal-500.webp' },
  discount: { id: 'POST-170', name: '170 GB', price: 45.9, benefit: 'Plan gamer', banner: '/promos/lucia-discount-170.webp' },
  proration: { id: 'POST-250', name: '250 GB', price: 49.9, benefit: 'Plan familiar', banner: '/promos/lucia-proration-250.webp' },
  reconnection: { id: 'POST-280', name: '280 GB', price: 55.9, benefit: 'Apps y llamadas ilimitadas', banner: '/promos/lucia-reconnection-280.webp' },
}
