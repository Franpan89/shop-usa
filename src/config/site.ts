/**
 * Single source of truth for the public marketing site's business facts.
 *
 * ⚠️ Values marked "CONFIRM" are placeholders — they are not invented client
 * data, but they are also not verified real numbers. Replace them before
 * launch. Everything else here is derived from the actual product (Prisma
 * schema defaults, real feature set) rather than guessed.
 */
export const SITE = {
  brand: "ShopUSA",

  // CONFIRM: real WhatsApp number in E.164, and the inbox that should receive
  // the contact-form leads.
  whatsappNumber: "+13055550123",
  contactEmail: "hola@shopusa.com",
  // CONFIRM: real WhatsApp Community/group invite link (starts with
  // https://chat.whatsapp.com/). This is a placeholder and will not resolve.
  whatsappCommunityUrl: "https://chat.whatsapp.com/REEMPLAZAR-CON-TU-LINK",

  // CONFIRM: each country's starting ("desde") courier rate per pound.
  // Ecuador and Panamá price differently, and the app further splits Ecuador
  // into categories (Normal/Migrante/Emprendedor) with their own $/lb on top
  // of this — these are meant as the lowest headline anchor per country, not
  // a quote engine.
  countries: [
    { name: "Panamá", flag: "🇵🇦", fromPerLb: 5.50 },
    { name: "Ecuador", flag: "🇪🇨", fromPerLb: 6.50 },
  ],

  pricing: {
    // Real default from prisma/schema.prisma: Client.serviceFeePercent = 20.
    // Confirm this is the number you want published, since per-client
    // overrides exist in the app.
    personalShopperFeeFromPercent: 20,
  },
} as const;

export const whatsappHref = (message: string) =>
  `https://wa.me/${SITE.whatsappNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
