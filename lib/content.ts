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
  /** Optional small line under the eyebrow, e.g. the evening's date. */
  date?: string
  title: string
  courses: Course[]
  price: string
  notes: string[]
  /** Optional italic line under the price. */
  footnote?: string
}

/** One legal page (issue #11). In the text, {legalName} etc. are filled from
 * BUSINESS in lib/site.ts, {link:privacy} etc. link to another legal page,
 * {holdDays} and {maxDiners} come from the settings, and [[…]] marks wording
 * Eleanor still has to supply (shown highlighted). */
export type LegalPage = {
  metaTitle: string
  eyebrow: string
  title: string
  intro: string[]
  /** Each body item is a paragraph, or a list (an array). */
  sections: { heading: string; body: (string | string[])[] }[]
}

export const LEGAL_PAGES = ['legalNotice', 'privacy', 'allergens', 'terms'] as const
export type LegalPageKey = (typeof LEGAL_PAGES)[number]

/** Change this whenever the legal wording changes. */
export const LEGAL_UPDATED = '2026-11-17'

const legalPages = (pages: Record<LegalPageKey, LegalPage>) => pages

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
    soldOut: 'Sold out',
    closed: 'Orders closed',
    past: 'This evening has passed',
    collectionTitle: 'Collection',
    collectionNote:
      'Choose the time and place that suits you best when you order. The exact address is sent with your confirmation.',
    orderTitle: 'Reserve your places',
    soldOutNote:
      'This evening is fully booked. Thank you so much — the next menu will be announced soon.',
    closedNote: 'Orders for this evening have now closed. The next menu will be announced soon.',
    pastNote: 'This evening has passed. Do have a look at the menus to come.',
    testNotice: 'Test evening · for trying out the site only',
    placesLeftLow: (n: number) => (n === 1 ? 'Only one place left' : `Only ${n} places left`),
    placesAvailable: 'Places available',
  },
  order: {
    pointLabel: 'Where would you like to collect?',
    dinersLabel: 'How many diners?',
    diners: (n: number) => (n === 1 ? '1 diner' : `${n} diners`),
    fewer: 'Fewer',
    more: 'More',
    choiceLabel: (course: string) => `${course}: one for each diner`,
    choiceCount: (chosen: number, total: number) => `${chosen} of ${total} chosen`,
    choiceTooMany: (chosen: number, total: number) =>
      `${chosen} chosen for ${total} ${total === 1 ? 'diner' : 'diners'}: please take some away`,
    choiceDone: 'All chosen',
    detailsTitle: 'Your details',
    name: 'Name',
    mobile: 'Mobile',
    email: 'Email',
    allergies: 'Allergies or dietary needs',
    allergiesHint: 'For every diner, please. If there are none, simply write “None”.',
    marketing: 'Yes, send me new box dates and other news from Eleanor Jessica.',
    agreement:
      'I understand that my order is subject to availability, is confirmed only once the deposit is received, and that the balance is paid on collection.',
    agreementLinks: {
      before: 'I accept the ',
      terms: 'booking terms',
      middle: ' and have read the ',
      privacy: 'privacy policy',
      after: '.',
    },
    summaryTitle: 'Your order',
    total: 'Total',
    deposit: 'Deposit to reserve',
    balance: 'Balance on collection',
    times: (amount: string, n: number) => `${amount} × ${n}`,
    paymentNote: 'I’ll send you the details for paying the deposit by bank transfer.',
    submit: 'Reserve my places',
    submitting: 'Reserving…',
    errors: {
      required: 'Please fill this in.',
      email: 'Please check this email address.',
      mobile: 'Please check this number.',
      choices: 'Please choose a dish for every diner.',
      agreed: 'Please tick to agree.',
      collectionPoint: 'Please choose where to collect.',
      check: 'Please check the highlighted parts of the form.',
      closed: 'Sorry, orders for this evening have just closed.',
      notEnough: (n: number) =>
        n === 0
          ? 'Sorry, the last places have just been taken.'
          : n === 1
            ? 'Sorry, only one place is left now.'
            : `Sorry, only ${n} places are left now.`,
      generic: 'Sorry, something went wrong. Please try again in a moment.',
    },
  },
  thanks: {
    eyebrow: 'Thank you',
    title: 'Your places are reserved',
    text: [
      'I’ve sent you an email with your order and the details for paying your deposit by bank transfer.',
      'Your order is confirmed as soon as the deposit has been received, and the balance is paid on collection.',
    ],
    reference: (ref: string) => `Order no. ${ref}`,
    // The bank details box uses the "request received" email's wording (email.received).
    back: 'Back to the evening',
  },
  notify: {
    title: 'Tell me about the next one',
    label: 'Your email',
    button: 'Notify me',
    // Shown after signing up: they join the list only once they confirm by email.
    done: 'Thank you. Please check your inbox: I’ve sent you a link to confirm your email address.',
    error: 'Please check this email address.',
    consent: 'You’ll receive new box dates and other news from Eleanor Jessica. You can unsubscribe at any time.',
    // The same box on the home page (not tied to one evening).
    newsTitle: 'Hear about new box dates',
    newsButton: 'Subscribe',
  },
  email: {
    greeting: (name: string) => `Hello ${name},`,
    signOff: 'With warm wishes,',
    signature: 'Eleanor',
    replyNote: 'If you have any questions, simply reply to this email.',
    signup: {
      subject: 'Please confirm your subscription',
      title: 'Confirm your email',
      greeting: 'Hello,',
      intro: 'Thank you for signing up to hear about new box dates and other news from Eleanor Jessica. Please click below to confirm your email address.',
      button: 'Confirm my subscription',
      expires: 'This link works for 30 days.',
      ignore: 'If you didn’t sign up, simply ignore this email: you won’t be added to the list.',
    },
    footer: 'Eleanor Jessica · cheffe privée · Dine at Home',
    unsubscribe: 'Unsubscribe from news',
    summaryTitle: 'Your order',
    evening: 'Evening',
    diners: 'Diners',
    collection: 'Collection',
    collectionAt: (place: string, time: string) => `${place} at ${time}`,
    address: 'Address',
    allergies: 'Allergies & dietary needs',
    noAllergies: 'None given',
    total: 'Total',
    deposit: 'Deposit',
    balance: 'Balance on collection',
    orderNo: 'Order no.',
    received: {
      subject: (title: string) => `Your request · ${title}`,
      title: 'Thank you',
      intro: (title: string, date: string) =>
        `Thank you for your order for ${title} on ${date}. Your places are held for you, and your booking is confirmed as soon as the deposit arrives.`,
      payTitle: 'Your deposit',
      // `days` (from Console → Settings) adds how long they have to pay.
      transferIntro: (amount: string, days?: number) =>
        `Please pay the deposit of ${amount} by bank transfer${
          !days ? '' : days === 1 ? ' within a day of ordering' : ` within ${days} days of ordering`
        }:`,
      accountName: 'Account name',
      iban: 'IBAN',
      bic: 'BIC',
      amount: 'Amount',
      reference: 'Reference',
      transferNote:
        'Please include the reference so I can match your payment. I’ll email you as soon as it arrives.',
      bankLater: (amount: string) =>
        `I’ll send you the bank details for paying the deposit of ${amount} very shortly.`,
      cardPaid: (amount: string) => `Your deposit of ${amount} has been paid by card. Thank you.`,
      payInPerson: (amount: string, method: 'cash' | 'cheque') =>
        `The deposit of ${amount} is to be paid by ${method === 'cash' ? 'cash' : 'cheque'}, as agreed.`,
      addressNote: 'The exact collection address will be sent with your confirmation.',
    },
    confirmed: {
      subject: (title: string) => `Booking confirmed · ${title}`,
      title: 'Your booking is confirmed',
      intro: (title: string, date: string) =>
        `Your deposit has arrived, thank you. Your booking for ${title} on ${date} is confirmed.`,
      introNoDeposit: (title: string, date: string) =>
        `Your booking for ${title} on ${date} is confirmed.`,
      collectionTitle: 'Collecting your meal',
      balanceNote: 'Payable by cash or cheque when you collect.',
      allergiesNote: 'If anything has changed, please reply to this email.',
    },
    reminder: {
      subject: (title: string) => `See you tomorrow · ${title}`,
      title: 'See you tomorrow',
      intro: (title: string, date: string) =>
        `Just a reminder that your ${title} meal is ready to collect tomorrow, ${date}.`,
      outro: 'I look forward to seeing you.',
    },
  },
  confirmSignup: {
    metaTitle: 'Confirm your subscription',
    eyebrow: 'News',
    title: 'Confirm',
    text: 'Please confirm that you’d like to receive new box dates and other news from Eleanor Jessica.',
    button: 'Confirm my subscription',
    done: 'Thank you, you’re on the list. I’ll let you know about new box dates.',
    invalid: 'This link isn’t valid or has expired. Please sign up again on the website.',
    error: 'Something went wrong. Please try again.',
    back: 'Back to the website',
  },
  unsubscribe: {
    metaTitle: 'Unsubscribe',
    eyebrow: 'News',
    title: 'Unsubscribe',
    text: 'Stop receiving new box dates and other news from Eleanor Jessica. You’ll still receive emails about any order you have placed.',
    button: 'Unsubscribe',
    done: 'You’re unsubscribed. You won’t receive any more news from me.',
    invalid: 'This unsubscribe link isn’t valid. Simply reply to any of my emails and I’ll take you off the list.',
    error: 'Something went wrong. Please try again.',
    back: 'Back to the website',
  },
  menuWords: {
    or: 'or',
  },
  footer: {
    rights: 'All rights reserved.',
  },
  legal: {
    updated: 'Last updated',
    /** Shown, highlighted, where a business detail in lib/site.ts is still missing. */
    missing: (what: string) => `to be supplied: ${what}`,
    fields: {
      legalName: 'Eleanor’s full legal name',
      tradingName: 'trading name',
      legalForm: 'legal form, e.g. micro-entreprise',
      address: 'business address',
      siret: 'SIRET number',
      activityCode: 'activity code (APE)',
      vat: 'VAT status, e.g. “TVA non applicable, art. 293 B du CGI”',
      phone: 'phone number',
      email: 'email address',
      insurance: 'professional insurer',
      mediator: 'consumer mediator: name and website',
    },
    /** Footer links. */
    links: {
      legalNotice: 'Legal notice',
      privacy: 'Privacy',
      allergens: 'Allergens',
      terms: 'Booking terms',
    },
    /** The same pages named inside a sentence. */
    inText: {
      legalNotice: 'legal notice',
      privacy: 'privacy policy',
      allergens: 'allergen information',
      terms: 'booking terms',
    },
    pages: legalPages({
      legalNotice: {
        metaTitle: 'Legal notice',
        eyebrow: 'Mentions légales',
        title: 'Legal notice',
        intro: [],
        sections: [
          {
            heading: 'Who publishes this website',
            body: [
              'This website is published by {legalName}, trading as {tradingName}.',
              [
                'Legal form: {legalForm}',
                'Address: {address}',
                'SIRET: {siret}',
                'Activity code (APE): {activityCode}',
                'VAT: {vat}',
                'Email: {email}',
                'Phone: {phone}',
              ],
              'Publication director: {legalName}.',
            ],
          },
          {
            heading: 'Hosting',
            body: ['This website is hosted by {host}.'],
          },
          {
            heading: 'Insurance',
            body: ['Professional liability insurance with {insurance}, covering the European Union.'],
          },
          {
            heading: 'Photographs, text and logo',
            body: [
              'The photographs, menus, text and logo on this website belong to {legalName}. Please don’t copy or reuse them without asking first.',
            ],
          },
          {
            heading: 'Your personal data',
            body: ['How I use the details you give me, and your rights, are explained in the {link:privacy}.'],
          },
        ],
      },
      privacy: {
        metaTitle: 'Privacy policy',
        eyebrow: 'Your data',
        title: 'Privacy policy',
        intro: [
          'This policy explains what personal information I collect through this website and when you order, why I need it, and what your rights are. I’m responsible for it: {legalName}, {address}, {email}.',
        ],
        sections: [
          {
            heading: 'What I collect',
            body: [
              [
                'When you order: your name, mobile number and email address, the dishes you choose, where you collect, and any allergies or dietary needs you tell me about.',
                'Your preferred language, and how and when you paid.',
                'If you join my mailing list: your email address, your language, and when you joined and confirmed.',
                'A record of the emails I send you (date, which email, and whether it was sent).',
              ],
            ],
          },
          {
            heading: 'Why I use it',
            body: [
              [
                'To prepare your order, tell you about it and take payment. This is needed to carry out your order.',
                'Allergies and dietary needs, which can count as health information, are used only to prepare your food safely. You choose to give them to me, and you can ask me to delete them at any time.',
                'To send you new box dates and other news, only if you’ve asked for them and confirmed.',
                'To keep the accounting records French law requires.',
              ],
              'I never sell your details or share them for anyone else’s marketing.',
            ],
          },
          {
            heading: 'The mailing list',
            body: [
              'You join only by ticking the box when you order, or by entering your email in a sign-up box on this website and then clicking the link in the confirmation email I send you.',
              'Every news email has an unsubscribe link at the bottom: one click and you’re off the list. You can also simply reply to any email and ask. Emails about an order you have placed are still sent, as they’re part of your order.',
            ],
          },
          {
            heading: 'Who handles it for me',
            body: [
              'Only I see your details. These companies store or send them on my behalf, and only for that purpose:',
              [
                'Vercel Inc. (United States): hosts this website.',
                'Neon Inc. (United States): stores orders and customer details, [[server location to be confirmed]].',
                'Resend Inc. (United States): sends my emails.',
              ],
              'Where your details are handled outside the European Union, this is covered by safeguards recognised under European law, such as the EU–US Data Privacy Framework or the European Commission’s standard contractual clauses. [[To be checked for each company.]]',
            ],
          },
          {
            heading: 'How long I keep it',
            body: [
              [
                'Orders and payment records: 10 years, as French accounting law requires.',
                'Allergies and dietary needs: [[how long, e.g. deleted 3 months after your evening]].',
                'Your contact details: 3 years after your last order or contact with me. [[To be confirmed.]]',
                'Mailing list: until you unsubscribe. After that I keep only a note that you left, so you’re not added again by mistake.',
              ],
            ],
          },
          {
            heading: 'Cookies',
            body: [
              'This website uses no advertising or tracking cookies. Visits are counted with Vercel Web Analytics, which uses no cookies and doesn’t identify you.',
            ],
          },
          {
            heading: 'Your rights',
            body: [
              'You can ask to see the information I hold about you, to correct it, delete it or receive a copy, or to object to how I use it. You can withdraw your consent at any time. Just email me at {email}.',
              'If you’re not happy with my answer, you can complain to the CNIL, the French data protection authority (www.cnil.fr).',
            ],
          },
        ],
      },
      allergens: {
        metaTitle: 'Allergens',
        eyebrow: 'Your safety',
        title: 'Allergens',
        intro: [
          'Every menu is cooked in my own kitchen, where all fourteen major allergens are handled.',
        ],
        sections: [
          {
            heading: 'The fourteen major allergens',
            body: [
              [
                'Cereals containing gluten',
                'Crustaceans',
                'Eggs',
                'Fish',
                'Peanuts',
                'Soya',
                'Milk',
                'Nuts',
                'Celery',
                'Mustard',
                'Sesame',
                'Sulphites',
                'Lupin',
                'Molluscs',
              ],
            ],
          },
          {
            heading: 'Tell me when you order',
            body: [
              'Please list every diner’s allergies and dietary needs on the order form. I’ll let you know which dishes are affected and adapt them where I safely can. If I can’t, I’ll tell you before your order is confirmed.',
              'You can ask me for the full list of allergens in each dish, in writing, at any time before your evening. [[Also printed on the label of each box? Eleanor to confirm.]]',
            ],
          },
          {
            heading: 'What I can’t promise',
            body: [
              'I take great care, but my kitchen isn’t allergen-free, so I can’t guarantee that any dish is completely free from traces. If an allergy is severe, please talk to me before ordering.',
            ],
          },
          {
            heading: 'Once you’ve collected',
            body: [
              '[[Storage and finishing advice, e.g. keep the box chilled and enjoy it the same evening. Eleanor to supply.]]',
            ],
          },
        ],
      },
      terms: {
        metaTitle: 'Booking terms',
        eyebrow: 'Dine at Home',
        title: 'Booking terms',
        intro: [
          'These terms apply to every Dine at Home order with {tradingName}. When you tick the box on the order form, you accept them.',
        ],
        sections: [
          {
            heading: 'Dine at Home',
            body: [
              'Dine at Home is a themed four-course menu that I prepare, and that you collect on the evening, at the place and time you chose, and finish at home with my video guide.',
              'Prices are per person, as shown on each evening’s page ({vat}).',
            ],
          },
          {
            heading: 'Ordering',
            body: [
              'You can order for up to {maxDiners} diners on this website. For more, please get in touch. Your places are held as soon as you order, and your order is confirmed when I receive your deposit. I’ll email you each time.',
            ],
          },
          {
            heading: 'Paying',
            body: [
              'A deposit per person, shown on each evening’s page, is paid when you order, by bank transfer. Please pay it within {holdDays} days, quoting the reference I give you. If it hasn’t arrived by then, I may cancel your order and release your places.',
              'The balance is paid when you collect, by cash or cheque.',
            ],
          },
          {
            heading: 'Changing your order',
            body: [
              'If you need to change the number of diners, the dishes or where you collect, please tell me as soon as you can. I’ll do my best, but can’t promise changes after the order deadline shown on the evening’s page.',
            ],
          },
          {
            heading: 'If you cancel',
            body: [
              'The deposit is non-refundable. If you cancel more than 7 days before the evening, I’ll gladly move your deposit to another Dine at Home evening instead. Within 7 days of the evening, the deposit is kept.',
              'As each menu is fresh food prepared for a set date, the usual 14-day right to cancel online purchases doesn’t apply (French Consumer Code, article L221-28).',
            ],
          },
          {
            heading: 'If I cancel',
            body: [
              'If I ever have to cancel an evening, I’ll tell you as soon as possible and refund everything you’ve paid, in full.',
            ],
          },
          {
            heading: 'Collecting',
            body: [
              'Please collect at the place and time you chose. The exact address is in your confirmation email. If you can’t make it, tell me as early as you can. A box that isn’t collected, without the order having been cancelled, is still due in full.',
              'Once collected, your food is in your care: please follow the storage advice on the {link:allergens} page and in the box.',
            ],
          },
          {
            heading: 'Allergies',
            body: [
              'Please tell me every diner’s allergies and dietary needs when you order. See the {link:allergens}.',
            ],
          },
          {
            heading: 'If something isn’t right',
            body: [
              'Email me at {email} and I’ll do my best to put it right. If we can’t agree, you can contact the consumer mediator free of charge: {mediator}.',
              'These terms are governed by French law. How I use your details is explained in the {link:privacy}.',
            ],
          },
        ],
      },
    }),
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
    soldOut: 'Complet',
    closed: 'Commandes closes',
    past: 'Cette soirée est passée',
    collectionTitle: 'Récupération',
    collectionNote:
      'Choisissez l’heure et le lieu qui vous conviennent lors de votre commande. L’adresse exacte vous est envoyée avec votre confirmation.',
    orderTitle: 'Réserver vos places',
    soldOutNote:
      'Cette soirée est complète. Merci beaucoup — le prochain menu sera annoncé très bientôt.',
    closedNote:
      'Les commandes pour cette soirée sont closes. Le prochain menu sera annoncé très bientôt.',
    pastNote: 'Cette soirée est passée. Découvrez les prochains menus.',
    testNotice: 'Soirée test · uniquement pour essayer le site',
    placesLeftLow: (n: number) =>
      n === 1 ? 'Plus qu’une place' : `Plus que ${n} places`,
    placesAvailable: 'Places disponibles',
  },
  order: {
    pointLabel: 'Où souhaitez-vous récupérer votre repas ?',
    dinersLabel: 'Combien de convives ?',
    diners: (n: number) => (n === 1 ? '1 convive' : `${n} convives`),
    fewer: 'Moins',
    more: 'Plus',
    choiceLabel: (course: string) => `${course} : un par convive`,
    choiceCount: (chosen: number, total: number) =>
      `${chosen} sur ${total} ${chosen > 1 ? 'choisis' : 'choisi'}`,
    choiceTooMany: (chosen: number, total: number) =>
      `${chosen} choisis pour ${total} ${total === 1 ? 'convive' : 'convives'} : merci d’en retirer`,
    choiceDone: 'Tout est choisi',
    detailsTitle: 'Vos coordonnées',
    name: 'Nom',
    mobile: 'Portable',
    email: 'E-mail',
    allergies: 'Allergies ou régimes alimentaires',
    allergiesHint: 'Pour chaque convive, s’il vous plaît. S’il n’y en a pas, écrivez simplement « Aucune ».',
    marketing: 'Oui, envoyez-moi les dates des prochaines box et les autres actualités d’Eleanor Jessica.',
    agreement:
      'Je comprends que ma commande est sous réserve de disponibilité, qu’elle n’est confirmée qu’à réception de l’acompte et que le solde est réglé à la récupération.',
    agreementLinks: {
      before: 'J’accepte les ',
      terms: 'conditions de réservation',
      middle: ' et j’ai lu la ',
      privacy: 'politique de confidentialité',
      after: '.',
    },
    summaryTitle: 'Votre commande',
    total: 'Total',
    deposit: 'Acompte pour réserver',
    balance: 'Solde à la récupération',
    times: (amount: string, n: number) => `${amount} × ${n}`,
    paymentNote: 'Je vous enverrai les coordonnées pour régler l’acompte par virement.',
    submit: 'Réserver mes places',
    submitting: 'Réservation…',
    errors: {
      required: 'Merci de compléter ce champ.',
      email: 'Merci de vérifier cette adresse e-mail.',
      mobile: 'Merci de vérifier ce numéro.',
      choices: 'Merci de choisir un plat pour chaque convive.',
      agreed: 'Merci de cocher pour accepter.',
      collectionPoint: 'Merci de choisir un lieu de récupération.',
      check: 'Merci de vérifier les parties signalées du formulaire.',
      closed: 'Désolée, les commandes pour cette soirée viennent de se clore.',
      notEnough: (n: number) =>
        n === 0
          ? 'Désolée, les dernières places viennent d’être prises.'
          : n === 1
            ? 'Désolée, il ne reste plus qu’une place.'
            : `Désolée, il ne reste plus que ${n} places.`,
      generic: 'Désolée, un problème est survenu. Merci de réessayer dans un instant.',
    },
  },
  thanks: {
    eyebrow: 'Merci',
    title: 'Vos places sont réservées',
    text: [
      'Je vous ai envoyé un e-mail avec votre commande et les coordonnées pour régler l’acompte par virement.',
      'Votre commande est confirmée dès réception de l’acompte ; le solde est réglé à la récupération.',
    ],
    reference: (ref: string) => `Commande n° ${ref}`,
    back: 'Retour à la soirée',
  },
  notify: {
    title: 'Prévenez-moi de la prochaine',
    label: 'Votre e-mail',
    button: 'Me prévenir',
    done: 'Merci. Vérifiez votre boîte de réception : je vous ai envoyé un lien pour confirmer votre adresse e-mail.',
    error: 'Merci de vérifier cette adresse e-mail.',
    consent: 'Vous recevrez les dates des prochaines box et les autres actualités d’Eleanor Jessica. Désabonnement possible à tout moment.',
    newsTitle: 'Être informé(e) des prochaines box',
    newsButton: 'M’inscrire',
  },
  email: {
    greeting: (name: string) => `Bonjour ${name},`,
    signOff: 'Bien chaleureusement,',
    signature: 'Eleanor',
    replyNote: 'Pour toute question, il vous suffit de répondre à cet e-mail.',
    signup: {
      subject: 'Merci de confirmer votre inscription',
      title: 'Confirmez votre e-mail',
      greeting: 'Bonjour,',
      intro: 'Merci de vous être inscrit(e) pour recevoir les dates des prochaines box et les autres actualités d’Eleanor Jessica. Cliquez ci-dessous pour confirmer votre adresse e-mail.',
      button: 'Confirmer mon inscription',
      expires: 'Ce lien est valable 30 jours.',
      ignore: 'Si vous ne vous êtes pas inscrit(e), ignorez simplement cet e-mail : vous ne serez pas ajouté(e) à la liste.',
    },
    footer: 'Eleanor Jessica · cheffe privée · Dîner à la maison',
    unsubscribe: 'Se désabonner des actualités',
    summaryTitle: 'Votre commande',
    evening: 'Soirée',
    diners: 'Convives',
    collection: 'Retrait',
    collectionAt: (place: string, time: string) => `${place} à ${time}`,
    address: 'Adresse',
    allergies: 'Allergies et régimes',
    noAllergies: 'Aucune indiquée',
    total: 'Total',
    deposit: 'Acompte',
    balance: 'Solde au retrait',
    orderNo: 'Commande n°',
    received: {
      subject: (title: string) => `Votre demande · ${title}`,
      title: 'Merci',
      intro: (title: string, date: string) =>
        `Merci pour votre commande pour ${title}, le ${date.charAt(0).toLowerCase() + date.slice(1)}. Vos places sont réservées, et votre réservation est confirmée dès réception de l’acompte.`,
      payTitle: 'Votre acompte',
      transferIntro: (amount: string, days?: number) =>
        `Merci de régler l’acompte de ${amount} par virement bancaire${
          !days ? '' : days === 1 ? ' dans la journée qui suit votre commande' : ` dans les ${days} jours qui suivent votre commande`
        } :`,
      accountName: 'Titulaire du compte',
      iban: 'IBAN',
      bic: 'BIC',
      amount: 'Montant',
      reference: 'Référence',
      transferNote:
        'Merci d’indiquer la référence pour que je puisse identifier votre paiement. Je vous écrirai dès sa réception.',
      bankLater: (amount: string) =>
        `Je vous envoie très vite les coordonnées bancaires pour régler l’acompte de ${amount}.`,
      cardPaid: (amount: string) => `Votre acompte de ${amount} a été réglé par carte. Merci.`,
      payInPerson: (amount: string, method: 'cash' | 'cheque') =>
        `L’acompte de ${amount} est à régler ${method === 'cash' ? 'en espèces' : 'par chèque'}, comme convenu.`,
      addressNote: 'L’adresse exacte du retrait vous sera envoyée avec votre confirmation.',
    },
    confirmed: {
      subject: (title: string) => `Réservation confirmée · ${title}`,
      title: 'Votre réservation est confirmée',
      intro: (title: string, date: string) =>
        `Votre acompte est bien arrivé, merci. Votre réservation pour ${title}, le ${date.charAt(0).toLowerCase() + date.slice(1)}, est confirmée.`,
      introNoDeposit: (title: string, date: string) =>
        `Votre réservation pour ${title}, le ${date.charAt(0).toLowerCase() + date.slice(1)}, est confirmée.`,
      collectionTitle: 'Le retrait de votre repas',
      balanceNote: 'À régler en espèces ou par chèque au retrait.',
      allergiesNote: 'Si quelque chose a changé, merci de répondre à cet e-mail.',
    },
    reminder: {
      subject: (title: string) => `À demain · ${title}`,
      title: 'À demain',
      intro: (title: string, date: string) =>
        `Petit rappel : votre repas ${title} est à retirer demain, ${date.charAt(0).toLowerCase() + date.slice(1)}.`,
      outro: 'Au plaisir de vous voir.',
    },
  },
  confirmSignup: {
    metaTitle: 'Confirmer votre inscription',
    eyebrow: 'Actualités',
    title: 'Confirmer',
    text: 'Merci de confirmer que vous souhaitez recevoir les dates des prochaines box et les autres actualités d’Eleanor Jessica.',
    button: 'Confirmer mon inscription',
    done: 'Merci, vous êtes inscrit(e). Je vous préviendrai des prochaines box.',
    invalid: 'Ce lien n’est pas valide ou a expiré. Merci de vous inscrire à nouveau sur le site.',
    error: 'Une erreur est survenue. Merci de réessayer.',
    back: 'Retour au site',
  },
  unsubscribe: {
    metaTitle: 'Se désabonner',
    eyebrow: 'Actualités',
    title: 'Se désabonner',
    text: 'Ne plus recevoir les dates des prochaines box ni les autres actualités d’Eleanor Jessica. Vous recevrez toujours les e-mails liés à vos commandes.',
    button: 'Me désabonner',
    done: 'Vous êtes désabonné(e). Vous ne recevrez plus mes actualités.',
    invalid: 'Ce lien de désabonnement n’est pas valide. Répondez simplement à l’un de mes e-mails et je vous retirerai de la liste.',
    error: 'Une erreur est survenue. Merci de réessayer.',
    back: 'Retour au site',
  },
  menuWords: {
    or: 'ou',
  },
  footer: {
    rights: 'Tous droits réservés.',
  },
  legal: {
    updated: 'Dernière mise à jour',
    missing: (what: string) => `à compléter : ${what}`,
    fields: {
      legalName: 'nom légal complet d’Eleanor',
      tradingName: 'nom commercial',
      legalForm: 'forme juridique, ex. micro-entreprise',
      address: 'adresse professionnelle',
      siret: 'numéro SIRET',
      activityCode: 'code APE',
      vat: 'régime de TVA, ex. « TVA non applicable, art. 293 B du CGI »',
      phone: 'numéro de téléphone',
      email: 'adresse e-mail',
      insurance: 'assureur professionnel',
      mediator: 'médiateur de la consommation : nom et site internet',
    },
    links: {
      legalNotice: 'Mentions légales',
      privacy: 'Confidentialité',
      allergens: 'Allergènes',
      terms: 'Conditions de réservation',
    },
    inText: {
      legalNotice: 'mentions légales',
      privacy: 'politique de confidentialité',
      allergens: 'informations sur les allergènes',
      terms: 'conditions de réservation',
    },
    pages: legalPages({
      legalNotice: {
        metaTitle: 'Mentions légales',
        eyebrow: 'Informations',
        title: 'Mentions légales',
        intro: [],
        sections: [
          {
            heading: 'Éditeur du site',
            body: [
              'Ce site est édité par {legalName}, sous le nom commercial {tradingName}.',
              [
                'Forme juridique : {legalForm}',
                'Adresse : {address}',
                'SIRET : {siret}',
                'Code APE : {activityCode}',
                'TVA : {vat}',
                'E-mail : {email}',
                'Téléphone : {phone}',
              ],
              'Directrice de la publication : {legalName}.',
            ],
          },
          {
            heading: 'Hébergement',
            body: ['Ce site est hébergé par {host}.'],
          },
          {
            heading: 'Assurance',
            body: ['Assurance responsabilité civile professionnelle : {insurance}, couverture Union européenne.'],
          },
          {
            heading: 'Photographies, textes et logo',
            body: [
              'Les photographies, menus, textes et le logo de ce site appartiennent à {legalName}. Merci de ne pas les copier ni les réutiliser sans autorisation.',
            ],
          },
          {
            heading: 'Vos données personnelles',
            body: ['L’utilisation de vos données et vos droits sont expliqués dans la {link:privacy}.'],
          },
        ],
      },
      privacy: {
        metaTitle: 'Politique de confidentialité',
        eyebrow: 'Vos données',
        title: 'Politique de confidentialité',
        intro: [
          'Cette politique explique quelles données personnelles je recueille sur ce site et lors de vos commandes, pourquoi, et quels sont vos droits. J’en suis responsable : {legalName}, {address}, {email}.',
        ],
        sections: [
          {
            heading: 'Ce que je recueille',
            body: [
              [
                'Lors d’une commande : vos nom, numéro de portable et adresse e-mail, les plats choisis, le lieu de récupération, ainsi que les allergies ou régimes alimentaires que vous m’indiquez.',
                'Votre langue, ainsi que le mode et la date de vos paiements.',
                'Si vous vous inscrivez à mes actualités : votre adresse e-mail, votre langue, et les dates d’inscription et de confirmation.',
                'Un relevé des e-mails que je vous envoie (date, type d’e-mail, envoyé ou non).',
              ],
            ],
          },
          {
            heading: 'Pourquoi je les utilise',
            body: [
              [
                'Pour préparer votre commande, vous en informer et encaisser le paiement : c’est nécessaire à l’exécution de votre commande.',
                'Les allergies et régimes alimentaires, qui peuvent constituer des données de santé, servent uniquement à préparer votre repas en toute sécurité. Vous choisissez de me les communiquer et pouvez me demander de les effacer à tout moment.',
                'Pour vous envoyer les dates des prochaines box et mes actualités, uniquement si vous l’avez demandé et confirmé.',
                'Pour tenir la comptabilité exigée par la loi française.',
              ],
              'Je ne vends jamais vos données et ne les partage avec personne à des fins commerciales.',
            ],
          },
          {
            heading: 'Mes actualités',
            body: [
              'Vous ne recevez mes actualités que si vous cochez la case lors d’une commande, ou si vous saisissez votre e-mail dans un formulaire d’inscription de ce site puis cliquez sur le lien de l’e-mail de confirmation.',
              'Chaque e-mail d’actualités comporte un lien de désabonnement en bas : un clic suffit. Vous pouvez aussi simplement répondre à l’un de mes e-mails. Les e-mails liés à une commande passée restent envoyés, car ils font partie de votre commande.',
            ],
          },
          {
            heading: 'Mes prestataires',
            body: [
              'Je suis la seule à consulter vos données. Ces sociétés les stockent ou les envoient pour mon compte, uniquement à cette fin :',
              [
                'Vercel Inc. (États-Unis) : hébergement de ce site.',
                'Neon Inc. (États-Unis) : stockage des commandes et des données clients, [[localisation des serveurs à confirmer]].',
                'Resend Inc. (États-Unis) : envoi de mes e-mails.',
              ],
              'Lorsque vos données sont traitées hors de l’Union européenne, ce transfert est encadré par des garanties reconnues par le droit européen, comme le cadre de protection des données UE–États-Unis ou les clauses contractuelles types de la Commission européenne. [[À vérifier pour chaque société.]]',
            ],
          },
          {
            heading: 'Durée de conservation',
            body: [
              [
                'Commandes et paiements : 10 ans, comme l’exige le droit comptable français.',
                'Allergies et régimes alimentaires : [[durée, ex. effacés 3 mois après votre soirée]].',
                'Vos coordonnées : 3 ans après votre dernière commande ou votre dernier contact. [[À confirmer.]]',
                'Liste d’actualités : jusqu’à votre désabonnement. Je garde ensuite seulement une trace de votre départ, pour ne pas vous réinscrire par erreur.',
              ],
            ],
          },
          {
            heading: 'Cookies',
            body: [
              'Ce site n’utilise aucun cookie publicitaire ni de suivi. Les visites sont comptées avec Vercel Web Analytics, qui n’utilise pas de cookies et ne vous identifie pas.',
            ],
          },
          {
            heading: 'Vos droits',
            body: [
              'Vous pouvez demander à consulter les données que je détiens sur vous, à les corriger, à les effacer ou à en recevoir une copie, ou vous opposer à leur utilisation. Vous pouvez retirer votre consentement à tout moment. Écrivez-moi simplement à {email}.',
              'Si ma réponse ne vous satisfait pas, vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).',
            ],
          },
        ],
      },
      allergens: {
        metaTitle: 'Allergènes',
        eyebrow: 'Votre sécurité',
        title: 'Allergènes',
        intro: [
          'Chaque menu est préparé dans ma propre cuisine, où les quatorze allergènes majeurs sont manipulés.',
        ],
        sections: [
          {
            heading: 'Les quatorze allergènes majeurs',
            body: [
              [
                'Céréales contenant du gluten',
                'Crustacés',
                'Œufs',
                'Poissons',
                'Arachides',
                'Soja',
                'Lait',
                'Fruits à coque',
                'Céleri',
                'Moutarde',
                'Graines de sésame',
                'Sulfites',
                'Lupin',
                'Mollusques',
              ],
            ],
          },
          {
            heading: 'Prévenez-moi en commandant',
            body: [
              'Merci d’indiquer les allergies et régimes alimentaires de chaque convive dans le formulaire de commande. Je vous dirai quels plats sont concernés et les adapterai lorsque c’est possible en toute sécurité. Sinon, je vous préviendrai avant que votre commande ne soit confirmée.',
              'Vous pouvez me demander à tout moment avant votre soirée la liste complète et écrite des allergènes de chaque plat. [[Également indiquée sur l’étiquette de chaque box ? À confirmer par Eleanor.]]',
            ],
          },
          {
            heading: 'Ce que je ne peux pas garantir',
            body: [
              'Je fais très attention, mais ma cuisine n’est pas exempte d’allergènes : je ne peux donc pas garantir l’absence totale de traces dans un plat. En cas d’allergie sévère, parlez-m’en avant de commander.',
            ],
          },
          {
            heading: 'Après la récupération',
            body: [
              '[[Conseils de conservation et de finition, ex. garder la box au frais et la déguster le soir même. À fournir par Eleanor.]]',
            ],
          },
        ],
      },
      terms: {
        metaTitle: 'Conditions de réservation',
        eyebrow: 'Dîner à la maison',
        title: 'Conditions de réservation',
        intro: [
          'Ces conditions s’appliquent à toute commande Dîner à la maison auprès de {tradingName}. En cochant la case du formulaire de commande, vous les acceptez.',
        ],
        sections: [
          {
            heading: 'Dîner à la maison',
            body: [
              'Dîner à la maison est un menu à thème en quatre plats que je prépare, que vous récupérez le soir même au lieu et à l’heure choisis, et que vous terminez chez vous grâce à mon guide vidéo.',
              'Les prix s’entendent par personne, comme indiqué sur la page de chaque soirée ({vat}).',
            ],
          },
          {
            heading: 'Commander',
            body: [
              'Vous pouvez commander jusqu’à {maxDiners} couverts sur ce site. Au-delà, contactez-moi. Vos places sont réservées dès la commande, et votre commande est confirmée à réception de l’acompte. Je vous écris à chaque étape.',
            ],
          },
          {
            heading: 'Paiement',
            body: [
              'Un acompte par personne, indiqué sur la page de chaque soirée, est réglé à la commande par virement bancaire. Merci de le régler sous {holdDays} jours, en indiquant la référence que je vous donne. Passé ce délai, je peux annuler votre commande et libérer vos places.',
              'Le solde est réglé à la récupération, en espèces ou par chèque.',
            ],
          },
          {
            heading: 'Modifier votre commande',
            body: [
              'Pour modifier le nombre de couverts, les plats ou le lieu de récupération, prévenez-moi dès que possible. Je ferai de mon mieux, sans pouvoir garantir de modification après la date limite de commande indiquée sur la page de la soirée.',
            ],
          },
          {
            heading: 'Si vous annulez',
            body: [
              'L’acompte n’est pas remboursable. Si vous annulez plus de 7 jours avant la soirée, je reporte volontiers votre acompte sur une autre soirée Dîner à la maison. À moins de 7 jours de la soirée, l’acompte est conservé.',
              'Chaque menu étant composé de denrées fraîches préparées pour une date précise, le droit de rétractation de 14 jours ne s’applique pas (Code de la consommation, article L221-28).',
            ],
          },
          {
            heading: 'Si j’annule',
            body: [
              'Si je dois annuler une soirée, je vous préviens au plus vite et vous rembourse intégralement les sommes versées.',
            ],
          },
          {
            heading: 'Récupération',
            body: [
              'Merci de venir au lieu et à l’heure choisis. L’adresse exacte figure dans votre e-mail de confirmation. En cas d’empêchement, prévenez-moi le plus tôt possible. Une box non récupérée, sans annulation de la commande, reste due en totalité.',
              'Une fois récupéré, votre repas est sous votre responsabilité : suivez les conseils de conservation de la page {link:allergens} et ceux joints à la box.',
            ],
          },
          {
            heading: 'Allergies',
            body: [
              'Merci d’indiquer les allergies et régimes alimentaires de chaque convive en commandant. Voir les {link:allergens}.',
            ],
          },
          {
            heading: 'En cas de problème',
            body: [
              'Écrivez-moi à {email} et je ferai de mon mieux pour y remédier. À défaut d’accord, vous pouvez saisir gratuitement le médiateur de la consommation : {mediator}.',
              'Ces conditions sont soumises au droit français. L’utilisation de vos données est expliquée dans la {link:privacy}.',
            ],
          },
        ],
      },
    }),
  },
}

export const content: Record<Locale, Content> = { en, fr }

export function t(locale: Locale): Content {
  return content[locale]
}
