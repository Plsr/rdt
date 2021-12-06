import { formatDistance } from 'date-fns'
import chalk from 'chalk'

import { randomChalkColor } from './RandomChalkColor.js'

export default class Comments {

  constructor(comments = {}) {
    this.comments = comments?.reverse()
  }

  addComments(newComments) {
    if (this.comments.length === 0) {
      this.comments = comments.reverse()
    }

    const unpersistetComments = this.comments.filter(comment => {
      return !this.comments.includes(comment)
    })

    this.comments.push(...unpersistetComments)
  }

  printComments() {
    this.comments.forEach(comment => {
      if (comment.data.stickied) return

      const author = this.authorName(comment.data.author)
      const createdAt = this.parseDate(comment.data.created)
      const body = this.commentBody(comment.data.body)

      const randomColor = randomChalkColor()
      console.log(chalk[randomColor](author + ' (' + createdAt + ')'))
      console.log(body)
      console.log('')
    })
  }

  parseDate(unixEpochDate) {
    const commentDate = new Date(unixEpochDate * 1000)
    const nowDate = new Date
    return formatDistance(
      commentDate,
      nowDate,
      { addSuffix: true }
    )
  }

  authorName(name) {
    return `/u/${name}`
  }

  commentBody(bodyData) {
    return bodyData
  }
}

