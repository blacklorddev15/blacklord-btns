# wolfbtns

A small, **fully transparent** interactive-buttons helper for
[wolfsocket](https://www.npmjs.com/package/wolfsocket). No `eval`, no
string-table obfuscation, no tamper-checks — every line is plain, readable
JavaScript you can audit in under five minutes.

Built as an open alternative to obfuscated third-party button libraries in
the WhatsApp-bot ecosystem, where you'd otherwise be trusting code you
can't read.

## Install

```bash
npm install wolfbtns wolfsocket
```

## Usage

```js
import makeWASocket from 'wolfsocket'
import { sendButtons, btn } from 'wolfbtns'

const sock = makeWASocket({ /* ... */ })

await sendButtons(sock, jid, {
  text: 'Choose an option below',
  footer: 'WOLF TECH',
  title: 'Menu',
  buttons: [
    btn.url('Open GitHub', 'https://github.com/WOLVAREX'),
    btn.reply('Say hi', 'hi_id'),
    btn.copy('Copy invite code', 'WOLF2026'),
    btn.call('Call support', '+254700000000'),
    btn.list('View options', [
      { title: 'Section 1', rows: [{ title: 'Row 1', description: 'optional', id: 'row_1' }] }
    ])
  ]
})
```

## Button types

| builder | renders as | tap behavior |
|---|---|---|
| `btn.url(text, url, merchantUrl?)` | link button | opens `url` |
| `btn.reply(text, id)` | quick-reply button | sends `id` back as the message text |
| `btn.copy(text, code)` | copy button | copies `code` to clipboard |
| `btn.call(text, phoneNumber)` | call button | prompts a call to `phoneNumber` |
| `btn.list(buttonText, sections)` | list/menu button | opens a tappable list |

Buttons are plain `{ name, buttonParamsJson }` objects under the hood — if
you need a button type not covered by the builders above, just construct
that shape yourself and pass it in `buttons: [...]` directly.

## Options

```ts
sendButtons(sock, jid, {
  text?: string        // body text
  footer?: string       // footer text
  title?: string         // header title
  subtitle?: string      // header subtitle
  buttons: Array<{ name: string, buttonParamsJson: string }>  // required, at least 1
  quoted?: WAMessage      // message to reply to
  viewOnce?: boolean      // default true -- required by current WhatsApp
                          // clients to render native-flow buttons correctly
})
```

## Why this exists

Most WhatsApp-bot "buttons" packages in this ecosystem ship as obfuscated,
`eval`-based code with no visibility into what they actually do at runtime.
`wolfbtns` builds the same WhatsApp native-flow button message directly
from Baileys/wolfsocket's own documented proto types — there's nothing
hidden, and nothing here depends on any specific vendor's backend.

## License

MIT