import type { Locale } from '@/lib/i18n'

/**
 * All customer-facing wording lives here, with an English and a French slot.
 * Change wording here, never inside the page components.
 * The `fr` object must have the same shape as `en` (TypeScript checks this).
 */

export type Course = {
  /** One dish, or several alternatives (shown with "or" between them). */
  dishes: string[]
  /** Components, shown separated by middle dots. */
  components: string[]
}

export type TastingMenu = {
  eyebrow: string
  title: string
  courses: Course[]
  price: string
  notes: string[]
}

const en = {
  site: {
    name: 'Eleanor Jessica',
    strapline: 'cheffe privée',
    title: 'Eleanor Jessica · cheffe privée',
    description:
      'Eleanor Jessica, private chef. Seasonal tasting menus, prepared with care for your table.',
  },
  nav: {
    home: 'Home',
    menu: 'Menu',
    switchLanguage: 'Français',
  },
  home: {
    heroEyebrow: 'cheffe privée',
    heroTitle: 'Eleanor Jessica',
    heroLead: 'Seasonal tasting menus, prepared with care for your table.',
    heroCta: 'View the menu',
    introTitle: 'A dinner to remember',
    introBody:
      'This page is a placeholder while the new site is being built. Eleanor’s story, menus and booking details will appear here soon.',
    imageAlt1: 'A plated dish by Eleanor Jessica',
    imageAlt2: 'A plated dish by Eleanor Jessica',
    menuSectionTitle: 'A sample menu',
  },
  sampleMenu: {
    eyebrow: 'Dine at home',
    title: 'Inspired by India',
    courses: [
      {
        dishes: ['Caramelised Onion, Squash & Feta Samosa (v)'],
        components: ['roasted red pepper & smoked chilli purée'],
      },
      {
        dishes: ['Spiced Cauliflower Velouté (v)'],
        components: [
          'cauliflower & onion bhaji',
          'raisin & tamarind chutney',
          'curry leaf',
        ],
      },
      {
        dishes: [
          'Chicken Tikka Masala Pithivier',
          'Smoked Aubergine & Chickpea Pithivier (v)',
        ],
        components: [
          'bombay potato pavé',
          'spiced pea & spinach fricassée',
          'makhani gravy',
        ],
      },
      {
        dishes: ['Masala Chai Sticky Toffee Pudding (v)'],
        components: ['jaggery caramel', 'cardamom crème anglaise'],
      },
    ],
    price: '40 € pp',
    notes: ['4 courses', 'prepared by me', 'finished by you'],
  } satisfies TastingMenu,
  menuWords: {
    or: 'or',
  },
  footer: {
    rights: 'All rights reserved.',
  },
}

export type Content = typeof en

const fr: Content = {
  site: {
    name: 'Eleanor Jessica',
    strapline: 'cheffe privée',
    title: 'Eleanor Jessica · cheffe privée',
    description:
      'Eleanor Jessica, cheffe privée. Menus dégustation de saison, préparés avec soin pour votre table.',
  },
  nav: {
    home: 'Accueil',
    menu: 'Menu',
    switchLanguage: 'English',
  },
  home: {
    heroEyebrow: 'cheffe privée',
    heroTitle: 'Eleanor Jessica',
    heroLead: 'Menus dégustation de saison, préparés avec soin pour votre table.',
    heroCta: 'Découvrir le menu',
    introTitle: 'Un dîner inoubliable',
    introBody:
      'Cette page est provisoire, le temps de construire le nouveau site. L’histoire d’Eleanor, ses menus et les réservations arrivent bientôt.',
    imageAlt1: 'Une assiette signée Eleanor Jessica',
    imageAlt2: 'Une assiette signée Eleanor Jessica',
    menuSectionTitle: 'Un exemple de menu',
  },
  sampleMenu: {
    eyebrow: 'Dîner à la maison',
    title: 'Inspiré par l’Inde',
    courses: [
      {
        dishes: ['Samosa oignon caramélisé, courge & feta (v)'],
        components: ['purée de poivron rouge rôti & piment fumé'],
      },
      {
        dishes: ['Velouté de chou-fleur épicé (v)'],
        components: [
          'bhaji de chou-fleur & oignon',
          'chutney raisin & tamarin',
          'feuille de curry',
        ],
      },
      {
        dishes: [
          'Pithivier poulet tikka masala',
          'Pithivier aubergine fumée & pois chiches (v)',
        ],
        components: [
          'pavé de pommes de terre bombay',
          'fricassée de petits pois & épinards épicés',
          'sauce makhani',
        ],
      },
      {
        dishes: ['Sticky toffee pudding au masala chai (v)'],
        components: ['caramel de jaggery', 'crème anglaise à la cardamome'],
      },
    ],
    price: '40 € par personne',
    notes: ['4 plats', 'préparés par moi', 'terminés par vous'],
  },
  menuWords: {
    or: 'ou',
  },
  footer: {
    rights: 'Tous droits réservés.',
  },
}

export const content: Record<Locale, Content> = { en, fr }

export function t(locale: Locale): Content {
  return content[locale]
}
