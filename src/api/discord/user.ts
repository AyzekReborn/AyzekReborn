import { User as DSUser } from "discord.js";
import { Gender, User } from "../../model/conversation";
import DiscordApi from "./api";
import { Image } from '../../model/attachment/attachment';

export default class DiscordUser extends User<DiscordApi>{

    constructor(api: DiscordApi, public user: DSUser) {
        super(
            api,
            user.id,
            api.encodeUserUid(user.id),
            user.username,
            null,
            null,
            Gender.MAN, // TODO how to select gender in Discord?
            "",
            user.bot
        );
    }
    private _photoImage: Promise<Image> | null = null;

    get photoImage() {
        return this._photoImage || (this._photoImage = Promise.resolve(Image.fromUrl(this.user.avatarURL, 'photo.png', 'image/png')));
    }
}