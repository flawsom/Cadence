/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as answers from "../answers.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as crons from "../crons.js";
import type * as evaluateAnswer from "../evaluateAnswer.js";
import type * as evaluateOffline from "../evaluateOffline.js";
import type * as http from "../http.js";
import type * as lib from "../lib.js";
import type * as mailer from "../mailer.js";
import type * as plans from "../plans.js";
import type * as pods from "../pods.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as welcome from "../welcome.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  answers: typeof answers;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  crons: typeof crons;
  evaluateAnswer: typeof evaluateAnswer;
  evaluateOffline: typeof evaluateOffline;
  http: typeof http;
  lib: typeof lib;
  mailer: typeof mailer;
  plans: typeof plans;
  pods: typeof pods;
  tasks: typeof tasks;
  users: typeof users;
  welcome: typeof welcome;
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
