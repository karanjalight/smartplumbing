import { describe, expect, it } from "vitest";

import {
  decodeAxdrValue,
  parseOnlineStatusString,
  parseRelayStatusResponse,
} from "@/lib/longi-vending";

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

describe("decodeAxdrValue", () => {
  it("decodes null", () => {
    expect(decodeAxdrValue("00")).toEqual({ type: "null", value: null });
  });

  it("decodes boolean true and false", () => {
    expect(decodeAxdrValue("0301")).toEqual({ type: "boolean", value: true });
    expect(decodeAxdrValue("0300")).toEqual({ type: "boolean", value: false });
  });

  it("decodes double-long (signed 4-byte) as -100", () => {
    expect(decodeAxdrValue("05FFFFFF9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes double-long-unsigned (unsigned 4-byte) as 100", () => {
    expect(decodeAxdrValue("0600000064")).toEqual({ type: "number", value: 100 });
  });

  it("decodes octet-string as a hex string", () => {
    expect(decodeAxdrValue("090405060708")).toEqual({ type: "string", value: "05060708" });
  });

  it("decodes visible-string as ASCII text", () => {
    expect(decodeAxdrValue("0A0548656C6C6F")).toEqual({ type: "string", value: "Hello" });
  });

  it("decodes integer (signed 1-byte) as -100", () => {
    expect(decodeAxdrValue("0F9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes long (signed 2-byte) as -100", () => {
    expect(decodeAxdrValue("10FF9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes unsigned (unsigned 1-byte) as 100", () => {
    expect(decodeAxdrValue("1164")).toEqual({ type: "number", value: 100 });
  });

  it("decodes long-unsigned (unsigned 2-byte) as 100", () => {
    expect(decodeAxdrValue("120064")).toEqual({ type: "number", value: 100 });
  });

  it("decodes long64 (signed 8-byte) as -100", () => {
    expect(decodeAxdrValue("14FFFFFFFFFFFFFF9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes long64-unsigned (unsigned 8-byte) as 100", () => {
    expect(decodeAxdrValue("150000000000000064")).toEqual({ type: "number", value: 100 });
  });

  it("decodes enum as its numeric value", () => {
    expect(decodeAxdrValue("1601")).toEqual({ type: "number", value: 1 });
  });

  it("decodes float32 as approximately 100.55", () => {
    const result = decodeAxdrValue("1742C9199A");
    expect(result?.type).toBe("number");
    expect((result as { type: "number"; value: number }).value).toBeCloseTo(100.55, 1);
  });

  it("decodes float64 as approximately 100.55", () => {
    const result = decodeAxdrValue("184059233333333333");
    expect(result?.type).toBe("number");
    expect((result as { type: "number"; value: number }).value).toBeCloseTo(100.55, 1);
  });

  it("decodes an unrecognized-but-well-formed tag as unsupported", () => {
    expect(decodeAxdrValue("1907E5030404")).toEqual({ type: "unsupported", tag: 25 });
  });

  it("returns null for empty input", () => {
    expect(decodeAxdrValue("")).toBeNull();
  });

  it("returns null for odd-length hex", () => {
    expect(decodeAxdrValue("0")).toBeNull();
  });

  it("returns null when a fixed-size value is truncated", () => {
    // double-long (tag 05) needs 4 value bytes, only 1 given
    expect(decodeAxdrValue("05FF")).toBeNull();
  });

  it("returns null when a length-prefixed value's length points past the buffer", () => {
    // octet-string (tag 09) claims length 5 but supplies 0 following bytes
    expect(decodeAxdrValue("0905")).toBeNull();
  });
});
