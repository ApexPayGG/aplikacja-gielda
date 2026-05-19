#!/usr/bin/env node
/**
 * Force-overwrite landing + legal strings that still contain English/Polish placeholders.
 * Run: node apps/frontend/scripts/fix-landing-i18n-overrides.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");

function deepOverwrite(target, source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return source;
  }
  const out = { ...(target && typeof target === "object" && !Array.isArray(target) ? target : {}) };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = deepOverwrite(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
  }
  return value;
}

const pricingTiers = {
  ja: {
    free: {
      body: "一貫した取引習慣を築くための基本機能。",
      cta: "無料で始める",
      features: ["コアダッシュボード", "基本AIシグナル", "コミュニティアクセス"],
      name: "Free",
      price: "$0/mo",
    },
    pro: {
      body: "アクティブな投資家向けのフルアクセス。",
      cta: "Proを選ぶ",
      features: ["全AIモジュール", "行動コーチング", "トレーダー心理プロファイル"],
      name: "Pro",
      price: "$9/mo",
    },
    proPlus: {
      body: "パワーユーザーと自動化ワークフロー向け。",
      cta: "Pro+を選ぶ",
      features: ["Proの全機能", "APIアクセス", "ブローカー連携"],
      name: "Pro+",
      price: "$19/mo",
    },
  },
  es: {
    free: {
      body: "Funciones básicas para empezar a construir consistencia.",
      cta: "Empezar gratis",
      features: ["Panel principal", "Señales IA básicas", "Acceso a la comunidad"],
      name: "Free",
      price: "$0/mo",
    },
    pro: {
      body: "Acceso completo para inversores activos.",
      cta: "Elegir Pro",
      features: ["Todos los módulos IA", "Coaching conductual", "Perfil psicológico del trader"],
      name: "Pro",
      price: "$9/mo",
    },
    proPlus: {
      body: "Para usuarios avanzados y flujos de automatización.",
      cta: "Elegir Pro+",
      features: ["Todo lo de Pro", "Acceso API", "Integración con bróker"],
      name: "Pro+",
      price: "$19/mo",
    },
  },
  fr: {
    free: {
      body: "Fonctions de base pour développer votre régularité.",
      cta: "Commencer gratuitement",
      features: ["Tableau de bord principal", "Signaux IA de base", "Accès communauté"],
      name: "Free",
      price: "$0/mo",
    },
    pro: {
      body: "Accès complet pour investisseurs actifs.",
      cta: "Choisir Pro",
      features: ["Tous les modules IA", "Coaching comportemental", "Profil psychologique trader"],
      name: "Pro",
      price: "$9/mo",
    },
    proPlus: {
      body: "Pour utilisateurs avancés et workflows automatisés.",
      cta: "Choisir Pro+",
      features: ["Tout Pro inclus", "Accès API", "Intégration courtier"],
      name: "Pro+",
      price: "$19/mo",
    },
  },
  ko: {
    free: {
      body: "꾸준한 투자 습관을 위한 기본 기능.",
      cta: "무료로 시작",
      features: ["코어 대시보드", "기본 AI 신호", "커뮤니티 액세스"],
      name: "Free",
      price: "$0/mo",
    },
    pro: {
      body: "활성 투자자를 위한 전체 액세스.",
      cta: "Pro 선택",
      features: ["모든 AI 모듈", "행동 코칭", "트레이더 심리 프로필"],
      name: "Pro",
      price: "$9/mo",
    },
    proPlus: {
      body: "파워 유저 및 자동화 워크플로용.",
      cta: "Pro+ 선택",
      features: ["Pro의 모든 기능", "API 액세스", "브로커 연동"],
      name: "Pro+",
      price: "$19/mo",
    },
  },
  hi: {
    free: {
      body: "निरंतरता बनाने के लिए बुनियादी सुविधाएँ।",
      cta: "मुफ़्त शुरू करें",
      features: ["कोर डैशबोर्ड", "बुनियादी AI सिग्नल", "कम्युनिटी एक्सेस"],
      name: "Free",
      price: "$0/mo",
    },
    pro: {
      body: "सक्रिय निवेशकों के लिए पूर्ण पहुँच।",
      cta: "Pro चुनें",
      features: ["सभी AI मॉड्यूल", "व्यवहार कोचिंग", "ट्रेडर मनोविज्ञान प्रोफ़ाइल"],
      name: "Pro",
      price: "$9/mo",
    },
    proPlus: {
      body: "पावर यूज़र और ऑटोमेशन वर्कफ़्लो के लिए।",
      cta: "Pro+ चुनें",
      features: ["Pro की सभी सुविधाएँ", "API एक्सेस", "ब्रोकर एकीकरण"],
      name: "Pro+",
      price: "$19/mo",
    },
  },
  "zh-TW": {
    free: {
      body: "建立穩定交易習慣的基礎功能。",
      cta: "免費開始",
      features: ["核心儀表板", "基礎 AI 訊號", "社群存取"],
      name: "Free",
      price: "$0/mo",
    },
    pro: {
      body: "活躍投資人的完整存取。",
      cta: "選擇 Pro",
      features: ["所有 AI 模組", "行為教練", "交易者心理檔案"],
      name: "Pro",
      price: "$9/mo",
    },
    proPlus: {
      body: "進階使用者與自動化工作流程。",
      cta: "選擇 Pro+",
      features: ["Pro 全部功能", "API 存取", "券商整合"],
      name: "Pro+",
      price: "$19/mo",
    },
  },
};

const solutionFeatures = {
  ja: {
    aiBrief: { body: "スコアだけではなく、有望かどうかの理由を丁寧に解説します。", title: "AIブリーフ（解説付き）" },
    behavioralCoach: { body: "あなたのミスを検出し、同じ失敗の繰り返しを防ぎます。", title: "行動コーチング" },
    brokerIntegration: "ブローカー連携",
    globalMarkets: { body: "GPW、NYSE、DAX、TSE、NSEなど。アプリの切り替えは不要。", title: "130以上の取引所" },
    languages: "9言語",
    paperTrading: { body: "リスクなく練習。コストのかからない失敗から学べます。", title: "ペーパートレード" },
    preMortemAi: { body: "購入前に、最も起こりやすい損失シナリオをAIが提示します。", title: "プレモータムAI" },
    signalAnalysis: "AIシグナル分析",
    signalDna: { body: "過去の類似セットアップを分析し、過去の結果を示します。", title: "シグナルDNA" },
    traderPsycheProfile: "トレーダー心理プロファイル",
  },
  es: {
    aiBrief: { body: "No solo una puntuación: explicación completa del porqué.", title: "AI Brief con narrativa" },
    behavioralCoach: { body: "Detecta tus errores y evita repetirlos.", title: "Coaching conductual" },
    brokerIntegration: "Integración con bróker",
    globalMarkets: { body: "GPW, NYSE, DAX, TSE, NSE y más. Sin cambiar de app.", title: "130+ bolsas" },
    languages: "9 idiomas",
    paperTrading: { body: "Practica sin riesgo. Aprende sin coste.", title: "Operaciones simuladas" },
    preMortemAi: { body: "Antes de comprar, la IA muestra el escenario de pérdida más probable.", title: "Pre-Mortem IA" },
    signalAnalysis: "Análisis de señales IA",
    signalDna: { body: "Gemelos históricos del setup y resultados pasados.", title: "Signal DNA" },
    traderPsycheProfile: "Perfil psicológico del trader",
  },
  fr: {
    aiBrief: { body: "Pas seulement un score : explication complète du pourquoi.", title: "Brief IA narratif" },
    behavioralCoach: { body: "Détecte vos erreurs et évite les répétitions.", title: "Coaching comportemental" },
    brokerIntegration: "Intégration courtier",
    globalMarkets: { body: "GPW, NYSE, DAX, TSE, NSE et plus. Sans changer d'app.", title: "130+ places" },
    languages: "9 langues",
    paperTrading: { body: "Entraînez-vous sans risque.", title: "Paper trading" },
    preMortemAi: { body: "Avant d'acheter, l'IA montre le scénario de perte le plus probable.", title: "Pre-Mortem IA" },
    signalAnalysis: "Analyse de signaux IA",
    signalDna: { body: "Jumeaux historiques du setup et résultats passés.", title: "Signal DNA" },
    traderPsycheProfile: "Profil psychologique trader",
  },
  ko: {
    aiBrief: { body: "점수만이 아니라, 왜 유망한지 전체 설명을 제공합니다.", title: "AI 브리프(내러티브)" },
    behavioralCoach: { body: "실수를 감지하고 반복을 막아줍니다.", title: "행동 코칭" },
    brokerIntegration: "브로커 연동",
    globalMarkets: { body: "GPW, NYSE, DAX, TSE, NSE 등. 앱 전환 불필요.", title: "130개 이상 거래소" },
    languages: "9개 언어",
    paperTrading: { body: "리스크 없이 연습하세요.", title: "모의 거래" },
    preMortemAi: { body: "매수 전 AI가 가장 가능성 높은 손실 시나리오를 보여줍니다.", title: "프리모텀 AI" },
    signalAnalysis: "AI 신호 분석",
    signalDna: { body: "과거 유사 셋업과 결과를 분석합니다.", title: "시그널 DNA" },
    traderPsycheProfile: "트레이더 심리 프로필",
  },
  hi: {
    aiBrief: { body: "सिर्फ स्कोर नहीं — पूरा कारण बताता है।", title: "AI ब्रीफ (विवरण सहित)" },
    behavioralCoach: { body: "आपकी गलतियाँ पकड़ता है और दोहराव रोकता है।", title: "व्यवहार कोचिंग" },
    brokerIntegration: "ब्रोकर एकीकरण",
    globalMarkets: { body: "GPW, NYSE, DAX, TSE, NSE और अधिक।", title: "130+ एक्सचेंज" },
    languages: "9 भाषाएँ",
    paperTrading: { body: "बिना जोखिम अभ्यास करें।", title: "पेपर ट्रेडिंग" },
    preMortemAi: { body: "खरीदने से पहले संभावित हानि का परिदृश्य।", title: "प्री-मॉर्टेम AI" },
    signalAnalysis: "AI सिग्नल विश्लेषण",
    signalDna: { body: "ऐतिहासिक सेटअप समानता और परिणाम।", title: "सिग्नल DNA" },
    traderPsycheProfile: "ट्रेडर मनोविज्ञान प्रोफ़ाइल",
  },
  "zh-TW": {
    aiBrief: { body: "不只是分數，完整說明為何值得或不值得。", title: "AI 簡報（敘事版）" },
    behavioralCoach: { body: "偵測你的錯誤並避免重複。", title: "行為教練" },
    brokerIntegration: "券商整合",
    globalMarkets: { body: "GPW、NYSE、DAX、TSE、NSE 等，無需切換 App。", title: "130+ 交易所" },
    languages: "9 種語言",
    paperTrading: { body: "零風險練習，從不花錢的錯誤中學習。", title: "模擬交易" },
    preMortemAi: { body: "買入前，AI 顯示最可能的虧損情境。", title: "事前檢視 AI" },
    signalAnalysis: "AI 訊號分析",
    signalDna: { body: "歷史相似型態與過往結果。", title: "訊號 DNA" },
    traderPsycheProfile: "交易者心理檔案",
  },
};

const PATCHES = {
  ja: {
    landing: {
      footer: { copyright: "© 2026 StockAI Pro · 無断転載を禁じます" },
      footerCta: {
        button: "無料で始める",
        disclaimer: "教育目的のサービスです。投資助言ではありません。投資にはリスクがあります。",
        pricing: "料金を見る",
        title: "今すぐ無料アカウントを作成",
      },
      pricing: {
        badge: "先行ユーザー価格",
        earlyAdopter: "最初の500件のProアカウントはずっと$9/月",
        monthly: "月額",
        popular: "一番人気",
        save: "27%お得",
        saveProPlus: "34%お得",
        title: "シンプルな料金プラン",
        trial: "14日間無料",
        yearly: "年額",
        tiers: pricingTiers.ja,
      },
      problem: {
        cards: {
          memory: {
            body: "フィードバックのループがなければ、同じ高コストなパターンがトレードごとに繰り返されます。",
            title: "誰もあなたのミスを覚えていない",
          },
        },
      },
      socialProof: {
        subtitle: "早期アクセスコミュニティは毎週成長しています。",
        testimonials: [
          {
            author: "Kasia, ワルシャワ",
            quote: "以前は5つのアプリを行き来していました。今は1つの画面で、何をしているかわかります。",
          },
          {
            author: "Lukas, ベルリン",
            quote: "行動コーチのおかげで、悪いシグナルではなくFOMOで負けていたと気づきました。",
          },
          {
            author: "Clara, マドリード",
            quote: "プレモータムAIがリスクへの考え方を変えました。クリックする前に考えるようになりました。",
          },
        ],
        title: "早期アクセスコミュニティに参加",
      },
      solution: { features: solutionFeatures.ja },
    },
    legal: {
      ariaLabel: "投資に関する重要事項",
      investmentDisclaimer:
        "【重要】本サービス（StockAI Pro）において、人工知能（Claude AIを含む）が生成・提供する市場分析、シグナル、レポートその他の情報は、投資の教育および参考情報の提供を目的とするものであり、金融商品取引法に基づく投資助言・代理業の業務、または投資一任契約に該当するものではありません。株式、その他金融商品への投資には、価格変動等により元本を割り込むおそれがあり、損失が生じる場合があります。当社（AMC Energy Sp. z o.o.）は、本アプリケーションの情報に基づいてお客様が行った投資判断の結果について、いかなる保証もいたしません。投資に関する最終決定は、お客様ご自身の判断と責任において行ってください。",
      termsLink: "利用規約全文",
    },
  },
  es: {
    landing: {
      hero: {
        ctaPrimary: "Empezar gratis",
        ctaSecondary: "Ver demo",
        widgetLive: "En vivo",
        widgetTitle: "Pulso del mercado en vivo",
      },
      footerCta: {
        button: "Crear cuenta gratis",
        disclaimer: "Producto educativo. No es asesoramiento financiero. Invertir implica riesgos.",
        title: "Empieza hoy tu cuenta gratuita",
      },
      pricing: {
        title: "Precios simples",
        tiers: pricingTiers.es,
      },
      problem: {
        cards: {
          memory: {
            body: "Sin un bucle de retroalimentación, los mismos patrones costosos se repiten operación tras operación.",
            title: "Nadie recuerda tus errores",
          },
        },
      },
      socialProof: {
        subtitle: "La comunidad de acceso anticipado crece cada semana.",
        testimonials: [
          {
            author: "Kasia, Varsovia",
            quote: "Antes saltaba entre apps. Ahora tengo una pantalla y sé lo que hago.",
          },
          {
            author: "Lukas, Berlín",
            quote: "El coaching conductual me mostró que perdía por FOMO, no por malas señales.",
          },
          {
            author: "Clara, Madrid",
            quote: "Pre-Mortem IA cambió mi forma de pensar el riesgo. Pienso antes de hacer clic.",
          },
        ],
        title: "Únete a nuestra comunidad de acceso anticipado",
      },
      solution: { features: solutionFeatures.es },
    },
  },
  fr: {
    landing: {
      hero: {
        ctaPrimary: "Commencer gratuitement",
        ctaSecondary: "Voir la démo",
        widgetLive: "En direct",
        widgetTitle: "Pouls du marché en direct",
      },
      footerCta: {
        button: "Créer un compte gratuit",
        disclaimer: "Produit éducatif. Pas un conseil financier. Investir comporte des risques.",
        title: "Créez votre compte gratuit aujourd'hui",
      },
      pricing: {
        title: "Tarifs simples",
        tiers: pricingTiers.fr,
      },
      problem: {
        cards: {
          memory: {
            body: "Sans boucle de retour, les mêmes schémas coûteux se répètent trade après trade.",
            title: "Personne ne retient vos erreurs",
          },
        },
      },
      socialProof: {
        subtitle: "La communauté early access grandit chaque semaine.",
        testimonials: [
          {
            author: "Kasia, Varsovie",
            quote: "Je passais d'une app à l'autre. Maintenant j'ai un écran et je sais ce que je fais.",
          },
          {
            author: "Lukas, Berlin",
            quote: "Le coaching comportemental m'a montré que je perdais à cause du FOMO, pas des signaux.",
          },
          {
            author: "Clara, Madrid",
            quote: "Pre-Mortem IA a changé ma vision du risque. Je réfléchis avant de cliquer.",
          },
        ],
        title: "Rejoignez notre communauté early access",
      },
      solution: { features: solutionFeatures.fr },
    },
  },
  ko: {
    landing: {
      hero: {
        ctaPrimary: "무료로 시작",
        ctaSecondary: "데모 보기",
        widgetLive: "실시간",
        widgetTitle: "실시간 시장 펄스",
      },
      footer: { copyright: "© 2026 StockAI Pro · 모든 권리 보유" },
      footerCta: {
        button: "무료 계정 만들기",
        disclaimer: "교육용 제품입니다. 금융 자문이 아닙니다. 투자에는 위험이 따릅니다.",
        title: "오늘 무료 계정을 시작하세요",
      },
      pricing: {
        title: "간단한 요금제",
        tiers: pricingTiers.ko,
      },
      problem: {
        cards: {
          memory: {
            body: "피드백 루프가 없으면 같은 비용 큰 패턴이 거래마다 반복됩니다.",
            title: "아무도 당신의 실수를 기억하지 않습니다",
          },
        },
      },
      socialProof: {
        subtitle: "얼리 액세스 커뮤니티가 매주 성장하고 있습니다.",
        testimonials: [
          {
            author: "Kasia, 바르샤바",
            quote: "예전엔 앱을 오갔습니다. 이제는 한 화면에서 무엇을 하는지 압니다.",
          },
          {
            author: "Lukas, 베를린",
            quote: "행동 코칭 덕분에 나쁜 신호가 아니라 FOMO로 잃고 있었음을 알았습니다.",
          },
          {
            author: "Clara, 마드리드",
            quote: "프리모텀 AI가 리스크에 대한 생각을 바꿨습니다. 클릭 전에 생각합니다.",
          },
        ],
        title: "얼리 액세스 커뮤니티에 참여하세요",
      },
      solution: { features: solutionFeatures.ko },
    },
  },
  hi: {
    landing: {
      hero: {
        ctaPrimary: "मुफ़्त शुरू करें",
        ctaSecondary: "डेमो देखें",
        widgetLive: "लाइव",
        widgetTitle: "लाइव मार्केट पल्स",
      },
      footerCta: {
        button: "मुफ़्त खाता बनाएँ",
        disclaimer: "शैक्षिक उत्पाद। वित्तीय सलाह नहीं। निवेश में जोखिम है।",
        title: "आज ही अपना मुफ़्त खाता शुरू करें",
      },
      pricing: {
        title: "सरल मूल्य निर्धारण",
        tiers: pricingTiers.hi,
      },
      problem: {
        cards: {
          memory: {
            body: "फ़ीडबैक लूप के बिना, वही महँगे पैटर्न हर ट्रेड में दोहराए जाते हैं।",
            title: "कोई आपकी गलतियाँ याद नहीं रखता",
          },
        },
      },
      socialProof: {
        subtitle: "अर्ली एक्सेस समुदाय हर हफ़्ते बढ़ रहा है।",
        testimonials: [
          {
            author: "Kasia, वारसॉ",
            quote: "पहले मैं ऐप्स के बीच कूदती थी। अब एक स्क्रीन है और मुझे पता है क्या कर रही हूँ।",
          },
          {
            author: "Lukas, बर्लिन",
            quote: "व्यवहार कोचिंग ने दिखाया कि मैं बुरे सिग्नल नहीं, FOMO से हार रही थी।",
          },
          {
            author: "Clara, मैड्रिड",
            quote: "प्री-मॉर्टेम AI ने जोखिम के बारे में सोचना बदल दिया। क्लिक से पहले सोचती हूँ।",
          },
        ],
        title: "हमारे अर्ली एक्सेस समुदाय से जुड़ें",
      },
      solution: { features: solutionFeatures.hi },
    },
  },
  "zh-TW": {
    landing: {
      hero: {
        ctaPrimary: "免費開始",
        ctaSecondary: "查看示範",
        widgetLive: "即時",
        widgetTitle: "即時市場脈動",
      },
      footerCta: {
        button: "建立免費帳戶",
        disclaimer: "教育用途產品，非財務建議。投資涉及風險。",
        title: "今天就開始您的免費帳戶",
      },
      pricing: {
        title: "簡單定價",
        tiers: pricingTiers["zh-TW"],
      },
      problem: {
        cards: {
          memory: {
            body: "沒有回饋循環，相同的代價高昂模式會一再重複。",
            title: "沒人記得你的錯誤",
          },
        },
      },
      socialProof: {
        subtitle: "搶先體驗社群每週都在成長。",
        testimonials: [
          {
            author: "Kasia, 華沙",
            quote: "以前我在多個 App 之間切換。現在一個畫面就知道自己在做什麼。",
          },
          {
            author: "Lukas, 柏林",
            quote: "行為教練讓我發現虧損來自 FOMO，而不是糟糕的訊號。",
          },
          {
            author: "Clara, 馬德里",
            quote: "事前檢視 AI 改變了我對風險的看法。我會在點擊前先思考。",
          },
        ],
        title: "加入我們的搶先體驗社群",
      },
      solution: { features: solutionFeatures["zh-TW"] },
    },
  },
};

for (const locale of Object.keys(PATCHES)) {
  const filePath = path.join(LOCALES_DIR, locale, "common.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const patch = PATCHES[locale];

  data.landing = sortKeys(deepOverwrite(data.landing ?? {}, patch.landing));
  if (patch.legal) {
    data.legal = sortKeys(deepOverwrite(data.legal ?? {}, patch.legal));
  }

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Patched ${locale}/common.json (landing + legal)`);
}
