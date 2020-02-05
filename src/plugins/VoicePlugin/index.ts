import { PluginInfo, PluginCategory, command } from "../../bot/plugin";
import { UserDisplayableError } from "../../command/error";
import { Attachment, Voice } from "../../model/attachment/attachment";
import { IMessage } from "../../model/message";
import { emit } from "@meteor-it/xrest";
import { textJoin } from "../../model/text";
import * as rawConfig from './config.yaml';

function findAllVoiceMessages(messages: IMessage<any>[], deepFirst: boolean): [string, Voice][] {
	const out: [string, Voice][] = [];
	for (const message of messages) {
		if (!deepFirst)
			out.push(...(message.attachments.filter(e => e instanceof Voice) as Voice[]).map(v => [message.user.fullName, v]) as [string, Voice][]);
		if (message.replyTo)
			out.push(...findAllVoiceMessages([message.replyTo], true));
		if (message.forwarded.length !== 0)
			out.push(...findAllVoiceMessages(message.forwarded, false));
		if (deepFirst)
			out.push(...(message.attachments.filter(e => e instanceof Voice) as Voice[]).map(v => [message.user.fullName, v]) as [string, Voice][]);
	}
	return out;
}

const speechToTextCommand = command(['speech-to-text', 'stt'])
	.executes(async ctx => {
		const forwarded = findAllVoiceMessages([ctx.source.event], false);
		if (forwarded.length === 0) throw new UserDisplayableError('Не вижу голосовух в том что ты отправил');
		if (forwarded.length > 10) throw new UserDisplayableError('Увы, больше 10 голосовух одновременно я расшифровываю только за донат боту');
		const decoded = await Promise.all(forwarded.map(async ([user, voice]) => {
			try {
				// TODO: Move to selfhosted & opensource
				const result = await emit('POST', 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize', {
					query: {
						lang: 'ru-RU',
						topic: 'general',
						profanityFilter: 'false',
						format: 'oggopus',
					},
					headers: {
						'Authorization': `Api-Key ${rawConfig.speechKitApiKey}`,
					},
					// FIXME: Streaming upload instead of buffer, handle api limits
					data: await voice.data.toBuffer(),
				});
				try {
					const text = result.jsonBody?.result;
					if (text === '') {
						return `${user} » ⛔ Нет слов/невнятная речь`;
					} else if (!text) {
						console.log(result.jsonBody);
						return `${user} » ⛔ Распознавание не удалось, возможно у разраба истёк лимит на токене`;
					}
					return `${user} » ${text}`;
				} catch{
					return `${user} » ⛔ Распознавание не удалось из за ошибки со стороны сервера, возможно у разраба истёк лимит на токене`;
				}
			} catch (e) {
				return `${user} » ⛔ Распознавание не удалось из за ошибки: ${e.message}`;
			}
		}));
		await ctx.source.send(textJoin(decoded, '\n\n'));
	}, 'Расшифровать все голосовые сообщения из пересланных, используется SpeechKit, поддерживается только русский')

export default class VoicePlugin implements PluginInfo {
	name = 'VoicePlugin';
	author = 'НекийЛач';
	description = 'Расшифровка голосовух, вас же тоже бесят люди что их создают?';
	category = PluginCategory.UTILITY;
	commands = [speechToTextCommand];
	listeners = [];
	async init() {
		if (!rawConfig.speechKitApiKey)
			throw new Error('Bad config: missing speechKitApiKey');
	}
}
