import { content } from '@/lib/content'
import { formatDate, formatMoney, formatTime, type Locale } from '@/lib/i18n'
import { SITE_URL } from '@/lib/site'

/**
 * The emails (issue #13): what they say and how they look, in HTML and plain
 * text. No database or sending code here, so the console can also use this in
 * the browser to show previews.
 *
 * Customer emails follow the order's language; wording is in lib/content.ts
 * (the `email` section). Eleanor's copy is always in English.
 */

export type EmailKind = 'received' | 'confirmed' | 'reminder' | 'owner'

export const EMAIL_KINDS: { id: EmailKind; label: string; when: string }[] = [
  { id: 'received', label: 'Request received', when: 'Sent to the customer as soon as they order.' },
  { id: 'confirmed', label: 'Booking confirmed', when: 'Sent when you press “Deposit received”. The only email (with the reminder) that gives the address.' },
  { id: 'reminder', label: 'Reminder', when: 'Sent at 18:00 the day before, to confirmed orders only.' },
  { id: 'owner', label: 'Your copy', when: 'Sent to you for every new website order. Always in English.' },
]

/** Everything an email needs to know about one order. */
export type EmailOrder = {
  id: string
  name: string
  email: string
  mobile: string
  language: Locale
  diners: number
  allergies: string
  notes: string
  source: string
  paymentMethod: 'bank_transfer' | 'card' | 'cash' | 'cheque'
  totalCents: number
  depositCents: number
  balanceCents: number
  depositPaid: boolean
  event: { title: string; date: string } // date YYYY-MM-DD
  place: string
  time: string // HH:MM
  /** Exact address. Only ever shown in the confirmed and reminder emails. */
  address: string
  /** The menu, with how many of each dish for choice courses. */
  courses: { name: string; dishes: { name: string; quantity: number | null }[] }[]
}

export type BankDetails = { accountName: string; iban: string; bic: string }

export type RenderedEmail = { subject: string; html: string; text: string }

/** The reference customers put on their bank transfer, e.g. "EJ-123". */
export function transferReference(orderId: string): string {
  return `EJ-${orderId}`
}

export function hasBankDetails(b: BankDetails): boolean {
  return Boolean(b.accountName.trim() && b.iban.trim())
}

export function renderEmail(kind: EmailKind, o: EmailOrder, bank: BankDetails): RenderedEmail {
  if (kind === 'owner') return ownerCopy(o, bank)
  const loc = o.language
  const c = content[loc].email
  const date = formatDate(o.event.date, loc)
  const money = (cents: number) => formatMoney(cents, loc)
  const b = new Builder()

  let subject: string
  if (kind === 'received') {
    subject = c.received.subject(o.event.title)
    b.title(c.received.title)
    b.para(c.greeting(o.name))
    b.para(c.received.intro(o.event.title, date))
    summary(b, o, loc, false)
    if (o.depositCents > 0 && !o.depositPaid) {
      b.heading(c.received.payTitle)
      if (o.paymentMethod === 'bank_transfer') {
        if (hasBankDetails(bank)) {
          b.para(c.received.transferIntro(money(o.depositCents)))
          b.table([
            [c.received.accountName, bank.accountName.trim()],
            [c.received.iban, bank.iban.trim()],
            ...(bank.bic.trim() ? [[c.received.bic, bank.bic.trim()] as [string, string]] : []),
            [c.received.amount, money(o.depositCents)],
            [c.received.reference, transferReference(o.id)],
          ], true)
          b.para(c.received.transferNote)
        } else {
          b.para(c.received.bankLater(money(o.depositCents)))
        }
      } else if (o.paymentMethod === 'cash' || o.paymentMethod === 'cheque') {
        b.para(c.received.payInPerson(money(o.depositCents), o.paymentMethod))
      }
    } else if (o.depositCents > 0 && o.paymentMethod === 'card') {
      b.heading(c.received.payTitle)
      b.para(c.received.cardPaid(money(o.depositCents)))
    }
    b.para(c.received.addressNote, true)
  } else if (kind === 'confirmed') {
    subject = c.confirmed.subject(o.event.title)
    b.title(c.confirmed.title)
    b.para(c.greeting(o.name))
    b.para(o.depositCents > 0 ? c.confirmed.intro(o.event.title, date) : c.confirmed.introNoDeposit(o.event.title, date))
    b.heading(c.confirmed.collectionTitle)
    collection(b, o, loc)
    if (o.balanceCents > 0) b.para(c.confirmed.balanceNote, true)
    b.heading(c.allergies)
    b.para(o.allergies.trim() || c.noAllergies)
    b.para(c.confirmed.allergiesNote, true)
    summary(b, o, loc, true)
  } else {
    subject = c.reminder.subject(o.event.title)
    b.title(c.reminder.title)
    b.para(c.greeting(o.name))
    b.para(c.reminder.intro(o.event.title, date))
    collection(b, o, loc)
    if (o.balanceCents > 0) b.para(content[loc].email.confirmed.balanceNote, true)
    b.para(c.reminder.outro)
  }

  b.para(c.replyNote, true)
  b.signOff(c.signOff, c.signature)
  return { subject, ...b.finish(c.footer, subject) }
}

