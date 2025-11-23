const { Cluster } = require("puppeteer-cluster");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const config = require("./config");
const AccountManager = require("./utils/accountManager");
const TelegramNotifier = require("./utils/telegramNotification");
const Logger = require("./utils/logger");
const monitorTask = require("./task/monitorTask");

// Apply stealth plugin
puppeteer.use(StealthPlugin());

const logger = new Logger("Main");

/**
 * Main bot entry point
 */
async function start() {
  logger.info("Starting Webook Ticket Bot...");

  // Validate configuration
  if (!config.telegram.token || !config.telegram.chatId) {
    logger.error("Missing Telegram configuration in .env file");
    process.exit(1);
  }

  if (!config.event.url) {
    logger.error("Missing TARGET_URL in .env file");
    process.exit(1);
  }

  // Load accounts
  const accountManager = new AccountManager(config.files.accounts);
  const accounts = accountManager.loadAccounts();

  if (accounts.length === 0) {
    logger.error("No accounts found!");
    logger.info("Please run: npm run login");
    process.exit(1);
  }

  // Validate accounts
  const validAccounts = accounts.filter((acc) =>
    accountManager.validateAccount(acc)
  );

  if (validAccounts.length === 0) {
    logger.error(
      "No valid accounts found! All accounts are missing required cookies."
    );
    logger.info("Please run: npm run login");
    process.exit(1);
  }

  if (validAccounts.length < accounts.length) {
    logger.warn(
      `${accounts.length - validAccounts.length} invalid account(s) skipped`
    );
  }

  logger.success(`Loaded ${validAccounts.length} valid account(s)`);

  // Setup Telegram notifier
  const notifier = new TelegramNotifier(
    config.telegram.token,
    config.telegram.chatId
  );
  await notifier.notifyStart(validAccounts.length);

  // Setup cluster
  const cluster = await Cluster.launch({
    puppeteer,
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: validAccounts.length,
    timeout: 300000, // 5 minutes
    puppeteerOptions: config.puppeteer,
    monitor: false,
  });

  logger.success("Cluster initialized");

  // Assign proxies to accounts (round-robin if fewer proxies than accounts)
  const proxies = config.proxies.length > 0 ? config.proxies : [null];

  validAccounts.forEach((account, index) => {
    const proxy = proxies[index % proxies.length];

    if (proxy) {
      logger.info(
        `${account.email} -> Proxy: ${proxy
          .replace(/https?:\/\//, "")
          .split("@")
          .pop()}`
      );
    }

    cluster.queue({
      email: account.email,
      cookies: account.cookies,
      proxy,
      notifier,
    });
  });

  // Set task function
  await cluster.task(monitorTask);

  logger.success(`${validAccounts.length} account(s) queued for monitoring`);
  logger.info(`Target: ${config.event.url}`);
  logger.info(`Check interval: ${config.bot.checkInterval}ms`);
  logger.info("Press Ctrl+C to stop");

  // Wait for all tasks to complete
  await cluster.idle();
  await cluster.close();

  logger.success("All tasks completed");
}

// Handle errors
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection:", error);
});

process.on("SIGINT", async () => {
  logger.warn("\nShutting down gracefully...");
  process.exit(0);
});

// Start the bot
start().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
