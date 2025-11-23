const TelegramBot = require('node-telegram-bot-api');
const Logger = require('./logger');

class TelegramNotifier {
  constructor(token, chatId) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
    this.logger = new Logger('Telegram');
  }

  /**
   * Send ticket success notification
   */
  async notifySuccess(data) {
    const message = this._formatSuccessMessage(data);

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      this.logger.success('Notification sent');
    } catch (error) {
      this.logger.error('Failed to send notification:', error.message);
    }
  }

  /**
   * Send error notification
   */
  async notifyError(email, error) {
    const message = `
⚠️ *ERROR ALERT*
━━━━━━━━━━━━━━━━━━━━━━
👤 Account: \`${email}\`
❌ Error: ${error}
━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      this.logger.error('Failed to send error notification:', err.message);
    }
  }

  /**
   * Send bot start notification
   */
  async notifyStart(accountCount) {
    const message = `
🤖 *BOT STARTED*
━━━━━━━━━━━━━━━━━━━━━━
📊 Accounts: ${accountCount}
🎯 Status: Monitoring
⏰ Time: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      this.logger.success('Start notification sent');
    } catch (error) {
      this.logger.error('Failed to send start notification:', error.message);
    }
  }

  /**
   * Format success message
   */
  _formatSuccessMessage(data) {
    return `
🎉 *TICKETS SECURED!*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Account:* \`${data.email}\`
📍 *Zone:* ${data.zone}
💺 *Seats:* ${data.seatCount}

*Ticket Details:*
${data.ticketDetails}

━━━━━━━━━━━━━━━━━━━━━━
🔗 *Proxy:* ${data.proxy}
🔑 *Ticket ID:* \`${data.firstTicketId}\`
⏰ *Time:* ${new Date().toLocaleString()}

🔴 *COMPLETE PAYMENT NOW!*
    `.trim();
  }
}

module.exports = TelegramNotifier;