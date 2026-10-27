import { beforeEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "@/app/api/notifications/preferences/route";
import { alice, jsonRequest, readJson, signInAs } from "./helpers/session";

type Preferences = { randomAlertsEnabled: boolean; randomAlertsPerDay: number; awakeStart: string; awakeEnd: string; dailyDigestEnabled: boolean };
const read = async () => (await readJson<{ preferences: Preferences }>(await GET())).preferences;
const patch = (body: unknown) => PATCH(jsonRequest("/api/notifications/preferences", "PATCH", body));

describe("notification preferences API", () => {
  beforeEach(() => signInAs(alice));

  it("requires sign-in", async () => {
    await signInAs(null);
    expect((await GET()).status).toBe(401);
    expect((await patch({ randomAlertsEnabled: false })).status).toBe(401);
  });

  it("gives new people random check-ins by default, 3 a day between 08:00 and 21:00", async () => {
    expect(await read()).toMatchObject({ randomAlertsEnabled: true, randomAlertsPerDay: 3, awakeStart: "08:00", awakeEnd: "21:00", dailyDigestEnabled: false });
  });

  it("turns random check-ins off and back on without touching other settings", async () => {
    expect((await readJson<{ preferences: Preferences }>(await patch({ randomAlertsEnabled: false }))).preferences).toMatchObject({ randomAlertsEnabled: false, randomAlertsPerDay: 3 });
    expect((await read()).randomAlertsEnabled).toBe(false);
    expect((await readJson<{ preferences: Preferences }>(await patch({ randomAlertsEnabled: true, dailyDigestEnabled: true }))).preferences).toMatchObject({ randomAlertsEnabled: true, dailyDigestEnabled: true });
  });

  it("saves how many a day and the awake hours", async () => {
    expect((await readJson<{ preferences: Preferences }>(await patch({ randomAlertsPerDay: 5, awakeStart: "07:30", awakeEnd: "22:00" }))).preferences).toMatchObject({ randomAlertsPerDay: 5, awakeStart: "07:30", awakeEnd: "22:00" });
  });

  it("rejects values that make no sense", async () => {
    for (const bad of [{ randomAlertsPerDay: 0 }, { randomAlertsPerDay: 6 }, { randomAlertsPerDay: 2.5 }, { randomAlertsPerDay: "3" }, { awakeStart: "8am" }, { awakeEnd: "25:00" }, { awakeStart: "10:00", awakeEnd: "12:00" }, { awakeStart: "22:00", awakeEnd: "08:00" }]) {
      expect((await patch(bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("checks a new start time against the saved end time", async () => {
    await patch({ awakeStart: "08:00", awakeEnd: "21:00" });
    expect((await patch({ awakeStart: "20:00" })).status).toBe(400);
    expect((await patch({ awakeStart: "09:00" })).status).toBe(200);
  });
});
