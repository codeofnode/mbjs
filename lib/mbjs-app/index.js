const { resolve } = require('path')
const assert = require('assert')
const { utils } = require('templist')
const yargs = require('yargs')
const assign = utils.assign
const CURR_YEAR = new Date().getFullYear()

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
    /** the whole config passed
      * @member {Object} */
    this.config = config
    /** the source directory
      * @member {String} */
    this.srcdir = srcdir
    /** the application config
      * @member {Object} */
    this.appConfig = this.config[Application.mainAppName]
    /** the main module code to be used as prefix for codes, eg error code
      * @member {String} */
    this.mainModuleCodeUpper = config[Application.mainAppName].name
      .split('-')
      .join('_')
      .toUpperCase()
    /** the list of name of modules to be registered
      * @member {String[]} */
    this.modules = Object.keys(config)
    /** the dictionary to keep class references of modules
      * @member {Object} */
    this.AllModules = {}
    /** the dictionary to keep instance references of modules
      * @member {Object} */
    this.allModules = {}
    /** the function to be called when INTERRUPT signal recieved
      * @member {Function} */
    this.signalIntFunc = this.signalInterrupt.bind(this)
  }

  /**
   * Set application config from package.json config
   *
   * @param {Object|String} pkg the package config or its dir path
   *
   * @return {Object} returns the configuration found
   */
  static getConfigFromPkg (pkgVal) {
    assert.ok(['object', 'string'].includes(typeof pkgVal), 'name MUST_BE_OBJECT_OR_STRING')
    let pkg = pkgVal
    if (typeof pkg === 'string') {
      pkg = require(resolve(pkg, '..', 'package.json'))
    }
    return assign({
      [Application.mainAppName]: (({
        name, description, version, keywords, homepage, author
      }) => ({
        name, description, version, keywords, homepage, author
      }))(pkg)
    }, pkg.config)
  }

  /**
   * The main entry function of the application
   *
   * @param {String} srcdir where to find app modules
   * @param {Object} [conf] the app config to override
   *
   * @returns {Application} the instance of Application
   */
  static async main (srcdir, conf) {
    assert.strictEqual(typeof srcdir, 'string', 'srcdir MUST_BE_STRING')
    if (typeof conf !== 'object') {
      conf = Application.getConfigFromPkg(srcdir)
    }
    const app = new Application(conf, srcdir)
    app.require()
    app.init()
    app.module(app.modules, 'setCli', yargs)
    await app.start()
    return app
  }

  /**
   * Set cli flags and commands
   *
   * @param {Yargs} yargs the instance of yargs
   */
  setCli (yargs) {
    yargs
      .scriptName(this.appConfig.name)
      .count('verbose')
      .alias('v', 'verbose')
      .help('h')
      .alias('h', 'help')
      .boolean('f')
      .describe('f', 'Force the command execution.')
      .alias('f', 'force')
      .epilog(`Copyright ${CURR_YEAR} ${this.appConfig.author}`)
      .usage(`$0 - ${this.appConfig.description}\n\nUsage: \n  $0 [options] [<command>] [arguments]`)
  }

  /**
   * Throw an error
   *
   * @param {String} errCode the error code
   * @param {String} [msg] the error message
   * @param {Boolean} [justReturn] just return the error, don't throw
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
      assert.strictEqual(typeof sec, 'string', 'modules MUST_BE_STRING')
      if (!Object.hasOwnProperty.call(this.config, sec)) {
        this.config[sec] = conf
        this.modules.push(sec)
      }
      this.AllModules[sec] = require(resolve(this.srcdir, sec))
    })
  }

  /**
   * Initialize all modules
   *
   * @param {String[]} [modules] list of modules
   */
  init (modules) {
    (modules || this.modules).forEach(sec => {
      assert.strictEqual(typeof sec, 'string', 'sec MUST_BE_STRING')
      if (sec === Application.mainAppName) {
        this.allModules[sec] = this
      } else {
        this.allModules[sec] = new this.AllModules[sec](this.config[sec], this)
      }
    })
  }

  /**
   * Start the application
   *
   * @returns {Promise} the promise which contain all start promises returned by modules
   */
  start () {
    process.on('SIGINT', this.signalIntFunc)
    return this._start()
  }

  /**
   * Start all modules
   *
   * @param {String[]} [modules] list of modules
   *
   * @returns {Promise} the promise which contain all start promises returned by modules
   * @private
   */
  _start (modules) {
    return Promise.all(
      (modules || this.modules).filter((sec) => {
        return sec !== Application.mainAppName && typeof this.allModules[sec].start === 'function'
      }).map(sec => this.allModules[sec].start())
    )
  }

  /**
   * Start the application
   *
   * @returns {Promise} the promise which contain all start promises returned by modules
   */
  stop () {
    process.off('SIGINT', this.signalIntFunc)
    return this._stop()
  }

  /**
   * Stop all modules
   *
   * @param {String[]} [modules] list of modules
   *
   * @returns {Promise} the promise which contain all stop promises returned by modules
   */
  _stop (modules) {
    return Promise.allSettled(
      (modules || this.modules).filter(sec => sec !== Application.mainAppName).map(sec => {
        if (typeof this.allModules[sec].stop !== 'function') {
          return Promise.resolve('stop MODULE_FUNCTION_NOT_FOUND')
        }
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
    assert.ok(['object', 'string'].includes(typeof name), 'name MUST_BE_ARRAY_OR_STRING')
    assert.strictEqual(typeof func, 'string', 'func MUST_BE_STRING')
    assert.strictEqual(typeof params, 'object', 'modules MUST_BE_ARRAY')
    const results = []
    const isAr = Array.isArray(name)
    const nn = isAr ? name : [name]
    nn.forEach(sec => {
      if (!Object.hasOwnProperty.call(this.allModules, sec)) {
        this.throwError('MODULE_NOT_FOUND')
      }
      if (typeof this.allModules[sec][func] === 'function') {
        results.push(this.allModules[sec][func](...params))
      } else if (!isAr) {
        this.throwError('MODULE_FUNCTION_NOT_FOUND')
      }
    })
    return isAr ? results : results.pop()
  }

  /**
   * Function to be invoked upon signal interrupt on process
   *
   */
  signalInterrupt () {
    process.stdout.write(`Stopping ${this.config.name} ...`)
    this.stop().then(results => {
      const successExit = results.find(pm => pm.status !== 'fulfilled')
      process.exit(successExit ? 0 : 1)
    })
  }
}

Application.mainAppName = 'mbjs-app'
module.exports = Application
