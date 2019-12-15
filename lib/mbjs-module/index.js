const assert = require('assert')

/**
 * @module MbjsModule
 */

/**
 * The MbjsModule class
 * @class
 */
class MbjsModule {
  /**
   * Create an instance of MbjsModule class
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

module.exports = MbjsModule
