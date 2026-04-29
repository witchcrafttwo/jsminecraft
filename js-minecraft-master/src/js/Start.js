import Minecraft from './net/minecraft/client/Minecraft.js';
import * as aesjs from '../../libraries/aes.js';
import Block from './net/minecraft/client/world/block/Block.js';
import { BlockRegistry } from './net/minecraft/client/world/block/BlockRegistry.js';
import EnumSkyBlock from './net/minecraft/util/EnumSkyBlock.js';
BlockRegistry.create();  // ← 必




BlockRegistry.create();
console.log("✅ BlockRegistry.create() 呼び出し完了");

class Start {

    loadTextures(textures) {
        let resources = [];
        let index = 0;

        return textures.reduce((currentPromise, texturePath) => {
            return currentPromise.then(() => {
                return new Promise((resolve, reject) => {
                    // Load texture
                    let image = new Image();
                    image.src = "src/resources/" + texturePath;
                    image.onload = () => resolve();
                    resources[texturePath] = image;

                    index++;
                });
            });
        }, Promise.resolve()).then(() => {
            return resources;
        });
    }

    launch(canvasWrapperId) {
        this.loadTextures([
            "misc/grasscolor.png",
            "gui/font.png",
            "gui/gui.png",
            "gui/background.png",
            "gui/icons.png",
            "terrain/terrain.png",
            "terrain/sun.png",
            "terrain/moon.png",
            "char.png",
            "gui/title/minecraft.png",
            "gui/title/background/panorama_0.png",
            "gui/title/background/panorama_1.png",
            "gui/title/background/panorama_2.png",
            "gui/title/background/panorama_3.png",
            "gui/title/background/panorama_4.png",
            "gui/title/background/panorama_5.png",
            "gui/container/creative.png"
        ]).then((resources) => {
            // Launch actual game on canvas
            window.app = new Minecraft(canvasWrapperId, resources);
        });
    }
}

// Listen on history back
window.addEventListener('pageshow', function (event) {
    if (window.app) {
        // Reload page to restart the game
        if (!window.app.running) {
            window.location.reload();
        }
    } else {
        // Launch game
        new Start().launch("canvas-container");
    }
});

export function require(module) {
    return window[module];
}

function exportSave() {
  if (!window.app || !window.app.player || !window.app.world) {
    alert("ゲームがまだ読み込まれていません！");
    return;
  }

  const saveData = {
    player: {
      x: window.app.player.x,
      y: window.app.player.y,
      z: window.app.player.z,
      inventory: window.app.player.inventory
    },
    blocks: getAllBlockStates(window.app.world)
  };
  console.log("📦 セーブ直前の saveData.blocks 件数:", Object.keys(saveData.blocks).length);
  const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "save.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importSave(event) {
  const player = window.app.player;
player.x = -8;
player.y = 20;
player.z = -8;

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);  // ✅ dataはここで定義される
      const player = window.app.player;
      const world = window.app.world;

      // ✅ プレイヤー位置
      if (data.player) {
        player.x = data.player.x;
        player.y = data.player.y;
        player.z = data.player.z;

        const inv = player.inventory;
        for (let i in data.player.inventory) {
          inv.setItem?.(i, data.player.inventory[i]);
        }
      }

      // ✅ ブロック配置
      if (data.blocks) {
        console.log("✅ ロードブロック数:", Object.keys(data.blocks).length);
        loadAllBlockStates(world, data.blocks);

        // ✅ 描画再構築
        world.minecraft.worldRenderer.rebuildAll();
      } else {
        console.warn("❗ セーブデータに blocks が見つかりません");
      }

      alert("セーブデータを読み込みました！");
    } catch (err) {
      alert("ロード失敗: " + err.message);
      console.error(err);
    }
  };

  reader.readAsText(file); // ✅ ここが非同期 → reader.onload で data が渡される
}


