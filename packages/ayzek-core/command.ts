import { ParseEntryPoint, CurrentArguments, ParseResults, CommandContext } from "@ayzek/command-parser/command";
import { CommandEventContext } from "./context";
import { Requirement } from "@ayzek/command-parser";
import { Text } from "@ayzek/text";

export type AyzekParseEntryPoint = ParseEntryPoint<AyzekCommandSource>;
export type AyzekCommandSource = CommandEventContext;
export type AyzekCommandContext<O extends CurrentArguments = {}> = CommandContext<AyzekCommandSource, O, Text>;
export type AyzekCommandRequirement = Requirement<AyzekCommandSource>;
export type AyzekParseResults = ParseResults<AyzekCommandSource>;
