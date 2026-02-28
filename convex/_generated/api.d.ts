/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as activityEvents from "../activityEvents.js";
import type * as agents from "../agents.js";
import type * as documents from "../documents.js";
import type * as followUpQueue from "../followUpQueue.js";
import type * as heartbeat from "../heartbeat.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as office from "../office.js";
import type * as runs from "../runs.js";
import type * as scheduledTasks from "../scheduledTasks.js";
import type * as search from "../search.js";
import type * as standup from "../standup.js";
import type * as taskBoard from "../taskBoard.js";
import type * as tasks from "../tasks.js";
import type * as teamMembers from "../teamMembers.js";
import type * as threadSubscriptions from "../threadSubscriptions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  activityEvents: typeof activityEvents;
  agents: typeof agents;
  documents: typeof documents;
  followUpQueue: typeof followUpQueue;
  heartbeat: typeof heartbeat;
  messages: typeof messages;
  notifications: typeof notifications;
  office: typeof office;
  runs: typeof runs;
  scheduledTasks: typeof scheduledTasks;
  search: typeof search;
  standup: typeof standup;
  taskBoard: typeof taskBoard;
  tasks: typeof tasks;
  teamMembers: typeof teamMembers;
  threadSubscriptions: typeof threadSubscriptions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
