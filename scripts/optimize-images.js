const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const outputDir = path.join(root, "public", "assets");

const images = [
  {
    input: "logo_1757914521356--Bodoo3y.png",
    output: "logo.webp",
    width: 240,
    quality: 88,
  },
  {
    input: "luxury_bathroom_hero_image_d06ca2ad-BRu9mhtY.png",
    output: "hero-bathroom.webp",
    width: 1600,
    quality: 78,
  },
  {
    input: "Professional Kitchen Faucet_1757915501686-qDncg0hK.png",
    output: "professional-kitchen-faucet.webp",
    width: 900,
    quality: 80,
  },
  {
    input: "Satin Finish Kitchen Sink_1757915501686-BvzPqhJl.png",
    output: "satin-finish-kitchen-sink.webp",
    width: 900,
    quality: 80,
  },
  {
    input: "Stainless Steel Kitchen Mixer_1757915501686-BemfgtaI.png",
    output: "stainless-steel-kitchen-mixer.webp",
    width: 900,
    quality: 80,
  },
  {
    input: "Chrome Soap Dispenser_1757915501685-Jawrtdpi.png",
    output: "chrome-soap-dispenser.webp",
    width: 900,
    quality: 80,
  },
  {
    input: path.join("source-images", "tramontina-island-hood.jpg"),
    output: "tramontina-island-hood.webp",
    width: 1000,
    quality: 84,
  },
  {
    input: path.join("source-images", "tramontina-wall-hood.jpg"),
    output: "tramontina-wall-hood.webp",
    width: 1000,
    quality: 84,
  },
  {
    input: path.join("source-images", "tramontina-penta-cooktop.jpg"),
    output: "tramontina-penta-cooktop.webp",
    width: 1000,
    quality: 84,
  },
];

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  for (const image of images) {
    const input = path.join(root, image.input);
    const output = path.join(outputDir, image.output);
    await sharp(input)
      .resize({ width: image.width, withoutEnlargement: true })
      .webp({ quality: image.quality })
      .toFile(output);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
