import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// CS2 Skin rarities
const RARITIES = ['consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'contraband'];

// Sample skins data
const SKINS_DATA = [
  // Knives (Contraband/Covert)
  { name: 'Karambit | Gamma Doppler (Emerald)', rarity: 'contraband', weaponType: 'knife', price: 5000 },
  { name: 'Karambit | Fade', rarity: 'covert', weaponType: 'knife', price: 2500 },
  { name: 'M9 Bayonet | Doppler', rarity: 'covert', weaponType: 'knife', price: 1800 },
  { name: 'Butterfly Knife | Tiger Tooth', rarity: 'covert', weaponType: 'knife', price: 2200 },
  { name: 'Talon Knife | Crimson Web', rarity: 'covert', weaponType: 'knife', price: 1500 },
  { name: 'Skeleton Knife | Fade', rarity: 'covert', weaponType: 'knife', price: 1200 },

  // Gloves (Covert)
  { name: 'Sport Gloves | Pandora\'s Box', rarity: 'covert', weaponType: 'gloves', price: 4000 },
  { name: 'Specialist Gloves | Crimson Kimono', rarity: 'covert', weaponType: 'gloves', price: 3500 },
  { name: 'Driver Gloves | King Snake', rarity: 'covert', weaponType: 'gloves', price: 800 },

  // Rifles (Various)
  { name: 'AK-47 | Wild Lotus', rarity: 'covert', weaponType: 'rifle', price: 800 },
  { name: 'AK-47 | Fire Serpent', rarity: 'covert', weaponType: 'rifle', price: 600 },
  { name: 'AK-47 | Vulcan', rarity: 'covert', weaponType: 'rifle', price: 250 },
  { name: 'AK-47 | Neon Rider', rarity: 'covert', weaponType: 'rifle', price: 150 },
  { name: 'AK-47 | Asiimov', rarity: 'covert', weaponType: 'rifle', price: 120 },
  { name: 'AK-47 | Redline', rarity: 'classified', weaponType: 'rifle', price: 30 },
  { name: 'AK-47 | Blue Laminate', rarity: 'restricted', weaponType: 'rifle', price: 5 },
  { name: 'AK-47 | Safari Mesh', rarity: 'industrial', weaponType: 'rifle', price: 1 },

  { name: 'M4A4 | Howl', rarity: 'contraband', weaponType: 'rifle', price: 3000 },
  { name: 'M4A4 | Neo-Noir', rarity: 'covert', weaponType: 'rifle', price: 80 },
  { name: 'M4A4 | Asiimov', rarity: 'covert', weaponType: 'rifle', price: 100 },
  { name: 'M4A4 | Desolate Space', rarity: 'classified', weaponType: 'rifle', price: 25 },
  { name: 'M4A4 | Dragon King', rarity: 'restricted', weaponType: 'rifle', price: 10 },

  { name: 'M4A1-S | Welcome to the Jungle', rarity: 'covert', weaponType: 'rifle', price: 150 },
  { name: 'M4A1-S | Printstream', rarity: 'covert', weaponType: 'rifle', price: 120 },
  { name: 'M4A1-S | Hyper Beast', rarity: 'covert', weaponType: 'rifle', price: 50 },
  { name: 'M4A1-S | Golden Coil', rarity: 'covert', weaponType: 'rifle', price: 40 },

  // AWPs
  { name: 'AWP | Dragon Lore', rarity: 'covert', weaponType: 'sniper', price: 2000 },
  { name: 'AWP | Gungnir', rarity: 'covert', weaponType: 'sniper', price: 1500 },
  { name: 'AWP | Fade', rarity: 'covert', weaponType: 'sniper', price: 800 },
  { name: 'AWP | Asiimov', rarity: 'covert', weaponType: 'sniper', price: 100 },
  { name: 'AWP | Hyper Beast', rarity: 'covert', weaponType: 'sniper', price: 60 },
  { name: 'AWP | Lightning Strike', rarity: 'covert', weaponType: 'sniper', price: 150 },
  { name: 'AWP | Redline', rarity: 'classified', weaponType: 'sniper', price: 20 },
  { name: 'AWP | Elite Build', rarity: 'milspec', weaponType: 'sniper', price: 3 },
  { name: 'AWP | Safari Mesh', rarity: 'industrial', weaponType: 'sniper', price: 1 },

  // Pistols
  { name: 'Desert Eagle | Blaze', rarity: 'covert', weaponType: 'pistol', price: 400 },
  { name: 'Desert Eagle | Code Red', rarity: 'covert', weaponType: 'pistol', price: 80 },
  { name: 'Desert Eagle | Printstream', rarity: 'covert', weaponType: 'pistol', price: 60 },
  { name: 'Desert Eagle | Kumicho Dragon', rarity: 'classified', weaponType: 'pistol', price: 15 },

  { name: 'USP-S | Kill Confirmed', rarity: 'covert', weaponType: 'pistol', price: 80 },
  { name: 'USP-S | Printstream', rarity: 'covert', weaponType: 'pistol', price: 50 },
  { name: 'USP-S | Cortex', rarity: 'classified', weaponType: 'pistol', price: 15 },
  { name: 'USP-S | Cyrex', rarity: 'restricted', weaponType: 'pistol', price: 5 },

  { name: 'Glock-18 | Fade', rarity: 'covert', weaponType: 'pistol', price: 800 },
  { name: 'Glock-18 | Gamma Doppler', rarity: 'covert', weaponType: 'pistol', price: 400 },
  { name: 'Glock-18 | Water Elemental', rarity: 'classified', weaponType: 'pistol', price: 10 },

  // SMGs
  { name: 'MP9 | Hypnotic', rarity: 'restricted', weaponType: 'smg', price: 5 },
  { name: 'MAC-10 | Neon Rider', rarity: 'covert', weaponType: 'smg', price: 20 },
  { name: 'UMP-45 | Primal Saber', rarity: 'classified', weaponType: 'smg', price: 8 },
  { name: 'P90 | Asiimov', rarity: 'covert', weaponType: 'smg', price: 25 },

  // Low-tier fillers
  { name: 'P250 | Sand Dune', rarity: 'consumer', weaponType: 'pistol', price: 0.5 },
  { name: 'SG 553 | Army Sheen', rarity: 'consumer', weaponType: 'rifle', price: 0.5 },
  { name: 'Nova | Sand Dune', rarity: 'consumer', weaponType: 'shotgun', price: 0.5 },
  { name: 'Sawed-Off | Forest DDPAT', rarity: 'consumer', weaponType: 'shotgun', price: 0.5 },
  { name: 'G3SG1 | Safari Mesh', rarity: 'consumer', weaponType: 'sniper', price: 0.5 },
  { name: 'MP7 | Forest DDPAT', rarity: 'industrial', weaponType: 'smg', price: 0.8 },
  { name: 'Negev | Army Sheen', rarity: 'industrial', weaponType: 'machinegun', price: 0.8 },
  { name: 'PP-Bizon | Sand Dashed', rarity: 'industrial', weaponType: 'smg', price: 0.8 },
];

// Case definitions
const CASES_DATA = [
  {
    name: 'Emerald Case',
    slug: 'emerald-case',
    price: 50,
    houseEdge: 8,
    isFeatured: true,
    items: [
      { skinName: 'Karambit | Gamma Doppler (Emerald)', coinValue: 5000, oddsWeight: 1 },
      { skinName: 'AWP | Dragon Lore', coinValue: 2000, oddsWeight: 2 },
      { skinName: 'M4A4 | Howl', coinValue: 3000, oddsWeight: 1 },
      { skinName: 'AK-47 | Fire Serpent', coinValue: 600, oddsWeight: 10 },
      { skinName: 'AWP | Asiimov', coinValue: 100, oddsWeight: 50 },
      { skinName: 'AK-47 | Redline', coinValue: 30, oddsWeight: 200 },
      { skinName: 'AWP | Redline', coinValue: 20, oddsWeight: 250 },
      { skinName: 'AK-47 | Blue Laminate', coinValue: 5, oddsWeight: 500 },
      { skinName: 'P250 | Sand Dune', coinValue: 0.5, oddsWeight: 1000 },
    ],
  },
  {
    name: 'Starter Case',
    slug: 'starter-case',
    price: 10,
    houseEdge: 8,
    isFeatured: true,
    items: [
      { skinName: 'AK-47 | Asiimov', coinValue: 120, oddsWeight: 5 },
      { skinName: 'M4A1-S | Hyper Beast', coinValue: 50, oddsWeight: 20 },
      { skinName: 'AWP | Redline', coinValue: 20, oddsWeight: 100 },
      { skinName: 'USP-S | Cyrex', coinValue: 5, oddsWeight: 300 },
      { skinName: 'AK-47 | Blue Laminate', coinValue: 5, oddsWeight: 350 },
      { skinName: 'MP7 | Forest DDPAT', coinValue: 0.8, oddsWeight: 500 },
      { skinName: 'P250 | Sand Dune', coinValue: 0.5, oddsWeight: 700 },
    ],
  },
  {
    name: 'Dragon Case',
    slug: 'dragon-case',
    price: 100,
    houseEdge: 8,
    isFeatured: true,
    items: [
      { skinName: 'AWP | Dragon Lore', coinValue: 2000, oddsWeight: 5 },
      { skinName: 'AWP | Gungnir', coinValue: 1500, oddsWeight: 8 },
      { skinName: 'AWP | Fade', coinValue: 800, oddsWeight: 15 },
      { skinName: 'AWP | Lightning Strike', coinValue: 150, oddsWeight: 50 },
      { skinName: 'AWP | Asiimov', coinValue: 100, oddsWeight: 80 },
      { skinName: 'AWP | Hyper Beast', coinValue: 60, oddsWeight: 150 },
      { skinName: 'AWP | Redline', coinValue: 20, oddsWeight: 300 },
      { skinName: 'AWP | Elite Build', coinValue: 3, oddsWeight: 500 },
      { skinName: 'AWP | Safari Mesh', coinValue: 1, oddsWeight: 800 },
    ],
  },
  {
    name: 'Knife Case',
    slug: 'knife-case',
    price: 200,
    houseEdge: 8,
    isFeatured: true,
    items: [
      { skinName: 'Karambit | Gamma Doppler (Emerald)', coinValue: 5000, oddsWeight: 2 },
      { skinName: 'Karambit | Fade', coinValue: 2500, oddsWeight: 5 },
      { skinName: 'Butterfly Knife | Tiger Tooth', coinValue: 2200, oddsWeight: 8 },
      { skinName: 'M9 Bayonet | Doppler', coinValue: 1800, oddsWeight: 12 },
      { skinName: 'Talon Knife | Crimson Web', coinValue: 1500, oddsWeight: 20 },
      { skinName: 'Skeleton Knife | Fade', coinValue: 1200, oddsWeight: 30 },
      { skinName: 'Desert Eagle | Blaze', coinValue: 400, oddsWeight: 100 },
      { skinName: 'Glock-18 | Fade', coinValue: 800, oddsWeight: 50 },
      { skinName: 'AK-47 | Redline', coinValue: 30, oddsWeight: 500 },
      { skinName: 'P250 | Sand Dune', coinValue: 0.5, oddsWeight: 1000 },
    ],
  },
  {
    name: 'Budget Case',
    slug: 'budget-case',
    price: 5,
    houseEdge: 8,
    isFeatured: false,
    items: [
      { skinName: 'AK-47 | Redline', coinValue: 30, oddsWeight: 10 },
      { skinName: 'AWP | Redline', coinValue: 20, oddsWeight: 20 },
      { skinName: 'Desert Eagle | Kumicho Dragon', coinValue: 15, oddsWeight: 50 },
      { skinName: 'UMP-45 | Primal Saber', coinValue: 8, oddsWeight: 100 },
      { skinName: 'USP-S | Cyrex', coinValue: 5, oddsWeight: 200 },
      { skinName: 'M4A4 | Dragon King', coinValue: 10, oddsWeight: 150 },
      { skinName: 'MP9 | Hypnotic', coinValue: 5, oddsWeight: 250 },
      { skinName: 'AWP | Elite Build', coinValue: 3, oddsWeight: 400 },
      { skinName: 'MP7 | Forest DDPAT', coinValue: 0.8, oddsWeight: 600 },
      { skinName: 'P250 | Sand Dune', coinValue: 0.5, oddsWeight: 800 },
    ],
  },
  {
    name: 'Glove Case',
    slug: 'glove-case',
    price: 300,
    houseEdge: 8,
    isFeatured: true,
    items: [
      { skinName: 'Sport Gloves | Pandora\'s Box', coinValue: 4000, oddsWeight: 3 },
      { skinName: 'Specialist Gloves | Crimson Kimono', coinValue: 3500, oddsWeight: 5 },
      { skinName: 'Driver Gloves | King Snake', coinValue: 800, oddsWeight: 30 },
      { skinName: 'Karambit | Fade', coinValue: 2500, oddsWeight: 10 },
      { skinName: 'M9 Bayonet | Doppler', coinValue: 1800, oddsWeight: 20 },
      { skinName: 'AK-47 | Fire Serpent', coinValue: 600, oddsWeight: 50 },
      { skinName: 'AWP | Asiimov', coinValue: 100, oddsWeight: 200 },
      { skinName: 'AK-47 | Redline', coinValue: 30, oddsWeight: 500 },
      { skinName: 'P250 | Sand Dune', coinValue: 0.5, oddsWeight: 1000 },
    ],
  },
  {
    name: 'AK-47 Case',
    slug: 'ak47-case',
    price: 75,
    houseEdge: 8,
    isFeatured: false,
    items: [
      { skinName: 'AK-47 | Wild Lotus', coinValue: 800, oddsWeight: 5 },
      { skinName: 'AK-47 | Fire Serpent', coinValue: 600, oddsWeight: 8 },
      { skinName: 'AK-47 | Vulcan', coinValue: 250, oddsWeight: 20 },
      { skinName: 'AK-47 | Neon Rider', coinValue: 150, oddsWeight: 40 },
      { skinName: 'AK-47 | Asiimov', coinValue: 120, oddsWeight: 60 },
      { skinName: 'AK-47 | Redline', coinValue: 30, oddsWeight: 200 },
      { skinName: 'AK-47 | Blue Laminate', coinValue: 5, oddsWeight: 400 },
      { skinName: 'AK-47 | Safari Mesh', coinValue: 1, oddsWeight: 800 },
    ],
  },
  {
    name: 'Pistol Case',
    slug: 'pistol-case',
    price: 25,
    houseEdge: 8,
    isFeatured: false,
    items: [
      { skinName: 'Glock-18 | Fade', coinValue: 800, oddsWeight: 3 },
      { skinName: 'Glock-18 | Gamma Doppler', coinValue: 400, oddsWeight: 8 },
      { skinName: 'Desert Eagle | Blaze', coinValue: 400, oddsWeight: 8 },
      { skinName: 'USP-S | Kill Confirmed', coinValue: 80, oddsWeight: 30 },
      { skinName: 'Desert Eagle | Code Red', coinValue: 80, oddsWeight: 30 },
      { skinName: 'USP-S | Printstream', coinValue: 50, oddsWeight: 50 },
      { skinName: 'Desert Eagle | Printstream', coinValue: 60, oddsWeight: 40 },
      { skinName: 'Desert Eagle | Kumicho Dragon', coinValue: 15, oddsWeight: 150 },
      { skinName: 'USP-S | Cortex', coinValue: 15, oddsWeight: 150 },
      { skinName: 'Glock-18 | Water Elemental', coinValue: 10, oddsWeight: 200 },
      { skinName: 'USP-S | Cyrex', coinValue: 5, oddsWeight: 400 },
      { skinName: 'P250 | Sand Dune', coinValue: 0.5, oddsWeight: 800 },
    ],
  },
];

async function main() {
  console.log('🌱 Starting seed...');

  // Create skins
  console.log('Creating skins...');
  const skins = new Map<string, string>();

  for (const skinData of SKINS_DATA) {
    const marketHashName = skinData.name.replace(/[^a-zA-Z0-9\s\-|\']/g, '').replace(/\s+/g, ' ');

    const skin = await prisma.skin.upsert({
      where: { marketHashName },
      update: {},
      create: {
        name: skinData.name,
        marketHashName,
        imageUrl: `https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5lpKKqPrxN7LEm1Rd6dd2j6fH8Njz2gTm80RuMWulJIaUIFJsNFjR-FS7x-vng8PpupTAmHZhsnQgtHfemhGpwUYbk6KYEz4/${skinData.rarity}_icon.png`,
        rarity: skinData.rarity,
        weaponType: skinData.weaponType,
        displayPrice: skinData.price,
      },
    });
    skins.set(skinData.name, skin.id);
  }
  console.log(`Created ${skins.size} skins`);

  // Create cases
  console.log('Creating cases...');
  for (const caseData of CASES_DATA) {
    // Check if case exists
    let caseRecord = await prisma.case.findUnique({
      where: { slug: caseData.slug },
    });

    if (!caseRecord) {
      caseRecord = await prisma.case.create({
        data: {
          name: caseData.name,
          slug: caseData.slug,
          imageUrl: `https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXU5A1PIYQNqhpOSV-fRPasw8rsUFJ5KBFZv668FFY1naeaIWUStYjgxdnewKCmMLLXmX5D_dB-j-jR9NWiiALk_kFvZz33d9SSc1Q_aFjY_FLrlOvqjJa97J6bnCdh7SYntC3VzxXl0hwabOMv0quLSEOYF0rD/${caseData.slug}.png`,
          price: caseData.price,
          houseEdge: caseData.houseEdge,
          isFeatured: caseData.isFeatured,
          isActive: true,
        },
      });
    }

    // Calculate total weight for odds percentage
    const totalWeight = caseData.items.reduce((sum, item) => sum + item.oddsWeight, 0);

    // Create case items
    for (const itemData of caseData.items) {
      const skinId = skins.get(itemData.skinName);
      if (!skinId) {
        console.warn(`Skin not found: ${itemData.skinName}`);
        continue;
      }

      const oddsPercentage = (itemData.oddsWeight / totalWeight) * 100;

      await prisma.caseItem.upsert({
        where: {
          caseId_skinId: {
            caseId: caseRecord.id,
            skinId,
          },
        },
        update: {
          coinValue: itemData.coinValue,
          oddsWeight: itemData.oddsWeight,
          oddsPercentage,
        },
        create: {
          caseId: caseRecord.id,
          skinId,
          coinValue: itemData.coinValue,
          oddsWeight: itemData.oddsWeight,
          oddsPercentage,
        },
      });
    }

    console.log(`Created case: ${caseData.name} with ${caseData.items.length} items`);
  }

  // Create a test user
  console.log('Creating test user...');
  const testUser = await prisma.user.upsert({
    where: { steamId: '76561198000000001' },
    update: {},
    create: {
      steamId: '76561198000000001',
      username: 'TestPlayer',
      avatarUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
      balance: 1000,
      level: 10,
      vipTier: 'gold',
      clientSeed: crypto.randomBytes(16).toString('hex'),
    },
  });

  // Create user seed pair
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

  await prisma.userSeed.upsert({
    where: {
      id: `${testUser.id}-initial`,
    },
    update: {},
    create: {
      id: `${testUser.id}-initial`,
      userId: testUser.id,
      serverSeed,
      serverSeedHash,
      clientSeed: testUser.clientSeed || 'default',
      nonce: 0,
      isActive: true,
    },
  });

  console.log(`Created test user: ${testUser.username}`);

  console.log('✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
