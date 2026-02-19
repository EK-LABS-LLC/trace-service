import { getRuntimeServices } from "../runtime/services";

const authSchema = getRuntimeServices().authSchema;

export const user = authSchema.user;
export const authSession = authSchema.authSession;
export const account = authSchema.account;
export const verification = authSchema.verification;