// 以下はそのまま使ってOK
function getAllBlockStates(world) {
  const result = {};
  const chanker = 5
  // 🔽 範囲を -1〜1 チャンクのみに制限（合計 3×3＝9チャンク）
  for (let cx = -chanker; cx <= chanker; cx++) {
    for (let cz = -chanker; cz <= chanker; cz++) {
      const chunk = world.getChunkAt(cx, cz);
      if (!chunk) continue;

      for (let sy = 0; sy < 8; sy++) {
        const section = chunk.getSection(sy);
        if (!section) continue;

        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            for (let z = 0; z < 16; z++) {
              const id = section.getBlockAt(x, y, z);
              if (id === 0) continue;

              const block = Block.getById(id);
              if (!block) {
                console.warn(`未登録ブロックID: ${id}`);
                continue;
              }

              const wx = (cx << 4) + x;
              const wy = (sy << 4) + y;
              const wz = (cz << 4) + z;
              const name = typeof block.name === "string" ? block.name : (block.constructor?.name || "unknown");
              const data = section.getBlockDataAt(x, y, z);
              result[`${wx},${wy},${wz}`] = data === undefined || data === 0 ? block.id : {
                id: block.id,
                data
              };

            }
          }
        }
      }
    }
  }

  console.log("🟢 セーブ対象ブロック数:", Object.keys(result).length);
  return result;
}
function loadAllBlockStates(world, savedBlocks) {
  let placed = 0;
  let skipped = 0;
  const touchedChunks = new Map();
  const placedBlocks = [];

  for (const key in savedBlocks) {
    const [x, y, z] = key.split(",").map(Number);
    const state = savedBlocks[key];
    const hasSavedData = typeof state === "object" && state !== null && "data" in state;
    const id = typeof state === "object" && state !== null ? state.id : state;
    const data = hasSavedData ? state.data : 0;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      skipped++;
      continue;
    }

    if (!Block.getById(id)) {
      console.warn(`Missing block id ${id}`);
      skipped++;
      continue;
    }

    const chunkX = x >> 4;
    const chunkZ = z >> 4;
    const chunkKey = `${chunkX},${chunkZ}`;
    let chunk = touchedChunks.get(chunkKey);

    if (!chunk) {
      chunk = world.getChunkAt(chunkX, chunkZ);
      if (!chunk) {
        console.warn(`Missing chunk: (${chunkX}, ${chunkZ})`);
        skipped++;
        continue;
      }

      clearChunkForSaveLoad(chunk);
      touchedChunks.set(chunkKey, chunk);
    }

    const section = chunk.getSection(y >> 4);
    if (!section) {
      skipped++;
      continue;
    }

    section.setBlockAt(x & 15, y & 15, z & 15, id);
    section.setBlockDataAt(x & 15, y & 15, z & 15, data);
    placedBlocks.push({x, y, z, id, hasSavedData});
    placed++;
  }

  for (const savedBlock of placedBlocks) {
    if (savedBlock.hasSavedData) {
      continue;
    }

    const block = Block.getById(savedBlock.id);
    block?.onBlockAdded(world, savedBlock.x, savedBlock.y, savedBlock.z);
  }

  const chunksToRefresh = relightChunksAfterSaveLoad(world, touchedChunks, placedBlocks);

  if (world.minecraft?.worldRenderer) {
    const renderer = world.minecraft.worldRenderer;
    for (const chunk of chunksToRefresh.values()) {
      chunk.rebuild(renderer);
    }
    renderer.rebuildAll();
    renderer.flushRebuild = true;
  }

  console.log(`Loaded ${placed} blocks from save data`);
  console.log(`Skipped ${skipped} blocks while loading save data`);
}

function clearChunkForSaveLoad(chunk) {
  const maxSections = Math.min(8, chunk.sections.length);

  for (let sy = 0; sy < maxSections; sy++) {
    const section = chunk.getSection(sy);
    if (!section) {
      continue;
    }

    section.blocks = [];
    section.blocksData = [];
    section.blockLight = [];
    section.skyLight = [];
    section.empty = true;
    section.isModified = true;
  }
}

