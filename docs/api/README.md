# API support

API - is a bridge from messenger specific api to a bot events

Currently api support is tightly coupled with bot core to ease development, as codebase is not big at this moment

## Api features

API should try to normalize all texts being sent to standard form, i.e split large messages to maximum allowed in messenger without making text look ugly/non default

Also API should try to cover unsupported features by transforming them to supported alternatives, i.e transforming inline keyboards (as in VK/TG) to emojis (DS) when it is possible, or throw error else

All supported features is specified a `Set` in `API` class, plugins should look there first (Helper methods as `requireFeature` is available to prevent commands from being visible to users of non-supported APIs)

## IDs

API should provide unique ids for users/chats/guilds in form `{TYPE}{ENTITY_TYPE}:{DESCRIMINATOR}:{ID}`

This form can be changed, as ids shouldn't be parsed by plugins, but it is better to prefer this

`DESCRIMINATOR` is used to distinguish between different API instances, so there shouldn't be two apis with same type and descriminator to make answers from correct messenger bot account
