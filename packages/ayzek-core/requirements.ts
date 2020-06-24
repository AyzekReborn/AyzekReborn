import { Attribute, AttributeConstructor } from '@ayzek/attribute';
import ApiFeature from '@ayzek/model/features';
import { AyzekCommandRequirement } from './command';

/**
 * Require feature is supported by sender api
 * @param feature needed feature
 */
export function requireApiHasFeature(feature: ApiFeature): AyzekCommandRequirement {
	return source => source.api.isFeatureSupported(feature);
}

/**
 * Command can be only executed by payload (Prefer PluginInfo#payloadHandlers instead)
 * FIXME: Recomendation is not available because payloadHandlers not implemented
 */
export function requireHidden(): AyzekCommandRequirement {
	return source => source.isPayloadIssued;
}

/**
 * Command is only exists in development env
 * I.e unsafe debugging helpers
 */
export function requireDevelopment(): AyzekCommandRequirement {
	return _source => process.env.NODE_ENV === 'DEVELOPMENT';
}

/**
 * Fails if message sender doesn't have needed attribute
 */
export function requireAttribute<P extends Attribute>(constructor: AttributeConstructor<P>): AyzekCommandRequirement {
	return ctx => {
		const attribute = ctx.event.user.attributeStorage!.getIfAvailable(constructor);
		return !!attribute;
	};
}

/**
 * Fails if message sender have specified attachment
 */
export function requireAttributeAbsent<P extends Attribute>(constructor: AttributeConstructor<P>): AyzekCommandRequirement {
	return ctx => {
		const attribute = ctx.event.user.attributeStorage!.getIfAvailable(constructor);
		return !attribute;
	};
}
