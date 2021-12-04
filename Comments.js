import { formatDistance } from 'date-fns'
import chalk from 'chalk'

import { randomChalkColor } from './RandomChalkColor.js'

export function printComments(comments) {
  comments.reverse().forEach(comment => {
    if (comment.data.stickied) return

    const author = authorName(comment.data.author)
    const createdAt = parseDate(comment.data.created)
    const body = commentBody(comment.data.body)

    const randomColor = randomChalkColor()
    console.log(chalk[randomColor](author + ' (' + createdAt + ')'))
    console.log(body)
    console.log('')
  })
}

function parseDate(unixEpochDate) {
  const commentDate = new Date(unixEpochDate * 1000)
  const nowDate = new Date
  return formatDistance(
    commentDate,
    nowDate,
    { addSuffix: true }
  )
}

function authorName(name) {
  return `/u/${name}`
}

function commentBody(bodyData) {
  return bodyData
}