/** Time, place, address and the balance: for the confirmed and reminder emails. */
function collection(b: Builder, o: EmailOrder, loc: Locale) {
  const c = content[loc].email
  b.table([
    [c.evening, `${formatDate(o.event.date, loc)} · ${o.event.title}`],
    [c.collection, c.collectionAt(o.place, formatTime(o.time, loc))],
    [c.address, o.address],
    ...(o.balanceCents > 0 ? [[c.balance, formatMoney(o.balanceCents, loc)] as [string, string]] : []),
  ], true)
}

/** The order: evening, place (never the address), diners, dishes, prices. */
function summary(b: Builder, o: EmailOrder, loc: Locale, short: boolean) {
  const c = content[loc].email
  const money = (cents: number) => formatMoney(cents, loc)
  b.heading(c.summaryTitle)
  const rows: [string, string][] = []
  if (!short) {
    rows.push([c.evening, `${formatDate(o.event.date, loc)} · ${o.event.title}`])
    rows.push([c.collection, c.collectionAt(o.place, formatTime(o.time, loc))])
  }
  rows.push([c.diners, String(o.diners)])
  rows.push([c.orderNo, o.id])
  b.table(rows)
  b.menu(o.courses)
  const money_rows: [string, string][] = [[c.total, money(o.totalCents)]]
  if (o.depositCents > 0) money_rows.push([c.deposit, money(o.depositCents)])
  if (o.balanceCents > 0 && o.depositCents > 0) money_rows.push([c.balance, money(o.balanceCents)])
  b.table(money_rows)
  if (!short && o.allergies.trim()) b.table([[c.allergies, o.allergies.trim()]])
}

/** Eleanor's copy of a new order (English, with everything she needs). */
function ownerCopy(o: EmailOrder, bank: BankDetails): RenderedEmail {
  const money = (cents: number) => formatMoney(cents, 'en')
  const subject = `New order · ${o.name} · ${o.diners} diner${o.diners === 1 ? '' : 's'} · ${o.event.title}`
  const b = new Builder()
  b.title('New order')
  b.para(`${o.name} has ordered for ${formatDate(o.event.date, 'en')}.`)
  b.table([
    ['Name', o.name],
    ['Email', o.email || '—'],
    ['Mobile', o.mobile || '—'],
    ['Language', o.language === 'fr' ? 'French' : 'English'],
    ['Evening', `${formatDate(o.event.date, 'en')} · ${o.event.title}`],
    ['Collection', `${o.place} at ${o.time}`],
    ['Diners', String(o.diners)],
    ['Order no.', o.id],
  ])
  b.menu(o.courses)
  b.table([
    ['Allergies', o.allergies.trim() || '—'],
    ...(o.notes.trim() ? [['Notes', o.notes.trim()] as [string, string]] : []),
    ['Total', money(o.totalCents)],
    ['Deposit', `${money(o.depositCents)}${o.depositPaid ? ' (paid)' : ' (not paid yet)'}`],
    ['Balance', money(o.balanceCents)],
    ...(o.paymentMethod === 'bank_transfer' && !o.depositPaid && o.depositCents > 0
      ? [['Transfer reference', transferReference(o.id)] as [string, string]]
      : []),
  ])
  if (o.paymentMethod === 'bank_transfer' && !o.depositPaid && o.depositCents > 0 && !hasBankDetails(bank)) {
    b.para('Your bank details are not filled in yet, so the customer was told you will send them. Add them in the console under Emails.')
  }
  b.para('When the deposit arrives, press “Deposit received” in the console (Orders). The customer is then sent their confirmation with the address.', true)
  b.link('Open the console', `${SITE_URL}/manager`)
  return { subject, ...b.finish('Eleanor Jessica · console', subject) }
}

