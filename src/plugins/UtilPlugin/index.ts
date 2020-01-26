import { PluginCategory, PluginInfo } from "../../bot/plugin";

export default class implements PluginInfo {
	name = 'UtilPlugin';
	author = 'НекийЛач';
	description = 'Разные утилиты';
	category = PluginCategory.UTILITY;
	commands = [];
	listeners = [];
}
