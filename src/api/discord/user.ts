import { User as DSUser } from "discord.js";
import { Image } from '../../model/attachment/attachment';
import { Gender, User } from "../../model/conversation";
import DiscordApi from "./api";

export default class DiscordUser extends User<DiscordApi>{
	constructor(api: DiscordApi, public apiUser: DSUser) {
		super(
			api,
			apiUser.dmChannel && apiUser.dmChannel.id || '0',
			api.encodeUserUid(apiUser.id),
			apiUser.username,
			null,
			null,
			// TODO: Bot-level gender selection
			Gender.UNSPECIFIED,
			// Available only for friends/users who present in same guilds as you
			`https://discordapp.com/users/${apiUser.id}`,
			apiUser.bot
		);
	}
	private _photoImage: Promise<Image> | null = null;

	get photoImage() {
		return this._photoImage || (this._photoImage = Promise.resolve(Image.fromUrl(this.apiUser.avatarURL, 'photo.png', 'image/png')));
	}
}