/* ---------- Building the HTML and the plain text side by side ---------- */

const C = {
  cream: '#f7f3ea',
  ivory: '#fcfaf5',
  charcoal: '#2b2a28',
  stone: '#5a5a5a',
  gold: '#d4ac54',
  goldDeep: '#a9832f',
  rule: '#e4dccb',
}
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
const SANS = "Jost, 'Helvetica Neue', Helvetica, Arial, sans-serif"

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')
}

class Builder {
  private html: string[] = []
  private text: string[] = []

  title(s: string) {
    this.html.push(
      `<h1 style="margin:0 0 24px;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1.2;color:${C.charcoal};text-align:center;">${esc(s)}</h1>`,
    )
    this.text.push(s.toUpperCase(), '')
  }

  heading(s: string) {
    this.html.push(
      `<p style="margin:32px 0 6px;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.goldDeep};text-align:center;">${esc(s)}</p>` +
        `<div style="margin:0 auto 18px;width:48px;border-top:1px solid ${C.gold};font-size:0;line-height:0;">&nbsp;</div>`,
    )
    this.text.push('', `— ${s.toUpperCase()} —`, '')
  }

  para(s: string, quiet = false) {
    this.html.push(
      `<p style="margin:0 0 16px;font-family:${SANS};font-weight:300;font-size:${quiet ? 14 : 16}px;line-height:1.6;color:${quiet ? C.stone : C.charcoal};">${esc(s)}</p>`,
    )
    this.text.push(s, '')
  }

  /** Label/value rows. `boxed` draws a thin gold frame (bank details, address). */
  table(rows: [string, string][], boxed = false) {
    const cells = rows
      .map(
        ([k, v]) =>
          `<tr><td width="38%" style="width:38%;padding:6px 16px 6px 0;vertical-align:top;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.stone};white-space:nowrap;">${esc(k)}</td>` +
          `<td style="padding:6px 0;vertical-align:top;font-family:${SANS};font-weight:300;font-size:15px;line-height:1.5;color:${C.charcoal};">${esc(v)}</td></tr>`,
      )
      .join('')
    const frame = boxed ? `border:1px solid ${C.gold};padding:14px 18px;` : 'padding:0;'
    this.html.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;${frame}border-collapse:separate;"><tbody>${cells}</tbody></table>`,
    )
    for (const [k, v] of rows) this.text.push(`${k}: ${v}`)
    this.text.push('')
  }

  /** The menu as on her printed card: centred, thin rules, quantities for choices. */
  menu(courses: EmailOrder['courses']) {
    const parts = courses.map((course, i) => {
      const dishes = course.dishes
        .map(
          (d) =>
            `<div style="font-family:${SERIF};font-size:19px;line-height:1.35;color:${C.charcoal};">${esc(d.name)}${
              d.quantity !== null ? ` <span style="font-family:${SANS};font-size:14px;color:${C.goldDeep};">×&nbsp;${d.quantity}</span>` : ''
            }</div>`,
        )
        .join('')
      const rule = i > 0 ? `<div style="margin:0 auto 14px;width:32px;border-top:1px solid ${C.rule};font-size:0;line-height:0;">&nbsp;</div>` : ''
      return `${rule}<div style="margin:0 0 14px;text-align:center;"><div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${C.stone};margin-bottom:4px;">${esc(course.name)}</div>${dishes}</div>`
    })
    this.html.push(`<div style="margin:8px 0 18px;">${parts.join('')}</div>`)
    for (const course of courses) {
      const dishes = course.dishes.map((d) => (d.quantity !== null ? `${d.name} × ${d.quantity}` : d.name))
      this.text.push(`${course.name}: ${dishes.join(', ')}`)
    }
    this.text.push('')
  }

  link(label: string, href: string) {
    this.html.push(
      `<p style="margin:8px 0 16px;text-align:center;"><a href="${esc(href)}" style="display:inline-block;padding:12px 28px;border:1px solid ${C.charcoal};font-family:${SANS};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.charcoal};text-decoration:none;">${esc(label)}</a></p>`,
    )
    this.text.push(`${label}: ${href}`, '')
  }

  signOff(line: string, name: string) {
    this.html.push(
      `<p style="margin:24px 0 0;font-family:${SANS};font-weight:300;font-size:16px;line-height:1.6;color:${C.charcoal};">${esc(line)}</p>` +
        `<p style="margin:4px 0 0;font-family:${SERIF};font-style:italic;font-size:24px;color:${C.charcoal};">${esc(name)}</p>`,
    )
    this.text.push(line, name, '')
  }

  finish(footer: string, subject: string): { html: string; text: string } {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital@0;1&family=Jost:wght@300;400&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.cream};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${C.cream};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:${C.ivory};border:1px solid ${C.rule};">
