export type RestaurantCard = {
  name: string;
  cuisine: string;
  rating: number;
  reviews: string;
  eta: string;
  veg: boolean;
  image: string;
};

export const restaurants: RestaurantCard[] = [
  {
    name: 'Udupi Heritage',
    cuisine: 'South Indian · Pure Veg',
    rating: 4.6,
    reviews: '1.2k',
    eta: '15–25 mins',
    veg: true,
    image: '/masala_dosa.png',
  },
  {
    name: 'Spice Villa',
    cuisine: 'North Indian · Pure Veg',
    rating: 4.5,
    reviews: '892',
    eta: '20–30 mins',
    veg: true,
    image: '/misal_pav.png',
  },
  {
    name: 'The Deccan Table',
    cuisine: 'North Indian · Chinese',
    rating: 4.4,
    reviews: '640',
    eta: '25–35 mins',
    veg: false,
    image: '/chicken_tikka.png',
  },
];
