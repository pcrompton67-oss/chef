import { customersConfig as cfg } from './config'

// The one-off "you're on the list" email sent after a home page sign-up. It
// also lets anyone signed up by someone else remove themselves in one click.
export function buildSignupEmail(
  r: { name: string; unsubscribe_token: string },
  siteUrl: string,
  locale: 'en' | 'fr',
): { subject: string; text: string } {
  const first = r.name.trim().split(/\s+/)[0]
  const unsubscribe = `${siteUrl}/unsubscribe?token=${r.unsubscribe_token}`
  if (locale === 'fr') {
    return {
      subject: `Vous êtes inscrit(e) aux rappels de ${cfg.businessName}`,
      text: [
        `Bonjour${first ? ` ${first}` : ''},`,
        ``,
        `Merci ! Nous vous enverrons un e-mail quand les commandes ouvriront pour nos prochaines livraisons.`,
        ``,
        `Si ce n'est pas vous qui vous êtes inscrit(e), ou si vous changez d'avis, désinscrivez-vous ici :`,
        unsubscribe,
        ``,
        cfg.businessName,
      ].join('\n'),
    }
  }
  return {
    subject: `You're on the reminder list for ${cfg.businessName}`,
    text: [
      `Hi${first ? ` ${first}` : ''},`,
      ``,
      `Thanks! We'll email you when orders open for our next deliveries.`,
      ``,
      `If you didn't sign up, or change your mind, you can unsubscribe here:`,
      unsubscribe,
      ``,
      cfg.businessName,
    ].join('\n'),
  }
}
