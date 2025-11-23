const config = require("../config");
const Logger = require("../utils/logger");

class BookingHandler {
  constructor(page, email) {
    this.page = page;
    this.email = email;
    this.logger = new Logger(email);
  }

  /**
   * Click the book button
   */
  async clickBookButton() {
    try {
      const button = await this.page.waitForSelector(
        config.selectors.bookButton,
        { timeout: 3000 }
      );

      if (!button) return false;

      await button.click();
      this.logger.success("Book button clicked");

      // Wait for map to load
      await this.page
        .waitForFunction(
          () =>
            document.querySelector("svg") ||
            document.querySelector("#canvas") ||
            document.querySelector('[data-testid="zone"]'),
          { timeout: 20000 }
        )
        .catch(() => {
          this.logger.warn("Map load timeout");
        });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Select a zone/area on canvas-based seating map
   */
  async selectZone() {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to find the canvas element
      const canvas = await this.page.$(config.selectors.canvas);

      if (!canvas) {
        this.logger.warn("Canvas not found, trying HTML zones");
        return await this.selectHtmlZone();
      }

      const box = await canvas.boundingBox();
      if (!box) {
        this.logger.warn("Canvas has no bounding box");
        return "Unknown Zone";
      }

      this.logger.info("Canvas-based zone map detected");

      // Try multiple random clicks on the canvas to find an available zone
      const maxAttempts = 20;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt++;

        // Click random position on canvas (avoid extreme edges)
        const x = box.x + box.width * (0.15 + Math.random() * 0.7);
        const y = box.y + box.height * (0.15 + Math.random() * 0.7);

        await this.page.mouse.click(x, y);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if a zone modal/dialog appeared or if URL changed
        const zoneSelected = await this.page.evaluate(() => {
          // Check for modal/dialog
          const modal = document.querySelector(
            '[role="dialog"], .modal, [class*="modal"]'
          );
          if (modal && modal.style.display !== "none") {
            return true;
          }

          // Check for zone selection overlay
          const overlay = document.querySelector(
            '[class*="zone"], [class*="section"]'
          );
          if (overlay) {
            return true;
          }

          return false;
        });

        if (zoneSelected) {
          this.logger.success(`Zone found after ${attempt} attempt(s)`);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const zoneName = await this.extractZoneName();
          this.logger.success(`Selected zone: ${zoneName}`);
          return zoneName;
        }
      }

      this.logger.warn(`No available zone found after ${maxAttempts} attempts`);
      return "Zone Selection Timeout";
    } catch (error) {
      this.logger.warn("Zone selection failed:", error.message);
      return "Unknown Zone";
    }
  }

  /**
   * Fallback: Select zone from HTML elements
   */
  async selectHtmlZone() {
    try {
      const zones = await this.page.$$(config.selectors.availableZones);

      if (zones.length === 0) {
        this.logger.info("No HTML zones found");
        return "Direct Selection";
      }

      this.logger.info(`Found ${zones.length} available HTML zone(s)`);

      // Select random zone
      const randomZone = zones[Math.floor(Math.random() * zones.length)];
      await randomZone.click();
      this.logger.info("HTML zone clicked");

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const zoneName = await this.extractZoneName();
      this.logger.success(`Selected zone: ${zoneName}`);
      return zoneName;
    } catch (error) {
      this.logger.warn("HTML zone selection failed:", error.message);
      return "Unknown Zone";
    }
  }

  /**
   * Extract zone name using multiple strategies
   */
  async extractZoneName() {
    // Strategy 1: Try configured selector
    try {
      await this.page.waitForSelector(config.selectors.zoneName, {
        timeout: 2000,
      });
      const name = await this.page.$eval(config.selectors.zoneName, (el) =>
        el.textContent.trim()
      );
      if (name) return name;
    } catch {}

    // Strategy 2: Look for common zone/section text patterns
    try {
      const zoneInfo = await this.page.evaluate(() => {
        const selectors = [
          "h1",
          "h2",
          "h3",
          '[class*="zone"]',
          '[class*="section"]',
          '[class*="area"]',
          '[data-testid*="zone"]',
          '[data-testid*="section"]',
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent.trim();
            if (text && text.length > 0 && text.length < 100) {
              // Filter for likely zone names
              if (text.match(/zone|section|area|منطقة|قطاع/i)) {
                return text;
              }
            }
          }
        }
        return null;
      });
      if (zoneInfo) return zoneInfo;
    } catch {}

