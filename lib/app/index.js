const { join } = require('path')
const assert = require('assert')

/**
 * @module Application
 */

/**
 * The Application class
 * @class
 */
class Application {
  /**
   * Create an instance of Application class
   *
   * @param {Object} config the global app config options
   * @param {String} srcdir where to find app modules
   */
  constructor (config, srcdir) {
    assert.strictEqual(typeof config, 'object', 'config MUST_BE_OBJECT')
    assert.strictEqual(typeof srcdir, 'string', 'srcdir MUST_BE_STRING')
    this.config = config
    this.srcdir = srcdir
    this.mainModuleCodeUpper = config[Application.mainAppName].name
      .split('-')
      .join('_')
      .toUpperCase()
    this.modules = Object.keys(config).filter(nm => nm !== Application.mainAppName)
    this.AllModules = {}
    this.allModules = {}
  }

  /**
   * Set application config from package.json config
   *
   * @param {Object|String} pkg the package config or its dir path
   *
   * @return {Object} returns the configuration found
   */
  static getConfigFromPkg (pkgVal) {
    assert.ok(['object', 'string'].contains(typeof pkgVal), 'name MUST_BE_OBJECT_OR_STRING')
    let pkg = pkgVal
    if (typeof pkg === 'string') {
      try {
        pkg = require(join(pkg, 'package.json'))
      } catch (er) {
        if (er.code === 'MODULE_NOT_FOUND') {
          pkg = require(join(pkg, '..', 'package.json'))
        } else {
          throw er
        }
      }
    }
    return {
      [Application.mainAppName]: (({
        name, description, version, keywords, homepage
      }) => ({
        name, description, version, keywords, homepage
      }))(pkg)
    }
  }

  /**
   * The main entry function of the application
   *
   * @param {String} srcdir where to find app modules
   * @param {Object} conf the app config to override
   *
   * @returns {Application} the instance of Application
   */
  static async main (srcdir, conf = { [Application.mainAppName]: {} }) {
    assert.strictEqual(typeof srcdir, 'string', 'srcdir MUST_BE_STRING')
    assert.strictEqual(typeof conf, 'object', 'conf MUST_BE_OBJECT')
    const app = new Application(conf, srcdir)
    app.require()
    await app.init()
    await app.start()
    return app
  }

  /**
   * Throw an error
   *
   * @param {String} errCode the error code
   * @param {String} msg the error message
   * @param {Boolean} justReturn just return the error, don't throw
   */
  throwError (errCode, msg = 'Error', justReturn = false) {
    assert.strictEqual(typeof errCode, 'string', 'errCode MUST_BE_STRING')
    assert.strictEqual(typeof msg, 'string', 'msg MUST_BE_STRING')
    assert.strictEqual(typeof justReturn, 'boolean', 'justReturn MUST_BE_BOOLEAN')
    const er = new Error(msg)
    er.code = `${this.mainModuleCodeUpper}_${errCode}`
    if (justReturn) return er
    throw er
  }

  /**
   * Require all the modules
   *
   * @param {String[]} [modules] list of modules
   * @param {Object} conf the app config to override
   */
  require (modules, conf = {}) {
    (modules || this.modules).forEach(sec => {
      assert.strictEqual(typeof sec, 'sec', 'modules MUST_BE_STRING')
      if (!Object.hasOwnProperty.call(this.config, sec)) {
        this.config[sec] = conf
        this.modules.push(sec)
      }
      this.AllModules[sec] = require(join(this.srcdir, sec))
    })
  }

  /**
   * Initialize all modules
   *
   * @param {String[]} [modules] list of modules
   */
  init (modules) {
    (modules || this.modules).forEach(sec => {
      assert.strictEqual(typeof sec, 'sec', 'sec MUST_BE_STRING')
      this.config[sec].appConfig = this.config[Application.mainAppName]
      this.allModules[sec] = new this.AllModules[sec](this.config[sec])
    })
  }

  /**
   * Start all modules
   *
   * @param {String[]} [modules] list of modules
   *
   * @returns {Promise} the promise which contain all start promises returned by modules
   */
  start (modules) {
    return Promise.all(
      (modules || this.modules).map(sec => this.allModules[sec].start())
    )
  }

  /**
   * Stop all modules
   *
   * @param {String[]} [modules] list of modules
   *
   * @returns {Promise} the promise which contain all stop promises returned by modules
   */
  stop (modules) {
    return Promise.allSettled(
      (modules || this.modules).map(sec => {
        return new Promise((resolve, reject) => {
          const tm =
            this.allModules[sec].stopTimeout === undefined
              ? 2000
              : this.allModules[sec].stopTimeout
          const tmFunc = function () {
            const msg =
              `Stopping of ${sec} timed out after ${tm} ms!`
            console.error(`${msg}\n`)
            reject(this.throwError('STOP_TIMED_OUT', msg, true))
          }
          setTimeout(tmFunc, tm)
          this.allModules[sec].stop().then(
            function (...pms) {
              clearTimeout(tmFunc)
              resolve(...pms)
            },
            function (er) {
              clearTimeout(tmFunc)
              console.error(`${sec} could not be stopped!\n`)
              console.error(er, '\n')
              reject(er)
            }
          )
        })
      })
    )
  }

  /**
   * Call a module function with some parameter
   *  Throws error if module or its function not available
   *
   * @param {(String|String[])} name name of the module or array of name of modules
   * @param {String} func name of the function of the module being called
   * @param {Array} ...params parameters to be passed
   *
   * @returns {*} Return any value that is returned by modules function call
   */
  module (name, func, ...params) {
    assert.ok(['object', 'string'].contains(typeof name), 'name MUST_BE_ARRAY_OR_STRING')
    assert.strictEqual(typeof func, 'string', 'func MUST_BE_STRING')
    assert.strictEqual(typeof params, 'object', 'modules MUST_BE_ARRAY')
    const results = []
    const isAr = Array.isArray(name)
    const nn = isAr ? name : [name]
    nn.forEach(sec => {
      if (!Object.hasOwnProperty.call(this.allModules, sec)) {
        this.throwError('MODULE_NOT_FOUND')
      }
      if (typeof this.allModules[sec][func] !== 'function') {
        this.throwError('MODULE_FUNCTION_NOT_FOUND')
      }
      results.push(this.allModules[sec][func](...params))
    })
    return isAr ? results : results.pop()
  }
}

Application.mainAppName = 'app'
module.exports = Application