function relightChunksAfterSaveLoad(world, touchedChunks, placedBlocks) {
  world.lightUpdateQueue = [];

  const chunksToRelight = new Map(touchedChunks);
  for (const key of touchedChunks.keys()) {
    const [chunkX, chunkZ] = key.split(",").map(Number);
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
        const relightX = chunkX + offsetX;
        const relightZ = chunkZ + offsetZ;
        const relightKey = `${relightX},${relightZ}`;
        if (!chunksToRelight.has(relightKey) && world.chunkExists(relightX, relightZ)) {
          chunksToRelight.set(relightKey, world.getChunkAt(relightX, relightZ));
        }
      }
    }
  }

  for (const chunk of chunksToRelight.values()) {
    for (const section of chunk.sections) {
      if (!section) {
        continue;
      }
      section.skyLight = [];
      section.blockLight = [];
    }

    chunk.generateSkylightMap();
    chunk.generateBlockLightMap();
    chunk.setModifiedAllSections();
  }

  spreadBlockLightsAfterSaveLoad(world, placedBlocks);

  let processedLightUpdates = 0;
  while (world.lightUpdateQueue.length > 0 && processedLightUpdates < 50000) {
    const update = world.lightUpdateQueue.shift();
    update.updateBlockLightning(world);
    processedLightUpdates++;
  }

  if (world.lightUpdateQueue.length > 0) {
    console.warn("Light update queue grew large during save load; remaining updates will continue in the background.");
  }

  return chunksToRelight;
}

function spreadBlockLightsAfterSaveLoad(world, placedBlocks) {
  const queue = [];
  const directions = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ];

  for (const savedBlock of placedBlocks) {
    const block = Block.getById(savedBlock.id);
    const lightLevel = block === null ? 0 : block.getLightValue();
    if (lightLevel <= 0) {
      continue;
    }

    setBlockLightDirect(world, savedBlock.x, savedBlock.y, savedBlock.z, lightLevel);
    queue.push({
      x: savedBlock.x,
      y: savedBlock.y,
      z: savedBlock.z,
      light: lightLevel
    });
  }

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];

    for (const direction of directions) {
      const x = current.x + direction[0];
      const y = current.y + direction[1];
      const z = current.z + direction[2];

      if (!world.blockExists(x, y, z)) {
        continue;
      }

      const typeId = world.getBlockAt(x, y, z);
      const block = typeId === 0 ? null : Block.getById(typeId);
      let opacity = typeId === 0 || block === null ? 1 : Math.round(block.getOpacity() * 255);
      if (opacity === 0) {
        opacity = 1;
      }

      const nextLight = current.light - opacity;
      if (nextLight <= 0 || world.getSavedLightValue(EnumSkyBlock.BLOCK, x, y, z) >= nextLight) {
        continue;
      }

      setBlockLightDirect(world, x, y, z, nextLight);
      queue.push({x, y, z, light: nextLight});
    }
  }
}

function setBlockLightDirect(world, x, y, z, lightLevel) {
  if (!world.blockExists(x, y, z)) {
    return;
  }

  const section = world.getChunkSectionAt(x >> 4, y >> 4, z >> 4);
  section.setLightAt(EnumSkyBlock.BLOCK, x & 15, y & 15, z & 15, lightLevel);
}

window.loadAllBlockStates = loadAllBlockStates;

document.getElementById("loadWorldFile")?.addEventListener("change", (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      window.selectedSaveData = data;
      alert("セーブデータを読み込みました！『Create World』を押してください");
    } catch (err) {
      alert("ロード失敗：" + err.message);
    }
  };
  reader.readAsText(file);
});


// イベント登録（type=module対応）
document.getElementById("saveBtn")?.addEventListener("click", exportSave);
document.getElementById("loadFile")?.addEventListener("change", importSave);
