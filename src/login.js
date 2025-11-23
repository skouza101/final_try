const puppeteer = require("puppeteer");
const readline = require("readline");

const config = require("./config");
const AccountManager = require("./utils/accountManager");
const Logger = require("./utils/logger");

const logger = new Logger("Login");

/**
 * Create readline interface for user input
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Prompt for user input
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Login tool to extract and save cookies
 */
async function login() {
  logger.info("Webook Account Login Tool");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Get account email
  const email = await prompt("\nEnter account email: ");

  if (!email || !email.includes("@")) {
    logger.error("Invalid email address");
    rl.close();
    process.exit(1);
  }

  logger.info(`\nAccount: ${email}`);
  logger.info("Opening browser...");

  // Launch browser (always visible for login)
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // Navigate to Webook login page
    logger.info("Navigating to Webook.com...");
    await page.goto("https://webook.com/ar/login", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    logger.warn("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.warn("MANUAL LOGIN REQUIRED");
    logger.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info("Please complete the following steps in the browser:");
    logger.info("1. Log in with your Webook account");
    logger.info("2. Complete any 2FA/verification if required");
    logger.info("3. Wait until you see your account dashboard/homepage");
    logger.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Wait for user confirmation
    await prompt("Press ENTER when you have successfully logged in...");

    // Extract all cookies
    logger.info("Extracting cookies...");
    const cookies = await page.cookies();

    if (cookies.length === 0) {
      logger.error("No cookies found! Login may have failed.");
      rl.close();
      await browser.close();
      process.exit(1);
    }

    logger.success(`Extracted ${cookies.length} cookies`);

    // Check for authentication token
    const hasToken = cookies.some(
      (c) => c.name === "token" || c.name.includes("auth")
    );

    if (!hasToken) {
      logger.warn("Warning: No authentication token found in cookies");
      logger.warn("The account may not work properly");

      const proceed = await prompt("Continue anyway? (y/n): ");
      if (proceed.toLowerCase() !== "y") {
        logger.info("Login cancelled");
        rl.close();
        await browser.close();
        process.exit(0);
      }
    }

    // Save account
    const accountManager = new AccountManager(config.files.accounts);
    const success = accountManager.saveAccount(email, cookies);

    if (success) {
      logger.success("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logger.success("✓ Account saved successfully!");
      logger.success("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logger.info(`Email: ${email}`);
      logger.info(`Cookies: ${cookies.length}`);
      logger.info(`File: ${config.files.accounts}`);
      logger.success("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      logger.info("You can now run: npm start");
    } else {
      logger.error("Failed to save account");
    }
  } catch (error) {
    logger.error("Login error:", error.message);
  } finally {
    rl.close();
    await browser.close();
  }
}

// Handle errors
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled error:", error);
  rl.close();
  process.exit(1);
});

// Start login process
login().catch((error) => {
  logger.error("Fatal error:", error);
  rl.close();
  process.exit(1);
});
