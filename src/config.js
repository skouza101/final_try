require("dotenv").config();

module.exports = {
  // Telegram Configuration
  telegram: {
    token: process.env.TELEGRAM_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  // Target Event Configuration
  event: {
    url: process.env.TARGET_URL,
    bookButtonSelector:
      process.env.BOOK_BUTTON_SELECTOR || '[data-testid="book-button"]',
  },

  // Bot Settings
  bot: {
    headless: process.env.HEADLESS === "true",
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 3000,
    maxSeats: 5,
    canvasClickAttempts: 30,
    paymentHoldTime: 900000, // 15 minutes
  },

  // Proxy Configuration
  proxies: process.env.PROXY_LIST
    ? process.env.PROXY_LIST.split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : [],

  // File Paths
  files: {
    accounts: "./accounts.json",
  },

  // Puppeteer Options
  puppeteer: {
    headless: process.env.HEADLESS === "true",
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
    ignoreHTTPSErrors: true,
  },

  // Selectors
  selectors: {
    bookButton:
      process.env.BOOK_BUTTON_SELECTOR || '[data-testid="book-button"]',
    canvas: "canvas",
    tooltip: "#sectionTooltip",
    availableZones:
      'path[fill]:not([fill="none"]), g.available-zone, [data-testid="zone-available"]',
    zoneName: 'div[style*="gap: 14px"] span[style*="font-weight: 700"] > span',
    confirmButton:
      'button.primary-action, [data-testid="add-to-cart"], button[class*="checkout"]',
    eventTickets: "#event-tickets",
    ticketLine: 'li [data-testid^="cart-ticket-line-"]',
    ticketName: 'div[data-testid^="cart-ticket-name-"] p',
  },
};
