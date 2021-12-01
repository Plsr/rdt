#!/usr/bin/env node

import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { Command } from 'commander';
import express from "express"
import open from "open"
import chalk from 'chalk'
import Keychain, { REFRESH_TOKEN_KEY, ACCESS_TOKEN_KEY } from './Keychain.js';

// Load dotenv config. Keep at top.
dotenv.config()

// Env vars
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const USER_AGENT = process.env.USER_AGENT

const STATE = (Math.random() + 1).toString(36).substring(7);
const REDIRECT_URI = "http://localhost:7777/authorize_callback";
let ACCESS_TOKEN = undefined

const program = new Command();
const keychain = new Keychain();
let server

program.option('-fr, --force-refresh', 'force new refresh token, only dev, delete me')
program.parse();
const options = program.opts();

const msw_main = "https://reddit.com/r/mauerstrassenwetten.json"

/**
 * MAIN PROGRAM
 */

const authNeeded = await isAuthNeeded()

if (authNeeded) {
  console.log(chalk.magenta("No auth data found, starting auth process..."))
  startServer()
  make_auth_request()
} else {
  const dailyLink = await getDaily()
  const comments = await getDailyComments(dailyLink)
  printComments(comments)
}

/**
 * END MAIN PROGRAM
 */

function printComments(comments) {
  comments.reverse().forEach(comment => {
    if (comment.data.stickied) return

    const author = comment.data.author
    const createdAt = new Date(comment.data.created * 1000)
    const body = comment.data.body

    console.log('[' + author + '         ' + createdAt + ']')
    console.log(body)
    console.log('')

  })
}

async function getDailyComments(dailyLink) {
  const headers = {
    'Authorization': 'bearer ' + ACCESS_TOKEN,
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/x-www-form-urlencoded'
  }
  const res = await fetch(dailyLink, headers)
  const data = await res.json()
  const comments = data[1].data.children
  console.log(comments)
  return comments
}

async function getDaily() {
  const headers = {
    'Authorization': 'bearer ' + ACCESS_TOKEN,
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/x-www-form-urlencoded'
  }
  const res = await fetch(msw_main, headers)
  const data = await res.json()
  const children = data.data.children
  const daily = children.find(post => {
    return post.data.title.includes("Tägliche Diskussion")
  })
  console.log(daily.data.url)
  return daily.data.url + '.json'
}

async function accessTokenValid() {
  // TODO: How to do this?
  return false
}

async function isAuthNeeded() {
  if (options.forceRefresh) {
    console.log(chalk.yellow('Running in force refresh mode, deleting stored keys and starting auth flow...'))
    await deleteRefreshTokenFromKeychain()
    return true
  }

  const accessToken = await keychain.getItem(ACCESS_TOKEN_KEY)

  if (accessToken && await accessTokenValid()) {
    ACCESS_TOKEN = accessToken
    return false
  }

  const refreshToken = await getRefreshTokenFromKeychain()
  console.log(refreshToken)

  if (!refreshToken) return true

  const accessToken = await getAccessToken(refreshToken.trim())
  if (accessToken) {
    console.log('got access token')
    console.log(accessToken)
    ACCESS_TOKEN = accessToken
    return false
  }

  return true
}

async function getRefreshTokenFromKeychain() {
  return await keychain.getItem(REFRESH_TOKEN_KEY)
}


async function getAccessToken(refreshToken) {
  console.log("Getting access token from refresh token")
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
  const url = 'https://www.reddit.com/api/v1/access_token'
  const base64encodedData = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const headers = {
    'Authorization': 'Basic ' + base64encodedData,
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/x-www-form-urlencoded'
  }
  console.log(headers)
  console.log(body)
  const res = await fetch(url, {method: 'POST', body: body, headers: headers});
  const data = await res.json()
  console.log(data)
  const accessToken = data['access_token']
  return accessToken
}


async function deleteRefreshTokenFromKeychain() {
  return await keychain.deleteItem(REFRESH_TOKEN_KEY)
}

async function saveToken(token) {
  return await keychain.storeItem(REFRESH_TOKEN_KEY, token)
}

async function handleTokenRetrival(code, state) {
  if (state !== STATE) {
    throw new Error('States do not match')
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: REDIRECT_URI
  })
  const url = 'https://www.reddit.com/api/v1/access_token'
  const base64encodedData = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const headers = {
    'Authorization': 'Basic ' + base64encodedData,
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/x-www-form-urlencoded'
  }

  const res = await fetch(url, {method: 'POST', body: body, headers: headers});
  const data = await res.json()

  ACCESS_TOKEN = data['access_token']
  const refresh_token = data['refresh_token']

  console.log(chalk.green("✔ Retrieved access & refresh token, saving to keychain"))

  await keychain.storeItem(REFRESH_TOKEN_KEY, refresh_token)
  await keychain.storeItem(ACCESS_TOKEN_KEY, ACCESS_TOKEN)

  stopServer()
}

function stopServer() {
  console.log(chalk.magenta("Shutting down auth server..."))
  server.close(() => {
    console.log(chalk.magenta("...shut down."))
  })
}

function startServer() {
  const port = 7777
  const app = express()

  server = app.listen(port, () => {
      console.log(chalk.magenta(`Auth callback server is running on http://localhost:${port}`));
  });

  app.get('/authorize_callback', (req, res) => {
    if (req.query['code'] && req.query['state']) {
      const code = req.query['code']
      const state = req.query['state']
      console.log(chalk.magenta("Retrieved callback, retrieving access token..."))
      handleTokenRetrival(code, state)
    }
  })
}

function make_auth_request() {
  const response_type = 'code';

  const duration = "permanent";
  const scope = "mysubreddits"

  const auth_url = `https://www.reddit.com/api/v1/authorize?client_id=${CLIENT_ID}&response_type=${response_type}&state=${STATE}&redirect_uri=${REDIRECT_URI}&duration=${duration}&scope=${scope}`

  console.log(chalk.magenta('Opening browser window...'))
  open(auth_url)
}
