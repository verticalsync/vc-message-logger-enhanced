/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Settings } from "@api/Settings";
import { UserStore } from "@webpack/common";

import { settings } from "../index";
import { loggedMessagesCache } from "../LoggedMessageManager";
import { LoggedMessageJSON } from "../types";
import { findLastIndex, getGuildIdByChannel } from "./misc";


export * from "./cleanUp";
export * from "./misc";


// stolen from mlv2
// https://github.com/1Lighty/BetterDiscordPlugins/blob/master/Plugins/MessageLoggerV2/MessageLoggerV2.plugin.js#L2367
interface Id { id: string, time: number; }
export const DISCORD_EPOCH = 14200704e5;
export function reAddDeletedMessages(messages: LoggedMessageJSON[], deletedMessages: string[], channelStart: boolean, channelEnd: boolean) {
    if (!messages.length || !deletedMessages?.length) return;
    const IDs: Id[] = [];
    const savedIDs: Id[] = [];

    for (let i = 0, len = messages.length; i < len; i++) {
        const { id } = messages[i];
        IDs.push({ id: id, time: (parseInt(id) / 4194304) + DISCORD_EPOCH });
    }
    for (let i = 0, len = deletedMessages.length; i < len; i++) {
        const id = deletedMessages[i];
        const record = loggedMessagesCache[id];
        if (!record) continue;
        savedIDs.push({ id: id, time: (parseInt(id) / 4194304) + DISCORD_EPOCH });
    }
    savedIDs.sort((a, b) => a.time - b.time);
    if (!savedIDs.length) return;
    const { time: lowestTime } = IDs[IDs.length - 1];
    const [{ time: highestTime }] = IDs;
    const lowestIDX = channelEnd ? 0 : savedIDs.findIndex(e => e.time > lowestTime);
    if (lowestIDX === -1) return;
    const highestIDX = channelStart ? savedIDs.length - 1 : findLastIndex(savedIDs, e => e.time < highestTime);
    if (highestIDX === -1) return;
    const reAddIDs = savedIDs.slice(lowestIDX, highestIDX + 1);
    reAddIDs.push(...IDs);
    reAddIDs.sort((a, b) => b.time - a.time);
    for (let i = 0, len = reAddIDs.length; i < len; i++) {
        const { id } = reAddIDs[i];
        if (messages.findIndex(e => e.id === id) !== -1) continue;
        const record = loggedMessagesCache[id];
        if (!record.message) continue;
        messages.splice(i, 0, record.message);
    }
}

interface ShouldIgnoreArguments {
    channelId?: string,
    authorId?: string,
    guildId?: string;
    flags?: number,
    bot?: boolean;
}

const EPHEMERAL = 64;
export function shouldIgnore({ channelId, authorId, guildId, flags, bot }: ShouldIgnoreArguments) {
    if (channelId && guildId == null)
        guildId = getGuildIdByChannel(channelId);

    const myId = UserStore.getCurrentUser().id;

    const { ignoreBots, ignoreSelf, ignoreUsers } = Settings.plugins.MessageLogger;

    const ids = [authorId, channelId, guildId];

    const shouldIgnore =
        ((flags ?? 0) & EPHEMERAL) === EPHEMERAL ||
        ignoreBots && bot ||
        ignoreSelf && authorId === myId ||
        [...settings.store.blacklistedIds.split(","), ...ignoreUsers.split(",")].some(e => ids.includes(e));

    return shouldIgnore;
}


export function addToBlacklist(id: string) {
    const items = settings.store.blacklistedIds ? settings.store.blacklistedIds.split(",") : [];
    items.push(id);

    settings.store.blacklistedIds = items.join(",");
}

export function removeFromBlacklist(id: string) {
    const items = settings.store.blacklistedIds ? settings.store.blacklistedIds.split(",") : [];
    const index = items.indexOf(id);
    if (index !== -1) {
        items.splice(index, 1);
    }
    settings.store.blacklistedIds = items.join(",");
}
