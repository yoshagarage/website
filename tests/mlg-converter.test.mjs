import assert from "node:assert/strict";
import test from "node:test";

import {
  MlgConversionError,
  convertMlgToMsl,
  getMslFilename,
} from "../js/mlg-converter.mjs";

function writeCString(bytes, offset, length, value) {
  const encoded = new TextEncoder().encode(value);
  bytes.set(encoded.subarray(0, Math.max(0, length - 1)), offset);
}

function buildTestMlg() {
  const fieldCount = 3;
  const definitionsEnd = 24 + fieldCount * 89;
  const bitNames = new TextEncoder().encode("INVALID\0Engine Prot. MAP\0");
  const dataStart = definitionsEnd + bitNames.length;
  const recordLength = 7;
  const blockLength = recordLength + 5;
  const buffer = new ArrayBuffer(dataStart + blockLength * 2);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  bytes.set([0x4d, 0x4c, 0x56, 0x4c, 0x47, 0x00], 0);
  view.setUint16(6, 2, false);
  view.setUint32(16, dataStart, false);
  view.setUint16(20, recordLength, false);
  view.setUint16(22, fieldCount, false);

  const timeDefinition = 24;
  view.setUint8(timeDefinition, 4);
  writeCString(bytes, timeDefinition + 1, 34, "Time");
  writeCString(bytes, timeDefinition + 35, 10, "s");
  view.setFloat32(timeDefinition + 46, 0.001, false);
  view.setFloat32(timeDefinition + 50, 0, false);
  view.setInt8(timeDefinition + 54, 3);

  const rpmDefinition = timeDefinition + 89;
  view.setUint8(rpmDefinition, 2);
  writeCString(bytes, rpmDefinition + 1, 34, "RPM");
  writeCString(bytes, rpmDefinition + 35, 10, "rpm");
  view.setFloat32(rpmDefinition + 46, 1, false);
  view.setFloat32(rpmDefinition + 50, 0, false);
  view.setInt8(rpmDefinition + 54, 0);

  const bitfieldDefinition = rpmDefinition + 89;
  view.setUint8(bitfieldDefinition, 16);
  view.setUint32(bitfieldDefinition + 47, definitionsEnd, false);
  view.setUint8(bitfieldDefinition + 51, 2);
  bytes.set(bitNames, definitionsEnd);

  const records = [
    { counter: 5, time: 1234, rpm: 3000, status: 0 },
    { counter: 7, time: 1300, rpm: 3100, status: 2 },
  ];
  records.forEach((record, index) => {
    const position = dataStart + index * blockLength;
    view.setUint8(position, 0);
    view.setUint8(position + 1, record.counter);
    view.setUint16(position + 2, index, false);
    view.setUint32(position + 4, record.time, false);
    view.setUint16(position + 8, record.rpm, false);
    view.setUint8(position + 10, record.status);
    let crc = 0;
    for (let byteIndex = 0; byteIndex < recordLength; byteIndex += 1) {
      crc = (crc + bytes[position + 4 + byteIndex]) & 0xff;
    }
    view.setUint8(position + 11, index === 1 ? (crc + 1) & 0xff : crc);
  });

  return buffer;
}

test("converts MLVLG v2 records and named status bits to MSL", () => {
  const result = convertMlgToMsl(buildTestMlg());

  assert.equal(result.recordCount, 2);
  assert.equal(result.channelCount, 3);
  assert.equal(result.badCrcCount, 1);
  assert.equal(result.counterGapCount, 1);
  assert.equal(
    result.msl,
    [
      "Time\tRPM\tEngine Prot. MAP",
      "s\trpm\t",
      "1.234\t3000\t0",
      "1.300\t3100\t1",
      "",
    ].join("\n"),
  );
});

test("rejects files without the MLVLG signature", () => {
  assert.throws(
    () => convertMlgToMsl(new ArrayBuffer(24)),
    (error) => error instanceof MlgConversionError && /not an EFI Analytics MLG/.test(error.message),
  );
});

test("derives a safe MSL download filename", () => {
  assert.equal(getMslFilename("pull.MLG"), "pull.msl");
  assert.equal(getMslFilename("pull.bin"), "pull.bin.msl");
});
