import { promises as fs } from 'node:fs';
import path from 'node:path';

var rootDir = process.cwd();
var productsDir = path.join(rootDir, 'assets', 'images', 'products');
var outputFile = path.join(rootDir, 'js', 'product-images.js');
var allowedExtensions = new Set(['.jpeg', '.jpg', '.png', '.webp']);

async function readProductImages() {
  var manifest = {};
  var entries = await fs.readdir(productsDir, { withFileTypes: true });

  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    if (!entry.isDirectory()) continue;

    var productId = entry.name;
    var productPath = path.join(productsDir, productId);
    var files = await fs.readdir(productPath, { withFileTypes: true });
    var imagePaths = files
      .filter(function(file) {
        return file.isFile() && allowedExtensions.has(path.extname(file.name).toLowerCase());
      })
      .map(function(file) {
        return 'assets/images/products/' + productId + '/' + file.name;
      })
      .sort();

    manifest[productId] = imagePaths;
  }

  return manifest;
}

async function writeManifest() {
  var manifest = await readProductImages();
  var contents = [
    'window.YOSHA_PRODUCT_IMAGES = ' + JSON.stringify(manifest, null, 2) + ';',
    ''
  ].join('\n');

  await fs.writeFile(outputFile, contents, 'utf8');
  console.log('Wrote ' + path.relative(rootDir, outputFile));
}

writeManifest().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
