import { shell } from "../hub-kit.js";
// Kniffel / Yahtzee / Yatzy / Generala for the multiplayer hub.
// The game itself is the same script the solo page uses (games/kniffel.js, a factory `createKniffel`);
// here it gets the hub's stage and the room: the host picks the variant on a pre-game screen and starts,
// the player whose turn it is publishes rolls (a seed), resting dice and written fields through `ctx.send`.

const SRC = new URL("../games/kniffel.js", import.meta.url).href;

function load(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("failed " + src));
    document.head.appendChild(s);
  });
}

export default {
  min: 2, max: 6,

  async mount(ctx) {
    const kit = shell(ctx, { title: "Kniffel" }), root = kit.body;
    window.__KN_HUB__ = true;                                   // the script must not start itself as the solo page
    if (!window.createKniffel) await load(SRC);
    const game = window.createKniffel({
      root,
      net: {
        send: (type, data, to) => ctx.send(type, data, to),
        onMessage: (type, fn) => ctx.onMessage(type, fn),
        onEvent: (ev, fn) => ctx.onEvent(ev, fn),
        get me() { return ctx.me; },
        get isHost() { return ctx.isHost; },
        get hostId() { return ctx.hostId; },
        get players() { return ctx.players; },
        end: () => ctx.end(),
        leave: () => window.Multiplayer.leave(),
      },
    });
    return { go: () => game.go(), destroy: () => game.destroy() };
  },
};
