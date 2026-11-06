export class Backend {
  constructor(url) {
    this.url = url;
    this.pending = new Map();
    this.ready = null;
    this.channel = crypto.randomUUID();
    window.addEventListener("message", (event) => {
      if (
        !this.frame ||
        !/^https:\/\/([a-z0-9-]+-)?script\.googleusercontent\.com$/.test(
          event.origin,
        ) ||
        event.data?.channel !== this.channel
      )
        return;
      const message = event.data;
      if (message?.type === "vq-ready") {
        this.bridge = event.source;
        this.bridgeOrigin = event.origin;
        this.resolveReady?.();
      }
      if (event.source !== this.bridge) return;
      if (message?.type === "vq-response" && this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        clearTimeout(timer);
        this.pending.delete(message.id);
        message.error ? reject(Error(message.error)) : resolve(message.result);
      }
    });
  }
  connect() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ready = null;
        this.frame?.remove();
        reject(
          Error(
            "The class server did not respond. Check your connection and try again.",
          ),
        );
      }, 25000);
      this.resolveReady = () => {
        clearTimeout(timer);
        resolve();
      };
      this.frame = document.createElement("iframe");
      this.frame.hidden = true;
      this.frame.src =
        this.url +
        (this.url.includes("?") ? "&" : "?") +
        "mode=bridge&origin=" +
        encodeURIComponent(location.origin) +
        "&channel=" +
        this.channel;
      document.body.append(this.frame);
    });
    return this.ready;
  }
  async request(action, payload = {}) {
    await this.connect();
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error("Connection interrupted. Please retry."));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.bridge.postMessage(
        { type: "vq-request", channel: this.channel, id, action, payload },
        this.bridgeOrigin,
      );
    });
  }
}
