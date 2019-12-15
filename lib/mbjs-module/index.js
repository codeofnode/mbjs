const assert = require('assert')

/**
 * @module MbjsApp
 */

/**
 * The MbjsApp class
 * @class
 */
class MbjsApp {
  /**
   * Create an instance of MbjsApp class
   *
   * @param {Object} config the global app config options
   * @param {Application} app the mbjs app
   */
  constructor (config, app) {
    assert.strictEqual(typeof config, 'object', 'config MUST_BE_OBJECT')
    /** the function to throw error with app code
      * @member {Function} */
    this.throwError = app.throwError.bind(app)
  }
}

module.exports = MbjsApp
