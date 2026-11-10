import vm from "node:vm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
export function fixture() {
  const sheets = new Map(),
    props = {
      SPREADSHEET_ID: "db",
      TEACHER_EMAILS: "teacher@example.com",
      IMAGE_FOLDER_ID: "images",
    },
    cache = new Map();
  let email = "teacher@example.com";
  class Sheet {
    constructor() {
      this.rows = [];
    }
    appendRow(row) {
      this.rows.push(row);
      return this;
    }
    getLastRow() {
      return this.rows.length;
    }
    getDataRange() {
      return { getValues: () => this.rows.map((r) => [...r]) };
    }
    getRange(row, col, nr = 1, nc = 1) {
      if (typeof row === "string")
        return {
          createTextFinder: (needle) => ({
            matchEntireCell() {
              return this;
            },
            findNext: () => {
              const i = this.rows.findIndex((r) => r[0] === needle);
              return i < 0 ? null : { getRow: () => i + 1 };
            },
          }),
        };
      return {
        getValues: () =>
          Array.from({ length: nr }, (_, i) =>
            Array.from(
              { length: nc },
              (_, j) => this.rows[row + i - 1]?.[col + j - 1] || "",
            ),
          ),
        getValue: () => this.rows[row - 1][col - 1],
        setValue: (v) => (this.rows[row - 1][col - 1] = v),
        setValues: (values) =>
          values.forEach((r, i) => {
            this.rows[row + i - 1] ||= [];
            r.forEach((v, j) => (this.rows[row + i - 1][col + j - 1] = v));
          }),
      };
    }
  }
  const db = {
    getSheetByName: (n) => sheets.get(n),
    insertSheet: (n) => {
      const s = new Sheet();
      sheets.set(n, s);
      return s;
    },
  };
  const metrics = {
    driveReads: 0,
    blobReads: 0,
    lockDepth: 0,
    driveWhileLocked: 0,
  };
  const files = new Map();
  const folder = {
    getId: () => "images",
    createFile: (blob) => {
      const id = "image_" + randomUUID();
      const file = {
        getId: () => id,
        getParents: () => {
          let done = false;
          return {
            hasNext: () => !done,
            next: () => {
              done = true;
              return folder;
            },
          };
        },
        isTrashed: () => false,
        getMimeType: () => blob.getContentType(),
        getSize: () => blob.getBytes().length,
        getBlob: () => {
          metrics.blobReads++;
          return blob;
        },
      };
      files.set(id, file);
      return file;
    },
  };
  const c = vm.createContext({
    console,
    Date,
    JSON,
    Math,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (n) => props[n] }),
    },
    Session: { getActiveUser: () => ({ getEmail: () => email }) },
    SpreadsheetApp: { openById: () => db },
    LockService: {
      getScriptLock: () => ({
        waitLock() {
          metrics.lockDepth++;
        },
        releaseLock() {
          metrics.lockDepth--;
        },
      }),
    },
    DriveApp: {
      getFolderById: () => folder,
      getFileById: (id) => {
        metrics.driveReads++;
        if (metrics.lockDepth) metrics.driveWhileLocked++;
        if (!files.has(id)) throw Error("Image not found");
        return files.get(id);
      },
    },
    Utilities: {
      getUuid: randomUUID,
      base64Decode: (s) => Array.from(Buffer.from(s, "base64")),
      base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
      newBlob: (bytes, mime) => ({
        getBytes: () => bytes,
        getContentType: () => mime,
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k),
        put: (k, v) => cache.set(k, v),
        getAll: (keys) =>
          Object.fromEntries(
            keys
              .filter((key) => cache.has(key))
              .map((key) => [key, cache.get(key)]),
          ),
        putAll: (values) => {
          Object.entries(values).forEach(([key, value]) => {
            if (value.length > 100000) throw Error("Cache entry too large");
            cache.set(key, value);
          });
        },
      }),
    },
  });
  vm.runInContext(
    readFileSync(new URL("../backend/Seed.gs", import.meta.url), "utf8") +
      "\n" +
      readFileSync(new URL("../backend/Code.gs", import.meta.url), "utf8"),
    c,
  );
  c.initialize();
  return { c, sheets, metrics, files, cache, setEmail: (e) => (email = e) };
}
