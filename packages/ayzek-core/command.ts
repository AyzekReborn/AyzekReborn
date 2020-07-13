import { Requirement } from '@ayzek/command-parser';
import { CommandContext, CurrentArguments, ParseEntryPoint, ParseResults } from '@ayzek/command-parser/command';
import { Text } from '@ayzek/text';
import { CommandMessageEvent } from './events/message';

export type AyzekParseEntryPoint = ParseEntryPoint<AyzekCommandSource>;
export type AyzekCommandSource = CommandMessageEvent;
// eslint-disable-next-line @typescript-eslint/ban-types
export type AyzekCommandContext<O extends CurrentArguments = {}> = CommandContext<AyzekCommandSource, O, Text>;
export type AyzekCommandRequirement = Requirement<AyzekCommandSource>;
export type AyzekParseResults = ParseResults<AyzekCommandSource>;
