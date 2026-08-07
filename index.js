// wolfbtns -- transparent, unobfuscated interactive-buttons helper for wolfsocket
// (WOLF TECH). No eval, no string-table obfuscation -- read it, audit it, fork it.
//
// Usage:
//   import { sendButtons, btn } from 'wolfbtns'
//   await sendButtons(sock, jid, {
//       text: 'Choose an option',
//       footer: 'WOLF TECH',
//       buttons: [
//           btn.url('Open GitHub', 'https://github.com/WOLVAREX'),
//           btn.reply('Say hi', 'hi_id'),
//           btn.copy('Copy code', 'WOLF2026')
//       ]
//   })

import { generateWAMessageFromContent } from 'wolfsocket'

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
				id: `copy_${Date.now()}`,
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
 * @param {import('wolfsocket').WASocket} sock
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
 * @param {import('wolfsocket').WAMessage} [options.quoted] message to quote/reply to
 * @param {boolean} [options.viewOnce=true] wrap in viewOnceMessage (required by
 *   current WhatsApp clients to render native-flow buttons correctly)
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
		quoted,
		viewOnce = true
	} = options

	const resolvedButtons = buttons || interactiveButtons || []

	if (!Array.isArray(resolvedButtons) || resolvedButtons.length === 0) {
		throw new Error('wolfbtns: sendButtons requires at least one button (pass `buttons` or `interactiveButtons`)')
	}

	for (const b of resolvedButtons) {
		if (!b || typeof b.name !== 'string' || typeof b.buttonParamsJson !== 'string') {
			throw new Error('wolfbtns: each button needs { name, buttonParamsJson } -- use the btn.* builders')
		}
	}

	const bodyAndHeader = {
		...(text ? { body: { text } } : {}),
		...(footer ? { footer: { text: footer } } : {}),
		...(title || subtitle
			? { header: { title, subtitle, hasMediaAttachment: false } }
			: {})
	}

	if (contextInfo && typeof contextInfo === 'object') {
		bodyAndHeader.contextInfo = contextInfo
	}

	const interactiveMessage = {
		...bodyAndHeader,
		nativeFlowMessage: {
			buttons: resolvedButtons,
			messageParamsJson: ''
		}
	}

	const messageContent = viewOnce
		? { viewOnceMessage: { message: { interactiveMessage } } }
		: { interactiveMessage }

	const fullMessage = generateWAMessageFromContent(jid, messageContent, {
		quoted,
		userJid: sock.user?.id
	})

	await sock.relayMessage(jid, fullMessage.message, { messageId: fullMessage.key.id })

	return fullMessage
}

/**
 * Alias for `sendButtons`, matching the method name used by some other
 * interactive-buttons libraries -- use this if you want a true drop-in
 * replacement without renaming the call site
 * (`otherLib.sendInteractiveMessage(sock, jid, {...})` becomes
 * `wolfbtns.sendInteractiveMessage(sock, jid, {...})`).
 */
export const sendInteractiveMessage = sendButtons

export default { sendButtons, sendInteractiveMessage, btn }