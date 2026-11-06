// File-name cleaning, type and size rules, storage paths and delete rule for attachments.
import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, canDeleteAttachment, checkUpload, formatBytes, sanitizeFileName, storagePathFor } from "../src/lib/attachments";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0x20)]).subarray(0, 16);

describe("sanitizeFileName", () => {
  it("drops folders and traversal", () => {
    expect(sanitizeFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeFileName("C:\\Users\\me\\Quote.pdf")).toBe("Quote.pdf");
  });
  it("replaces odd characters and control characters", () => {
    expect(sanitizeFileName("pro<po>sal\u0000 v2?.pdf")).toBe("pro_po_sal v2_.pdf");
  });
  it("removes leading dots and falls back when nothing is left", () => {
    expect(sanitizeFileName(".htaccess")).toBe("htaccess");
    expect(sanitizeFileName("???.pdf")).toBe("file.pdf");
    expect(sanitizeFileName("")).toBe("file");
  });
  it("keeps the extension when the name is long", () => {
    const out = sanitizeFileName(`${"a".repeat(300)}.xlsx`);
    expect(out.endsWith(".xlsx")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(106);
  });
});

describe("checkUpload", () => {
  it("accepts a real PDF and stores our own MIME type", () => {
    const r = checkUpload("a.PDF", 100, bytes(0x25, 0x50, 0x44, 0x46));
    expect(r).toMatchObject({ ok: true, mime: "application/pdf" });
  });
  it("accepts text without NUL bytes and refuses binary posing as text", () => {
    expect(checkUpload("a.csv", 10, bytes(0x61, 0x2c, 0x62)).ok).toBe(true);
    expect(checkUpload("a.txt", 10, bytes(0x61, 0x00)).ok).toBe(false);
  });
  it("refuses a file whose content does not match its extension", () => {
    expect(checkUpload("evil.pdf", 100, bytes(0x4d, 0x5a)).ok).toBe(false); // an .exe renamed
    expect(checkUpload("x.png", 100, bytes(0xff, 0xd8, 0xff)).ok).toBe(false);
  });
  it("refuses types that are not on the list", () => {
    for (const n of ["a.exe", "a.html", "a.svg", "a.js", "noext"]) expect(checkUpload(n, 10, bytes(0x25, 0x50, 0x44, 0x46)).ok).toBe(false);
  });
  it("enforces the size limit and refuses empty files", () => {
    expect(checkUpload("a.pdf", MAX_ATTACHMENT_BYTES, bytes(0x25, 0x50, 0x44, 0x46)).ok).toBe(true);
    expect(checkUpload("a.pdf", MAX_ATTACHMENT_BYTES + 1, bytes(0x25, 0x50, 0x44, 0x46)).ok).toBe(false);
    expect(checkUpload("a.pdf", 0, bytes(0x25, 0x50, 0x44, 0x46)).ok).toBe(false);
  });
  it("checks the WEBP and Office signatures", () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
    expect(checkUpload("a.webp", 50, webp).ok).toBe(true);
    expect(checkUpload("a.docx", 50, bytes(0x50, 0x4b, 0x03, 0x04)).ok).toBe(true);
    expect(checkUpload("a.xls", 50, bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)).ok).toBe(true);
  });
});

describe("paths, sizes and delete rule", () => {
  it("builds the storage path", () => {
    expect(storagePathFor("w", "contact", "r", "u", "f.pdf")).toBe("w/contact/r/u-f.pdf");
  });
  it("formats sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("lets the uploader, managers and CEO/Admin delete, nobody else", () => {
    expect(canDeleteAttachment("sales_bd", "u1", "u1")).toBe(true);
    expect(canDeleteAttachment("sales_bd", "u1", "u2")).toBe(false);
    expect(canDeleteAttachment("data_researcher", "u1", "u2")).toBe(false);
    expect(canDeleteAttachment("manager", "u1", "u2")).toBe(true);
    expect(canDeleteAttachment("ceo_admin", "u1", "u2")).toBe(true);
  });
});
