import { FISH_TYPES, DEFAULT_CHARACTER_SETTINGS, DEFAULT_AMBIENT_CONFIG, DEFAULT_BUCKETS, DEFAULT_SILHOUETTE_CONFIG, DEFAULT_START_CONFIG, DEFAULT_BAIT_CONFIG, Fish, AmbientFish, Bait, getSpeciesCategory, isTargetForMode } from './fish.js';
import { buildRankingPayload } from './app.js';
import { sound } from './audio.js';
import { t, getLocalizedTitle, getCurrentLang, translations } from './i18n.js';
import confetti from 'canvas-confetti';

export const DEFAULT_PLAYER_TITLES = [
  { minScore: 15000, title: "魚神" },
  { minScore: 13000, title: "魚王" },
  { minScore: 12000, title: "魚会長" },
  { minScore: 11000, title: "魚社長" },
  { minScore: 10000, title: "魚職人" },
  { minScore: 8500, title: "魚超名人" },
  { minScore: 6000, title: "魚マニア" },
  { minScore: 4000, title: "魚公務員" },
  { minScore: 2000, title: "魚愛好家" },
  { minScore: 0, title: "見習い" }
];

export const DEFAULT_X_SHARE_TEMPLATES = {
  ja: "🐟【ヒラメいた！】で{score}pt獲得！\n所属: {mode} | 称号: {title}\n最大コンボ: {combo}連続\n#ヒラメいた #カレイ派 #ヒラメ派",
  en: "🐟 Scored {score}pts in [HoK!]!\nFaction: {mode} | Title: {title}\nMax Combo: {combo}\n#HoK #FishSort #ActionGame",
  ko: "🐟【HoK!】에서 {score}pt 획득!\n소속: {mode} | 칭호: {title}\n최대 콤보: {combo}연속\n#HoK #가자미파 #넙치파",
  zh: "🐟 在【HoK!】中获得 {score}分！\n阵营: {mode} | 称号: {title}\n最大连击: {combo}次\n#HoK #比目鱼派 #鲽鱼派"
};

export const DEFAULT_X_SHARE_TEMPLATE = DEFAULT_X_SHARE_TEMPLATES.ja;

export const DEFAULT_TITLE_SCREEN = {
  credits: {
    enabled: true,
    author: "PIG STAR",
    year: "2026",
    fontSize: 11,
    fontFamily: "'M PLUS Rounded 1c', sans-serif",
    position: "subtitle" // 'subtitle' | 'header' | 'above_lang' | 'footer'
  },
  mainTitle: {
    text: "HoK！\n~華麗にヒラメいた！~",
    textByLang: {
      ja: "HoK！\n~華麗にヒラメいた！~",
      en: "HoK!\n~Catch & Sort Fishes!~",
      ko: "HoK!\n~화려하게 번뜩였다!~",
      zh: "HoK！\n~华丽灵感大分流！~"
    },
    fontFamily: "'M PLUS Rounded 1c', sans-serif",
    fontWeight: "900",
    fontSize: 36,
    lineHeight: 1.25,
    letterSpacing: 0,
    scaleX: 100,
    scaleY: 100,
    baselineShift: 0,
    textAlign: "center",
    fauxBold: false,
    fauxItalic: false,
    allCaps: false,
    smallCaps: false,
    superscript: false,
    subscript: false,
    underline: false,
    strikethrough: false,
    alignH: "center",
    alignV: "middle",
    posX: 0,
    posY: 0,
    scale: 100,
    rotation: 0,
    opacity: 100,
    fillEnabled: true,
    fillType: "gradient",
    fillColor: "#ffffff",
    fillGradStops: [
      { color: "#38bdf8", pos: 0 },
      { color: "#facc15", pos: 50 },
      { color: "#f43f5e", pos: 100 }
    ],
    fillGradAngle: 135,
    strokeEnabled: false,
    strokeColor: "#000000",
    strokeWidth: 4,
    bgEnabled: false,
    bgColor: "#0f172a",
    bgOpacity: 80,
    bgPaddingX: 16,
    bgPaddingY: 8,
    bgRadius: 12,
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowOpacity: 50,
    shadowAngle: 135,
    shadowDistance: 4,
    shadowBlur: 12
  },
  subTitle: {
    text: "カレイとヒラメを瞬時に見分けろ！",
    textByLang: {
      ja: "カレイとヒラメを瞬時に見分けろ！",
      en: "Distinguish Karei and Hirame in a flash!",
      ko: "가자미와 넙치를 순식간에 구별하라!",
      zh: "瞬间辨别鲽鱼与比目鱼！"
    },
    fontFamily: "'M PLUS Rounded 1c', sans-serif",
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 1.4,
    letterSpacing: 0.5,
    scaleX: 100,
    scaleY: 100,
    baselineShift: 0,
    textAlign: "center",
    fauxBold: false,
    fauxItalic: false,
    allCaps: false,
    smallCaps: false,
    superscript: false,
    subscript: false,
    underline: false,
    strikethrough: false,
    alignH: "center",
    alignV: "middle",
    posX: 0,
    posY: 0,
    scale: 100,
    rotation: 0,
    opacity: 100,
    fillEnabled: true,
    fillType: "solid",
    fillColor: "#94a3b8",
    fillGradStops: [
      { color: "#94a3b8", pos: 0 },
      { color: "#cbd5e1", pos: 100 }
    ],
    fillGradAngle: 90,
    strokeEnabled: false,
    strokeColor: "#000000",
    strokeWidth: 2,
    bgEnabled: false,
    bgColor: "#0f172a",
    bgOpacity: 70,
    bgPaddingX: 10,
    bgPaddingY: 4,
    bgRadius: 8,
    shadowEnabled: false,
    shadowColor: "#000000",
    shadowOpacity: 50,
    shadowAngle: 135,
    shadowDistance: 2,
    shadowBlur: 4
  }
};

export const DEFAULT_MODE_SELECT_SCREEN = {
  masterAvatar: "./images/BUTA_shokunin.png",
  masterSpeech: "おう！おめぇはどっちの魚が好きなんだい！？\n自分の派閥をハッキリさせな！",
  masterSpeechByLang: {
    ja: "おう！おめぇはどっちの魚が好きなんだい！？\n自分の派閥をハッキリさせな！",
    en: "Hey you! Which side do you belong to!?\nPick your faction right now!",
    ko: "이봐! 넌 어느 파냐!?\n어느 쪽을 좋아하는지 분명히 골라봐!",
    zh: "喂！你小子到底是哪一派的！？\n赶紧亮明你的阵营！"
  },
  modes: {
    karei: {
      nameByLang: { ja: "🐟 カレイ派", en: "🐟 Karei Team", ko: "🐟 가자미파", zh: "🐟 鲽鱼派" },
      descByLang: {
        ja: "カレイだけをひたすら獲る！\n（ヒラメは獲るなよ！）",
        en: "Catch Karei only!\n(Don't touch Hirame!)",
        ko: "가자미만 계속 골라라!\n(광어는 건드리지 마라!)",
        zh: "专挑右侧鲽鱼！\n（千万别碰牙鲆！）"
      }
    },
    hirame: {
      nameByLang: { ja: "🦈 ヒラメ派", en: "🦈 Hirame Team", ko: "🦈 광어파", zh: "🦈 牙鲆派" },
      descByLang: {
        ja: "ヒラメだけをひたすら獲る！\n（カレイは獲るなよ！）",
        en: "Catch Hirame only!\n(Don't touch Karei!)",
        ko: "광어만 계속 골라라!\n(가자미는 건드리지 마라!)",
        zh: "专挑左侧牙鲆！\n（千万别碰鲽鱼！）"
      }
    },
    hirai: {
      nameByLang: { ja: "⚖️ ヒライ派（仕分け）", en: "⚖️ Hirai Team (Sort Both)", ko: "⚖️ 히라이파 (분류 달인)", zh: "⚖️ 平鲽派（双向分拣）" },
      descByLang: {
        ja: "両方愛する達人！\nバケツを選んで正確に仕分けろ！",
        en: "Master who loves both!\nSwitch buckets and sort accurately!",
        ko: "둘 다 사랑하는 고수!\n양동이를 골라 정확히 분류해라!",
        zh: "两者兼得的高手！\n选择水桶精准分类！"
      }
    }
  }
};

export const DEFAULT_BGM_BANNER_CONFIG = {
  holdSec: 61,            // 0: 瞬時, 1~60: 秒数, 61: 無効 (デフォルト61)
  tapCount: 1,           // トリガー必要タップ回数 (1~10, デフォルト1)
  actionType: 'modal',   // 'modal' または 'link'
  title: '自作楽曲ストリーミング',
  message: 'Core Tuneより各配信サービスにて好評配信中！',
  linkUrl: 'https://linkco.re/HaZSEutS',
  linkText: '🎵 配信プラットフォーム一覧を開く'
};

