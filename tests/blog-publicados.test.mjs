import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

test("las páginas leen el blog con getPublishedPosts, no con getCollection('blog')", () => {
  const directos = archivos("src/pages")
    .filter((ruta) => /getCollection\(\s*["']blog["']/.test(readFileSync(ruta, "utf8")));
  assert.deepEqual(directos, [], "un post con pubDate futuro se publicaría antes de su día");
});
