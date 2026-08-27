// blacklord-btns -- transparent, unobfuscated interactive-buttons helper for blacklord-socket
// No eval, no string-table obfuscation -- read it, audit it, fork it.
//
// Usage:
//   import { sendButtons, btn } from 'blacklord-btns'
//   await sendButtons(sock, jid, {
//       text: 'Choose an option',
//       footer: 'BLACKLORD',
//       buttons: [
//           btn.url('Open GitHub', 'https://github.com/blacklorddev15/blacklord-socket'),
//           btn.reply('Say hi', 'hi_id'),
//           btn.copy('Copy code', 'BLACKLORD2026')
//       ]
//   })

import { generateWAMessageFromContent } from 'blacklord-socket'

/**
 * Button builders for WhatsApp's native-flow interactive buttons.
 * Each returns { name, buttonParamsJson } ready to drop into `buttons: []`.
 */
export const btn = {
	/** Opens a URL when tapped */
	url(display_text, url, merchant_url) {
		return {
			name: 'cta_url',
			buttonParamsJson: JSON.stringify({
				display_text,
				url,
				merchant_url: merchant_url || url
			})
		}
	},

	/** Copies a code/string to the recipient's clipboard when tapped */
	copy(display_text, copy_code) {
		return {
			name: 'cta_copy',
			buttonParamsJson: JSON.stringify({
				display_text,
				copy_code
			})
		}
	},

	/** Prompts a phone call when tapped */
	call(display_text, phone_number) {
		return {
			name: 'cta_call',
			buttonParamsJson: JSON.stringify({ display_text, phone_number })
		}
	},

	/** Sends `id` back as the message text when tapped (most common "quick reply" button) */
	reply(display_text, id) {
		return {
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({ display_text, id })
		}
	},

	/**
	 * A tappable list/menu.
	 * sections: [{ title, rows: [{ header, title, description, id }] }]
	 */
	list(list_button_text, sections) {
		return {
			name: 'single_select',
			buttonParamsJson: JSON.stringify({ title: list_button_text, sections })
		}
	}
}

/**
 * Send an interactive-buttons message.
 *
 * @param {import('blacklord-socket').WASocket} sock
 * @param {string} jid
 * @param {object} options
 * @param {string} [options.text] body text
 * @param {string} [options.footer] footer text
 * @param {string} [options.title] header title
 * @param {string} [options.subtitle] header subtitle
 * @param {Array} [options.buttons] array of button objects (use `btn.*` builders)
 * @param {Array} [options.interactiveButtons] alias for `buttons` (kept
 *   for compatibility with libraries that use this call shape -- lets you
 *   swap `otherLib.sendInteractiveMessage(...)` for `sendButtons(...)`
 *   without touching the call site's payload shape)
 * @param {object} [options.contextInfo] raw contextInfo to merge in (e.g. for
 *   `{ mentionedJid: [...] }`)
 * @param {import('blacklord-socket').WAMessage} [options.quoted] message to quote/reply to
 */
export async function sendButtons(sock, jid, options = {}) {
	const {
		text = '',
		footer = '',
		title,
		subtitle,
		buttons,
		interactiveButtons, // compatibility alias for `buttons`
		contextInfo,
		quoted
	} = options

	const resolvedButtons = buttons || interactiveButtons || []

	if (!Array.isArray(resolvedButtons) || resolvedButtons.length === 0) {
		throw new Error('blacklord-btns: sendButtons requires at least one button (pass `buttons` or `interactiveButtons`)')
	}

	for (const b of resolvedButtons) {
		if (!b || typeof b.name !== 'string' || typeof b.buttonParamsJson !== 'string') {
			throw new Error('blacklord-btns: each button needs { name, buttonParamsJson } -- use the btn.* builders')
		}
	}

	const bodyAndHeader = {
		header: { title: title || '', subtitle: subtitle || '', hasMediaAttachment: false },
		...(text ? { body: { text } } : {}),
		...(footer ? { footer: { text: footer } } : {})
	}

	if (contextInfo && typeof contextInfo === 'object') {
		bodyAndHeader.contextInfo = contextInfo
	}

	const interactiveMessage = {
		...bodyAndHeader,
		nativeFlowMessage: {
			buttons: resolvedButtons,
			messageParamsJson: '',
			messageVersion: 1
		}
	}

	// No viewOnceMessage wrapper -- interactiveMessage goes at the top level.
	const messageContent = { interactiveMessage }

	// WhatsApp requires this additionalNodes stanza for the client to
	// recognize and render the message as interactive (native-flow) buttons.
	// Without it, the message relays successfully with no error, but the
	// recipient's client silently ignores the interactive content.
	const interactiveStanzaNodes = [
		{
			tag: 'biz',
			attrs: {},
			content: [
				{
					tag: 'interactive',
					attrs: { type: 'native_flow', v: '1' },
					content: [
						{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
					]
				}
			]
		}
	]

	const fullMessage = generateWAMessageFromContent(jid, messageContent, {
		quoted,
		userJid: sock.user?.id
	})

	await sock.relayMessage(jid, fullMessage.message, {
		messageId: fullMessage.key.id,
		additionalNodes: interactiveStanzaNodes
	})

	return fullMessage
}

/**
 * Alias for `sendButtons`, matching the method name used by some other
 * interactive-buttons libraries -- use this if you want a true drop-in
 * replacement without renaming the call site
 * (`otherLib.sendInteractiveMessage(sock, jid, {...})` becomes
 * `blacklord-btns.sendInteractiveMessage(sock, jid, {...})`).
 */
export const sendInteractiveMessage = sendButtons

/**
 * Send a reliable plain-text or image-caption response when a client does not
 * support native-flow rendering. This preserves the same call shape as
 * sendButtons while omitting interactive metadata.
 */
export async function sendRaw(sock, jid, options = {}) {
	const {
		text = '',
		image,
		caption,
		contextInfo,
		quoted
	} = options

	const message = image
		? { image, caption: caption ?? text, ...(contextInfo ? { contextInfo } : {}) }
		: { text, ...(contextInfo ? { contextInfo } : {}) }

	return sock.sendMessage(jid, message, { quoted })
}

/**
 * Send native-flow buttons or the reliable raw equivalent. Set `format` to
 * `raw`, `text`, or `plain` for a plain message; native is the default. With
 * `fallbackRaw` enabled, native-flow errors automatically degrade to raw.
 */
export async function sendCompatible(sock, jid, options = {}) {
	const {
		format = 'native',
		fallbackRaw = false,
		...payload
	} = options

	if (['raw', 'text', 'plain'].includes(String(format).toLowerCase())) {
		return sendRaw(sock, jid, payload)
	}

	try {
		return await sendButtons(sock, jid, payload)
	} catch (error) {
		if (!fallbackRaw) throw error
		return sendRaw(sock, jid, payload)
	}
}

export default { sendButtons, sendInteractiveMessage, sendRaw, sendCompatible, btn }
