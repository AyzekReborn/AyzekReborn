export type IVKKeyboard = {
	buttons: IButton[][],
	one_time?: boolean,
	inline?: boolean,
};

export type IButton = {
	color?: 'primary' | 'secondary' | 'negative' | 'positive',
	action: IButtonAction,
};

export type IButtonAction = {
	type: 'text',
	label: string,
	payload: string,
} | {
	type: 'open_link',
	link: string,
	label: string,
	payload?: string,
} | {
	type: 'location',
	payload: string,
} | {
	type: 'vkpay',
	hash: string,
	payload?: string,
} | {
	type: 'open_app',
	app_id: number,
	owner_id: number,
	label: string,
	hash: string,
	payload?: string,
};
