import { describe, expect, it } from "vitest";

import { parseOnlineStatusString, parseRelayStatusResponse } from "@/lib/longi-vending";

describe("parseRelayStatusResponse", () => {
  it("maps positional results onto the requested meter numbers", () => {
    const result = parseRelayStatusResponse(
      [{ dataTmp: "Connected" }, { dataTmp: "Disconnected" }],
      ["meter-1", "meter-2"]
    );
    expect(result).toEqual(
      new Map([
        ["meter-1", "connected"],
        ["meter-2", "disconnected"],
      ])
    );
  });

  it("treats an unrecognized dataTmp value as unknown", () => {
    const result = parseRelayStatusResponse([{ dataTmp: "Weird" }], ["meter-1"]);
    expect(result).toEqual(new Map([["meter-1", "unknown"]]));
  });

  it("returns null on a length mismatch rather than mis-mapping", () => {
    expect(
      parseRelayStatusResponse([{ dataTmp: "Connected" }], ["meter-1", "meter-2"])
    ).toBeNull();
  });

  it("returns null when data is missing", () => {
    expect(parseRelayStatusResponse(undefined, ["meter-1"])).toBeNull();
  });
});

describe("parseOnlineStatusString", () => {
  it("parses a comma-separated meterNo:code list", () => {
    const result = parseOnlineStatusString("0159000000152:0,0159000000165:-2");
    expect(result).toEqual(
      new Map([
        ["0159000000152", "online"],
        ["0159000000165", "offline"],
      ])
    );
  });

  it("treats an unrecognized code as unknown", () => {
    expect(parseOnlineStatusString("0159000000152:-3")).toEqual(
      new Map([["0159000000152", "unknown"]])
    );
  });

  it("returns an empty map for undefined input", () => {
    expect(parseOnlineStatusString(undefined)).toEqual(new Map());
  });
});
