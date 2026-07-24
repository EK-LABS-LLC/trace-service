import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";

const databases: Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
});

describe("legacy trace table migration", () => {
  test("drops traces before sessions and preserves spans", async () => {
    const database = new Database(":memory:");
    databases.push(database);
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE projects (id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id)
      );
      CREATE TABLE traces (
        trace_id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id),
        session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL
      );
      CREATE TABLE spans (
        span_id TEXT PRIMARY KEY NOT NULL,
        trace_id TEXT,
        project_id TEXT NOT NULL REFERENCES projects(id),
        session_id TEXT NOT NULL
      );
      INSERT INTO projects (id) VALUES ('project-1');
      INSERT INTO sessions (id, project_id) VALUES ('session-1', 'project-1');
      INSERT INTO traces (trace_id, project_id, session_id)
        VALUES ('trace-1', 'project-1', 'session-1');
      INSERT INTO spans (span_id, trace_id, project_id, session_id)
        VALUES ('span-1', 'trace-1', 'project-1', 'session-1');
    `);

    const migration = await Bun.file(
      new URL("../drizzle/0003_serious_guardsmen.sql", import.meta.url),
    ).text();
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }

    const tables = database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      )
      .all()
      .map(({ name }) => name);
    const span = database
      .query<{ span_id: string; trace_id: string }, []>(
        "SELECT span_id, trace_id FROM spans",
      )
      .get();

    expect(tables).not.toContain("traces");
    expect(tables).not.toContain("sessions");
    expect(span).toEqual({ span_id: "span-1", trace_id: "trace-1" });
  });
});
