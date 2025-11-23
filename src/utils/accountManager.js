const fs = require('fs');
const Logger = require('./logger');

class AccountManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.logger = new Logger('AccountManager');
  }

  /**
   * Load all accounts from file
   */
  loadAccounts() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.logger.error(`Accounts file not found: ${this.filePath}`);
        this.logger.info('Please run: npm run login');
        return [];
      }

      const rawData = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(rawData);

      if (!data.accounts || !Array.isArray(data.accounts)) {
        this.logger.error('Invalid accounts.json format');
        return [];
      }

      this.logger.success(`Loaded ${data.accounts.length} accounts`);
      return data.accounts;

    } catch (error) {
      this.logger.error('Error loading accounts:', error.message);
      return [];
    }
  }

  /**
   * Save account to file
   */
  saveAccount(email, cookies) {
    try {
      let data = { accounts: [] };

      if (fs.existsSync(this.filePath)) {
        const existing = fs.readFileSync(this.filePath, 'utf8');
        data = JSON.parse(existing);
      }

      // Remove existing entry for this email
      data.accounts = data.accounts.filter(acc => acc.email !== email);

      // Add new account
      data.accounts.push({
        email,
        cookies,
        addedAt: new Date().toISOString(),
      });

      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      this.logger.success(`Saved account: ${email}`);
      
      return true;
    } catch (error) {
      this.logger.error('Error saving account:', error.message);
      return false;
    }
  }

  /**
   * Validate account cookies
   */
  validateAccount(account) {
    if (!account.email || !account.cookies) {
      return false;
    }

    const requiredCookies = ['token'];
    const cookieNames = account.cookies.map(c => c.name);

    return requiredCookies.every(name => cookieNames.includes(name));
  }

  /**
   * Get account statistics
   */
  getStats() {
    const accounts = this.loadAccounts();
    
    return {
      total: accounts.length,
      valid: accounts.filter(acc => this.validateAccount(acc)).length,
    };
  }
}

module.exports = AccountManager;