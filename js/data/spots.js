/**
 * Public-friendly geology / beach / trail suggestions for Oahu + generic fallbacks.
 * Each named spot has a kid-friendly photoChallenge — the highlight to snap on site.
 *
 * Drive bands (exclusive):
 *   Short  → 0–25 min
 *   Medium → 25–60 min
 *   Longer → 60–120 min
 */
export const PUBLIC_SPOTS = [
  // ── Windward / East Oahu ──────────────────────────────────────────
  {
    id: "lanikai-pillbox",
    name: "Kaiwa Ridge (Pillbox) Trail area",
    area: "Kailua, Oahu",
    lat: 21.3925,
    lng: -157.7156,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "scoria", "andesite"],
    rockHunt:
      "Ridge rock hunt: Spot charcoal basalt, holey scoria, and gray andesite along the trail. Feel for bubbly “lava sponge” textures and rusty weathered edges — stay on the path!",
    why: "Volcanic ridge views — look for dark lava rocks along the trail (stay on path).",
    tips: "Public trail. No cliff climbing. Pack water.",
    photoChallenge: {
      emoji: "🏔️",
      title: "Pillbox ridge view",
      prompt: "Snap the ocean view from near the pillbox / ridge lookout (stay on the trail)!",
    },
  },
  {
    id: "kailua-beach",
    name: "Kailua Beach Park",
    area: "Kailua, Oahu",
    lat: 21.398,
    lng: -157.739,
    kinds: ["coral", "basalt", "beach_glass", "limestone"],
    rockHunt:
      "Beach rock hunt: Dark basalt pebbles, pale coral rubble, light limestone bits, and maybe frosty beach glass. Waves sort treasures at the high-tide line — never take living coral!",
    why: "Beachcombing for coral rubble and dark basalt pebbles (never take living coral).",
    tips: "Public beach park. Photos beat collecting.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the long sandy shoreline and turquoise water!",
    },
  },
  {
    id: "lanikai-beach",
    name: "Lanikai Beach access",
    area: "Kailua, Oahu",
    lat: 21.392,
    lng: -157.715,
    kinds: ["coral", "basalt", "beach_glass"],
    why: "Classic windward shore — light coral bits and dark basalt mixed by the waves.",
    tips: "Limited parking. Be respectful of neighbors.",
    photoChallenge: {
      emoji: "🏝️",
      title: "Mokulua islands view",
      prompt: "Snap the two Mokulua islands offshore from Lanikai Beach!",
    },
  },
  {
    id: "waimanalo-beach",
    name: "Waimānalo Beach Park",
    area: "Waimānalo, Oahu",
    lat: 21.335,
    lng: -157.7,
    kinds: ["basalt", "coral", "olivine"],
    why: "Long sandy stretch with volcanic pebbles near the edges.",
    tips: "Public park. Soft sand — great family walk.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the long Waimānalo shoreline with the Koʻolau mountains behind you!",
    },
  },
  {
    id: "bellows-area",
    name: "Bellows Field Beach Park (public days)",
    area: "Waimānalo, Oahu",
    lat: 21.355,
    lng: -157.71,
    kinds: ["basalt", "coral"],
    why: "Wide windward beach when open to the public.",
    tips: "Often weekends only — check open days.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the wide sandy beach and bright windward water!",
    },
  },
  {
    id: "makapuu",
    name: "Makapuʻu Point Lighthouse Trail",
    area: "East Oahu",
    // Pin near mid-trail so check-in works along the paved path, not only at the far lighthouse
    lat: 21.3072,
    lng: -157.6502,
    checkInRadiusKm: 2.1,
    challengeRadiusKm: 2.3,
    kinds: ["basalt", "scoria", "olivine"],
    rockHunt:
      "Trail rock hunt: Dark basalt and bubbly scoria everywhere — hunt for lucky green olivine (peridot) sparkles in the lava! Compare rough trail rock vs smoother pieces near the path.",
    why: "Coastal volcanic rock and big ocean views.",
    tips: "Paved public trail. Windy! Stay behind barriers.",
    photoChallenge: {
      emoji: "🗼",
      title: "Makapuʻu Lighthouse",
      prompt: "Snap the red-roofed Makapuʻu lighthouse from the trail!",
      verifyTarget:
        "the Makapuʻu lighthouse itself — white lighthouse tower with a distinctive red roof clearly visible (not just trail, ocean, or rocks)",
    },
  },
  {
    id: "makapuu-lookout",
    name: "Makapuʻu Lookout (highway pull-off)",
    area: "East Oahu",
    lat: 21.318,
    lng: -157.665,
    checkInRadiusKm: 0.9,
    challengeRadiusKm: 1.0,
    kinds: ["basalt", "scoria"],
    why: "Quick roadside view of the rugged east coastline.",
    tips: "Park only in pull-off. Watch traffic.",
    photoChallenge: {
      emoji: "👀",
      title: "Coastline lookout",
      prompt: "Snap the big Makapuʻu coastline view from the lookout!",
      verifyTarget:
        "a wide coastal lookout view of Makapuʻu cliffs and ocean from the highway overlook (not the lighthouse tower close-up, not a random trail selfie without the coast vista)",
    },
  },
  {
    id: "halona-blowhole",
    name: "Hālona Blowhole Lookout",
    area: "East Oahu",
    lat: 21.2818,
    lng: -157.6778,
    kinds: ["basalt", "scoria"],
    why: "Lava rock shoreline and famous blowhole spout (view from safe railing).",
    tips: "Stay behind barriers — waves are dangerous.",
    photoChallenge: {
      emoji: "💨",
      title: "Blowhole lookout",
      prompt: "Snap the Hālona Blowhole / rocky lava point from the safe lookout!",
    },
  },
  {
    id: "lanai-lookout",
    name: "Lānaʻi Lookout",
    area: "East Oahu",
    lat: 21.284,
    lng: -157.675,
    kinds: ["basalt"],
    why: "Dramatic lava cliffs and ocean — geology in plain sight.",
    tips: "Pull-off only. No cliff climbing.",
    photoChallenge: {
      emoji: "🌊",
      title: "Lava cliff view",
      prompt: "Snap the dark lava cliffs and blue ocean from Lānaʻi Lookout!",
    },
  },
  {
    id: "sandy-beach",
    name: "Sandy Beach Park",
    area: "East Oahu",
    lat: 21.285,
    lng: -157.672,
    kinds: ["basalt", "coral", "olivine"],
    why: "Powerful shore — dark volcanic sand and pebbles.",
    tips: "Strong shorebreak — dry zones only with an adult.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the powerful Sandy Beach shoreline from a safe dry spot!",
    },
  },
  {
    id: "hanauma-bay",
    name: "Hanauma Bay Nature Preserve (lookout / area)",
    area: "East Honolulu, Oahu",
    lat: 21.269,
    lng: -157.694,
    kinds: ["basalt", "tuff", "coral"],
    why: "Volcanic crater bay — great geology story.",
    tips: "Check entry rules. Look, don’t collect.",
    photoChallenge: {
      emoji: "🌋",
      title: "Crater bay view",
      prompt: "Snap the horseshoe crater bay of Hanauma from a public viewpoint!",
    },
  },
  {
    id: "koko-crater",
    name: "Koko Crater Trail / Botanical Garden area",
    area: "Hawaii Kai, Oahu",
    lat: 21.285,
    lng: -157.685,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "tuff", "scoria"],
    why: "Cinder cone and crater — classic east Honolulu volcano story.",
    tips: "Stairs are steep — go with a grown-up.",
    photoChallenge: {
      emoji: "🌋",
      title: "Cinder cone",
      prompt: "Snap Koko Crater’s cinder-cone shape or the railroad-tie trail stairs!",
    },
  },
  {
    id: "koolau-vista",
    name: "Nuʻuanu Pali Lookout",
    area: "Oahu",
    lat: 21.3669,
    lng: -157.7939,
    kinds: ["basalt", "andesite"],
    why: "Cliff-forming volcanic rock of the Koʻolau range.",
    tips: "Lookout only — do not scramble cliffs.",
    photoChallenge: {
      emoji: "🌬️",
      title: "Pali cliffs lookout",
      prompt: "Snap the windy Nuʻuanu Pali cliffs and windward vista!",
    },
  },
  {
    id: "byodo-in",
    name: "Byodo-In Temple (Valley of the Temples)",
    area: "Kāneʻohe, Oahu",
    lat: 21.4308,
    lng: -157.8317,
    kinds: ["basalt"],
    why: "Famous temple set against the Koʻolau mountains — scenic geology backdrop.",
    tips: "Entry fee. Quiet respect. Stay on paths.",
    photoChallenge: {
      emoji: "🏯",
      title: "Temple & mountains",
      prompt: "Snap the Byodo-In Temple with the green Koʻolau cliffs behind it!",
    },
  },
  {
    id: "hoomaluhia",
    name: "Hoʻomaluhia Botanical Garden",
    area: "Kāneʻohe, Oahu",
    lat: 21.388,
    lng: -157.808,
    kinds: ["basalt"],
    why: "Garden lake with towering Koʻolau ridgeline — great for landscape photos.",
    tips: "Public garden hours. No collecting plants or rocks.",
    photoChallenge: {
      emoji: "🌄",
      title: "Lake & Koʻolau view",
      prompt: "Snap the garden lake with the steep Koʻolau mountains rising behind!",
    },
  },
  {
    id: "kaneohe-bay-park",
    name: "Heʻeia State Park area",
    area: "Kāneʻohe, Oahu",
    lat: 21.441,
    lng: -157.81,
    kinds: ["basalt", "coral", "limestone"],
    why: "Windward bay views with volcanic shoreline stories.",
    tips: "Stay off fragile reef flats.",
    photoChallenge: {
      emoji: "⛵",
      title: "Kāneʻohe Bay view",
      prompt: "Snap the wide Kāneʻohe Bay view from Heʻeia!",
    },
  },
  {
    id: "kualoa-regional",
    name: "Kualoa Regional Park",
    area: "Windward Oahu",
    lat: 21.512,
    lng: -157.837,
    kinds: ["basalt", "coral"],
    why: "Iconic Koʻolau backdrop — shoreline pebbles and basalt.",
    tips: "Public park. No cliff scrambling.",
    photoChallenge: {
      emoji: "🎬",
      title: "Chinaman’s Hat view",
      prompt: "Snap Mokoliʻi (Chinaman’s Hat) island from Kualoa Beach!",
    },
  },
  {
    id: "kahana-bay",
    name: "Kahana Bay Beach Park",
    area: "Windward Oahu",
    lat: 21.556,
    lng: -157.874,
    kinds: ["basalt", "coral"],
    why: "Quiet bay with steep valley walls — volcanic island scenery.",
    tips: "Public park. Watch tides.",
    photoChallenge: {
      emoji: "🏞️",
      title: "Bay & valley",
      prompt: "Snap Kahana Bay with the green valley walls around it!",
    },
  },
  {
    id: "laie-point",
    name: "Lāʻie Point State Wayside",
    area: "Lāʻie, Oahu",
    lat: 21.649,
    lng: -157.92,
    kinds: ["basalt", "limestone"],
    why: "Dramatic coastal point and sea arches — geology photo gold.",
    tips: "Stay behind barriers. Big waves.",
    photoChallenge: {
      emoji: "🪨",
      title: "Sea arch / point",
      prompt: "Snap the Lāʻie Point sea arch and rocky point (from a safe spot)!",
    },
  },

  // ── Honolulu / South shore ────────────────────────────────────────
  {
    id: "diamond-head",
    name: "Diamond Head (Lēʻahi) State Monument",
    area: "Honolulu, Oahu",
    lat: 21.2619,
    lng: -157.8058,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "tuff", "scoria"],
    rockHunt:
      "Crater rock hunt: Look for dark basalt, holey scoria, and pale tuff (old volcanic ash rock stuck together). Feel the rough lava underfoot — photo & learn; monument rules often say no collecting!",
    why: "Famous volcanic crater — educational stop about Hawaii’s fire-made islands.",
    tips: "Entry fee / reservations may apply. Stay on trail.",
    photoChallenge: {
      emoji: "🌋",
      title: "Crater & bunker view",
      prompt: "Snap the Diamond Head crater view from the summit bunker lookout!",
    },
  },
  {
    id: "ala-moana-beach",
    name: "Ala Moana Beach Park",
    area: "Honolulu, Oahu",
    lat: 21.29,
    lng: -157.846,
    kinds: ["basalt", "coral", "beach_glass"],
    why: "City beach park — easy family rock-spotting along the shore.",
    tips: "Busy park. Photos are best.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the Ala Moana shoreline or Magic Island tip!",
    },
  },
  {
    id: "waikiki-kapiolani",
    name: "Kapiʻolani Regional Park / Waikīkī shore",
    area: "Honolulu, Oahu",
    lat: 21.268,
    lng: -157.82,
    kinds: ["basalt", "coral", "sandstone"],
    why: "Urban shoreline walk — compare beach sand and basalt fragments.",
    tips: "Leave living coral alone.",
    photoChallenge: {
      emoji: "🏄",
      title: "Waikīkī shore",
      prompt: "Snap Diamond Head rising behind the Waikīkī shoreline!",
    },
  },
  {
    id: "mano-falls-area",
    name: "Mānoa Falls Trail (public trailhead area)",
    area: "Mānoa Valley, Oahu",
    lat: 21.333,
    lng: -157.8,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "conglomerate"],
    why: "Rainforest valley cut through volcanic rock.",
    tips: "Muddy trail — go with a grown-up.",
    photoChallenge: {
      emoji: "💧",
      title: "Waterfall (or trail)",
      prompt: "Snap Mānoa Falls (or the rainforest trail if you stop earlier)!",
    },
  },
  {
    id: "tantalus-lookout",
    name: "Puʻu ʻUalakaʻa State Wayside (Tantalus)",
    area: "Honolulu, Oahu",
    lat: 21.319,
    lng: -157.82,
    kinds: ["basalt", "tuff"],
    why: "Hilltop lookout over Honolulu and Diamond Head.",
    tips: "Winding road — adult driver. Stay in park area.",
    photoChallenge: {
      emoji: "🏙️",
      title: "Honolulu lookout",
      prompt: "Snap the city + Diamond Head view from the Tantalus lookout!",
    },
  },
  {
    id: "punchbowl-area",
    name: "National Memorial Cemetery of the Pacific (view area)",
    area: "Honolulu, Oahu",
    lat: 21.312,
    lng: -157.846,
    kinds: ["tuff", "basalt"],
    why: "Historic crater site with island views — respectful visit.",
    tips: "Quiet respect. No collecting. Follow all rules.",
    photoChallenge: {
      emoji: "🕊️",
      title: "Crater memorial view",
      prompt: "Snap the Punchbowl crater overlook view (respectfully, no climbing)!",
    },
  },

  // ── Central / Pearl / Mid-island (fills Medium↔Longer gap) ────────
  {
    id: "pearl-harbor-shore",
    name: "Aiea Bay State Recreation Area",
    area: "Central Oahu",
    lat: 21.375,
    lng: -157.94,
    kinds: ["basalt", "coral", "limestone"],
    why: "Calm bay shore — easy walk for comparing stone colors.",
    tips: "Stay out of restricted Navy zones.",
    photoChallenge: {
      emoji: "⚓",
      title: "Pearl Harbor shore",
      prompt: "Snap the calm Pearl Harbor shoreline from the public park!",
    },
  },
  {
    id: "waipio-peninsula",
    name: "Waipiʻo Point Access Road lookout area",
    area: "Central Oahu",
    lat: 21.36,
    lng: -157.98,
    kinds: ["basalt", "coral"],
    why: "Open views across Pearl Harbor — dark volcanic ground rock nearby.",
    tips: "Respect fencing. Photo only.",
    photoChallenge: {
      emoji: "👀",
      title: "Harbor lookout",
      prompt: "Snap the wide Pearl Harbor view from the public lookout area!",
    },
  },
  {
    id: "ewa-beach",
    name: "ʻEwa Beach Park",
    area: "ʻEwa, Oahu",
    lat: 21.315,
    lng: -158.007,
    kinds: ["coral", "basalt", "limestone"],
    why: "South-central beach with coral rubble and basalt mix.",
    tips: "Public park. Leave living reef alone.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the ʻEwa Beach shoreline and open ocean horizon!",
    },
  },
  {
    id: "white-plains",
    name: "White Plains Beach",
    area: "ʻEwa / Kapolei, Oahu",
    lat: 21.304,
    lng: -158.045,
    kinds: ["coral", "basalt"],
    why: "Family-friendly south shore beach between Honolulu and the west side.",
    tips: "Public access. Watch for boards and swimmers.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the White Plains beach and shoreline!",
    },
  },
  {
    id: "kapolei-regional",
    name: "Kapolei Regional Park",
    area: "Kapolei, Oahu",
    lat: 21.335,
    lng: -158.078,
    kinds: ["basalt"],
    why: "Big open park on the dry leeward plain — easy family stop mid-island.",
    tips: "City park. Stay on fields and paths.",
    photoChallenge: {
      emoji: "🏞️",
      title: "Park landscape",
      prompt: "Snap the open park fields with the Waiʻanae mountains in the distance!",
    },
  },
  {
    id: "halawa-valley-view",
    name: "Hālawa Valley / Aloha Stadium area (public roadsides)",
    area: "Central Oahu",
    lat: 21.373,
    lng: -157.93,
    kinds: ["basalt"],
    why: "Central valley gateway between Honolulu and the North Shore roads.",
    tips: "Stay in public parking/view areas. Watch traffic.",
    photoChallenge: {
      emoji: "🏟️",
      title: "Central valley",
      prompt: "Snap the stadium or the central Hālawa valley hills!",
    },
  },
  {
    id: "kaaawa-beach",
    name: "Kaʻaʻawa Beach Park",
    area: "Windward Oahu",
    lat: 21.547,
    lng: -157.854,
    kinds: ["basalt", "coral"],
    why: "Scenic windward coast between Kualoa and Kahana — classic island drive stop.",
    tips: "Small park. Watch traffic on Kamehameha Hwy.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & cliffs",
      prompt: "Snap Kaʻaʻawa Beach with the steep windward cliffs behind it!",
    },
  },
  {
    id: "mililani-district",
    name: "Mililani District Park",
    area: "Central Oahu",
    lat: 21.451,
    lng: -158.001,
    kinds: ["basalt"],
    why: "Central plateau park — good mid-island stop between town and North Shore.",
    tips: "City park. Stay on fields and paths.",
    photoChallenge: {
      emoji: "🌳",
      title: "Neighborhood park",
      prompt: "Snap the big open park lawns under central Oahu skies!",
    },
  },
  {
    id: "wahiawa-botanical",
    name: "Wahiawa Botanical Garden",
    area: "Central Oahu",
    lat: 21.498,
    lng: -158.02,
    kinds: ["basalt"],
    why: "Cooler central plateau garden — different climate zone than the coast.",
    tips: "Public garden. Stay on paths.",
    photoChallenge: {
      emoji: "🌿",
      title: "Garden canopy",
      prompt: "Snap the shady tropical canopy or a cool garden path!",
    },
  },
  {
    id: "dole-area",
    name: "Dole Plantation area (public grounds)",
    area: "Wahiawa / North-Central Oahu",
    lat: 21.525,
    lng: -158.038,
    kinds: ["basalt"],
    why: "Mid-island stop on the way to the North Shore — pineapple country scenery.",
    tips: "Visitor area. Follow property rules.",
    photoChallenge: {
      emoji: "🍍",
      title: "Pineapple country",
      prompt: "Snap the pineapple fields or the famous Dole sign / grounds!",
    },
  },
  {
    id: "kolekole-pass-view",
    name: "Kolekole Pass view area (when open / public side)",
    area: "Central / Waiʻanae side, Oahu",
    lat: 21.47,
    lng: -158.12,
    kinds: ["basalt"],
    why: "Mountain pass scenery between central Oahu and the coast.",
    tips: "Access rules change — only if publicly open. Adult driver.",
    photoChallenge: {
      emoji: "⛰️",
      title: "Mountain pass",
      prompt: "Snap the mountain pass view (only from allowed public areas)!",
    },
  },

  // ── North Shore ───────────────────────────────────────────────────
  {
    id: "haleiwa-beach",
    name: "Haleʻiwa Beach Park",
    area: "North Shore, Oahu",
    lat: 21.597,
    lng: -158.103,
    kinds: ["basalt", "coral", "beach_glass"],
    why: "North Shore beachcombing between swells.",
    tips: "Winter waves can be huge.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap Haleʻiwa Beach and the Anahulu Stream bridge area!",
    },
  },
  {
    id: "laniakea",
    name: "Laniakea Beach (Turtle Beach) overlook",
    area: "North Shore, Oahu",
    lat: 21.592,
    lng: -158.109,
    kinds: ["basalt", "coral"],
    why: "Famous turtle-watching shore — geology plus wildlife (watch from distance).",
    tips: "Give turtles lots of space. Stay off rocks in big surf.",
    photoChallenge: {
      emoji: "🐢",
      title: "Turtle beach shore",
      prompt: "Snap the Laniakea shoreline (and turtles only from a respectful distance)!",
    },
  },
  {
    id: "waimea-valley",
    name: "Waimea Valley (visitor center / public areas)",
    area: "North Shore, Oahu",
    lat: 21.638,
    lng: -158.063,
    kinds: ["basalt", "conglomerate"],
    why: "Valley setting with volcanic bedrock stories and botanical gardens.",
    tips: "Check visitor rules; cultural sites — look, don’t dig.",
    photoChallenge: {
      emoji: "🌺",
      title: "Valley garden",
      prompt: "Snap the lush Waimea Valley gardens or visitor-area valley view!",
    },
  },
  {
    id: "waimea-bay",
    name: "Waimea Bay Beach Park",
    area: "North Shore, Oahu",
    lat: 21.641,
    lng: -158.066,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "coral"],
    why: "Famous bay with volcanic cliffs and beach rocks (view safely).",
    tips: "Huge winter waves. Dry sand only with an adult.",
    photoChallenge: {
      emoji: "🌊",
      title: "Bay & jumping rock",
      prompt: "Snap famous Waimea Bay and the big rock / cliff backdrop (from safe sand)!",
    },
  },
  {
    id: "sharks-cove",
    name: "Pūpūkea Beach Park / Shark’s Cove",
    area: "North Shore, Oahu",
    lat: 21.651,
    lng: -158.063,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "coral", "limestone"],
    rockHunt:
      "Tide-pool rock hunt: Jagged black basalt, pale limestone, and coral rubble textures. Spot shiny wet rock vs dry matte rock — adult help near sharp, wet edges!",
    why: "Rocky tide-pool coast — amazing volcanic shoreline texture.",
    tips: "Sharp rock. Summer calm is safer. Adult required.",
    photoChallenge: {
      emoji: "🪨",
      title: "Rocky cove",
      prompt: "Snap Shark’s Cove’s dark basalt rock pools and cove shape!",
    },
  },
  {
    id: "sunset-beach",
    name: "Sunset Beach Park",
    area: "North Shore, Oahu",
    lat: 21.675,
    lng: -158.042,
    kinds: ["basalt", "coral", "beach_glass"],
    why: "Long north shore beach — pebbles and basalt bits after storms.",
    tips: "Dangerous shorebreak in winter.",
    photoChallenge: {
      emoji: "🌅",
      title: "Beach & shoreline",
      prompt: "Snap the long Sunset Beach shoreline (from high, safe sand)!",
    },
  },
  {
    id: "turtle-bay-area",
    name: "Kawela Bay / Turtle Bay shore access",
    area: "North Shore, Oahu",
    lat: 21.705,
    lng: -157.998,
    kinds: ["basalt", "coral", "limestone"],
    why: "Far north shore — different coastline feel and rock mix.",
    tips: "Public access points only.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the quiet north-shore bay and rocky edges!",
    },
  },
  {
    id: "kahuku-point",
    name: "Kahuku Point / James Campbell area (public edges)",
    area: "North Shore, Oahu",
    lat: 21.713,
    lng: -157.976,
    kinds: ["basalt", "limestone", "coral"],
    why: "Island’s northern tip energy — windy shore geology.",
    tips: "Respect refuge boundaries.",
    photoChallenge: {
      emoji: "🧭",
      title: "Northern tip shore",
      prompt: "Snap the windy northern tip shoreline from a public path!",
    },
  },

  // ── Leeward / West side ───────────────────────────────────────────
  {
    id: "ko-olina-lagoons",
    name: "Ko Olina Lagoons (public lagoon path)",
    area: "West Oahu",
    lat: 21.337,
    lng: -158.122,
    kinds: ["basalt", "coral", "limestone"],
    why: "Man-made lagoons on volcanic coast — easy family shoreline walk.",
    tips: "Public lagoon access.",
    photoChallenge: {
      emoji: "🏝️",
      title: "Lagoon path",
      prompt: "Snap one of the Ko Olina lagoons from the public path!",
    },
  },
  {
    id: "electric-beach",
    name: "Kahe Point Beach Park (Electric Beach)",
    area: "West Oahu",
    lat: 21.353,
    lng: -158.13,
    kinds: ["basalt", "coral"],
    why: "West-side basalt shore with clear water.",
    tips: "Adult supervision. Currents possible.",
    photoChallenge: {
      emoji: "⚡",
      title: "Power plant shore",
      prompt: "Snap the Kahe Point shoreline with the power plant landmark nearby!",
    },
  },
  {
    id: "pokai-bay",
    name: "Pōkaʻī Bay Beach Park",
    area: "Waiʻanae, Oahu",
    lat: 21.443,
    lng: -158.192,
    kinds: ["basalt", "coral", "limestone"],
    why: "Sheltered west-side bay — gentle shore for comparing stone types.",
    tips: "Public park. Calmer alternative to big surf beaches.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Sheltered bay",
      prompt: "Snap calm Pōkaʻī Bay and its protective breakwater!",
    },
  },
  {
    id: "makaha-beach",
    name: "Mākaha Beach Park",
    area: "Waiʻanae Coast, Oahu",
    lat: 21.476,
    lng: -158.22,
    kinds: ["basalt", "coral", "beach_glass"],
    why: "Classic leeward beach — dark volcanic sand and pebbles.",
    tips: "Winter surf can be huge.",
    photoChallenge: {
      emoji: "🏄",
      title: "Beach & shoreline",
      prompt: "Snap Mākaha Beach and the west-side mountain backdrop!",
    },
  },
  {
    id: "yokohama-bay",
    name: "Yokohama Bay (Keawaʻula)",
    area: "Waiʻanae Coast, Oahu",
    lat: 21.556,
    lng: -158.242,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "scoria", "coral"],
    why: "End-of-the-road west coast — wild volcanic shoreline.",
    tips: "Remote. Pack water. No cliff climbing.",
    photoChallenge: {
      emoji: "🌅",
      title: "End-of-road bay",
      prompt: "Snap wild Yokohama Bay at the end of Farrington Highway!",
    },
  },
  {
    id: "kaena-point-east",
    name: "Kaʻena Point trailhead (Yokohama side)",
    area: "West Oahu",
    lat: 21.558,
    lng: -158.248,
    checkInRadiusKm: 1.8,
    challengeRadiusKm: 2.0,
    kinds: ["basalt", "scoria"],
    why: "Long coastal hike toward the island’s western tip — pure lava rock country.",
    tips: "Hot, exposed trail. Stay on path.",
    photoChallenge: {
      emoji: "🥾",
      title: "Western tip trail",
      prompt: "Snap the wild Kaʻena Point coastal trail and lava rock shore!",
    },
  },

  // ── Generic fallbacks ─────────────────────────────────────────────
  {
    id: "any-beach-park",
    name: "Local public beach or shoreline park",
    area: "Near you",
    lat: null,
    lng: null,
    generic: true,
    kinds: ["sandstone", "limestone", "basalt", "quartz", "beach_glass"],
    why: "Beaches sort stones by waves — great for comparing colors and shapes.",
    tips: "Only public beaches. Leave living creatures alone.",
    photoChallenge: {
      emoji: "🏖️",
      title: "Beach & shoreline",
      prompt: "Snap the beach, waves, or shoreline where you are!",
    },
  },
  {
    id: "any-river-park",
    name: "Public riverwalk or creek park",
    area: "Near you",
    lat: null,
    lng: null,
    generic: true,
    kinds: ["granite", "quartz", "conglomerate", "shale", "basalt"],
    why: "Moving water polishes rocks and mixes types from upstream.",
    tips: "Stay on bank trails.",
    photoChallenge: {
      emoji: "🏞️",
      title: "Creek or river",
      prompt: "Snap the creek, river, or polished stones along the bank!",
    },
  },
  {
    id: "any-nature-center",
    name: "City nature center or state park visitor area",
    area: "Near you",
    lat: null,
    lng: null,
    generic: true,
    kinds: ["sandstone", "limestone", "granite", "slate"],
    why: "Educational displays help you learn what local rocks look like.",
    tips: "Ask rangers what you may collect (often: photo only!).",
    photoChallenge: {
      emoji: "🏡",
      title: "Visitor center",
      prompt: "Snap the nature center, trailhead sign, or a cool display outside!",
    },
  },
];

