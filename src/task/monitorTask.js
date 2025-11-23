const config = require('../config');
const Logger = require('../utils/logger');
const BookingHandler = require('../handlers/bookingHandler');

/**
 * Main monitoring task for each account
 */
async function monitorTask({ page, data }) {
  const { email, cookies, proxy, notifier } = data;
  const logger = new Logger(email);

  try {
    logger.info('Task started');

    // Setup page optimizations
    await setupPage(page, logger);

    // Set authentication cookies
    if (!await setCookies(page, cookies, logger)) {
      return;
    }

    // Navigate to event page
    logger.info('Navigating to event page...');
    await page.goto(config.event.url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Start monitoring loop
    const bookingHandler = new BookingHandler(page, email);
    let ticketFound = false;

    while (!ticketFound) {
      try {
        // Wait for book button
        const bookingStarted = await bookingHandler.clickBookButton();

        if (bookingStarted) {
          logger.ticket('TICKETS AVAILABLE!');

          // Execute booking flow
          const zone = await bookingHandler.selectZone();
          const seats = await bookingHandler.selectSeats();
          await bookingHandler.confirmBooking();

          // Extract ticket details
          const ticketInfo = await bookingHandler.extractTicketDetails();

          // Send notification
          const proxyInfo = proxy ? proxy.replace(/https?:\/\//, '').split('@').pop() : 'Direct';
          
          await notifier.notifySuccess({
            email,
            zone,
            seatCount: seats.length,
            ticketDetails: ticketInfo.details || seats.join(', ') || 'Check cart',
            proxy: proxyInfo,
            firstTicketId: ticketInfo.firstTicketId,
          });

          logger.success('Booking completed!');
          ticketFound = true;

          // Hold browser for payment
          logger.info(`Holding browser for ${config.bot.paymentHoldTime / 60000} minutes...`);
          await new Promise(resolve => setTimeout(resolve, config.bot.paymentHoldTime));

          return;
        }

      } catch (error) {
        // Button not available, continue monitoring
        logger.debug('Waiting for tickets...');
        await new Promise(resolve => setTimeout(resolve, config.bot.checkInterval));
      }
    }

  } catch (error) {
    logger.error('Task error:', error.message);
    await notifier.notifyError(email, error.message);
  }
}

/**
 * Setup page optimizations
 */
async function setupPage(page, logger) {
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const resourceType = request.resourceType();
    
    // Block unnecessary resources
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      request.abort();
    } else {
      request.continue();
    }
  });

  logger.debug('Page optimizations applied');
}

/**
 * Set authentication cookies
 */
async function setCookies(page, cookies, logger) {
  try {
    if (!cookies || cookies.length === 0) {
      logger.error('No cookies provided');
      return false;
    }

    // Filter and set cookies
    const validCookies = cookies.filter(cookie => 
      cookie.name && cookie.value && cookie.domain
    );

    await page.setCookie(...validCookies);
    logger.success(`${validCookies.length} cookies set`);

    // Verify token exists
    const hasToken = validCookies.some(c => c.name === 'token');
    if (!hasToken) {
      logger.warn('No token cookie found - authentication may fail');
    }

    return true;

  } catch (error) {
    logger.error('Failed to set cookies:', error.message);
    return false;
  }
}

module.exports = monitorTask;