export const DEFAULT_CHARACTER_LORE = [
  {
    id: 'karei',
    name: 'カレイ',
    nameByLang: { ja: 'カレイ', en: 'Karei (Righteye Flounder)', ko: '가자미', zh: '鲽鱼' },
    enabled: true,
    appearanceRate: 0,
    subtitle: 'これがカレイだ！',
    subtitleByLang: { ja: 'これがカレイだ！', en: 'This is Karei!', ko: '이것이 가자미다!', zh: '这就是鲽鱼！' },
    description: '「左ヒラメに右カレイ」でおなじみ。目が右側に集まっているのが特徴。おちょぼ口でゴカイが大好物！',
    descriptionByLang: {
      ja: '「左ヒラメに右カレイ」でおなじみ。目が右側に集まっているのが特徴。おちょぼ口でゴカイが大好物！',
      en: "Famous for 'Eyes on the right for Karei'. Small mouth and loves sea worms!",
      ko: "'좌광우도(왼쪽 광어, 오른쪽 가자미)'로 유명. 눈이 오른쪽에 모여 있는 것이 특징. 작은 입으로 지렁이를 좋아함!",
      zh: '俗称“左鲆右鲽”。双眼集中在右侧为其特征。小嘴巴最爱吃沙蚕！'
    },
    touchEffects: ['flee', 'glare'],
    tapEffect: 'flee'
  },
  {
    id: 'hirame',
    name: 'ヒラメ',
    nameByLang: { ja: 'ヒラメ', en: 'Hirame (Olive Flounder)', ko: '넙치 (광어)', zh: '牙鲆 (比目鱼)' },
    enabled: true,
    appearanceRate: 0,
    subtitle: 'これがヒラメだ！',
    subtitleByLang: { ja: 'これがヒラメだ！', en: 'This is Hirame!', ko: '이것이 광어다!', zh: '这就是牙鲆！' },
    description: '「左ヒラメに右カレイ」。精悍な顔つきと鋭い歯を持ち、小魚を急襲する海のハンター！',
    descriptionByLang: {
      ja: '「左ヒラメに右カレイ」。精悍な顔つきと鋭い歯を持ち、小魚を急襲する海のハンター！',
      en: "Famous for 'Eyes on the left for Hirame'. Fierce face, sharp teeth, hunter of small fish!",
      ko: "'왼쪽 광어, 오른쪽 가자미'. 용맹한 얼굴과 날카로운 이빨을 가진 바다의 사냥꾼!",
      zh: '俗称“左鲆右鲽”。面容霸气牙齿锋利，突袭小鱼的海洋猎手！'
    },
    touchEffects: ['flee', 'glare'],
    tapEffect: 'flee'
  },
  {
    id: 'boo_chan',
    name: 'ぶーちゃん',
    nameByLang: { ja: 'ぶーちゃん', en: 'Boo-chan', ko: '부짱 (돼지돌고래)', zh: '嘟嘟猪' },
    enabled: true,
    appearanceRate: 0,
    subtitle: '伝説の幸運豚イルカ！',
    subtitleByLang: { ja: '伝説の幸運豚イルカ！', en: 'Legendary Lucky Pig-Dolphin!', ko: '전설의 행운 돼지돌고래!', zh: '传说中的幸运猪豚！' },
    description: '愛嬌たっぷりのブタ鼻で海を泳ぐスペシャルキャラクター。タップすると大量ボーナス！',
    descriptionByLang: {
      ja: '愛嬌たっぷりのブタ鼻で海を泳ぐスペシャルキャラクター。タップすると大量ボーナス！',
      en: 'A charming special pig-nosed sea swimmer. Tap for a massive score bonus!',
      ko: '애교 넘치는 돼지코로 바다를 헤엄치는 스페셜 캐릭터. 탭하면 대량 보너스 획득!',
      zh: '长着可爱猪鼻子的特别游泳健将。点击即可获得巨额加分奖励！'
    },
    touchEffects: ['lucky'],
    tapEffect: 'lucky'
  },
  {
    id: 'octopus',
    name: 'タコ',
    nameByLang: { ja: 'タコ', en: 'Octopus', ko: '문어', zh: '章鱼' },
    enabled: true,
    appearanceRate: 0,
    subtitle: 'お邪魔な墨吐き名人！',
    subtitleByLang: { ja: 'お邪魔な墨吐き名人！', en: 'Pesky Ink Blaster!', ko: '성가신 먹물 장인!', zh: '捣蛋喷墨专家！' },
    description: 'ターゲット魚の上に覆いかぶさって視界を塞ぐ邪魔キャラ。触れると真っ黒な墨を吐いて視界を奪うぞ！',
    descriptionByLang: {
      ja: 'ターゲット魚の上に覆いかぶさって視界を塞ぐ邪魔キャラ。触れると真っ黒な墨を吐いて視界を奪うぞ！',
      en: 'Covers target fish to block your vision. Tap it and it blasts dark ink across your screen!',
      ko: '목표 물고기를 가려 시야를 방해하는 방해 캐릭터. 건드리면 새까만 먹물을 뿜어 시야를 가린다!',
      zh: '覆盖在目标鱼身上遮挡视线的捣蛋鬼。触碰它会喷出浓黑墨汁遮蔽视线！'
    },
    touchEffects: ['ink', 'glare'],
    tapEffect: 'ink'
  },
  {
    id: 'squid',
    name: 'イカ',
    nameByLang: { ja: 'イカ', en: 'Squid', ko: '오징어', zh: '乌贼' },
    enabled: true,
    appearanceRate: 0,
    subtitle: 'ジェット噴射の妨害イカ！',
    subtitleByLang: { ja: 'ジェット噴射の妨害イカ！', en: 'Jet-propelled Trouble Squid!', ko: '제트 분사 방해 오징어!', zh: '喷射干扰乌贼！' },
    description: '猛スピードで画面を横切る海のジェット機！タップすると濃密なスミを連射して逃走する！',
    descriptionByLang: {
      ja: '猛スピードで画面を横切る海のジェット機！タップすると濃密なスミを連射して逃走する！',
      en: 'The jet plane of the sea speeding across the screen! Tapping triggers a rapid ink escape!',
      ko: '엄청난 속도로 화면을 질주하는 바다의 제트기! 탭하면 짙은 먹물을 난사하고 도주한다!',
      zh: '以极高速度掠过屏幕的海洋喷气机！点击它会喷射浓厚墨汁疾速逃脱！'
    },
    touchEffects: ['ink'],
    tapEffect: 'ink'
  },
  {
    id: 'stingray',
    name: 'エイ',
    nameByLang: { ja: 'エイ', en: 'Stingray', ko: '가오리', zh: '鳐鱼' },
    enabled: true,
    appearanceRate: 0,
    subtitle: '巨大な深海の巨大影！',
    subtitleByLang: { ja: '巨大な深海の巨大影！', en: 'Giant Shadow of the Deep!', ko: '심해의 거대한 그림자!', zh: '深海巨型黑影！' },
    description: 'ゆったりと大きなヒレを広げて海底を巡航する。ターゲットを覆い隠してしまう厄介者。',
    descriptionByLang: {
      ja: 'ゆったりと大きなヒレを広げて海底を巡航する。ターゲットを覆い隠してしまう厄介者。',
      en: 'Cruises slowly across the seabed with huge fins, covering and hiding target fish.',
      ko: '커다란 지느러미를 활짝 펴고 바다 밑바닥을 순항한다. 목표 물고기를 가려버리는 복병.',
      zh: '展开巨大的鱼鳍在海底优雅巡航。经常遮盖住目标鱼的麻烦制造者。'
    },
    touchEffects: ['flee'],
    tapEffect: 'flee'
  },
  {
    id: 'aji_open',
    name: 'アジの開き',
    nameByLang: { ja: 'アジの開き', en: 'Dried Horse Mackerel', ko: '전갱이 건어물', zh: '竹荚鱼干' },
    enabled: true,
    appearanceRate: 0,
    subtitle: 'なぜ海に干物が！？',
    subtitleByLang: { ja: 'なぜ海に干物が！？', en: 'Why is dried fish in the ocean!?', ko: '왜 바다에 건어물이!?', zh: '海里怎么会有鱼干！？' },
    description: '塩味が効いた美味しそうなアジの開き。獲ってしまうと減点ペナルティを受けるので注意！',
    descriptionByLang: {
      ja: '塩味が効いた美味しそうなアジの開き。獲ってしまうと減点ペナルティを受けるので注意！',
      en: 'Deliciously salted dried horse mackerel. Watch out, catching it penalizes your score!',
      ko: '짭조름하고 맛있는 전갱이 건어물. 잡으면 점수 감점 페널티가 있으니 주의!',
      zh: '腌制入味香喷喷的开边竹荚鱼干。捕捞会扣分受罚，千万小心！'
    },
    touchEffects: ['flee', 'glare'],
    tapEffect: 'flee'
  },
  {
    id: 'shitabirame',
    name: 'シタビラメ',
    nameByLang: { ja: 'シタビラメ', en: 'Black Cow Tongue Sole', ko: '서대 (시타비라메)', zh: '龙利鱼 (舌鳎)' },
    enabled: true,
    appearanceRate: 0,
    subtitle: 'ムニエルの王様！',
    subtitleByLang: { ja: 'ムニエルの王様！', en: 'King of Meunière!', ko: '뫼니에르의 제왕!', zh: '嫩煎鱼排之王！' },
    description: '靴底のような細長い姿が特徴。ヒラメやカレイと見間違えやすいひっかけ魚！',
    descriptionByLang: {
      ja: '靴底のような細長い姿が特徴。ヒラメやカレイと見間違えやすいひっかけ魚！',
      en: 'Characterized by its slender shoe-sole shape. A tricky fish easily confused with flounder!',
      ko: '신발 밑창 같은 가늘고 긴 모양이 특징. 넙치나 가자미로 착각하기 쉬운 함정 물고기!',
      zh: '外形细长如鞋底为其特征。极易与比目鱼或鲽鱼混淆的陷阱鱼！'
    },
    touchEffects: ['flee', 'glare'],
    tapEffect: 'flee'
  },
  {
    id: 'kanji_hirame',
    name: '漢字「鮃」',
    nameByLang: { ja: '漢字「鮃」', en: "Kanji '鮃' (Hirame)", ko: "한자 '鮃' (넙치)", zh: '汉字“鮃” (比目鱼)' },
    enabled: true,
    appearanceRate: 0,
    subtitle: '魚偏に平らでヒラメ！',
    subtitleByLang: { ja: '魚偏に平らでヒラメ！', en: 'Fish radical + Flat = Hirame!', ko: '물고기 변에 평평할 평 = 넙치!', zh: '鱼字旁加平＝牙鲆！' },
    description: '漢字表記のヒラメ。ヒラメ派モードではしっかりターゲットとして捕獲できるぞ！',
    descriptionByLang: {
      ja: '漢字表記のヒラメ。ヒラメ派モードではしっかりターゲットとして捕獲できるぞ！',
      en: 'Kanji character for Hirame. Catch it as a valid target in Hirame mode!',
      ko: '넙치(광어)를 뜻하는 한자. 광어파 모드에서 당당한 타깃으로 포획할 수 있다!',
      zh: '比目鱼的汉字写法。在比目鱼派模式中可以作为得分目标稳稳捕捞！'
    },
    touchEffects: ['flee', 'glare'],
    tapEffect: 'flee'
  },
  {
    id: 'kanji_karei_1',
    name: '漢字「鰈」',
    nameByLang: { ja: '漢字「鰈」', en: "Kanji '鰈' (Karei)", ko: "한자 '鰈' (가자미)", zh: '汉字“鰈” (鲽鱼)' },
    enabled: true,
    appearanceRate: 0,
    subtitle: '魚偏に葉っぱでカレイ！',
    subtitleByLang: { ja: '魚偏に葉っぱでカレイ！', en: 'Fish radical + Leaf = Karei!', ko: '물고기 변에 잎 엽 = 가자미!', zh: '鱼字旁加叶＝鲽鱼！' },
    description: '木の葉のように薄いカレイを表す漢字。カレイ派モードで忘れずに仕分けよう！',
    descriptionByLang: {
      ja: '木の葉のように薄いカレイを表す漢字。カレイ派モードで忘れずに仕分けよう！',
      en: "Don't forget to sort leaf-thin Karei kanji in Karei mode!",
      ko: '나뭇잎처럼 얇은 가자미를 나타내는 한자. 가자미파 모드에서 잊지 말고 잡자!',
      zh: '代表如树叶般扁平鲽鱼的汉字。在鲽鱼派模式中千万别忘记捕捞！'
    },
    touchEffects: ['flee', 'glare'],
    tapEffect: 'flee'
  },
  {
    id: 'kanji_karei_2',
    name: '漢字「魪」',
    nameByLang: { ja: '漢字「魪」', en: "Kanji '魪' (Karei 2)", ko: "한자 '魪' (가자미 2)", zh: '汉字“魪” (罕见鲽字)' },
    enabled: true,
    appearanceRate: 0,
    subtitle: '珍しいもう一つのカレイ！',
    subtitleByLang: { ja: '珍しいもう一つのカレイ！', en: 'Rare alternate Karei kanji!', ko: '보기 드문 또 하나의 가자미 한자!', zh: '难得一见的另一个鲽字！' },
    description: '「魪」もカレイと読む難読漢字。見つけたら素早くタップして得点を稼ごう！',
    descriptionByLang: {
      ja: '「魪」もカレイと読む難読漢字。見つけたら素早くタップして得点を稼ごう！',
      en: 'A rare kanji also read as Karei. Spot it and tap quickly to rack up points!',
      ko: "'魪' 역시 가자미로 읽는 희귀 한자. 발견하면 재빨리 탭하여 점수를 획득하자!",
      zh: '读作鲽鱼的罕见难读汉字。发现它后迅速点击以赚取分数吧！'
    },
    touchEffects: ['flee', 'glare'],
    tapEffect: 'flee'
  }
];

export const DEFAULT_CHAOS_FEVER_CONFIG = {
  enabled: true,
  triggerTimeSec: 10,       // 残り10秒で発動
  maxScreenFishes: 70,      // 画面全体の最大匹数制限 (10〜120匹)
  messageText: '',          // 空なら言語別i18nを使用
  confettiEnabled: true,
  characters: {
    karei: { enabled: true, count: 12 },
    hirame: { enabled: true, count: 12 },
    boo_chan: { enabled: true, count: 2 },
    octopus: { enabled: true, count: 6 },
    squid: { enabled: true, count: 6 },
    stingray: { enabled: true, count: 3 },
    aji_open: { enabled: true, count: 6 },
    shitabirame: { enabled: true, count: 6 },
    kanji_karei_1: { enabled: true, count: 4 },
    kanji_karei_2: { enabled: true, count: 4 },
    kanji_hirame: { enabled: true, count: 4 }
  }
};

export function normalizeCharacterLore(lore) {
  const validEffects = ['flee', 'lucky', 'ink', 'glare'];
  const normalizeEffects = (item) => {
    if (Array.isArray(item.touchEffects) && item.touchEffects.length > 0) {
      const filtered = item.touchEffects.filter(e => validEffects.includes(e));
      if (filtered.length > 0) return filtered;
    }
    // 旧tapEffectからのマイグレーション
    if (item.tapEffect === 'ink' || item.id === 'octopus' || item.id === 'squid') return ['ink'];
    if (item.tapEffect === 'lucky' || item.id === 'boo_chan') return ['lucky'];
    return ['flee'];
  };

  const defMap = new Map(DEFAULT_CHARACTER_LORE.map(d => [d.id, d]));

  const mergeItem = (item) => {
    const def = defMap.get(item.id) || {};
    return {
      id: item.id || 'unknown',
      name: item.name || def.name || item.id,
      nameByLang: {
        ja: item.nameByLang?.ja || item.name || def.nameByLang?.ja || def.name || '',
        en: item.nameByLang?.en || def.nameByLang?.en || item.name || '',
        ko: item.nameByLang?.ko || def.nameByLang?.ko || item.name || '',
        zh: item.nameByLang?.zh || def.nameByLang?.zh || item.name || ''
      },
      enabled: item.enabled !== false,
      appearanceRate: item.appearanceRate !== undefined ? item.appearanceRate : (item.rate !== undefined ? item.rate : 0),
      subtitle: item.subtitle || def.subtitle || '',
      subtitleByLang: {
        ja: item.subtitleByLang?.ja || item.subtitle || def.subtitleByLang?.ja || def.subtitle || '',
        en: item.subtitleByLang?.en || def.subtitleByLang?.en || item.subtitle || '',
        ko: item.subtitleByLang?.ko || def.subtitleByLang?.ko || item.subtitle || '',
        zh: item.subtitleByLang?.zh || def.subtitleByLang?.zh || item.subtitle || ''
      },
      description: item.description || def.description || '',
      descriptionByLang: {
        ja: item.descriptionByLang?.ja || item.description || def.descriptionByLang?.ja || def.description || '',
        en: item.descriptionByLang?.en || def.descriptionByLang?.en || item.description || '',
        ko: item.descriptionByLang?.ko || def.descriptionByLang?.ko || item.description || '',
        zh: item.descriptionByLang?.zh || def.descriptionByLang?.zh || item.description || ''
      },
      touchEffects: normalizeEffects(item),
      tapEffect: item.tapEffect || (item.id === 'octopus' || item.id === 'squid' ? 'ink' : item.id === 'boo_chan' ? 'lucky' : 'flee')
    };
  };

  if (!lore) return JSON.parse(JSON.stringify(DEFAULT_CHARACTER_LORE));
  if (Array.isArray(lore) && lore.length > 0) {
    const list = lore.map(mergeItem);
    // デフォルトキャラが不足している場合は追加補完
    const existingIds = new Set(list.map(c => c.id));
    for (const def of DEFAULT_CHARACTER_LORE) {
      if (!existingIds.has(def.id)) {
        list.push(JSON.parse(JSON.stringify(def)));
        existingIds.add(def.id);
      }
    }
    return list;
  }
  if (typeof lore === 'object') {
    const list = Object.entries(lore).map(([id, val]) => mergeItem({ ...val, id }));
    const existingIds = new Set(list.map(c => c.id));
    for (const def of DEFAULT_CHARACTER_LORE) {
      if (!existingIds.has(def.id)) {
        list.push(JSON.parse(JSON.stringify(def)));
        existingIds.add(def.id);
      }
    }
    return list;
  }
  return JSON.parse(JSON.stringify(DEFAULT_CHARACTER_LORE));
}

