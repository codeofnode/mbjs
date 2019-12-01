#!/usr/bin/env node

const Application = require('./index')

Application.main(__dirname).then(() => {}, console.error)
