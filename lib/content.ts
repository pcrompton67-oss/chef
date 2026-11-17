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
    done: 'Thank you. I’ll let you know as soon as the next evening opens.',
    error: 'Please check this email address.',
    consent: 'You’ll receive new box dates and other news from Eleanor Jessica. You can unsubscribe at any time.',
  },
  email: {
    greeting: (name: string) => `Hello ${name},`,
    signOff: 'With warm wishes,',
    signature: 'Eleanor',
    replyNote: 'If you have any questions, simply reply to this email.',
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
    done: 'Merci. Je vous préviendrai dès l’ouverture de la prochaine soirée.',
    error: 'Merci de vérifier cette adresse e-mail.',
    consent: 'Vous recevrez les dates des prochaines box et les autres actualités d’Eleanor Jessica. Désabonnement possible à tout moment.',
  },
  email: {
    greeting: (name: string) => `Bonjour ${name},`,
    signOff: 'Bien chaleureusement,',
    signature: 'Eleanor',
    replyNote: 'Pour toute question, il vous suffit de répondre à cet e-mail.',
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
}

export const content: Record<Locale, Content> = { en, fr }

export function t(locale: Locale): Content {
  return content[locale]
}