export function applyTextCustomStyles(element, style, lang = null) {
  if (!element || !style) return;

  const currentL = lang || ((typeof getCurrentLang === 'function') ? getCurrentLang() : 'ja');
  let localizedText = null;

  const dataKey = element.getAttribute ? element.getAttribute('data-i18n') : null;
  const jaText = (style.textByLang && style.textByLang.ja) || style.text;

  if (style.textByLang && style.textByLang[currentL] !== undefined && style.textByLang[currentL] !== '') {
    // If language is not 'ja', check if currentL was mistakenly set identically to Japanese text
    if (currentL !== 'ja' && jaText && style.textByLang[currentL] === jaText) {
      if (dataKey && translations && translations[currentL]?.[dataKey]) {
        localizedText = translations[currentL][dataKey];
      } else {
        localizedText = style.textByLang[currentL];
      }
    } else {
      localizedText = style.textByLang[currentL];
    }
  } else if (currentL === 'ja' && style.text !== undefined && style.text !== null) {
    localizedText = style.text;
  } else {
    if (dataKey && translations && translations[currentL]?.[dataKey]) {
      localizedText = translations[currentL][dataKey];
    } else {
      const FALLBACKS = {
        en: {
          "HoK！\n~華麗にヒラメいた！~": "HoK!\n~Catch & Sort Fishes!~",
          "カレイとヒラメを瞬時に見分けろ！": "Distinguish Karei and Hirame in a flash!"
        },
        ko: {
          "HoK！\n~華麗にヒラメいた！~": "HoK!\n~화려하게 번뜩였다!~",
          "カレイとヒラメを瞬時に見分けろ！": "가자미와 넙치를 순식간에 구別하라!",
          "カレイとヒラメを瞬時に見分けろ！": "가자미와 넙치를 순식간에 구별하라!"
        },
        zh: {
          "HoK！\n~華麗にヒラメいた！~": "HoK！\n~华丽灵感大分流！~",
          "カレイとヒラメを瞬時に見分けろ！": "瞬间辨别鲽鱼与比目鱼！"
        }
      };
      if (FALLBACKS[currentL] && style.text && FALLBACKS[currentL][style.text]) {
        localizedText = FALLBACKS[currentL][style.text];
      } else if (style.text !== undefined && style.text !== null) {
        localizedText = style.text;
      }
    }
  }

  if (localizedText !== null) {
    element.innerText = localizedText;
  }
  element.style.whiteSpace = "pre-line";

  // Typography
  element.style.fontFamily = style.fontFamily || "'M PLUS Rounded 1c', sans-serif";
  element.style.fontWeight = style.fauxBold ? "900" : (style.fontWeight || "700");
  element.style.fontStyle = style.fauxItalic ? "italic" : "normal";
  element.style.fontSize = `${style.fontSize || 24}px`;
  element.style.lineHeight = style.lineHeight ? `${style.lineHeight}` : "1.3";
  element.style.letterSpacing = `${style.letterSpacing || 0}px`;
  element.style.textAlign = style.textAlign || "center";
  element.style.textTransform = style.allCaps ? "uppercase" : "none";
  element.style.fontVariant = style.smallCaps ? "small-caps" : "normal";

  // Text decoration
  const decors = [];
  if (style.underline) decors.push("underline");
  if (style.strikethrough) decors.push("line-through");
  element.style.textDecoration = decors.length > 0 ? decors.join(" ") : "none";

  // Transform
  const sx = ((style.scaleX || 100) / 100) * ((style.scale || 100) / 100);
  const sy = ((style.scaleY || 100) / 100) * ((style.scale || 100) / 100);
  const rot = style.rotation || 0;
  const px = style.posX || 0;
  const py = (style.posY || 0) + (style.baselineShift ? -style.baselineShift : 0);
  element.style.transform = `translate(${px}px, ${py}px) scale(${sx}, ${sy}) rotate(${rot}deg)`;
  element.style.transformOrigin = style.textAlign === "left" ? "left center" : (style.textAlign === "right" ? "right center" : "center center");
  element.style.opacity = `${(style.opacity !== undefined ? style.opacity : 100) / 100}`;

  // Fill
  if (style.fillEnabled !== false) {
    if (style.fillType === "gradient" && Array.isArray(style.fillGradStops) && style.fillGradStops.length > 0) {
      const stopsStr = style.fillGradStops.map(s => `${s.color} ${s.pos}%`).join(", ");
      const angle = style.fillGradAngle || 135;
      element.style.backgroundImage = `linear-gradient(${angle}deg, ${stopsStr})`;
      element.style.webkitBackgroundClip = "text";
      element.style.webkitTextFillColor = "transparent";
      element.style.color = "transparent";
    } else {
      element.style.backgroundImage = "none";
      element.style.webkitBackgroundClip = "unset";
      element.style.webkitTextFillColor = "unset";
      element.style.color = style.fillColor || "#ffffff";
    }
  } else {
    element.style.backgroundImage = "none";
    element.style.webkitBackgroundClip = "unset";
    element.style.webkitTextFillColor = "unset";
    element.style.color = "transparent";
  }

  // Stroke
  if (style.strokeEnabled && style.strokeWidth > 0) {
    element.style.webkitTextStroke = `${style.strokeWidth}px ${style.strokeColor || "#000000"}`;
    element.style.paintOrder = "stroke fill";
  } else {
    element.style.webkitTextStroke = "0px transparent";
  }

  // Background Box
  if (style.bgEnabled) {
    const alpha = (style.bgOpacity !== undefined ? style.bgOpacity : 100) / 100;
    const hex = style.bgColor || "#000000";
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    element.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    element.style.padding = `${style.bgPaddingY || 4}px ${style.bgPaddingX || 8}px`;
    element.style.borderRadius = `${style.bgRadius || 8}px`;
    element.style.display = "inline-block";
  } else {
    element.style.backgroundColor = "transparent";
    element.style.padding = "0px";
    element.style.borderRadius = "0px";
    element.style.display = "block";
  }

  // Drop Shadow
  if (style.shadowEnabled) {
    const angleRad = ((style.shadowAngle || 135) * Math.PI) / 180;
    const dist = style.shadowDistance || 4;
    const sx = Math.round(Math.cos(angleRad) * dist);
    const sy = Math.round(Math.sin(angleRad) * dist);
    const blur = style.shadowBlur || 8;
    const alpha = (style.shadowOpacity !== undefined ? style.shadowOpacity : 50) / 100;
    const hex = style.shadowColor || "#000000";
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const shadowRgba = `rgba(${r}, ${g}, ${b}, ${alpha})`;

    element.style.filter = `drop-shadow(${sx}px ${sy}px ${blur}px ${shadowRgba})`;
  } else {
    element.style.filter = "none";
  }
}

export const GAME_STATES = {
  TITLE: 'TITLE',
  MODE_SELECT: 'MODE_SELECT',
  COUNTDOWN: 'COUNTDOWN',
  PLAYING: 'PLAYING',
  RESULT: 'RESULT'
};

export const MODES = {
  KAREI: 'karei',    // カレイ派
  HIRAME: 'hirame',  // ヒラメ派
  HIRAI: 'hirai'     // ヒライ派 (仕分け)
};

