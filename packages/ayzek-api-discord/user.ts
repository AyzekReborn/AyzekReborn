import { Gender, User } from '@ayzek/core/conversation';
import { Image } from '@ayzek/core/model/attachment';
import type { User as DSUser } from 'discord.js';
import { DiscordApi } from '.';

export default class DiscordUser extends User {
	constructor(api: DiscordApi, public apiUser: DSUser) {
		super(
			api,
			api.encodeUserUid(apiUser.id),
			apiUser.username,
			null,
			null,
			// TODO: Bot-level gender selection
			Gender.UNSPECIFIED,
			// Available only for friends/users who present in same guilds as you
			`https://discordapp.com/users/${apiUser.id}`,
			apiUser.bot,
		);
	}
	private _photoImage: Promise<Image> | null = null;

	get channelId(): string {
		return this.apiUser.dmChannel && this.apiUser.dmChannel.id || '0';
	}

	get photoImage() {
		return this._photoImage || (this._photoImage = Promise.resolve(Image.fromUrl('GET', this.apiUser.avatar || this.apiUser.defaultAvatarURL, {}, 'photo.png', 'image/png')));
	}
}