/** haversine km */
export function distanceKm(a, b) {
  if (a == null || b == null || a.lat == null || b.lat == null) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Exclusive drive-time bands — continuous coverage, no overlap.
 * Short 0–25 · Medium 25–60 · Longer 60–120
 */
export const RANGE_PRESETS = {
  short: {
    label: "Short",
    minDriveMin: 0,
    maxDriveMin: 25,
    blurb: "Walk or short drive only — nearby parks & beaches (~25 min or less)",
  },
  medium: {
    label: "Medium",
    minDriveMin: 25,
    maxDriveMin: 60,
    blurb: "Medium drives only — across town or around your side of the island (~25–60 min)",
  },
  longer: {
    label: "Longer",
    minDriveMin: 60,
    maxDriveMin: 120,
    blurb: "Longer outings only — bigger island drives (~1–2 hr)",
  },
};

/**
 * Estimate realistic drive minutes from straight-line distance.
 * Slightly faster island speed + milder overhead so mid-range places
 * don't jump straight from ~30 min to 1h40m as often.
 */
export function estimateDriveMinutes(from, to, region = "general") {
  const d = distanceKm(from, to);
  if (!Number.isFinite(d)) return Infinity;
  // Effective road speed after turns / traffic / coastal routing
  const speedKmh = region === "hawaii" ? 32 : 42;
  const overheadMin = region === "hawaii" ? 5 : 4;
  // Extra time for longer hops (highways + congestion), not applied to short hops
  const longHop = region === "hawaii" && d > 18 ? (d - 18) * 0.35 : 0;
  return Math.round((d / speedKmh) * 60 + overheadMin + longHop);
}

/**
 * Exclusive band: short is [0, max]; medium/longer are (min, max]
 */
export function driveTimeInRange(driveMin, rangeKey) {
  const preset = RANGE_PRESETS[rangeKey] || RANGE_PRESETS.medium;
  if (driveMin == null || !Number.isFinite(driveMin)) return false;
  const min = preset.minDriveMin ?? 0;
  const max = preset.maxDriveMin ?? 55;
  if (rangeKey === "short" || min === 0) {
    return driveMin >= 0 && driveMin <= max;
  }
  return driveMin > min && driveMin <= max;
}

export function formatDriveTime(min) {
  if (min == null || !Number.isFinite(min)) return "Near you";
  if (min < 8) return "Walk / ~5 min";
  if (min < 60) return `~${min} min drive`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `~${h} hr ${m} min drive` : `~${h} hr drive`;
}

/** Default challenge if a spot has none */
export function getPhotoChallenge(spot) {
  if (spot?.photoChallenge) {
    const ch = spot.photoChallenge;
    return {
      ...ch,
      // Used by vision verify — must describe the actual subject, not "near the place"
      verifyTarget:
        ch.verifyTarget ||
        ch.prompt ||
        `the main famous feature of ${spot.name || "this place"} clearly visible in the photo`,
    };
  }
  if (spot?.generic) {
    return {
      emoji: "📸",
      title: "Adventure photo",
      prompt: "Snap something cool about this place!",
      verifyTarget: "a clear outdoor beach, trail, or park scene that matches a real adventure stop",
    };
  }
  return {
    emoji: "📸",
    title: "Place highlight",
    prompt: `Snap the main highlight of ${spot?.name || "this place"}!`,
    verifyTarget: `the main famous feature of ${spot?.name || "this place"} clearly visible (not just random nearby scenery)`,
  };
}