    // Strategy 3: Extract from visible modal/dialog header
    try {
      const modalText = await this.page.evaluate(() => {
        const modals = document.querySelectorAll(
          '[role="dialog"], .modal, [class*="modal"]'
        );
        for (const modal of modals) {
          const header = modal.querySelector(
            'h1, h2, h3, [class*="header"], [class*="title"]'
          );
          if (header) {
            const text = header.textContent.trim();
            if (text && text.length < 100) return text;
          }
        }
        return null;
      });
      if (modalText) return modalText;
    } catch {}

    return "Zone Selected";
  }

  /**
   * Select seats using multiple strategies
   */
  async selectSeats() {
    try {
      // Strategy 1: Try canvas-based selection
      const canvasSeats = await this.tryCanvasSelection();
      if (canvasSeats.length > 0) {
        return canvasSeats;
      }

      // Strategy 2: Try clickable seat elements
      const clickableSeats = await this.tryClickableSeats();
      if (clickableSeats.length > 0) {
        return clickableSeats;
      }

      // Strategy 3: Try quantity input (for events without seat selection)
      const quantitySeats = await this.tryQuantityInput();
      if (quantitySeats > 0) {
        return [`${quantitySeats} ticket(s)`];
      }

      this.logger.warn("All seat selection strategies failed");
      return [];
    } catch (error) {
      this.logger.error("Seat selection error:", error.message);
      return [];
    }
  }

  /**
   * Try canvas-based seat selection
   */
  async tryCanvasSelection() {
    try {
      const canvas = await this.page
        .waitForSelector(config.selectors.canvas, { timeout: 5000 })
        .catch(() => null);

      if (!canvas) {
        this.logger.debug("Canvas not found");
        return [];
      }

      const box = await canvas.boundingBox();
      if (!box) {
        this.logger.debug("Canvas has no bounding box");
        return [];
      }

      const selectedSeats = [];
      this.logger.info("Trying canvas-based seat selection...");

      for (let i = 0; i < config.bot.canvasClickAttempts; i++) {
        if (selectedSeats.length >= config.bot.maxSeats) {
          this.logger.success(`Maximum seats reached (${config.bot.maxSeats})`);
          break;
        }

        const x = box.x + box.width * 0.2 + Math.random() * (box.width * 0.6);
        const y = box.y + box.height * 0.2 + Math.random() * (box.height * 0.6);

        await this.page.mouse.click(x, y);
        await new Promise((resolve) => setTimeout(resolve, 500));

        const seatInfo = await this.page.evaluate(() => {
          const tooltip = document.querySelector("#sectionTooltip");
          if (tooltip && tooltip.innerText) {
            return tooltip.innerText.split("\n")[0];
          }
          return null;
        });

        if (seatInfo && !selectedSeats.includes(seatInfo)) {
          selectedSeats.push(seatInfo);
          this.logger.info(
            `Seat selected: ${seatInfo} (${selectedSeats.length}/${config.bot.maxSeats})`
          );
        }
      }

      if (selectedSeats.length > 0) {
        this.logger.success(`Canvas selection: ${selectedSeats.length} seats`);
      }
      return selectedSeats;
    } catch (error) {
      this.logger.debug("Canvas selection failed:", error.message);
      return [];
    }
  }

  /**
   * Try clicking individual seat elements
   */
  async tryClickableSeats() {
    try {
      this.logger.info("Trying clickable seat selection...");

      const seatSelectors = [
        '[class*="seat"][class*="available"]',
        '[data-testid*="seat"]',
        'button[class*="seat"]:not([disabled])',
        ".seat.available",
        '[role="button"][class*="seat"]',
      ];

      for (const selector of seatSelectors) {
        const seats = await this.page.$$(selector);
        if (seats.length > 0) {
          this.logger.info(`Found ${seats.length} clickable seats`);

          const selectedSeats = [];
          const maxToSelect = Math.min(seats.length, config.bot.maxSeats);

          for (let i = 0; i < maxToSelect; i++) {
            try {
              await seats[i].click();
              await new Promise((resolve) => setTimeout(resolve, 500));
              selectedSeats.push(`Seat ${i + 1}`);
              this.logger.info(`Clicked seat ${i + 1}/${maxToSelect}`);
            } catch {}
          }

          if (selectedSeats.length > 0) {
            this.logger.success(
              `Clickable selection: ${selectedSeats.length} seats`
            );
            return selectedSeats;
          }
        }
      }

      return [];
    } catch (error) {
      this.logger.debug("Clickable seat selection failed:", error.message);
      return [];
    }
  }

  /**
   * Try quantity input (for events without specific seat selection)
   */
  async tryQuantityInput() {
    try {
      this.logger.info("Trying quantity input...");

      const quantitySelectors = [
        'input[type="number"]',
        'input[name*="quantity"]',
        '[data-testid*="quantity"]',
        'select[name*="quantity"]',
      ];

      for (const selector of quantitySelectors) {
        const input = await this.page.$(selector);
        if (input) {
          await input.click({ clickCount: 3 }); // Select all
          await input.type(config.bot.maxSeats.toString());
          await new Promise((resolve) => setTimeout(resolve, 500));

          this.logger.success(`Set quantity to ${config.bot.maxSeats}`);
          return config.bot.maxSeats;
        }
      }

      return 0;
    } catch (error) {
      this.logger.debug("Quantity input failed:", error.message);
      return 0;
    }
  }

  /**
   * Confirm booking
   */
  async confirmBooking() {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const confirmBtn = await this.page.$(config.selectors.confirmButton);

      if (confirmBtn) {
        await confirmBtn.click();
        this.logger.success("Booking confirmed");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      }

      this.logger.warn("Confirm button not found");
      return false;
    } catch (error) {
      this.logger.error("Confirmation error:", error.message);
      return false;
    }
  }

  /**
   * Extract ticket details from order summary
   */
  async extractTicketDetails() {
    try {
      // Wait for order summary
      await this.page.waitForFunction(
        () =>
          document.body.innerText.includes("المجموع") ||
          document.body.innerText.includes("Total") ||
          document.querySelector("#event-tickets"),
        { timeout: 30000 }
      );

      // Get ticket IDs
      const ticketIds = await this.page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll('li [data-testid^="cart-ticket-line-"]')
        );
        return elements.map((el) => el.getAttribute("data-testid"));
      });

      // Get ticket details
      const details = await this.page.evaluate(() => {
        const items = Array.from(
          document.querySelectorAll("#event-tickets li")
        );

        if (items.length > 0) {
          return items
            .map((item) => {
              const nameEl = item.querySelector(
                'div[data-testid^="cart-ticket-name-"] p'
              );
              const text = nameEl ? nameEl.innerText : item.innerText;
              return text.replace(/\s\s+/g, " ").trim();
            })
            .join("\n");
        }

        // Fallback
        const allText = document.body.innerText.split("\n");
        const seatLines = allText.filter(
          (line) =>
            (line.includes("المقعد") ||
              line.includes("Seat") ||
              line.includes("Row")) &&
            line.length < 100
        );

        return seatLines.length > 0
          ? seatLines.join("\n")
          : "Check cart manually";
      });

      this.logger.success("Ticket details extracted");

      return {
        ticketIds,
        details,
        firstTicketId: ticketIds.length > 0 ? ticketIds[0] : "N/A",
      };
    } catch (error) {
      this.logger.error("Failed to extract ticket details:", error.message);
      return {
        ticketIds: [],
        details: "Failed to extract details",
        firstTicketId: "N/A",
      };
    }
  }
}

module.exports = BookingHandler;
