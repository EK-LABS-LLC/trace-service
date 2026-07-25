import { getRuntimeServices } from "../runtime/services";

const schema = getRuntimeServices().schema;

export const projects = schema.projects;
export const apiKeys = schema.apiKeys;
export const userProjects = schema.userProjects;
export const spans = schema.spans;

export type ProjectRole = "admin" | "user";
export type Project = any;
export type NewProject = any;
export type ApiKey = any;
export type NewApiKey = any;
export type UserProject = any;
export type NewUserProject = any;
export type Span = any;
export type NewSpan = any;
