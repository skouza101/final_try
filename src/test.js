const config = require("./config");
const AccountManager = require("./utils/accountManager");
const TelegramNotifier = require("./utils/telegramNotification");
const Logger = require("./utils/logger");

const logger = new Logger("Test");

/**
 * Test script to verify configuration and setup
 */
async function runTests() {
  logger.info("Running Configuration Tests...\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Environment Variables
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("Test 1: Environment Variables");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const envTests = [
    { name: "TELEGRAM_TOKEN", value: config.telegram.token },
    { name: "TELEGRAM_CHAT_ID", value: config.telegram.chatId },
    { name: "TARGET_URL", value: config.event.url },
    { name: "HEADLESS", value: process.env.HEADLESS || "false" },
    { name: "CHECK_INTERVAL", value: config.bot.checkInterval },
  ];

  envTests.forEach((test) => {
    if (test.value) {
      logger.success(
        `✓ ${test.name}: ${
          typeof test.value === "string" && test.value.length > 50
            ? test.value.substring(0, 47) + "..."
            : test.value
        }`
      );
      passed++;
    } else {
      logger.error(`✗ ${test.name}: Not set`);
      failed++;
    }
  });

  // Test 2: Proxy Configuration
  logger.info("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("Test 2: Proxy Configuration");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (config.proxies.length > 0) {
    logger.success(`✓ ${config.proxies.length} proxy(ies) configured`);
    config.proxies.forEach((proxy, i) => {
      const proxyDisplay = proxy
        .replace(/https?:\/\//, "")
        .split("@")
        .pop();
      logger.info(`  ${i + 1}. ${proxyDisplay}`);
    });
    passed++;
  } else {
    logger.warn("⚠ No proxies configured (using direct connection)");
    logger.info(
      "  You can add proxies in .env: PROXY_LIST=http://proxy1:8080,http://proxy2:8080"
    );
    passed++;
  }

  // Test 3: Accounts
  logger.info("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("Test 3: Account Configuration");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const accountManager = new AccountManager(config.files.accounts);
  const accounts = accountManager.loadAccounts();

  if (accounts.length > 0) {
    logger.success(`✓ ${accounts.length} account(s) found`);

    accounts.forEach((account, i) => {
      const isValid = accountManager.validateAccount(account);
      const status = isValid ? "✓" : "✗";
      const statusColor = isValid ? "success" : "error";

      logger[statusColor](
        `  ${status} ${i + 1}. ${account.email} (${
          account.cookies.length
        } cookies)`
      );

      if (isValid) {
        passed++;
      } else {
        failed++;
        logger.warn(`      Missing required 'token' cookie`);
      }
    });
  } else {
    logger.error("✗ No accounts found");
    logger.info("  Run: npm run login");
    failed++;
  }

  // Test 4: Telegram Bot
  logger.info("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("Test 4: Telegram Bot Connection");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (config.telegram.token && config.telegram.chatId) {
    try {
      const notifier = new TelegramNotifier(
        config.telegram.token,
        config.telegram.chatId
      );

      logger.info("Sending test notification...");
      await notifier.bot.sendMessage(
        config.telegram.chatId,
        "🧪 *Test Message*\n━━━━━━━━━━━━━━━━━━━━━━\nYour bot configuration is working!\n✅ Ready to monitor tickets",
        { parse_mode: "Markdown" }
      );

      logger.success("✓ Telegram notification sent successfully!");
      logger.info("  Check your Telegram to confirm");
      passed++;
    } catch (error) {
      logger.error("✗ Telegram test failed:", error.message);
      logger.warn("  Check your TELEGRAM_TOKEN and TELEGRAM_CHAT_ID");
      failed++;
    }
  } else {
    logger.error("✗ Telegram credentials missing");
    failed++;
  }

  // Test 5: Target URL
  logger.info("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("Test 5: Target URL Validation");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (config.event.url && config.event.url.startsWith("https://webook.com")) {
    logger.success(`✓ Valid target URL: ${config.event.url}`);
    passed++;
  } else if (config.event.url) {
    logger.warn("⚠ URL set but may not be a valid Webook event");
    logger.info(`  ${config.event.url}`);
    passed++;
  } else {
    logger.error("✗ No target URL set");
    failed++;
  }

  // Summary
  logger.info("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info("Test Summary");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.success(`Passed: ${passed}`);

  if (failed > 0) {
    logger.error(`Failed: ${failed}`);
    logger.warn(
      "\n⚠ Some tests failed. Please fix the issues before running the bot."
    );
    process.exit(1);
  } else {
    logger.success("\n✅ All tests passed! Your bot is ready to run.");
    logger.info("Start the bot with: npm start");
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  logger.error("Test error:", error);
  process.exit(1);
});
