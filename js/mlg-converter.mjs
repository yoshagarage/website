const TYPE_LAYOUTS = new Map([
  [0, { size: 1, read: (view, offset) => view.getUint8(offset) }],
  [1, { size: 1, read: (view, offset) => view.getInt8(offset) }],
  [2, { size: 2, read: (view, offset) => view.getUint16(offset, false) }],
  [3, { size: 2, read: (view, offset) => view.getInt16(offset, false) }],
  [4, { size: 4, read: (view, offset) => view.getUint32(offset, false) }],
  [5, { size: 4, read: (view, offset) => view.getInt32(offset, false) }],
  [6, { size: 8, read: (view, offset) => Number(view.getBigInt64(offset, false)) }],
  [7, { size: 4, read: (view, offset) => view.getFloat32(offset, false) }],
  [16, { size: 1, read: (view, offset) => view.getUint8(offset) }],
  [17, { size: 2, read: (view, offset) => view.getUint16(offset, false) }],
  [18, { size: 4, read: (view, offset) => view.getUint32(offset, false) }],
]);

const MLG_SIGNATURE = [0x4d, 0x4c, 0x56, 0x4c, 0x47, 0x00];
const FIELD_DEFINITION_SIZE = 89;
const HEADER_SIZE = 24;

export class MlgConversionError extends Error {
  constructor(message) {
    super(message);
    this.name = "MlgConversionError";
  }
}

function assertRange(bufferLength, offset, length, description) {
  if (offset < 0 || length < 0 || offset + length > bufferLength) {
    throw new MlgConversionError(`The MLG ends inside ${description}.`);
  }
}

function readCString(bytes, offset, length) {
  assertRange(bytes.length, offset, length, "a header field");
  const endLimit = offset + length;
  let end = offset;
  while (end < endLimit && bytes[end] !== 0) {
    end += 1;
  }
  let result = "";
  for (let index = offset; index < end; index += 1) {
    result += String.fromCharCode(bytes[index]);
  }
  return result;
}

function readBitNames(bytes, start, count) {
  const names = [];
  let offset = start;
  for (let index = 0; index < count; index += 1) {
    if (offset >= bytes.length) {
      throw new MlgConversionError("A bitfield name points outside the MLG header.");
    }
    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) {
      end += 1;
    }
    if (end === bytes.length) {
      throw new MlgConversionError("A bitfield name is not terminated correctly.");
    }
    names.push(readCString(bytes, offset, end - offset));
    offset = end + 1;
  }
  return names;
}

function validateHeaderText(value, description) {
  if (/\r|\n|\t/.test(value)) {
    throw new MlgConversionError(`${description} contains unsupported control characters.`);
  }
}

function parseFields(view, bytes, fieldCount) {
  const definitionsEnd = HEADER_SIZE + fieldCount * FIELD_DEFINITION_SIZE;
  assertRange(bytes.length, HEADER_SIZE, definitionsEnd - HEADER_SIZE, "the field definitions");

  const fields = [];
  let recordOffset = 0;
  for (let index = 0; index < fieldCount; index += 1) {
    const definitionOffset = HEADER_SIZE + index * FIELD_DEFINITION_SIZE;
    const typeId = view.getUint8(definitionOffset);
    const layout = TYPE_LAYOUTS.get(typeId);
    if (!layout) {
      throw new MlgConversionError(`Unsupported MLG field type ${typeId}.`);
    }

    const originalName = readCString(bytes, definitionOffset + 1, 34);
    const units = readCString(bytes, definitionOffset + 35, 10);
    validateHeaderText(originalName, "A channel name");
    validateHeaderText(units, "A channel unit");

    let scale = 1;
    let transform = 0;
    let digits = 0;
    let bitNames = [];
    if (typeId < 10) {
      scale = view.getFloat32(definitionOffset + 46, false);
      transform = view.getFloat32(definitionOffset + 50, false);
      digits = view.getInt8(definitionOffset + 54);
    } else {
      const bitNamesStart = view.getUint32(definitionOffset + 47, false);
      const bitCount = view.getUint8(definitionOffset + 51);
      bitNames = readBitNames(bytes, bitNamesStart, bitCount);
      bitNames.forEach((name) => validateHeaderText(name, "A bitfield channel name"));
    }

    fields.push({
      name: originalName || `_bitfield_${index}`,
      includeRaw: Boolean(originalName),
      units,
      typeId,
      layout,
      recordOffset,
      scale,
      transform,
      digits,
      bitNames,
    });
    recordOffset += layout.size;
  }
  return { fields, calculatedRecordLength: recordOffset };
}

