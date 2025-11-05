import React from 'react';
import { ContentCarouselData } from './types';
import { RestaurantIcon, ActivityIcon } from './components/icons';

export const exploreData: ContentCarouselData[] = [
  {
    title: 'For you in',
    location: 'Banda Hilir',
    showMapButton: true,
    cards: [
      {
        title: 'Bite of Life',
        subtitle: 'Cafe',
        imageUrl: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?q=80&w=1935&auto=format&fit=crop',
        icon: React.createElement(RestaurantIcon, { className: "w-4 h-4 text-white" })
      },
      {
        title: 'Capitol Seafood',
        subtitle: 'Malaysian',
        imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c7373058?q=80&w=1770&auto=format&fit=crop',
        icon: React.createElement(RestaurantIcon, { className: "w-4 h-4 text-white" })
      },
      {
        title: 'Angsana Hotel',
        subtitle: 'Hotel',
        imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1770&auto=format&fit=crop',
      },
      {
        title: 'The Old Merchant',
        subtitle: 'Cocktail Bar',
        imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc7d00a9d80?q=80&w=1770&auto=format&fit=crop',
        icon: React.createElement(RestaurantIcon, { className: "w-4 h-4 text-white" })
      },
    ]
  },
  {
    title: 'Get started',
    seeAllLink: false,
    cards: [
      {
        title: 'Take our travel quiz',
        subtitle: '',
        imageUrl: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?q=80&w=1770&auto=format&fit=crop',
      },
      {
        title: 'Create a trip',
        subtitle: '',
        imageUrl: 'https://images.unsplash.com/photo-1527632911563-ee5b6d5344b6?q=80&w=1887&auto=format&fit=crop',
      },
      {
        title: 'Creator tools',
        subtitle: '',
        imageUrl: 'https://images.unsplash.com/photo-1604351873940-a5a1b3a39396?q=80&w=1887&auto=format&fit=crop',
      }
    ]
  },
  {
    title: 'Get inspired',
    seeAllLink: true,
    cards: [
      {
        title: 'The Best Coffee Shops in Mexico City',
        subtitle: '',
        imageUrl: 'https://images.unsplash.com/photo-1511920183353-3c7c9c5f9f4a?q=80&w=1887&auto=format&fit=crop',
      },
      {
        title: '7 Days in Vietnam, From South to Central',
        subtitle: '',
        imageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?q=80&w=1770&auto=format&fit=crop',
      },
      {
        title: 'LISBON FOR FOODIES | from someone who lives there',
        subtitle: '',
        imageUrl: 'https://images.unsplash.com/photo-1560322398-a2656849a656?q=80&w=1964&auto=format&fit=crop',
      },
      {
        title: 'A Guide to the Best Ghibli Spots in Japan',
        subtitle: '',
        imageUrl: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1770&auto=format&fit=crop',
      }
    ]
  }
];
