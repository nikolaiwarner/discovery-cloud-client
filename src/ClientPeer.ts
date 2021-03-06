import { Duplex } from "stream"
import Debug from "debug"
import * as Base58 from "bs58"
import WebSocketStream from "./WebSocketStream"

const log = Debug("discovery-cloud:ClientPeer")

export interface Info {
  channel: Buffer
  discoveryKey: Buffer
  live?: boolean
  download?: boolean
  upload?: boolean
  encrypt?: boolean
  hash?: boolean
}

interface Options {
  id: string
  url: string
  stream: (info: Info) => Duplex
}

export default class ClientPeer {
  id: string
  url: string
  stream: (info: Info) => Duplex
  connections: Map<string, WebSocketStream> = new Map() // channel -> socket

  constructor({ url, id, stream }: Options) {
    this.url = url
    this.id = id
    this.stream = stream
  }

  add(channel: string) {
    if (this.connections.has(channel)) return

    const url = [this.url, this.id, channel].join("/")
    const tag = [this.id.slice(0, 2), channel.slice(0, 2)].join("-")
    const socket = new WebSocketStream(url, tag)

    this.connections.set(channel, socket)

    const protocol = this.stream({
      channel: Base58.decode(channel),
      discoveryKey: Base58.decode(channel),
      live: true,
      download: true,
      upload: true,
      encrypt: false,
      hash: false,
    })

    socket.ready.then(socket => protocol.pipe(socket).pipe(protocol))

    protocol.on("error", err => {
      log("protocol.onerror %s", tag, err)
    })

    socket.on("error", err => {
      log("socket.onerror %s", tag, err)
    })

    socket.once("end", () => {
      log("socket.onend")
      this.remove(channel)
    })

    socket.once("close", () => {
      log("socket.onclose")
      this.remove(channel)
    })
  }

  remove(channel: string) {
    log("%s removing connection: %s", this.id, channel)
    this.connections.delete(channel)
  }
}
