// Per-site settings for the customer list + reminder feature. When porting
// this feature to another site, this is the only file that should need edits.
export const customersConfig = {
  businessName: 'Magnificent Sausage Rolls & Sausages',
  contactEmail: 'magnificentsausagerolls@yahoo.com',
  // Legal entity shown in the data-use policy.
  legalName: 'Magnificent Sausage Rolls & Sausages, Valence-en-Poitou 86700 (SIRET 90507449800015)',
  // What the reminder email is about, used in copy like "when orders open".
  productNoun: 'sausage rolls and sausages',
  // Path of the public order page linked from reminder emails.
  orderPath: '/order',
  // Path of the data-use policy page.
  policyPath: '/data-policy',
}