<tr><td align="center" style="padding:36px 32px 8px;">
<img src="${SITE_URL}/CEJ_Logo.jpg" width="72" height="72" alt="Eleanor Jessica" style="display:block;width:72px;height:72px;border-radius:36px;border:0;">
<p style="margin:16px 0 0;font-family:${SANS};font-size:12px;letter-spacing:4px;text-transform:uppercase;color:${C.charcoal};">Eleanor Jessica</p>
<p style="margin:2px 0 0;font-family:${SERIF};font-style:italic;font-size:17px;color:${C.stone};">cheffe privée</p>
<div style="margin:20px auto 0;width:64px;border-top:1px solid ${C.gold};font-size:0;line-height:0;">&nbsp;</div>
</td></tr>
<tr><td style="padding:24px 36px 36px;">
${this.html.join('\n')}
</td></tr>
</table>
<p style="margin:18px 0 0;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.stone};">${esc(footer)}</p>
<p style="margin:6px 0 0;font-family:${SANS};font-size:12px;"><a href="${SITE_URL}" style="color:${C.goldDeep};text-decoration:none;">${esc(SITE_URL.replace(/^https?:\/\//, ''))}</a></p>
</td></tr></table>
</body></html>`
    const text = [
      'ELEANOR JESSICA · cheffe privée',
      '',
      ...this.text,
      '—',
      footer,
      SITE_URL,
    ]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
    return { html, text }
  }
}

/* ---------- Made-up order for previews in the console ---------- */

export function sampleOrder(language: Locale): EmailOrder {
  const d = new Date()
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)) // next Friday
  return {
    id: '123',
    name: language === 'fr' ? 'Camille Martin' : 'Sarah Jones',
    email: 'sample@example.com',
    mobile: '06 12 34 56 78',
    language,
    diners: 4,
    allergies: language === 'fr' ? 'Une personne ne mange pas de fruits à coque.' : 'One guest has a nut allergy.',
    notes: '',
    source: 'website',
    paymentMethod: 'bank_transfer',
    totalCents: 16000,
    depositCents: 8000,
    balanceCents: 8000,
    depositPaid: false,
    event: { title: 'Inspired by India', date: d.toISOString().slice(0, 10) },
    place: 'Sauzé-Vaussais',
    time: '17:30',
    address: '1 Place de l’Église, 79190 Sauzé-Vaussais (sample address)',
    courses: [
      { name: 'Starter', dishes: [{ name: 'Caramelised Onion, Squash & Feta Samosa', quantity: null }] },
      { name: 'Second course', dishes: [{ name: 'Spiced Cauliflower Velouté', quantity: null }] },
      {
        name: 'Main',
        dishes: [
          { name: 'Chicken Tikka Masala Pithivier', quantity: 3 },
          { name: 'Smoked Aubergine & Chickpea Pithivier', quantity: 1 },
        ],
      },
      { name: 'Dessert', dishes: [{ name: 'Masala Chai Sticky Toffee Pudding', quantity: null }] },
    ],
  }
}
