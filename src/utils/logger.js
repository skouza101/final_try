const chalk = require('chalk');

class Logger {
  constructor(prefix = '') {
    this.prefix = prefix;
  }

  _log(color, icon, message, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const prefixStr = this.prefix ? `[${this.prefix}]` : '';
    console.log(
      chalk.gray(`[${timestamp}]`),
      color(`${icon} ${prefixStr}`),
      color(message),
      ...args
    );
  }

  info(message, ...args) {
    this._log(chalk.blue, 'ℹ', message, ...args);
  }

  success(message, ...args) {
    this._log(chalk.green, '✓', message, ...args);
  }

  warn(message, ...args) {
    this._log(chalk.yellow, '⚠', message, ...args);
  }

  error(message, ...args) {
    this._log(chalk.red, '✗', message, ...args);
  }

  debug(message, ...args) {
    this._log(chalk.gray, '◆', message, ...args);
  }

  ticket(message, ...args) {
    this._log(chalk.magenta.bold, '🎫', message, ...args);
  }
}

module.exports = Logger;