function buildColumns(fields) {
  const columns = [];
  const names = new Set();
  const addColumn = (column) => {
    if (names.has(column.name)) {
      throw new MlgConversionError(`The MLG contains duplicate channel name “${column.name}”.`);
    }
    names.add(column.name);
    columns.push(column);
  };

  fields.forEach((field, fieldIndex) => {
    if (field.includeRaw) {
      addColumn({
        name: field.name,
        units: field.units,
        digits: field.digits,
        fieldIndex,
        bit: null,
      });
    }
    field.bitNames.forEach((name, bit) => {
      if (name && name !== "INVALID") {
        addColumn({ name, units: "", digits: 0, fieldIndex, bit });
      }
    });
  });
  return columns;
}

function formatValue(value, digits) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const safeDigits = Math.max(0, Math.min(9, digits));
  return safeDigits === 0 ? String(Math.round(value)) : value.toFixed(safeDigits);
}

function readRecordValues(view, fields, dataOffset) {
  return fields.map((field) => {
    const raw = field.layout.read(view, dataOffset + field.recordOffset);
    return {
      raw,
      scaled: (raw + field.transform) * field.scale,
    };
  });
}

function recordToLine(values, columns) {
  return columns.map((column) => {
    const value = values[column.fieldIndex];
    if (column.bit !== null) {
      return (Number(value.raw) & (1 << column.bit)) !== 0 ? "1" : "0";
    }
    return formatValue(value.scaled, column.digits);
  }).join("\t");
}

export function convertMlgToMsl(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new TypeError("Expected the MLG contents as an ArrayBuffer.");
  }
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  assertRange(bytes.length, 0, HEADER_SIZE, "the MLG header");
  if (!MLG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new MlgConversionError("This is not an EFI Analytics MLG file.");
  }

  const version = view.getUint16(6, false);
  if (version !== 2) {
    throw new MlgConversionError(`MLG version ${version} is not supported; this tool currently supports version 2.`);
  }

  const dataStart = view.getUint32(16, false);
  const recordLength = view.getUint16(20, false);
  const fieldCount = view.getUint16(22, false);
  const { fields, calculatedRecordLength } = parseFields(view, bytes, fieldCount);
  if (calculatedRecordLength !== recordLength) {
    throw new MlgConversionError(
      `The channel definitions total ${calculatedRecordLength} bytes, but records declare ${recordLength} bytes.`,
    );
  }
  if (dataStart > bytes.length) {
    throw new MlgConversionError("The MLG data offset is beyond the end of the file.");
  }

  const columns = buildColumns(fields);
  const lines = [
    columns.map((column) => column.name).join("\t"),
    columns.map((column) => column.units).join("\t"),
  ];
  const blockLength = recordLength + 5;
  let position = dataStart;
  let recordCount = 0;
  let badCrcCount = 0;
  let counterGapCount = 0;
  let previousCounter = null;

  while (position + blockLength <= bytes.length) {
    const blockType = view.getUint8(position);
    const counter = view.getUint8(position + 1);
    if (blockType !== 0) {
      throw new MlgConversionError(`Unsupported MLG block type ${blockType} at byte ${position}.`);
    }
    if (previousCounter !== null && counter !== (previousCounter + 1) % 256) {
      counterGapCount += 1;
    }
    previousCounter = counter;

    const dataOffset = position + 4;
    let crc = 0;
    for (let index = 0; index < recordLength; index += 1) {
      crc = (crc + bytes[dataOffset + index]) & 0xff;
    }
    if (crc !== bytes[dataOffset + recordLength]) {
      badCrcCount += 1;
    }

    const values = readRecordValues(view, fields, dataOffset);
    lines.push(recordToLine(values, columns));
    recordCount += 1;
    position += blockLength;
  }

  if (position !== bytes.length) {
    throw new MlgConversionError(`The MLG has ${bytes.length - position} unexpected trailing bytes.`);
  }
  if (recordCount === 0) {
    throw new MlgConversionError("The MLG contains no data records.");
  }

  return {
    msl: `${lines.join("\n")}\n`,
    recordCount,
    channelCount: columns.length,
    badCrcCount,
    counterGapCount,
  };
}

export function getMslFilename(filename) {
  return /\.mlg$/i.test(filename) ? filename.replace(/\.mlg$/i, ".msl") : `${filename}.msl`;
}
