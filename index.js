#!/usr/bin/env node

import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { Command } from 'commander';
import express from "express"
import open from "open"
import { exec } from "child_process"

// Load dotenv config. Keep at top.
dotenv.config()

// Env vars
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const USER_AGENT = process.env.USER_AGENT

const STATE = (Math.random() + 1).toString(36).substring(7);
const REFRESH_KEY = "rdt_refresh_token"
const REDIRECT_URI = "http://localhost:7777/authorize_callback";
let ACCESS_TOKEN = undefined
const authorized = false

const program = new Command();
let server

program.option('-fr, --force-refresh', 'force new refresh token, only dev, delete me')
program.parse();
const options = program.opts();

const msw_main = "https://reddit.com/r/mauerstrassenwetten.json"

/**
 * MAIN PROGRAM
 */

const authNeeded = await isAuthNeeded()
console.log(authNeeded)

if (authNeeded) {
  startServer()
  make_auth_request()
}

/**
 * END MAIN PROGRAM
 */

async function isAuthNeeded() {
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

function getRefreshTokenFromKeychain() {
  const getCmd = `security find-generic-password -wa '${REFRESH_KEY}'`

  return new Promise(resolve => {
     exec(getCmd, (err, stout, sterr) => {
        resolve(err ? sterr : stout)
     })
  });
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


function deleteRefreshTokenFromKeychain() {
  const delCmd = `security delete-generic-password -a '${REFRESH_KEY}' -s '${REFRESH_KEY}'`
  exec(delCmd, (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    console.log('Stored key deleted');
  })
}

function saveToken(token) {
  if (options.forceRefresh) {
    console.log('Force refresh mode, deleting stored key')
    deleteRefreshTokenFromKeychain()
  }

  const cmd = `security add-generic-password -a '${REFRESH_KEY}' -s '${REFRESH_KEY}' -w '${token}'`
  console.log(cmd)
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    console.log('Stored refresh token in kaychain');
  });
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
  console.log(headers)
  console.log(body)
  const res = await fetch(url, {method: 'POST', body: body, headers: headers});
  console.log(res.headers);
  const data = await res.json()
  console.log(data)
  ACCESS_TOKEN = data['access_token']
  const refresh_token = data['refresh_token']
  saveToken(refresh_token)
  stopServer()
}

function stopServer() {
  server.close()
}

function startServer() {
  const port = 7777
  const app = express()

  server = app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
  });

  app.get('/authorize_callback', (req, res) => {
    console.log(req.query['code'])
    if (req.query['code'] && req.query['state']) {
      const code = req.query['code']
      const state = req.query['state']
      handleTokenRetrival(code, state)
    }
  })
}

function make_auth_request() {
  const response_type = 'code';

  const duration = "permanent";
  const scope = "mysubreddits"

  const auth_url = `https://www.reddit.com/api/v1/authorize?client_id=${CLIENT_ID}&response_type=${response_type}&state=${STATE}&redirect_uri=${REDIRECT_URI}&duration=${duration}&scope=${scope}`
  open(auth_url)
}
