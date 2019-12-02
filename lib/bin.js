#!/usr/bin/env node

const Application = require('./index')

Application.main(__dirname)
  .then(() => {})
  .catch((er) => {
    console.error(er)
    process.exit(1)
  })
