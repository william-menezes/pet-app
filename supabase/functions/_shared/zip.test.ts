import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { crc32, zipStore } from "./zip.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

Deno.test("crc32: vetor padrao '123456789' = CBF43926", () => {
  assertEquals(crc32(enc.encode("123456789")), 0xcbf43926);
  assertEquals(crc32(new Uint8Array()), 0);
});

Deno.test("zipStore: le de volta nomes, tamanhos, CRC e conteudo pelo diretorio central", () => {
  const files = [
    { name: "pins.csv", data: enc.encode("code,pin\nABCD-EFGH-V,K47Q9M\n") },
    { name: "leia-me.txt", data: enc.encode("áéí") },
  ];
  const zip = zipStore(files, new Date(Date.UTC(2026, 10, 24, 12, 30, 0)));
  const v = new DataView(zip.buffer);
  const end = zip.length - 22;
  assertEquals(v.getUint32(end, true), 0x06054b50);
  assertEquals(v.getUint16(end + 10, true), 2);
  let p = v.getUint32(end + 16, true);
  for (const f of files) {
    assertEquals(v.getUint32(p, true), 0x02014b50);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const off = v.getUint32(p + 42, true);
    assertEquals(dec.decode(zip.slice(p + 46, p + 46 + nameLen)), f.name);
    assertEquals(size, f.data.length);
    assertEquals(crc, crc32(f.data));
    assertEquals(v.getUint32(off, true), 0x04034b50);
    const lNameLen = v.getUint16(off + 26, true);
    const dataStart = off + 30 + lNameLen;
    assertEquals(zip.slice(dataStart, dataStart + size), f.data);
    p += 46 + nameLen;
  }
});

Deno.test("zipStore: sem arquivos produz so o registro final", () => {
  assertEquals(zipStore([]).length, 22);
});
