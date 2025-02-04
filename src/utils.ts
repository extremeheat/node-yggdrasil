import { Agent } from 'http'
import { promisified as phin } from 'phin'
const { version } = require('../package.json') // eslint-disable-line

const headers = {
  'User-Agent': `node-yggdrasil/${version as string}`,
  'Content-Type': 'application/json'
}

const utils = {
  phin,
  /**
   * Generic POST request
   */
  call: async function (host: string, path: string, data: any, agent: boolean | Agent | undefined) {
    const resp = await phin({
      method: 'POST',
      url: `${host}/${path}`,
      data,
      headers,
      core: { agent }
    })
    if (resp.body.length === 0) return ''
    let body
    try {
      body = JSON.parse(resp.body)
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Probably a cloudflare error page
        const body = resp.body.toString()

        if (resp.statusCode === 403) {
          if (body.includes('Request blocked.')) {
            throw new Error('Request blocked by CloudFlare')
          }
          if (body.includes('cf-error-code">1009')) {
            throw new Error('Your IP is banned by CloudFlare')
          }
        } else {
          throw new Error(`Response is not JSON. Status code: ${resp.statusCode ?? 'no status code'}`)
        }
      } else {
        throw err
      }
    }
    if (body?.error !== undefined) throw new Error(body?.errorMessage)
    return body
  },

  /**
   * Java's stupid hashing method
   * @param  {Buffer|String} hash     The hash data to stupidify
   * @param  {String} encoding Optional, passed to Buffer() if hash is a string
   * @return {String}          Stupidified hash
   */
  mcHexDigest: function (hash: Buffer | String, encoding?: String): any {
    if (!(hash instanceof Buffer)) {
      hash = (Buffer as any).from(hash, encoding)
    }
    // check for negative hashes
    const negative = (hash as any).readInt8(0) < 0
    if (negative) performTwosCompliment(hash)
    return (negative ? '-' : '') + hash.toString('hex').replace(/^0+/g, '')
  },

  callbackify: function (f: any, maxParams: number) {
    return function (...args: any[]) {
      let cb: Function | undefined
      let i: number = args.length
      while (cb === undefined && i > 0) {
        if (typeof args[i - 1] === 'function') {
          cb = args[i - 1]
          args[i - 1] = undefined
          args[maxParams] = cb
          break
        }
        i--
      }
      return f(...args).then(
        (r: any) => {
          if (r[0] !== undefined) {
            cb?.(undefined, ...r)
            return r[r.length - 1]
          } else {
            cb?.(undefined, r)
            return r
          }
        },
        (err: unknown) => {
          if (typeof cb === 'function') cb(err)
          else throw err
        }
      )
    }
  }
}

/**
 * Java's annoying hashing method.
 * All credit to andrewrk
 * https://gist.github.com/andrewrk/4425843
 */
function performTwosCompliment (buffer: any): void {
  let carry = true
  let i, newByte, value
  for (i = buffer.length - 1; i >= 0; --i) {
    value = buffer.readUInt8(i)
    newByte = ~value & 0xff
    if (carry) {
      carry = newByte === 0xff
      buffer.writeUInt8(carry ? 0 : newByte + 1, i)
    } else {
      buffer.writeUInt8(newByte, i)
    }
  }
}

utils.call = utils.callbackify(utils.call, 4)

export = utils