export class Game {
  constructor(canvas, renderer) {
    this.canvas = canvas;
    this.renderer = renderer;

    // ゲーム状態
    this.state = GAME_STATES.TITLE;
    this.mode = MODES.KAREI;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correctCount = 0;
    this.mistakeCount = 0;
    this.timeLeft = 60; // 60秒
    this.timerInterval = null;
    this.countdownNumber = 3;

    // 餌システム
    this.baitStock = 1;
    this.lastBaitScoreThreshold = 0;
    this.baits = [];

    // 生物リスト
    this.fishes = [];
    this.ambientFishes = [];
    this.targetFishCount = 40;

    // ヒライ派（仕分けモード）の選択中バケツ ('bucketA', 'bucketB', etc.)
    this.activeBucket = 'bucketA';

    // プレイヤープロファイル (1000万人規模Base62 ID)
    this.playerName = localStorage.getItem('hirame_player_name') || '釣り吉';
    this.playerTag = this.getOrCreatePlayerTag();

    // セーフエリア（HUD下部・ボトムドック上部）
    this.safeTop = 75;
    this.safeBottom = this.canvas.height * 0.75;

    // バケツの位置キャッシュ
    this.bucketPositions = {
      bucketA: { x: 100, y: 500 },
      bucketB: { x: 300, y: 500 },
      karei: { x: 100, y: 500 },
      hirame: { x: 300, y: 500 }
    };

    // 開発者・管理ツール設定
    this.devConfig = this.loadDevConfig();
    try {
      this.adminChannel = new BroadcastChannel('hirame_admin_channel');
      this.adminChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'UPDATE_DEV_CONFIG') {
          this.devConfig = this.loadDevConfig();
        }
      };
    } catch (e) {}
    window.addEventListener('storage', (e) => {
      if (e.key === 'hirame_dev_config') {
        this.devConfig = this.loadDevConfig();
      }
    });

    this.lastTapPos = null;
    this.isFeverTime = false;

    this.initAmbientFish();
  }

  loadDevConfig() {
    try {
      let saved = localStorage.getItem('hirame_dev_config');
      if (!saved) {
        saved = localStorage.getItem('hirame_custom_default_config');
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        const characters = {};
        for (const [k, def] of Object.entries(DEFAULT_CHARACTER_SETTINGS)) {
          const v = parsed.characters?.[k] || {};
          characters[k] = {
            ...def,
            ...v,
            spawnCondition: {
              ...(def.spawnCondition || {}),
              ...(v.spawnCondition || {})
            },
            ambientTrigger: {
              ...(def.ambientTrigger || {}),
              ...(v.ambientTrigger || {})
            }
          };
        }

        const baseTitle = JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN));
        const mergedTitle = {
          ...baseTitle,
          ...(parsed.titleScreen || {}),
          mainTitle: {
            ...baseTitle.mainTitle,
            ...(parsed.titleScreen?.mainTitle || {}),
            textByLang: {
              ...baseTitle.mainTitle.textByLang,
              ...(parsed.titleScreen?.mainTitle?.textByLang || {})
            }
          },
          subTitle: {
            ...baseTitle.subTitle,
            ...(parsed.titleScreen?.subTitle || {}),
            textByLang: {
              ...baseTitle.subTitle.textByLang,
              ...(parsed.titleScreen?.subTitle?.textByLang || {})
            }
          },
          credits: {
            ...baseTitle.credits,
            ...(parsed.titleScreen?.credits || {})
          }
        };

        const baseModeSelect = JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN));
        const mergedModeSelect = {
          ...baseModeSelect,
          ...(parsed.modeSelectScreen || {}),
          masterSpeechByLang: {
            ...baseModeSelect.masterSpeechByLang,
            ...(parsed.modeSelectScreen?.masterSpeechByLang || {})
          },
          modes: {
            karei: {
              nameByLang: { ...baseModeSelect.modes.karei.nameByLang, ...(parsed.modeSelectScreen?.modes?.karei?.nameByLang || {}) },
              descByLang: { ...baseModeSelect.modes.karei.descByLang, ...(parsed.modeSelectScreen?.modes?.karei?.descByLang || {}) }
            },
            hirame: {
              nameByLang: { ...baseModeSelect.modes.hirame.nameByLang, ...(parsed.modeSelectScreen?.modes?.hirame?.nameByLang || {}) },
              descByLang: { ...baseModeSelect.modes.hirame.descByLang, ...(parsed.modeSelectScreen?.modes?.hirame?.descByLang || {}) }
            },
            hirai: {
              nameByLang: { ...baseModeSelect.modes.hirai.nameByLang, ...(parsed.modeSelectScreen?.modes?.hirai?.nameByLang || {}) },
              descByLang: { ...baseModeSelect.modes.hirai.descByLang, ...(parsed.modeSelectScreen?.modes?.hirai?.descByLang || {}) }
            }
          }
        };

        const mergedBgmBannerConfig = {
          ...DEFAULT_BGM_BANNER_CONFIG,
          ...(parsed.bgmBannerConfig || {})
        };

        const mergedAmbientConfig = {
          ...DEFAULT_AMBIENT_CONFIG,
          ...(parsed.ambientConfig || {}),
          bubbles: {
            ...DEFAULT_AMBIENT_CONFIG.bubbles,
            ...(parsed.ambientConfig?.bubbles || {})
          },
          smallFish: {
            ...DEFAULT_AMBIENT_CONFIG.smallFish,
            ...(parsed.ambientConfig?.smallFish || {})
          },
          presets: parsed.ambientConfig?.presets || JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG.presets))
        };

        return {
          timeLimitSec: parsed.timeLimitSec !== undefined ? Number(parsed.timeLimitSec) : 60,
          targetFishCount: 40,
          speedMultiplier: 1.0,
          eventScoreThreshold: 150,
          lifetimeSec: 6,
          minTargetThreshold: 2,
          refillTargetCount: 6,
          gameBalanceUnified: parsed.gameBalanceUnified !== undefined ? parsed.gameBalanceUnified : false,
          modeConfigs: parsed.modeConfigs || {
            karei: { timeLimitSec: 60, ...DEFAULT_CHARACTER_SETTINGS },
            hirame: { timeLimitSec: 60, ...DEFAULT_CHARACTER_SETTINGS },
            hirai: { timeLimitSec: 60, ...DEFAULT_CHARACTER_SETTINGS }
          },
          buckets: parsed.buckets || JSON.parse(JSON.stringify(DEFAULT_BUCKETS)),
          playerTitles: parsed.playerTitles || DEFAULT_PLAYER_TITLES,
          xShareTemplate: parsed.xShareTemplate || DEFAULT_X_SHARE_TEMPLATE,
          xShareTemplates: parsed.xShareTemplates || JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES)),
          xShareUrl: parsed.xShareUrl || '',
          characterLore: normalizeCharacterLore(parsed.characterLore),
          ambientConfig: mergedAmbientConfig,
          bgmBannerConfig: mergedBgmBannerConfig,
          chaosFeverConfig: {
            ...JSON.parse(JSON.stringify(DEFAULT_CHAOS_FEVER_CONFIG)),
            ...(parsed.chaosFeverConfig || {})
          },
          startConfig: {
            ...JSON.parse(JSON.stringify(DEFAULT_START_CONFIG)),
            ...(parsed.startConfig || {})
          },
          baitConfig: {
            ...JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG)),
            ...(parsed.baitConfig || {})
          },
          ...parsed,
          titleScreen: mergedTitle,
          modeSelectScreen: mergedModeSelect,
          characters
        };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      timeLimitSec: 60,
      targetFishCount: 20,
      speedMultiplier: 1.0,
      eventScoreThreshold: 150,
      lifetimeSec: 6,
      minTargetThreshold: 2,
      refillTargetCount: 6,
      gameBalanceUnified: false,
      modeConfigs: {
        karei: { timeLimitSec: 60, ...DEFAULT_CHARACTER_SETTINGS },
        hirame: { timeLimitSec: 60, ...DEFAULT_CHARACTER_SETTINGS },
        hirai: { timeLimitSec: 60, ...DEFAULT_CHARACTER_SETTINGS }
      },
      buckets: JSON.parse(JSON.stringify(DEFAULT_BUCKETS)),
      playerTitles: DEFAULT_PLAYER_TITLES,
      xShareTemplate: DEFAULT_X_SHARE_TEMPLATE,
      xShareTemplates: JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES)),
      xShareUrl: '',
      characterLore: JSON.parse(JSON.stringify(DEFAULT_CHARACTER_LORE)),
      titleScreen: JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN)),
      modeSelectScreen: JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN)),
      bgmBannerConfig: JSON.parse(JSON.stringify(DEFAULT_BGM_BANNER_CONFIG)),
      ambientConfig: JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG)),
      chaosFeverConfig: JSON.parse(JSON.stringify(DEFAULT_CHAOS_FEVER_CONFIG)),
      startConfig: JSON.parse(JSON.stringify(DEFAULT_START_CONFIG)),
      baitConfig: JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG)),
      characters: JSON.parse(JSON.stringify(DEFAULT_CHARACTER_SETTINGS))
    };
  }

  getActiveDevConfig() {
    if (!this.devConfig) return {};
    const mode = this.mode || 'karei';
    const baseChars = this.devConfig.characters || JSON.parse(JSON.stringify(DEFAULT_CHARACTER_SETTINGS));

    // モード別設定が存在すれば、対象モードのキャラクター設定とパラメーターを優先マージ
    const modeCfg = this.devConfig.modeConfigs?.[mode] || {};
    const modeChars = (this.devConfig.gameBalanceUnified === false && modeCfg.characters)
      ? modeCfg.characters
      : (modeCfg.characters || baseChars);

    const merged = {};
    for (const [id, def] of Object.entries(baseChars)) {
      merged[id] = {
        ...def,
        ...(modeChars[id] || {}),
        spawnCondition: {
          ...(def.spawnCondition || {}),
          ...(modeChars[id]?.spawnCondition || {})
        },
        ambientTrigger: {
          ...(def.ambientTrigger || {}),
          ...(modeChars[id]?.ambientTrigger || {})
        },
        silhouetteConfig: {
          ...(def.silhouetteConfig || DEFAULT_SILHOUETTE_CONFIG),
          ...(modeChars[id]?.silhouetteConfig || {})
        }
      };
    }
    for (const [id, mChar] of Object.entries(modeChars)) {
      if (!merged[id]) merged[id] = { ...mChar };
    }

    return {
      ...this.devConfig,
      ...modeCfg,
      timeLimitSec: Number(modeCfg.timeLimitSec ?? this.devConfig.timeLimitSec ?? 60),
      targetFishCount: modeCfg.targetFishCount || this.devConfig.targetFishCount || 40,
      minTargetThreshold: modeCfg.minTargetThreshold ?? this.devConfig.minTargetThreshold ?? 2,
      refillTargetCount: modeCfg.refillTargetCount ?? this.devConfig.refillTargetCount ?? 6,
      speedMultiplier: modeCfg.speedMultiplier || this.devConfig.speedMultiplier || 1.0,
      lifetimeSec: modeCfg.lifetimeSec || this.devConfig.lifetimeSec || 6.0,
      characters: merged,
      buckets: this.devConfig.buckets || DEFAULT_BUCKETS,
      silhouetteConfig: modeCfg.silhouetteConfig || this.devConfig.silhouetteConfig || JSON.parse(JSON.stringify(DEFAULT_SILHOUETTE_CONFIG))
    };
  }

  setDevConfig(newConfig) {
    this.devConfig = { ...this.devConfig, ...newConfig };
    localStorage.setItem('hirame_dev_config', JSON.stringify(this.devConfig));

    // ゲーム内を現在泳いでいる魚にも即時忠実に反映
    const activeCfg = this.getActiveDevConfig();
    if (this.fishes && Array.isArray(this.fishes)) {
      for (const fish of this.fishes) {
        const charCfg = activeCfg.characters?.[fish.type];
        if (charCfg) {
          if (charCfg.role) fish.role = charCfg.role;
          if (charCfg.sizeScale != null) {
            fish.sizeScale = charCfg.sizeScale;
            fish.width = (fish.baseWidth || 66) * fish.sizeScale;
            fish.height = (fish.baseHeight || 44) * fish.sizeScale;
          }
          if (charCfg.speedMultiplier != null) {
            const oldMult = fish.speedMultiplier || 1.0;
            fish.speedMultiplier = charCfg.speedMultiplier;
            if (oldMult > 0 && fish.vx) {
              fish.vx = (fish.vx / oldMult) * fish.speedMultiplier;
            }
          }
          if (charCfg.randomTurnRate != null) {
            fish.randomTurnRate = charCfg.randomTurnRate;
          }
          if (charCfg.beginnerAlert != null) {
            fish.beginnerAlert = charCfg.beginnerAlert;
          }
          if (charCfg.silhouetteConfig) {
            fish.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG, ...charCfg.silhouetteConfig };
          }
        }
      }
    }
  }

  getOrCreatePlayerTag() {
    let tag = localStorage.getItem('hirame_player_tag');
    if (!tag) {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      tag = '';
      for (let i = 0; i < 6; i++) {
        tag += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      localStorage.setItem('hirame_player_tag', tag);
    }
    return tag;
  }

  setPlayerName(name) {
    if (name && name.trim()) {
      this.playerName = name.trim();
      localStorage.setItem('hirame_player_name', this.playerName);
    }
  }

  initAmbientFish() {
    this.ambientFishes = Array.from({ length: 15 }, () => 
      new AmbientFish(this.canvas.width, this.canvas.height)
    );
  }

  setMode(mode) {
    this.mode = mode;
    this.devConfig = this.loadDevConfig();
    if (this.fishes) {
      for (const fish of this.fishes) {
        fish.setGameMode(mode);
      }
    }
  }

  startCountdown() {
    this.state = GAME_STATES.COUNTDOWN;
    this.countdownNumber = 3;
    sound.init();
    sound.stopTrackAudition(false);
    // カウントダウン中にフェードインで最初から再生開始
    sound.startBGMWithFadeIn(null, 2.5);
    sound.playCount(3);

    const step = () => {
      this.countdownNumber--;
      if (this.countdownNumber > 0) {
        sound.playCount(this.countdownNumber);
        setTimeout(step, 900);
      } else {
        sound.playCount(0); // スタート！
        this.countdownNumber = 'GO!';
        setTimeout(() => {
          this.startGameplay();
        }, 600);
      }
    };

    setTimeout(step, 900);
  }

  startGameplay() {
    this.devConfig = this.loadDevConfig();
    this.state = GAME_STATES.PLAYING;
    this.countdownNumber = null;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correctCount = 0;
    this.mistakeCount = 0;
    const activeCfg = this.getActiveDevConfig();
    const limit = Number(activeCfg?.timeLimitSec) || 60;
    this.timeLeft = limit;
    this.totalTimeLimit = limit;
    this.baitStock = 1;
    this.lastBaitScoreThreshold = 0;
    this.baits = [];
    this.fishes = [];

    // 出現条件トラッキング初期化
    this.spawnCondCounters = {
      targetTaps: 0,
      disturberTaps: 0,
      bgTaps: 0,
      charTaps: {},
      lastInteractionTime: performance.now()
    };
    this.spawnCondCooldowns = {};
    this.charRandomTargets = {};
    this.spawnConditionTriggerCounts = {};
    this.charRandomRepeatLimits = {};
    this.ambientSurge = { active: false, multiplier: 1.0, until: 0, targetPresets: [] };
    this.charAmbientTapCounts = {};

    if (activeCfg?.characters) {
      for (const [id, cCfg] of Object.entries(activeCfg.characters)) {
        this.charRandomTargets[id] = {
          targetTime: Math.floor(10 + Math.random() * 45), // 10〜55秒
          targetTaps: Math.floor(3 + Math.random() * 15)   // 3〜18回
        };
        this.charRandomRepeatLimits[id] = Math.floor(1 + Math.random() * 5); // 1〜5回ランダム
      }
    }

    // 初期出現（画面全体に上下左右広く均等分散配置し、ゆっくり優雅に泳ぎ始める）
    this.spawnGameStartFishes();

    // カウントダウン中に再生開始したBGMが万一止まっていた場合のみ再開
    if (!sound.isPlaying()) {
      sound.startBGM(null, false);
    }

    this.isFeverTime = false;

    // タイマースタート
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state !== GAME_STATES.PLAYING) return;
      this.timeLeft--;
      const feverTime = this.devConfig?.chaosFeverConfig?.triggerTimeSec !== undefined
        ? this.devConfig.chaosFeverConfig.triggerTimeSec
        : 10;
      if (this.timeLeft === feverTime) {
        this.triggerChaosFever();
      } else if (this.timeLeft < 10 && this.timeLeft > 0) {
        sound.playCount(1);
      }
      if (this.timeLeft <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  triggerChaosFever() {
    const feverCfg = this.devConfig?.chaosFeverConfig || DEFAULT_CHAOS_FEVER_CONFIG;
    if (feverCfg.enabled === false) return;

    this.isFeverTime = true;
    sound.playCombo();
    const bannerText = feverCfg.messageText || t('chaosFever');
    this.renderer.addFloatingText(bannerText, this.canvas.width * 0.5, this.canvas.height * 0.35, "#facc15", 34);
    if (feverCfg.confettiEnabled !== false) {
      confetti({
        particleCount: 50,
        spread: 90,
        origin: { x: 0.5, y: 0.4 }
      });
    }

    const bounds = {
      width: this.canvas.width,
      height: this.canvas.height,
      safeTop: this.safeTop,
      safeBottom: this.safeBottom
    };
    const activeDev = this.getActiveDevConfig();
    const maxCap = feverCfg.maxScreenFishes != null
      ? Math.max(0, Math.min(100, Number(feverCfg.maxScreenFishes)))
      : 70;
    if (maxCap === 0) return;

    // キャラクターごとの指定匹数を出現
    const charConfigs = feverCfg.characters || {};
    for (const [charId, charInfo] of Object.entries(charConfigs)) {
      if (charInfo && charInfo.enabled !== false && (charInfo.count || 0) > 0) {
        for (let i = 0; i < charInfo.count; i++) {
          if (this.fishes.length >= maxCap) break;
          this.fishes.push(new Fish(charId, bounds, activeDev, this.mode));
        }
      }
    }

    // もし指定キャラ以外または匹数が不足している場合、maxCapまで通常補充
    if (this.fishes.length < maxCap) {
      const remaining = maxCap - this.fishes.length;
      this.spawnFishes(remaining);
    }
  }

  setSafeBounds(safeTop, safeBottom) {
    this.safeTop = safeTop;
    this.safeBottom = safeBottom;
  }

  // ゲーム開始時の初期出現（画面全体に上下左右広く均等分散配置し、ゆっくり優雅に泳ぎ始める）
  spawnGameStartFishes() {
    this.fishes = [];
    const bounds = {
      width: this.canvas.width,
      height: this.canvas.height,
      safeTop: this.safeTop,
      safeBottom: this.safeBottom
    };
    const activeCfg = this.getActiveDevConfig();
    const startCfg = activeCfg?.startConfig || DEFAULT_START_CONFIG;

    const maxScreen = activeCfg?.maxScreenFishes != null ? Math.max(0, Math.min(100, Number(activeCfg.maxScreenFishes))) : 20;
    if (maxScreen === 0) {
      this.fishes = [];
      return;
    }

    const kareiCount = Math.max(0, startCfg.startKareiCount !== undefined ? Number(startCfg.startKareiCount) : 4);
    const hirameCount = Math.max(0, startCfg.startHirameCount !== undefined ? Number(startCfg.startHirameCount) : 4);
    const distTypeCount = Math.max(0, startCfg.startDisturberTypeCount !== undefined ? Number(startCfg.startDisturberTypeCount) : 3);
    const distCountPerType = Math.max(0, startCfg.startDisturberCountPerType !== undefined ? Number(startCfg.startDisturberCountPerType) : 2);

    // カレイ系候補 (バケツA所属 ＆ 出現条件OFF ＆ スコア閾値0以下のキャラのみ)
    const kareiCandidates = [FISH_TYPES.KAREI, FISH_TYPES.KANJI_KAREI_1, FISH_TYPES.KANJI_KAREI_2]
      .filter(id => !activeCfg?.characters?.[id]?.spawnCondition?.enabled && (activeCfg?.characters?.[id]?.scoreThreshold || 0) <= 0);
    if (activeCfg?.characters) {
      for (const [id, c] of Object.entries(activeCfg.characters)) {
        if ((c.role === 'bucketA' || (!c.role?.startsWith('bucket') && id.includes('karei'))) && !c.spawnCondition?.enabled && (c.scoreThreshold || 0) <= 0 && !kareiCandidates.includes(id)) {
          kareiCandidates.push(id);
        }
      }
    }
    if (kareiCandidates.length === 0) kareiCandidates.push(FISH_TYPES.KAREI);

    // ヒラメ系候補 (バケツB所属 ＆ 出現条件OFF ＆ スコア閾値0以下のキャラのみ)
    const hirameCandidates = [FISH_TYPES.HIRAME, FISH_TYPES.KANJI_HIRAME]
      .filter(id => !activeCfg?.characters?.[id]?.spawnCondition?.enabled && (activeCfg?.characters?.[id]?.scoreThreshold || 0) <= 0);
    if (activeCfg?.characters) {
      for (const [id, c] of Object.entries(activeCfg.characters)) {
        if ((c.role === 'bucketB' || (!c.role?.startsWith('bucket') && id.includes('hirame'))) && !c.spawnCondition?.enabled && (c.scoreThreshold || 0) <= 0 && !hirameCandidates.includes(id)) {
          hirameCandidates.push(id);
        }
      }
    }
    if (hirameCandidates.length === 0) hirameCandidates.push(FISH_TYPES.HIRAME);

    // 邪魔キャラ候補 (出現条件OFF ＆ スコア閾値0以下のキャラのみ)
    const disturberTypes = [FISH_TYPES.OCTOPUS, FISH_TYPES.SQUID, FISH_TYPES.STINGRAY, FISH_TYPES.AJI_OPEN, FISH_TYPES.SHITABIRAME]
      .filter(id => !activeCfg?.characters?.[id]?.spawnCondition?.enabled && (activeCfg?.characters?.[id]?.scoreThreshold || 0) <= 0);

    let fishesToSpawn = [];

    // 1. カレイ系ターゲット (候補が存在する場合のみ)
    if (kareiCandidates.length > 0) {
      for (let i = 0; i < kareiCount; i++) {
        fishesToSpawn.push(kareiCandidates[i % kareiCandidates.length]);
      }
    }

    // 2. ヒラメ系ターゲット (候補が存在する場合のみ)
    if (hirameCandidates.length > 0) {
      for (let i = 0; i < hirameCount; i++) {
        fishesToSpawn.push(hirameCandidates[i % hirameCandidates.length]);
      }
    }

    // 3. 邪魔キャラ (出現条件OFFのキャラから選出)
    if (disturberTypes.length > 0) {
      const shuffledDisturbers = [...disturberTypes].sort(() => Math.random() - 0.5);
      const selectedDisturberTypes = shuffledDisturbers.slice(0, distTypeCount);
      for (const dt of selectedDisturberTypes) {
        for (let i = 0; i < distCountPerType; i++) {
          fishesToSpawn.push(dt);
        }
      }
    }

    // 徹底防御: 出現条件ONのキャラを完全に除外
    fishesToSpawn = fishesToSpawn.filter(id => !activeCfg?.characters?.[id]?.spawnCondition?.enabled);

    // ランダム順にシャッフル
    fishesToSpawn.sort(() => Math.random() - 0.5);

    // １画面キャラ表示数設定で上限クリップ
    if (fishesToSpawn.length > maxScreen) {
      fishesToSpawn = fishesToSpawn.slice(0, maxScreen);
    }

    const total = fishesToSpawn.length;
    if (total === 0) return;

    // Y軸を上下全体（0.08〜0.92）に均等スライス＋ランダムジッターで配置（中央密集を完全に防止！）
    for (let i = 0; i < total; i++) {
      const type = fishesToSpawn[i];
      const baseRatio = (i + 0.5) / total;
      const jitter = (Math.random() - 0.5) * (0.8 / total);
      const initialYRatio = Math.max(0.08, Math.min(0.92, baseRatio + jitter));
      this.fishes.push(new Fish(type, bounds, activeCfg, this.mode, {
        isInitial: true,
        initialYRatio
      }));
    }
  }

  getTargetFishCount() {
    const activeCfg = this.getActiveDevConfig();
    return this.fishes.filter(f => {
      if (f.isDead || f.isCaptured || f.state === 'fleeing_temp') return false;
      if (f.role === 'disturber') return false;
      return isTargetForMode(f.type, this.mode, activeCfg);
    }).length;
  }

  spawnTargetFishes(count) {
    const bounds = {
      width: this.canvas.width,
      height: this.canvas.height,
      safeTop: this.safeTop,
      safeBottom: this.safeBottom
    };
    const activeCfg = this.getActiveDevConfig();
    const baseTarget = activeCfg?.maxScreenFishes != null ? Math.max(0, Math.min(100, Number(activeCfg.maxScreenFishes))) : (activeCfg?.targetFishCount || this.targetFishCount || 20);
    const feverLimit = activeCfg?.chaosFeverConfig?.maxScreenFishes != null
      ? Math.max(0, Math.min(100, Number(activeCfg.chaosFeverConfig.maxScreenFishes)))
      : Math.max(baseTarget * 2, 70);
    const maxCount = this.isFeverTime ? feverLimit : baseTarget;
    if (maxCount === 0) return;

    // モードに応じたターゲット候補プール
    const targetCandidates = [];
    if (this.mode === MODES.KAREI) {
      targetCandidates.push(FISH_TYPES.KAREI, FISH_TYPES.KANJI_KAREI_1, FISH_TYPES.KANJI_KAREI_2);
    } else if (this.mode === MODES.HIRAME) {
      targetCandidates.push(FISH_TYPES.HIRAME, FISH_TYPES.KANJI_HIRAME);
    } else {
      targetCandidates.push(FISH_TYPES.KAREI, FISH_TYPES.HIRAME, FISH_TYPES.KANJI_KAREI_1, FISH_TYPES.KANJI_KAREI_2, FISH_TYPES.KANJI_HIRAME);
    }

    // 各バケツ・ターゲット設定キャラも候補に追加
    if (activeCfg?.characters) {
      for (const [id, c] of Object.entries(activeCfg.characters)) {
        if (c.spawnCondition?.enabled || c.role === 'disturber') continue;
        if (this.mode === MODES.KAREI && (c.role === 'bucketA' || c.role === 'target') && !targetCandidates.includes(id)) targetCandidates.push(id);
        if (this.mode === MODES.HIRAME && (c.role === 'bucketB' || c.role === 'target') && !targetCandidates.includes(id)) targetCandidates.push(id);
        if (this.mode === MODES.HIRAI && (c.role?.startsWith('bucket') || c.role === 'target') && !targetCandidates.includes(id)) targetCandidates.push(id);
      }
    }

    // スペシャルキャラ「ぶーちゃん」は条件OFFならターゲット候補に加わる
    targetCandidates.push(FISH_TYPES.BOO_CHAN);

    const validTargets = targetCandidates.filter(id => {
      const cfg = activeCfg?.characters?.[id];
      if (cfg?.spawnCondition?.enabled) return false;
      const threshold = cfg?.scoreThreshold != null ? cfg.scoreThreshold : 0;
      if (this.score < threshold && !this.isFeverTime) return false;
      return cfg ? cfg.role !== 'disturber' : true;
    });

    const pool = validTargets.length > 0 ? validTargets : targetCandidates.filter(id => {
      const cfg = activeCfg?.characters?.[id];
      if (cfg?.spawnCondition?.enabled) return false;
      const threshold = cfg?.scoreThreshold != null ? cfg.scoreThreshold : 0;
      return this.score >= threshold || this.isFeverTime;
    });
    if (pool.length === 0) return;

    for (let i = 0; i < count; i++) {
      if (this.fishes.length >= maxCount) break;
      const type = pool[Math.floor(Math.random() * pool.length)];
      if (!type || activeCfg?.characters?.[type]?.spawnCondition?.enabled) continue;
      this.fishes.push(new Fish(type, bounds, activeCfg, this.mode));
    }
  }

  spawnFishes(count, isInitial = false) {
    const bounds = {
      width: this.canvas.width,
      height: this.canvas.height,
      safeTop: this.safeTop,
      safeBottom: this.safeBottom
    };
    const activeCfg = this.getActiveDevConfig();
    const baseTarget = activeCfg?.maxScreenFishes != null ? Math.max(0, Math.min(100, Number(activeCfg.maxScreenFishes))) : (activeCfg?.targetFishCount || this.targetFishCount || 20);
    const feverLimit = activeCfg?.chaosFeverConfig?.maxScreenFishes != null
      ? Math.max(0, Math.min(100, Number(activeCfg.chaosFeverConfig.maxScreenFishes)))
      : Math.max(baseTarget * 2, 70);
    const maxCount = this.isFeverTime ? feverLimit : baseTarget;
    if (maxCount === 0) return;

    // 特殊障害物候補（タコ・イカ・エイなどの障害生物：スコア閾値到達済み ＆ ウェイト > 0）
    const obstacleTypes = [FISH_TYPES.OCTOPUS, FISH_TYPES.SQUID, FISH_TYPES.STINGRAY, FISH_TYPES.AJI_OPEN, FISH_TYPES.SHITABIRAME];
    const disturberCandidates = [];
    if (activeCfg?.characters) {
      for (const [id, cfg] of Object.entries(activeCfg.characters)) {
        if (cfg.role === 'disturber' && obstacleTypes.includes(id)) {
          // 出現条件ONのキャラは除外
          if (cfg.spawnCondition?.enabled) continue;
          const weight = cfg.weight != null ? cfg.weight : 20;
          const threshold = cfg.scoreThreshold != null ? cfg.scoreThreshold : 150;
          if (weight > 0 && (this.score >= threshold || this.isFeverTime)) {
            disturberCandidates.push({ type: id, weight });
          }
        }
      }
    }

    // カレイ系・バケツA候補（出現条件ONのキャラは除外、全キャラ共通スコア閾値判定）
    const kareiCandidates = Object.keys(activeCfg?.characters || {})
      .filter(id => {
        const c = activeCfg.characters[id];
        if (c.spawnCondition?.enabled || c.role === 'disturber') return false;
        const threshold = c.scoreThreshold != null ? c.scoreThreshold : 0;
        if (this.score < threshold && !this.isFeverTime) return false;
        return c.role === 'bucketA' || (!c.role?.startsWith('bucket') && (id === FISH_TYPES.KAREI || id === FISH_TYPES.KANJI_KAREI_1 || id === FISH_TYPES.KANJI_KAREI_2));
      });
    if (kareiCandidates.length === 0) kareiCandidates.push(FISH_TYPES.KAREI);

    // ヒラメ系・バケツB候補（出現条件ONのキャラは除外、全キャラ共通スコア閾値判定）
    const hirameCandidates = Object.keys(activeCfg?.characters || {})
      .filter(id => {
        const c = activeCfg.characters[id];
        if (c.spawnCondition?.enabled || c.role === 'disturber') return false;
        const threshold = c.scoreThreshold != null ? c.scoreThreshold : 0;
        if (this.score < threshold && !this.isFeverTime) return false;
        return c.role === 'bucketB' || (!c.role?.startsWith('bucket') && (id === FISH_TYPES.HIRAME || id === FISH_TYPES.KANJI_HIRAME));
      });
    if (hirameCandidates.length === 0) hirameCandidates.push(FISH_TYPES.HIRAME);

    // ぶーちゃん（条件OFFなら全モードでレア出現候補に混ぜる、スコア閾値到達時のみ）
    const booCfg = activeCfg?.characters?.[FISH_TYPES.BOO_CHAN];
    const booThreshold = booCfg?.scoreThreshold != null ? booCfg.scoreThreshold : 0;
    const booChanAvailable = !booCfg?.spawnCondition?.enabled && (this.score >= booThreshold || this.isFeverTime);

    const obstacleRate = (activeCfg?.obstacleRate != null ? activeCfg.obstacleRate / 100 : 0.25);
    const spawnDisturberChance = this.isFeverTime ? 0.35 : obstacleRate;

    for (let i = 0; i < count; i++) {
      if (this.fishes.length >= maxCount) break;
      let type;
      if (disturberCandidates.length > 0 && Math.random() < spawnDisturberChance) {
        const totalWeight = disturberCandidates.reduce((sum, c) => sum + c.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const c of disturberCandidates) {
          if (rand < c.weight) {
            type = c.type;
            break;
          }
          rand -= c.weight;
        }
        if (!type) type = disturberCandidates[0].type;
      } else {
        // まれにぶーちゃんが出現（条件OFF時、約7%）
        if (booChanAvailable && Math.random() < 0.07) {
          type = FISH_TYPES.BOO_CHAN;
        } else if (this.mode === MODES.KAREI) {
          // カレイ派：カレイ系(約55%〜60%)とヒラメ系オトリ(約40%〜45%)を共存
          const isKarei = Math.random() < 0.58;
          if (isKarei && kareiCandidates.length > 0) {
            type = kareiCandidates[Math.floor(Math.random() * kareiCandidates.length)];
          } else if (hirameCandidates.length > 0) {
            type = hirameCandidates[Math.floor(Math.random() * hirameCandidates.length)];
          } else {
            type = kareiCandidates[0] || FISH_TYPES.KAREI;
          }
        } else if (this.mode === MODES.HIRAME) {
          // ヒラメ派：ヒラメ系(約55%〜60%)とカレイ系オトリ(約40%〜45%)を共存
          const isHirame = Math.random() < 0.58;
          if (isHirame && hirameCandidates.length > 0) {
            type = hirameCandidates[Math.floor(Math.random() * hirameCandidates.length)];
          } else if (kareiCandidates.length > 0) {
            type = kareiCandidates[Math.floor(Math.random() * kareiCandidates.length)];
          } else {
            type = hirameCandidates[0] || FISH_TYPES.HIRAME;
          }
        } else {
          // ヒライ派：両方がターゲット（50% / 50%）
          const isKarei = Math.random() < 0.5;
          if (isKarei && kareiCandidates.length > 0) {
            type = kareiCandidates[Math.floor(Math.random() * kareiCandidates.length)];
          } else if (hirameCandidates.length > 0) {
            type = hirameCandidates[Math.floor(Math.random() * hirameCandidates.length)];
          } else {
            type = Math.random() < 0.5 ? (kareiCandidates[0] || FISH_TYPES.KAREI) : (hirameCandidates[0] || FISH_TYPES.HIRAME);
          }
        }
      }
      if (!type || activeCfg?.characters?.[type]?.spawnCondition?.enabled) {
        continue;
      }
      this.fishes.push(new Fish(type, bounds, activeCfg, this.mode, { isInitial }));
    }
  }

  checkSpawnConditions(triggerSource = 'any') {
    if (this.state !== GAME_STATES.PLAYING) return;
    const activeCfg = this.getActiveDevConfig();
    if (!activeCfg?.characters) return;

    const now = performance.now();
    const idleSec = (now - (this.spawnCondCounters?.lastInteractionTime || now)) / 1000;
    const bounds = {
      width: this.canvas.width,
      height: this.canvas.height,
      safeTop: this.safeTop,
      safeBottom: this.safeBottom
    };

    for (const [charId, charCfg] of Object.entries(activeCfg.characters)) {
      const sc = charCfg.spawnCondition;
      if (!sc || !sc.enabled) continue;

      // 0. 繰り返し条件判定 (1ゲーム内最大発動回数: 0=無限, 1〜99=回数, 100=ランダム)
      const repeatLimit = (sc.repeatCount === 100)
        ? (this.charRandomRepeatLimits?.[charId] || 2)
        : (sc.repeatCount ?? 0);
      const currentTriggers = this.spawnConditionTriggerCounts?.[charId] || 0;
      if (repeatLimit > 0 && currentTriggers >= repeatLimit) {
        continue;
      }

      // 重複スポーン防止（同一キャラは直前出現から4秒間クールダウン）
      if (this.spawnCondCooldowns[charId] && (now - this.spawnCondCooldowns[charId] < 4000)) {
        continue;
      }

      // 1. スコア閾値条件判定 (獲得Pt)
      const scoreEnabled = !!sc.condScoreEnabled;
      const reqScore = charCfg.scoreThreshold ?? 0;
      const scorePassed = (this.score >= reqScore);

      // 2. 時間条件判定 (時間)
      const timeEnabled = sc.condTimeEnabled !== undefined ? !!sc.condTimeEnabled : (sc.timeSec && sc.timeSec > 0);
      let timePassed = false;
      if (sc.timeSec === 61) {
        // ランダム時間
        const targetTime = this.charRandomTargets[charId]?.targetTime || 30;
        if (this.timeLeft <= targetTime) timePassed = true;
      } else if (sc.timeSec > 0) {
        // 残り時間指定以下
        if (this.timeLeft <= sc.timeSec) timePassed = true;
      } else {
        timePassed = true; // 時間指定なし
      }

      // 3. 行動・タップ回数判定 (T捕獲数)
      const tapEnabled = sc.condTargetTapsEnabled !== undefined ? !!sc.condTargetTapsEnabled : (sc.tapCountEnabled !== false);
      let actionPassed = false;
      if (!tapEnabled) {
        actionPassed = true; // タップ回数条件OFF時は達成とみなす
      } else {
        const reqTaps = (sc.tapCount === 101)
          ? (this.charRandomTargets[charId]?.targetTaps || 10)
          : (sc.tapCount ?? 10);

        if (sc.isCombo) {
          // コンボON: 連続タップ成功回数(this.combo)が指定回数以上の場合のみ出現
          if (reqTaps > 0 && (this.combo || 0) >= reqTaps) {
            actionPassed = true;
          }
        } else {
          // コンボOFF (デフォルト): 延べタップ回数
          if (sc.triggerAction === 'idle') {
            // 無操作（3秒以上操作なし）
            if (idleSec >= 3.0) actionPassed = true;
          } else if (sc.triggerAction === 'tap_target') {
            if ((this.spawnCondCounters?.targetTaps || 0) >= reqTaps) actionPassed = true;
          } else if (sc.triggerAction === 'tap_disturber') {
            if ((this.spawnCondCounters?.disturberTaps || 0) >= reqTaps) actionPassed = true;
          } else if (sc.triggerAction === 'tap_background') {
            if ((this.spawnCondCounters?.bgTaps || 0) >= reqTaps) actionPassed = true;
          } else if (sc.triggerAction === 'tap_specific') {
            const targetChars = sc.targetCharacters || [];
            let totalTaps = 0;
            if (targetChars.length > 0) {
              for (const tc of targetChars) {
                totalTaps += (this.spawnCondCounters?.charTaps?.[tc] || 0);
              }
            } else {
              totalTaps = (this.spawnCondCounters?.charTaps?.[charId] || 0);
            }
            if (totalTaps >= reqTaps) actionPassed = true;
          }
        }
      }

      // ３条件設定のチェック判定（有効化されたチェックボックス群の達成状態を評価）
      const activeConditions = [];
      if (scoreEnabled) activeConditions.push(scorePassed);
      if (timeEnabled) activeConditions.push(timePassed);
      if (tapEnabled) activeConditions.push(actionPassed);

      // 「かたほうでも達成 (matchAny)」の判定:
      // matchAny有効時: チェックした条件のうち【いずれか1つでも】達成していれば出現 (OR条件)
      // matchAny無効時: チェックした条件の【全て】を達成していれば出現 (AND条件)
      let isConditionMet = false;
      if (activeConditions.length === 0) {
        isConditionMet = sc.matchAny ? (timePassed || actionPassed) : (timePassed && actionPassed);
      } else if (sc.matchAny) {
        isConditionMet = activeConditions.some(Boolean);
      } else {
        isConditionMet = activeConditions.every(Boolean);
      }

      if (!isConditionMet) continue;

      // 条件達成！クールダウン更新＆カウンタリセット
      this.spawnCondCooldowns[charId] = now;
      if (sc.triggerAction === 'tap_target') this.spawnCondCounters.targetTaps = 0;
      else if (sc.triggerAction === 'tap_disturber') this.spawnCondCounters.disturberTaps = 0;
      else if (sc.triggerAction === 'tap_background') this.spawnCondCounters.bgTaps = 0;
      else if (sc.triggerAction === 'tap_specific') {
        for (const tc of (sc.targetCharacters || [])) {
          if (this.spawnCondCounters.charTaps) this.spawnCondCounters.charTaps[tc] = 0;
        }
      } else if (sc.triggerAction === 'idle') {
        this.spawnCondCounters.lastInteractionTime = now;
      }

      // 3. 出現確率判定
      const prob = sc.probability != null ? sc.probability : 100;
      const roll = Math.random() * 100;
      if (roll <= prob) {
        // 発動回数インクリメント
        if (!this.spawnConditionTriggerCounts) this.spawnConditionTriggerCounts = {};
        this.spawnConditionTriggerCounts[charId] = (this.spawnConditionTriggerCounts[charId] || 0) + 1;

        // 出現！指定 origin から出現
        const origin = sc.origin || 'silhouette';
        const spawnedFish = new Fish(charId, bounds, activeCfg, this.mode, { origin });
        this.fishes.push(spawnedFish);

        // 出現演出メッセージ＆効果音
        const charName = charCfg.name || (charId === 'boo_chan' ? 'ぶーちゃん' : charId);
        console.log(`[SpawnCondition] ✨ ${charName} (${charId}) 出現条件達成！スポーンしました。 origin=${origin}`);
        this.renderer.addFloatingText(`✨ ${charName} 出現！`, spawnedFish.x, Math.max(90, spawnedFish.y), "#f472b6", 26);
        try { sound.playCatch(); } catch (e) {}
      }
    }
  }

  update() {
    const bounds = {
      width: this.canvas.width,
      height: this.canvas.height,
      safeTop: this.safeTop,
      safeBottom: this.safeBottom
    };

    // 環境生物更新
    for (const af of this.ambientFishes) {
      af.update(bounds);
    }

    // 餌更新
    for (let i = this.baits.length - 1; i >= 0; i--) {
      const bait = this.baits[i];
      bait.update(bounds);
      if (bait.isFinished) {
        this.baits.splice(i, 1);
      }
    }

    // メイン魚更新（最新タップ位置を渡してタコ・イカが邪魔に急行）
    for (let i = this.fishes.length - 1; i >= 0; i--) {
      const fish = this.fishes[i];
      fish.update(bounds, this.fishes, this.baits, this.ambientFishes, this.lastTapPos);

      // イカスミ逃走によるスミ煙の発生
      if (fish.pendingInks && fish.pendingInks.length > 0) {
        while (fish.pendingInks.length > 0) {
          const ink = fish.pendingInks.pop();
          this.renderer.addInkCloud(ink.x, ink.y);
        }
      }
      
      // 吸い込み完了または画面外退場完了チェック
      if (fish.isDead || (fish.isCaptured && fish.captureProgress >= 1)) {
        this.fishes.splice(i, 1);
      }
    }

    // ターゲット枯渇防止：残りターゲット魚が minTargetThreshold (デフォルト2匹) 以下になったら補充
    const activeCfg = this.getActiveDevConfig();
    const baseTarget = activeCfg?.maxScreenFishes != null ? Math.max(0, Math.min(100, Number(activeCfg.maxScreenFishes))) : (activeCfg?.targetFishCount || this.targetFishCount || 20);
    const feverLimit = activeCfg?.chaosFeverConfig?.maxScreenFishes != null
      ? Math.max(0, Math.min(100, Number(activeCfg.chaosFeverConfig.maxScreenFishes)))
      : Math.max(baseTarget * 2, 70);
    const maxCount = this.isFeverTime ? feverLimit : baseTarget;

    if (this.state === GAME_STATES.PLAYING && maxCount > 0) {
      const minThreshold = activeCfg?.minTargetThreshold ?? 2;
      const refillCount = activeCfg?.refillTargetCount ?? 6;
      if (this.getTargetFishCount() <= minThreshold && this.fishes.length < maxCount) {
        this.spawnTargetFishes(Math.min(refillCount, maxCount - this.fishes.length));
      }
    }

    // 魚の総数が減ったら補充（ラスト10秒フィーバー中は画面を埋め尽くすため上限を倍増！）
    if (this.state === GAME_STATES.PLAYING && maxCount > 0 && this.fishes.length < maxCount) {
      this.spawnFishes(Math.min(this.isFeverTime ? 8 : 4, maxCount - this.fishes.length));
    }

    // 出現条件チェック (時間・無操作など)
    this.checkSpawnConditions('time');

    // 背景サージ終了判定
    if (this.ambientSurge?.active && performance.now() > this.ambientSurge.until) {
      this.ambientSurge.active = false;
      this.ambientSurge.multiplier = 1.0;
    }
  }

  // 背景タップ時の空振りペナルティ（2回連続で半分逃走、4回連続で全員逃走）
  handleBackgroundMiss() {
    this.combo = 0; // 空振りミスで連続成功コンボをリセット
    this.consecutiveMisses = (this.consecutiveMisses || 0) + 1;
    if (this.spawnCondCounters) {
      this.spawnCondCounters.bgTaps = (this.spawnCondCounters.bgTaps || 0) + 1;
      this.checkSpawnConditions('tap');
    }
    const bounds = { width: this.canvas.width, height: this.canvas.height, safeTop: this.safeTop, safeBottom: this.safeBottom };

    const activeFishes = this.fishes.filter(f => !f.isCaptured && f.state !== 'fleeing_temp');

    if (this.consecutiveMisses >= 4) {
      // 4回連続空振り：全員逃走！
      for (const fish of activeFishes) {
        fish.fleeTemporary(bounds);
      }
      this.renderer.addFloatingText(t('allFledWarning'), this.canvas.width * 0.5, this.canvas.height * 0.4, "#ef4444", 32);
      this.consecutiveMisses = 0;
    } else if (this.consecutiveMisses === 2) {
      // 2回連続空振り：半分逃走！
      const halfCount = Math.ceil(activeFishes.length * 0.5);
      const shuffled = [...activeFishes].sort(() => Math.random() - 0.5);
      for (let i = 0; i < halfCount; i++) {
        shuffled[i].fleeTemporary(bounds);
      }
      this.renderer.addFloatingText(t('halfFledWarning'), this.canvas.width * 0.5, this.canvas.height * 0.4, "#f59e0b", 28);
    }
  }

  // 画面タップ処理
  handleTap(x, y) {
    sound.init();
    if (this.state !== GAME_STATES.PLAYING) return;

    if (this.spawnCondCounters) {
      this.spawnCondCounters.lastInteractionTime = performance.now();
    }

    // 上部ヘッダーHUD下地・下部ボトムドック下地の領域外タップを無視（誤爆防止）
    if (y < (this.safeTop - 10) || y > (this.safeBottom + 25)) {
      return;
    }

    // タップ位置を記録（タコ・イカが近寄る用）
    this.lastTapPos = { x, y, time: Date.now() };

    // クリックされた魚を判定（シルエットになっていない通常表示の魚を最優先、次いで手前の魚）
    const sortedFishes = [...this.fishes]
      .filter(f => !f.isCaptured)
      .sort((a, b) => {
        const aSil = (a.depth > 0.55);
        const bSil = (b.depth > 0.55);
        if (aSil !== bSil) {
          return aSil ? 1 : -1; // 非シルエット（鮮明な魚）を優先して最前面判定
        }
        return a.depth - b.depth;
      });

    let clickedFish = null;
    for (const fish of sortedFishes) {
      if (fish.containsPoint(x, y)) {
        clickedFish = fish;
        break;
      }
    }

    if (!clickedFish) {
      sound.playTap();
      this.renderer.addSplash(x, y);
      this.handleBackgroundMiss();
      return;
    }

    // 魚をタップできたので連続空振りをリセット
    this.consecutiveMisses = 0;

    // 魚ごとの判定ロジック
    this.processFishCatch(clickedFish, x, y);
  }

  triggerAmbientSurge(trigger, fish) {
    const pct = trigger.percentage ?? 50;
    const isIncrease = (trigger.direction !== 'decrease');
    const factor = isIncrease ? (1 + pct / 100) : Math.max(0.1, 1 - pct / 100);
    const duration = Math.max(0.5, trigger.durationSec || 2.0);
    const now = performance.now();

    this.ambientSurge = {
      active: true,
      multiplier: factor,
      until: now + duration * 1000,
      targetPresets: trigger.targetPresets || ['bubbles', 'small_fish'],
      type: fish.type
    };

    if (this.renderer) {
      const burstColor = isIncrease ? '#38bdf8' : '#94a3b8';
      const label = isIncrease ? `🫧 背景演出 +${pct}%!` : `🫧 背景演出 -${pct}%!`;
      this.renderer.addFloatingText(label, fish.x, Math.max(this.safeTop + 20, fish.y - 30), burstColor, 20);
      for (let i = 0; i < 15; i++) {
        this.renderer.addSplash(
          fish.x + (Math.random() - 0.5) * (fish.width || 40),
          fish.y + (Math.random() - 0.5) * (fish.height || 40),
          burstColor
        );
      }
    }
  }

  processFishCatch(fish, x, y) {
    const activeCfg = this.getActiveDevConfig();
    const charCfg = activeCfg?.characters?.[fish.type];

    // 出現条件用カウンター更新
    if (this.spawnCondCounters) {
      this.spawnCondCounters.lastInteractionTime = performance.now();
      if (!this.spawnCondCounters.charTaps) this.spawnCondCounters.charTaps = {};
      this.spawnCondCounters.charTaps[fish.type] = (this.spawnCondCounters.charTaps[fish.type] || 0) + 1;

      if (fish.role === 'disturber') {
        this.spawnCondCounters.disturberTaps = (this.spawnCondCounters.disturberTaps || 0) + 1;
      } else if (isTargetForMode(fish.type, this.mode, activeCfg)) {
        this.spawnCondCounters.targetTaps = (this.spawnCondCounters.targetTaps || 0) + 1;
      }
      this.checkSpawnConditions('tap');
    }

    // 7. キャラ単体の背景演出サージトリガー判定 (全キャラ設定可能・指定回数タップで発動)
    const ambTrigger = charCfg?.ambientTrigger;
    if (ambTrigger && ambTrigger.enabled) {
      if (!this.charAmbientTapCounts) this.charAmbientTapCounts = {};
      this.charAmbientTapCounts[fish.type] = (this.charAmbientTapCounts[fish.type] || 0) + 1;
      const reqTaps = Math.max(1, ambTrigger.tapCount || 1);
      if (this.charAmbientTapCounts[fish.type] >= reqTaps) {
        this.charAmbientTapCounts[fish.type] = 0;
        this.triggerAmbientSurge(ambTrigger, fish);
      }
    }

    // 1. 邪魔キャラクターまたはモード対象外の判定
    const isTarget = isTargetForMode(fish.type, this.mode, activeCfg);

    // 邪魔キャラの即時処理（タコ、イカ、エイ、または明示的にdisturber指定されたキャラ）
    const isExplicitDisturber = charCfg?.role === 'disturber' || 
      (fish.type !== FISH_TYPES.BOO_CHAN && !isTarget && (
        fish.type === FISH_TYPES.SQUID || 
        fish.type === FISH_TYPES.OCTOPUS || 
        fish.type === FISH_TYPES.STINGRAY || 
        fish.type === FISH_TYPES.AJI_OPEN || 
        fish.type === FISH_TYPES.SHITABIRAME
      ));

    if (isExplicitDisturber) {
      let pointVal = charCfg?.pointValue !== undefined ? charCfg.pointValue : (fish.pointValue !== undefined ? fish.pointValue : -5);
      // 邪魔キャラ・ミスは必ずマイナス得点（ペナルティ）
      if (pointVal >= 0) {
        pointVal = -Math.abs(pointVal || 5);
      }
      const pointText = `${pointVal}`;
      const pointColor = '#ef4444'; // 水槽プレビューと同じ赤文字

      if (fish.type === FISH_TYPES.SQUID) {
        sound.playInk();
        this.renderer.addInkCloud(fish.x, fish.y);
        this.renderer.addFloatingText(`${pointText} (${t('targetWrong')})`, fish.x, fish.y, pointColor, 26);
        this.score = Math.max(0, this.score + pointVal);
        this.combo = 0;
        this.mistakeCount++;
        const bounds = { width: this.canvas.width, height: this.canvas.height, safeTop: this.safeTop, safeBottom: this.safeBottom };
        fish.jetInkEscape(bounds);
        return;
      }
      if (fish.type === FISH_TYPES.OCTOPUS) {
        sound.playInk();
        this.renderer.addInkCloud(fish.x, fish.y);
        this.renderer.addFloatingText(`${pointText} (${t('targetWrong')})`, fish.x, fish.y, pointColor, 26);
        this.score = Math.max(0, this.score + pointVal);
        this.combo = 0;
        this.mistakeCount++;
        fish.capture({ x: fish.x, y: -50 });
        return;
      }
      sound.playMiss();
      this.renderer.addSplash(fish.x, fish.y, pointColor);
      this.renderer.addFloatingText(`${pointText} (${t('targetWrong')})`, fish.x, fish.y, pointColor, 26);
      this.score = Math.max(0, this.score + pointVal);
      this.combo = 0;
      this.mistakeCount++;
      fish.capture({ x: fish.x, y: -50 });
      return;
    }

    // 2. モード別の正誤判定（ターゲット魚）
    if (this.mode === MODES.KAREI) {
      if (isTarget) {
        const bucketPos = this.bucketPositions.bucketA || this.bucketPositions.karei;
        this.handleTargetSuccess(fish, bucketPos);
      } else {
        this.handleTargetMistake(fish);
      }
    } else if (this.mode === MODES.HIRAME) {
      if (isTarget) {
        const bucketPos = this.bucketPositions.bucketB || this.bucketPositions.hirame;
        this.handleTargetSuccess(fish, bucketPos);
      } else {
        this.handleTargetMistake(fish);
      }
    } else if (this.mode === MODES.HIRAI) {
      // ヒライ派（仕分けモード）：選択中バケツと魚の所属バケツが一致しているか判定
      // ぶーちゃんはどのバケツ選択中でもボーナス正解
      if (fish.type === FISH_TYPES.BOO_CHAN) {
        const targetPos = this.bucketPositions[this.activeBucket] || 
                          (this.activeBucket === 'bucketB' || this.activeBucket === 'hirame' ? this.bucketPositions.hirame : this.bucketPositions.karei);
        this.handleTargetSuccess(fish, targetPos);
        return;
      }

      let assignedBucket = charCfg?.role;
      if (!assignedBucket || assignedBucket === 'target') {
        const category = getSpeciesCategory(fish.type);
        assignedBucket = category === 'hirame' ? 'bucketB' : 'bucketA';
      }

      // バケツ識別子の正規化 ('karei' -> 'bucketA', 'hirame' -> 'bucketB')
      const normActive = (this.activeBucket === 'karei') ? 'bucketA' : (this.activeBucket === 'hirame') ? 'bucketB' : (this.activeBucket || 'bucketA');
      const normAssigned = (assignedBucket === 'karei') ? 'bucketA' : (assignedBucket === 'hirame') ? 'bucketB' : assignedBucket;

      if (normAssigned === normActive) {
        const bucketPos = this.bucketPositions[this.activeBucket] || 
                          this.bucketPositions[normActive] || 
                          (normActive === 'bucketB' ? this.bucketPositions.hirame : this.bucketPositions.karei);
        this.handleTargetSuccess(fish, bucketPos);
      } else {
        this.handleTargetMistake(fish);
      }
    }
  }

  handleTargetSuccess(fish, targetBucket) {
    this.correctCount++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // コンボ達成による出現条件チェック
    this.checkSpawnConditions('tap');

    // コンボボーナス倍率
    let multiplier = 1;
    if (this.combo >= 20) multiplier = 2.0;
    else if (this.combo >= 10) multiplier = 1.5;

    const activeCfg = this.getActiveDevConfig();
    const charCfg = activeCfg?.characters?.[fish.type];
    const basePoint = charCfg?.pointValue !== undefined ? charCfg.pointValue : 10;

    let gainedScore = 0;
    if (basePoint >= 0) {
      gainedScore = Math.floor(basePoint * multiplier);
      this.score += gainedScore;
    } else {
      gainedScore = basePoint; // 負のスコア設定の場合
      this.score = Math.max(0, this.score + gainedScore);
    }

    sound.playSuccess(this.combo);
    this.renderer.addSplash(fish.x, fish.y, '#38bdf8');

    const scoreText = gainedScore >= 0 ? `+${gainedScore}` : `${gainedScore}`;
    const scoreColor = gainedScore >= 0 ? '#38bdf8' : '#ef4444';
    this.renderer.addFloatingText(`${scoreText} (${t('targetCorrect')})`, fish.x, fish.y, scoreColor, 28);

    // 10連続正解でコンボ発生演出
    if (this.combo > 0 && this.combo % 10 === 0) {
      sound.playCombo();
      this.baitStock++;
      this.renderer.addFloatingText(`★ ${this.combo} COMBO!! ★`, this.canvas.width * 0.5, this.canvas.height * 0.4, '#facc15', 36);
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { x: fish.x / this.canvas.width, y: fish.y / this.canvas.height }
      });
    }

    // 500ポイント獲得ごとに餌ストック+1
    if (Math.floor(this.score / 500) > this.lastBaitScoreThreshold) {
      this.lastBaitScoreThreshold = Math.floor(this.score / 500);
      this.baitStock++;
      this.renderer.addFloatingText(t('baitGet'), this.canvas.width * 0.5, this.canvas.height * 0.3, '#4ade80', 32);
    }

    fish.capture(targetBucket || { x: this.canvas.width * 0.5, y: this.canvas.height + 40 });
  }

  handleTargetMistake(fish) {
    this.mistakeCount++;
    this.combo = 0;
    const activeCfg = this.getActiveDevConfig();
    const charCfg = activeCfg?.characters?.[fish.type];
    let pointVal = charCfg?.pointValue !== undefined ? charCfg.pointValue : (fish.pointValue !== undefined ? fish.pointValue : -5);
    if (pointVal >= 0) {
      pointVal = -Math.abs(pointVal || 5);
    }
    this.score = Math.max(0, this.score + pointVal);
    sound.playMiss();
    this.renderer.addSplash(fish.x, fish.y, '#ef4444');
    this.renderer.addFloatingText(`${pointVal} (${t('targetWrong')})`, fish.x, fish.y, '#ef4444', 26);
    fish.capture({ x: fish.x, y: -50 });
  }

  // 餌を撒く
  scatterBait(baitType) {
    if (this.baitStock <= 0) return false;
    this.baitStock--;
    sound.playSplash();

    const activeCfg = this.getActiveDevConfig();
    const baitCfg = activeCfg?.baitConfig || {};

    // 餌をばらまく
    const count = 4;
    for (let i = 0; i < count; i++) {
      const bx = (this.canvas.width * 0.2) + Math.random() * (this.canvas.width * 0.6);
      const by = this.canvas.height * 0.2 + Math.random() * 50;
      this.baits.push(new Bait(bx, by, baitType, baitCfg));
    }

    this.renderer.addFloatingText(
      baitType === 'karei' ? t('scatterWorms') : t('scatterFish'),
      this.canvas.width * 0.5,
      this.canvas.height * 0.35,
      '#facc15',
      30
    );
    return true;
  }

  // ヒライ派のバケツ切り替え
  setActiveBucket(bucketType) {
    this.activeBucket = bucketType;
    sound.playTap();
  }

  // 終了処理
  endGame() {
    this.state = GAME_STATES.RESULT;
    this.isFeverTime = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    // タイムアップのタイミングでフェードアウトして停止
    sound.fadeOutBGM(1.2);
    sound.playTimeUp();

    // ハイスコア保存
    this.saveScoreToLeaderboard();

    // 紙吹雪
    confetti({
      particleCount: 70,
      spread: 90,
      origin: { y: 0.6 }
    });
  }

  // 称号判定 (管理コンソールの設定リストまたはデフォルトから判定)
  getPlayerTitle() {
    const list = this.devConfig?.playerTitles || DEFAULT_PLAYER_TITLES;
    const sorted = [...list].sort((a, b) => b.minScore - a.minScore);
    for (const item of sorted) {
      if (this.score >= item.minScore) {
        return getLocalizedTitle(item.title);
      }
    }
    return getLocalizedTitle(sorted[sorted.length - 1]?.title || '見習い釣り人');
  }

  // ランキング保存（1プレイヤーにつき最良3つ＋最悪3つの計最大6つ、同スコアは1つのみ）
  saveScoreToLeaderboard() {
    const list = this.getLeaderboard();
    const payload = buildRankingPayload(this.score, {
      mode: this.mode,
      maxCombo: this.maxCombo,
      tag: this.playerTag,
      title: this.getPlayerTitle(),
      date: new Date().toLocaleDateString()
    });

    const entry = {
      id: payload.id || ('lb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      internal_user_id: payload.internal_user_id,
      name: payload.player_name,
      tag: this.playerTag,
      score: payload.score,
      mode: payload.mode,
      maxCombo: payload.maxCombo,
      title: payload.title,
      date: payload.date,
      played_at: payload.played_at
    };

    list.push(entry);

    // 1プレイヤーごとに「最良3つ＋最悪3つの計最大6つ（同一スコアは1つのみ）」に整理
    const playerGroups = new Map();
    for (const item of list) {
      const pKey = item.internal_user_id || item.name || 'anonymous';
      if (!playerGroups.has(pKey)) {
        playerGroups.set(pKey, []);
      }
      playerGroups.get(pKey).push(item);
    }

    const trimmedList = [];
    for (const items of playerGroups.values()) {
      // スコア降順にソート
      items.sort((a, b) => b.score - a.score);

      // 同一ポイント（重複）は1つのみ保持（maxComboが高い方を優先）
      const uniqueScoreMap = new Map();
      for (const it of items) {
        if (!uniqueScoreMap.has(it.score)) {
          uniqueScoreMap.set(it.score, it);
        } else {
          const existing = uniqueScoreMap.get(it.score);
          if ((it.maxCombo || 0) > (existing.maxCombo || 0)) {
            uniqueScoreMap.set(it.score, it);
          }
        }
      }

      const uniqueList = Array.from(uniqueScoreMap.values());
      if (uniqueList.length <= 6) {
        trimmedList.push(...uniqueList);
      } else {
        const top3 = uniqueList.slice(0, 3);
        const bottom3 = uniqueList.slice(-3);
        trimmedList.push(...top3, ...bottom3);
      }
    }

    trimmedList.sort((a, b) => b.score - a.score);
    localStorage.setItem('hirame_leaderboard', JSON.stringify(trimmedList));
    return trimmedList;
  }

  getLeaderboard(period = 'yearly', mode = 'all') {
    let list = [];
    try {
      const data = localStorage.getItem('hirame_leaderboard');
      if (data) list = JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    const now = Date.now();
    if (!list || list.length === 0) {
      // デフォルトのモックランキングデータ (各期間の検証ができるようタイムスタンプを設定)
      list = [
        { id: "mock_1", name: "築地の一本釣り", tag: "F9xK2A", score: 1850, mode: "hirai", maxCombo: 34, title: "魚影の達人", date: "今日", played_at: new Date(now - 1000 * 60 * 30).toISOString() },
        { id: "mock_2", name: "すし職人ケン", tag: "M3pL8Z", score: 1420, mode: "hirame", maxCombo: 26, title: "魚影の達人", date: "今日", played_at: new Date(now - 1000 * 60 * 120).toISOString() },
        { id: "mock_3", name: "カレイ命の男", tag: "W7rB1Y", score: 1210, mode: "karei", maxCombo: 21, title: "熟練の釣り師", date: "3日前", played_at: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString() },
        { id: "mock_4", name: "海坊主", tag: "K4nQ9C", score: 980, mode: "hirai", maxCombo: 18, title: "熟練の釣り師", date: "5日前", played_at: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString() },
        { id: "mock_5", name: "波乗りアングラー", tag: "L8kP2M", score: 1680, mode: "hirame", maxCombo: 30, title: "魚影の達人", date: "15日前", played_at: new Date(now - 1000 * 60 * 60 * 24 * 15).toISOString() },
        { id: "mock_6", name: "深海の主", tag: "X1aB9Z", score: 2150, mode: "karei", maxCombo: 42, title: "魚神", date: "45日前", played_at: new Date(now - 1000 * 60 * 60 * 24 * 45).toISOString() }
      ];
    }

    // 各項目にIDが存在することを保証
    list.forEach((item, idx) => {
      if (!item.id) {
        item.id = 'lb_' + (item.played_at || idx) + '_' + (item.tag || idx);
      }
    });

    // ブロック指定ユーザー (hirame_blocked_users) の除外フィルタリング
    let blockedUsers = [];
    try {
      const bData = localStorage.getItem('hirame_blocked_users');
      if (bData) blockedUsers = JSON.parse(bData);
    } catch (e) {}

    // 期間 ＆ モードごとのフィルタリング ＆ ブロック除外
    const filtered = list.filter(item => {
      const uid = item.internal_user_id || item.tag;
      if (blockedUsers.includes(uid) || (item.internal_user_id && blockedUsers.includes(item.internal_user_id)) || (item.tag && blockedUsers.includes(item.tag))) {
        return false; // ランキングに反映させない（ブロック指定）
      }

      // モード別フィルタ
      if (mode && mode !== 'all' && item.mode !== mode) {
        return false;
      }

      if (period === 'yearly') return true;
      const t = item.played_at ? new Date(item.played_at).getTime() : now;
      const diffMs = now - t;
      if (period === 'daily') {
        return diffMs <= 86400000; // 24時間以内
      }
      if (period === 'weekly') {
        return diffMs <= 86400000 * 7; // 7日以内
      }
      if (period === 'monthly') {
        return diffMs <= 86400000 * 30; // 30日以内
      }
      return true;
    });

    // 表示時にも1プレイヤーあたり最良3つ＋最悪3つの最大6つ（重複スコアは1つ）に正規化
    const playerGroups = new Map();
    for (const item of filtered) {
      const pKey = item.internal_user_id || item.name || 'anonymous';
      if (!playerGroups.has(pKey)) playerGroups.set(pKey, []);
      playerGroups.get(pKey).push(item);
    }

    const normalized = [];
    for (const items of playerGroups.values()) {
      items.sort((a, b) => b.score - a.score);
      const uniqueScoreMap = new Map();
      for (const it of items) {
        if (!uniqueScoreMap.has(it.score)) {
          uniqueScoreMap.set(it.score, it);
        } else {
          const existing = uniqueScoreMap.get(it.score);
          if ((it.maxCombo || 0) > (existing.maxCombo || 0)) {
            uniqueScoreMap.set(it.score, it);
          }
        }
      }
      const uniqueList = Array.from(uniqueScoreMap.values());
      if (uniqueList.length <= 6) {
        normalized.push(...uniqueList);
      } else {
        const top3 = uniqueList.slice(0, 3);
        const bottom3 = uniqueList.slice(-3);
        normalized.push(...top3, ...bottom3);
      }
    }

    return normalized.sort((a, b) => b.score - a.score);
  }

  // ユーザー自身によるランキング記録削除
  deleteLeaderboardEntries(ids) {
    if (!ids || ids.length === 0) return 0;
    try {
      const data = localStorage.getItem('hirame_leaderboard');
      if (data) {
        let list = JSON.parse(data);
        const prevLen = list.length;
        const idSet = new Set(ids);
        list = list.filter(item => !idSet.has(item.id));
        localStorage.setItem('hirame_leaderboard', JSON.stringify(list));
        return prevLen - list.length;
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  }

  // ユーザー自身の全ランキング記録を一括消去
  clearAllMyLeaderboardEntries(identity) {
    if (!identity) return 0;
    try {
      const data = localStorage.getItem('hirame_leaderboard');
      if (data) {
        let list = JSON.parse(data);
        const prevLen = list.length;
        list = list.filter(item => {
          const isSelf = Boolean(
            (identity.internal_user_id && item.internal_user_id === identity.internal_user_id) ||
            (identity.player_name && item.name && item.name === identity.player_name)
          );
          return !isSelf;
        });
        localStorage.setItem('hirame_leaderboard', JSON.stringify(list));
        return prevLen - list.length;
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  }

  // X（旧Twitter）シェアURL生成 (各言語テンプレート対応・無料版140字以内)
  generateXShareUrl() {
    const title = this.getPlayerTitle();
    const modeName = t(this.mode === MODES.KAREI ? 'modeKarei' : (this.mode === MODES.HIRAME ? 'modeHirame' : 'modeHirai'));
    const lang = (typeof getCurrentLang === 'function') ? getCurrentLang() : 'ja';

    let template;
    if (lang === 'ja') {
      template = this.devConfig?.xShareTemplate || t('xShareTemplate');
    } else {
      template = this.devConfig?.xShareTemplates?.[lang] || t('xShareTemplate');
    }

    let text = template
      .replace(/\{score\}/g, this.score)
      .replace(/\{mode\}/g, modeName)
      .replace(/\{title\}/g, title)
      .replace(/\{combo\}/g, this.maxCombo)
      .replace(/\{name\}/g, this.playerName || t('anonymousAngler'));

    // 無料版Xの文字数制限（140文字）内に確実に収める
    if (text.length > 130) {
      text = text.slice(0, 127) + '...';
    }

    const shareUrl = this.devConfig?.xShareUrl?.trim() || window.location.href;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  }

  // クイックリトライ（プレイ中にも即座に最初からやり直せる）
  restart() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.startCountdown();
  }

  // タイトルへ戻る
  resetToTitle() {
    this.state = GAME_STATES.TITLE;
    if (this.timerInterval) clearInterval(this.timerInterval);
    sound.stopBGM();
    this.fishes = [];
    this.baits = [];
    this.countdownNumber = null;
  }
}
