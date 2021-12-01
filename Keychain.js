import { exec } from "child_process"

export const REFRESH_TOKEN_KEY = "rdt_refresh_token"
export const ACCESS_TOKEN_KEY = "rdt_access_token"

export default class Keychain {
  async deleteItem(key) {
    const delCmd = `security delete-generic-password -a '${key}' -s '${key}'`

    // TODO: Does delete print to stderror instead?
    return await this.execCmd(delCmd)
  }

  async getItem(key) {
    const getCmd = `security find-generic-password -wa '${key}'`

    return await this.execCmd(getCmd)
  }

  async storeItem(key, item) {
    const storeCmd = `security add-generic-password -a '${key}' -s '${key}' -w '${item}'`
    return await this.execCmd(storeCmd)
  }

  async execCmd(cmd) {
    return new Promise(resolve => {
      exec(cmd, (err, stout, sterr) => {
         resolve(err ? sterr : stout)
      })
   });
  }
}