import type { Locale } from '@/lib/i18n'

/**
 * All customer-facing wording lives here, with an English and a French slot.
 * Change wording here, never inside the page components.
 * The `fr` object must have the same shape as `en` (TypeScript checks this).
 *
 * Event details (theme, intro, dishes, towns) come from the database and are
 * shown as Eleanor typed them.
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
  /** Optional italic line under the price. */
  footnote?: string
}

const en = {
  site: {
    name: 'Eleanor Jessica',
    strapline: 'cheffe privée',
    title: 'Eleanor Jessica · cheffe privée',
    description:
      'Eleanor Jessica, cheffe privée. Themed four-course menus, prepared by me and finished by you at home.',
  },
  nav: {
    dineAtHome: 'Dine at Home',
    switchLanguage: 'Français',
  },
  dineAtHome: {
    metaTitle: 'Dine at Home',
    eyebrow: 'Eleanor Jessica · cheffe privée',
    title: 'Dine at Home',
    lead: 'Four courses · prepared by me · finished by you',
    intro: [
      'Every few weeks I cook a themed four-course menu for a small number of homes nearby. I prepare each course in my kitchen; you collect it on the evening and finish it at home, at your own pace.',
      'Each menu comes with a short personal video in which I show you how to warm, finish and plate every course, so that it reaches your table just as I would serve it.',
    ],
    heroAlt: 'Spiced cauliflower velouté on dark slate, by Eleanor Jessica',
    stepsTitle: 'How it works',
    steps: [
      {
        title: 'Choose',
        text: 'Reserve your places and choose a main course for each guest.',
      },
      {
        title: 'Collect',
        text: 'Collect your meal on the evening, at the time and place nearest to you.',
      },
      {
        title: 'Finish',
        text: 'Follow my video guide to warm, finish and plate each course at home.',
      },
    ],
    upcomingTitle: 'Upcoming evenings',
    pastTitle: 'Past evenings',
    none: 'There is no evening open just now. The next menu will be announced here soon.',
    viewMenu: 'View the menu',
    perPerson: 'per person',
  },
  event: {
    back: 'All evenings',
    eyebrow: 'Dine at Home',
    heroAlt: 'A dish by Eleanor Jessica',
    secondImageAlt: 'Pithivier with pea & spinach fricassée, by Eleanor Jessica',
    courseCount: (n: number) => `${n} courses`,
    menuNotes: ['prepared by me', 'finished by you'],
    vegetarian: '(v)',
    videoNote:
      'Includes a personal video guide to heating, finishing & plating your meal.',
    printedMenu: 'View the printed menu',
    detailsTitle: 'The evening',
    perPerson: 'per person',
    deposit: (amount: string) =>
      `${amount} per person to reserve your places, the balance on collection.`,
    orderBy: (day: string) => `Orders close at midnight on ${day}.`,
    placesLeft: (n: number) => (n === 1 ? 'One place left' : `${n} places left`),
    soldOut: 'Sold out',
    closed: 'Orders closed',
    past: 'This evening has passed',
    collectionTitle: 'Collection',
    collectionNote:
      'Choose the time and place that suits you best when you order. The exact address is sent with your confirmation.',
    orderTitle: 'Reserve your places',
    orderPlaceholder: 'Online ordering will open here very soon.',
    soldOutNote:
      'This evening is fully booked. Thank you so much — the next menu will be announced soon.',
    closedNote: 'Orders for this evening have now closed. The next menu will be announced soon.',
    pastNote: 'This evening has passed. Do have a look at the menus to come.',
    testNotice: 'Test evening · for trying out the site only',
  },
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
      'Eleanor Jessica, cheffe privée. Des menus à thème en quatre plats, préparés par moi et terminés par vous, chez vous.',
  },
  nav: {
    dineAtHome: 'Dîner à la maison',
    switchLanguage: 'English',
  },
  dineAtHome: {
    metaTitle: 'Dîner à la maison',
    eyebrow: 'Eleanor Jessica · cheffe privée',
    title: 'Dîner à la maison',
    lead: 'Quatre plats · préparés par moi · terminés par vous',
    intro: [
      'Toutes les quelques semaines, je cuisine un menu à thème en quatre plats pour un petit nombre de foyers des environs. Je prépare chaque plat dans ma cuisine ; vous venez le chercher le soir même et vous le terminez chez vous, à votre rythme.',
      'Chaque menu est accompagné d’une courte vidéo personnelle, dans laquelle je vous montre comment réchauffer, terminer et dresser chaque plat, pour qu’il arrive à votre table tel que je le servirais.',
    ],
    heroAlt: 'Velouté de chou-fleur épicé sur ardoise, par Eleanor Jessica',
    stepsTitle: 'Comment ça marche',
    steps: [
      {
        title: 'Choisir',
        text: 'Réservez vos places et choisissez un plat principal pour chaque convive.',
      },
      {
        title: 'Récupérer',
        text: 'Récupérez votre repas le soir même, à l’heure et au lieu le plus proche de chez vous.',
      },
      {
        title: 'Terminer',
        text: 'Suivez ma vidéo pour réchauffer, terminer et dresser chaque plat chez vous.',
      },
    ],
    upcomingTitle: 'Prochaines soirées',
    pastTitle: 'Soirées passées',
    none: 'Aucune soirée n’est ouverte pour le moment. Le prochain menu sera annoncé ici très bientôt.',
    viewMenu: 'Voir le menu',
    perPerson: 'par personne',
  },
  event: {
    back: 'Toutes les soirées',
    eyebrow: 'Dîner à la maison',
    heroAlt: 'Une assiette signée Eleanor Jessica',
    secondImageAlt: 'Pithivier et fricassée de petits pois & épinards, par Eleanor Jessica',
    courseCount: (n: number) => `${n} plats`,
    menuNotes: ['préparés par moi', 'terminés par vous'],
    vegetarian: '(v)',
    videoNote:
      'Avec une vidéo personnelle pour réchauffer, terminer et dresser votre repas.',
    printedMenu: 'Voir le menu imprimé',
    detailsTitle: 'La soirée',
    perPerson: 'par personne',
    deposit: (amount: string) =>
      `${amount} par personne pour réserver vos places, le solde à la récupération.`,
    orderBy: (day: string) => `Commandes jusqu’à minuit le ${day.toLowerCase()}.`,
    placesLeft: (n: number) => (n === 1 ? 'Plus qu’une place' : `${n} places disponibles`),
    soldOut: 'Complet',
    closed: 'Commandes closes',
    past: 'Cette soirée est passée',
    collectionTitle: 'Récupération',
    collectionNote:
      'Choisissez l’heure et le lieu qui vous conviennent lors de votre commande. L’adresse exacte vous est envoyée avec votre confirmation.',
    orderTitle: 'Réserver vos places',
    orderPlaceholder: 'La commande en ligne ouvrira ici très bientôt.',
    soldOutNote:
      'Cette soirée est complète. Merci beaucoup — le prochain menu sera annoncé très bientôt.',
    closedNote:
      'Les commandes pour cette soirée sont closes. Le prochain menu sera annoncé très bientôt.',
    pastNote: 'Cette soirée est passée. Découvrez les prochains menus.',
    testNotice: 'Soirée test · uniquement pour essayer le site',
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
