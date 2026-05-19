#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");

const ONBOARDING = {
  pl: {
    skip: "Pomiń",
    step: "Krok {{current}}/{{total}}",
    defaultName: "Inwestorze",
    welcome: {
      title: "Witaj w StockAI Pro, {{name}}!",
      body: "StockAI Pro to platforma, która łączy analitykę rynku, sygnały i wsparcie AI dla inwestora. Personalizujemy doświadczenie, aby szybciej prowadzić Cię do trafniejszych decyzji.",
    },
    markets: {
      title: "Którymi rynkami jesteś zainteresowany?",
      error: "Wybierz co najmniej jeden rynek, aby przejść dalej.",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "Azja",
        other: "Inne",
      },
    },
    style: {
      title: "Jaki masz styl inwestowania?",
      error: "Wybierz styl inwestowania, aby kontynuować.",
      swing: {
        icon: "📈",
        title: "Swing trader (dni–tygodnie)",
        description: "Pozycje trzymane od kilku dni do kilku tygodni.",
      },
      longterm: {
        icon: "💼",
        title: "Długoterminowy (miesiące–lata)",
        description: "Inwestowanie na horyzont miesięcy lub lat.",
      },
      daytrader: {
        icon: "⚡",
        title: "Daytrader (intraday)",
        description: "Decyzje i transakcje realizowane intraday.",
      },
      learning: {
        icon: "🔰",
        title: "Uczę się dopiero",
        description: "Buduję fundamenty i poznaję rynek krok po kroku.",
      },
    },
    ready: {
      title: "Twój profil jest gotowy",
      subtitle: "Oto trzy funkcje, które najlepiej pomogą Ci wystartować już teraz:",
      explore: "Sprawdź →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "Przejrzyj bieżące sygnały inwestycyjne i ustaw własne alerty.",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "Analizuj decyzje i eliminuj powtarzające się błędy behawioralne.",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "Testuj strategie bez ryzyka na wirtualnym kapitale.",
      },
    },
    nav: {
      back: "← Wstecz",
      start: "Zaczynamy →",
      next: "Dalej →",
      dashboard: "Przejdź do Dashboard →",
    },
  },
  en: {
    skip: "Skip",
    step: "Step {{current}}/{{total}}",
    defaultName: "Investor",
    welcome: {
      title: "Welcome to StockAI Pro, {{name}}!",
      body: "StockAI Pro combines market analytics, signals, and AI support for investors. We personalize your experience to help you make better decisions faster.",
    },
    markets: {
      title: "Which markets are you interested in?",
      error: "Select at least one market to continue.",
      options: {
        gpw: "Warsaw Stock Exchange (GPW)",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "Asia",
        other: "Other",
      },
    },
    style: {
      title: "What is your investment style?",
      error: "Select an investment style to continue.",
      swing: {
        icon: "📈",
        title: "Swing trader (days–weeks)",
        description: "Positions held from a few days to a few weeks.",
      },
      longterm: {
        icon: "💼",
        title: "Long-term (months–years)",
        description: "Investing over a horizon of months or years.",
      },
      daytrader: {
        icon: "⚡",
        title: "Day trader (intraday)",
        description: "Decisions and trades executed within the same day.",
      },
      learning: {
        icon: "🔰",
        title: "Just learning",
        description: "Building foundations and learning the market step by step.",
      },
    },
    ready: {
      title: "Your profile is ready",
      subtitle: "Here are three features to help you get started right away:",
      explore: "Explore →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "Review current investment signals and set your own alerts.",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "Analyze decisions and eliminate recurring behavioral mistakes.",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "Test strategies risk-free with virtual capital.",
      },
    },
    nav: {
      back: "← Back",
      start: "Let's go →",
      next: "Next →",
      dashboard: "Go to Dashboard →",
    },
  },
  de: {
    skip: "Überspringen",
    step: "Schritt {{current}}/{{total}}",
    defaultName: "Investor",
    welcome: {
      title: "Willkommen bei StockAI Pro, {{name}}!",
      body: "StockAI Pro verbindet Marktanalytik, Signale und KI-Unterstützung für Anleger. Wir personalisieren Ihr Erlebnis, damit Sie schneller bessere Entscheidungen treffen.",
    },
    markets: {
      title: "Für welche Märkte interessieren Sie sich?",
      error: "Wählen Sie mindestens einen Markt, um fortzufahren.",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "Asien",
        other: "Sonstige",
      },
    },
    style: {
      title: "Welcher Anlagestil passt zu Ihnen?",
      error: "Wählen Sie einen Anlagestil, um fortzufahren.",
      swing: {
        icon: "📈",
        title: "Swing-Trader (Tage–Wochen)",
        description: "Positionen über einige Tage bis Wochen.",
      },
      longterm: {
        icon: "💼",
        title: "Langfristig (Monate–Jahre)",
        description: "Investieren über Monate oder Jahre.",
      },
      daytrader: {
        icon: "⚡",
        title: "Daytrader (Intraday)",
        description: "Entscheidungen und Trades am selben Tag.",
      },
      learning: {
        icon: "🔰",
        title: "Ich lerne noch",
        description: "Grundlagen aufbauen und den Markt Schritt für Schritt kennenlernen.",
      },
    },
    ready: {
      title: "Ihr Profil ist bereit",
      subtitle: "Drei Funktionen, mit denen Sie sofort starten können:",
      explore: "Entdecken →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "Aktuelle Investment-Signale prüfen und eigene Alerts setzen.",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "Entscheidungen analysieren und wiederkehrende Verhaltensfehler vermeiden.",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "Strategien risikofrei mit virtuellem Kapital testen.",
      },
    },
    nav: {
      back: "← Zurück",
      start: "Los geht's →",
      next: "Weiter →",
      dashboard: "Zum Dashboard →",
    },
  },
  es: {
    skip: "Omitir",
    step: "Paso {{current}}/{{total}}",
    defaultName: "Inversor",
    welcome: {
      title: "¡Bienvenido a StockAI Pro, {{name}}!",
      body: "StockAI Pro combina analítica de mercado, señales y soporte de IA para inversores. Personalizamos tu experiencia para ayudarte a decidir mejor y más rápido.",
    },
    markets: {
      title: "¿En qué mercados estás interesado?",
      error: "Selecciona al menos un mercado para continuar.",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "Asia",
        other: "Otros",
      },
    },
    style: {
      title: "¿Cuál es tu estilo de inversión?",
      error: "Selecciona un estilo de inversión para continuar.",
      swing: {
        icon: "📈",
        title: "Swing trader (días–semanas)",
        description: "Posiciones de unos días a unas semanas.",
      },
      longterm: {
        icon: "💼",
        title: "Largo plazo (meses–años)",
        description: "Invertir con horizonte de meses o años.",
      },
      daytrader: {
        icon: "⚡",
        title: "Day trader (intradía)",
        description: "Decisiones y operaciones en el mismo día.",
      },
      learning: {
        icon: "🔰",
        title: "Estoy aprendiendo",
        description: "Construyo bases y conozco el mercado paso a paso.",
      },
    },
    ready: {
      title: "Tu perfil está listo",
      subtitle: "Tres funciones para empezar ahora mismo:",
      explore: "Explorar →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "Revisa señales de inversión actuales y configura alertas.",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "Analiza decisiones y elimina errores conductuales recurrentes.",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "Prueba estrategias sin riesgo con capital virtual.",
      },
    },
    nav: {
      back: "← Atrás",
      start: "Empezar →",
      next: "Siguiente →",
      dashboard: "Ir al panel →",
    },
  },
  fr: {
    skip: "Passer",
    step: "Étape {{current}}/{{total}}",
    defaultName: "Investisseur",
    welcome: {
      title: "Bienvenue sur StockAI Pro, {{name}} !",
      body: "StockAI Pro combine analyse de marché, signaux et assistance IA pour les investisseurs. Nous personnalisons votre expérience pour vous aider à décider plus vite et mieux.",
    },
    markets: {
      title: "Quels marchés vous intéressent ?",
      error: "Sélectionnez au moins un marché pour continuer.",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "Asie",
        other: "Autres",
      },
    },
    style: {
      title: "Quel est votre style d'investissement ?",
      error: "Choisissez un style d'investissement pour continuer.",
      swing: {
        icon: "📈",
        title: "Swing trader (jours–semaines)",
        description: "Positions détenues de quelques jours à quelques semaines.",
      },
      longterm: {
        icon: "💼",
        title: "Long terme (mois–années)",
        description: "Investir sur un horizon de mois ou d'années.",
      },
      daytrader: {
        icon: "⚡",
        title: "Day trader (intraday)",
        description: "Décisions et transactions réalisées dans la journée.",
      },
      learning: {
        icon: "🔰",
        title: "Je débute",
        description: "Je construis les bases et découvre le marché pas à pas.",
      },
    },
    ready: {
      title: "Votre profil est prêt",
      subtitle: "Trois fonctionnalités pour bien démarrer dès maintenant :",
      explore: "Découvrir →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "Consultez les signaux d'investissement et créez vos alertes.",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "Analysez vos décisions et réduisez les erreurs comportementales.",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "Testez des stratégies sans risque avec un capital virtuel.",
      },
    },
    nav: {
      back: "← Retour",
      start: "C'est parti →",
      next: "Suivant →",
      dashboard: "Aller au tableau de bord →",
    },
  },
  ja: {
    skip: "スキップ",
    step: "ステップ {{current}}/{{total}}",
    defaultName: "投資家",
    welcome: {
      title: "StockAI Proへようこそ、{{name}}さん！",
      body: "StockAI Proは市場分析、シグナル、AIサポートを投資家向けに統合したプラットフォームです。より良い判断を早く行えるよう体験をパーソナライズします。",
    },
    markets: {
      title: "関心のある市場はどれですか？",
      error: "続行するには少なくとも1つの市場を選択してください。",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "アジア",
        other: "その他",
      },
    },
    style: {
      title: "投資スタイルはどれですか？",
      error: "続行するには投資スタイルを選択してください。",
      swing: {
        icon: "📈",
        title: "スイング（数日〜数週間）",
        description: "数日から数週間保有するスタイル。",
      },
      longterm: {
        icon: "💼",
        title: "長期（数ヶ月〜数年）",
        description: "数ヶ月から数年のホライズンで投資。",
      },
      daytrader: {
        icon: "⚡",
        title: "デイトレード（イントラデイ）",
        description: "当日中に判断・取引を行うスタイル。",
      },
      learning: {
        icon: "🔰",
        title: "学習中",
        description: "基礎を固めながら市場を少しずつ学んでいます。",
      },
    },
    ready: {
      title: "プロフィールの準備ができました",
      subtitle: "今すぐ始めるのに役立つ3つの機能：",
      explore: "見る →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "最新の投資シグナルを確認し、アラートを設定。",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "意思決定を分析し、行動バイアスのミスを減らす。",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "仮想資金でリスクなく戦略をテスト。",
      },
    },
    nav: {
      back: "← 戻る",
      start: "始める →",
      next: "次へ →",
      dashboard: "ダッシュボードへ →",
    },
  },
  hi: {
    skip: "छोड़ें",
    step: "चरण {{current}}/{{total}}",
    defaultName: "निवेशक",
    welcome: {
      title: "StockAI Pro में आपका स्वागत है, {{name}}!",
      body: "StockAI Pro बाज़ार विश्लेषण, सिग्नल और AI सहायता को एक प्लेटफ़ॉर्म में जोड़ता है। हम आपके अनुभव को व्यक्तिगत बनाते हैं ताकि आप तेज़ी से बेहतर निर्णय ले सकें।",
    },
    markets: {
      title: "आप किन बाज़ारों में रुचि रखते हैं?",
      error: "आगे बढ़ने के लिए कम से कम एक बाज़ार चुनें।",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "एशिया",
        other: "अन्य",
      },
    },
    style: {
      title: "आपकी निवेश शैली क्या है?",
      error: "जारी रखने के लिए निवेश शैली चुनें।",
      swing: {
        icon: "📈",
        title: "स्विंग ट्रेडर (दिन–सप्ताह)",
        description: "कुछ दिनों से कुछ हफ्तों तक पोज़िशन।",
      },
      longterm: {
        icon: "💼",
        title: "दीर्घकालिक (महीने–वर्ष)",
        description: "महीनों या वर्षों के क्षितिज पर निवेश।",
      },
      daytrader: {
        icon: "⚡",
        title: "डे ट्रेडर (इंट्राडे)",
        description: "एक ही दिन में निर्णय और ट्रेड।",
      },
      learning: {
        icon: "🔰",
        title: "अभी सीख रहा/रही हूँ",
        description: "नींव बना रहा/रही हूँ और बाज़ार को क्रम से समझ रहा/रही हूँ।",
      },
    },
    ready: {
      title: "आपकी प्रोफ़ाइल तैयार है",
      subtitle: "अभी शुरू करने में मदद करने वाली तीन सुविधाएँ:",
      explore: "देखें →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "मौजूदा निवेश सिग्नल देखें और अलर्ट सेट करें।",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "निर्णयों का विश्लेषण करें और व्यवहारिक गलतियाँ कम करें।",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "वर्चुअल पूंजी पर बिना जोखिम रणनीति आज़माएँ।",
      },
    },
    nav: {
      back: "← पीछे",
      start: "शुरू करें →",
      next: "आगे →",
      dashboard: "डैशबोर्ड पर जाएँ →",
    },
  },
  ko: {
    skip: "건너뛰기",
    step: "{{current}}/{{total}}단계",
    defaultName: "투자자",
    welcome: {
      title: "StockAI Pro에 오신 것을 환영합니다, {{name}}님!",
      body: "StockAI Pro는 시장 분석, 시그널, AI 지원을 투자자를 위해 통합한 플랫폼입니다. 더 나은 결정을 더 빠르게 내릴 수 있도록 경험을 개인화합니다.",
    },
    markets: {
      title: "관심 있는 시장은 무엇인가요?",
      error: "계속하려면 시장을 하나 이상 선택하세요.",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "아시아",
        other: "기타",
      },
    },
    style: {
      title: "투자 스타일은 무엇인가요?",
      error: "계속하려면 투자 스타일을 선택하세요.",
      swing: {
        icon: "📈",
        title: "스윙 트레이더(일–주)",
        description: "며칠에서 몇 주간 포지션 유지.",
      },
      longterm: {
        icon: "💼",
        title: "장기(월–년)",
        description: "수개월 또는 수년 호라이즌으로 투자.",
      },
      daytrader: {
        icon: "⚡",
        title: "데이 트레이더(인트라데이)",
        description: "당일 결정 및 거래.",
      },
      learning: {
        icon: "🔰",
        title: "아직 배우는 중",
        description: "기초를 쌓으며 시장을 단계적으로 익힙니다.",
      },
    },
    ready: {
      title: "프로필이 준비되었습니다",
      subtitle: "지금 바로 시작하는 데 도움이 되는 세 가지 기능:",
      explore: "살펴보기 →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "현재 투자 시그널을 확인하고 알림을 설정하세요.",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "결정을 분석하고 반복되는 행동 오류를 줄이세요.",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "가상 자본으로 위험 없이 전략을 테스트하세요.",
      },
    },
    nav: {
      back: "← 뒤로",
      start: "시작하기 →",
      next: "다음 →",
      dashboard: "대시보드로 →",
    },
  },
  "zh-TW": {
    skip: "略過",
    step: "步驟 {{current}}/{{total}}",
    defaultName: "投資人",
    welcome: {
      title: "歡迎使用 StockAI Pro，{{name}}！",
      body: "StockAI Pro 整合市場分析、訊號與 AI 支援，協助投資人做出更好、更快的決策。我們會為您個人化體驗。",
    },
    markets: {
      title: "您對哪些市場感興趣？",
      error: "請至少選擇一個市場以繼續。",
      options: {
        gpw: "GPW",
        nyse_nasdaq: "NYSE/NASDAQ",
        dax: "DAX",
        lse: "LSE",
        asia: "亞洲",
        other: "其他",
      },
    },
    style: {
      title: "您的投資風格是？",
      error: "請選擇投資風格以繼續。",
      swing: {
        icon: "📈",
        title: "波段交易（數日–數週）",
        description: "持倉數日至數週。",
      },
      longterm: {
        icon: "💼",
        title: "長期（數月–數年）",
        description: "以數月或數年為投資視野。",
      },
      daytrader: {
        icon: "⚡",
        title: "當沖（日內）",
        description: "當日決策與交易。",
      },
      learning: {
        icon: "🔰",
        title: "尚在學習",
        description: "逐步建立基礎並認識市場。",
      },
    },
    ready: {
      title: "您的個人檔案已就緒",
      subtitle: "以下三項功能可協助您立即開始：",
      explore: "查看 →",
    },
    features: {
      signals: {
        title: "Signals",
        description: "查看最新投資訊號並設定提醒。",
      },
      behavioralCoach: {
        title: "Behavioral Coach",
        description: "分析決策並減少重複的行為偏差。",
      },
      paperTrading: {
        title: "Paper Trading",
        description: "以虛擬資金無風險測試策略。",
      },
    },
    nav: {
      back: "← 返回",
      start: "開始 →",
      next: "下一步 →",
      dashboard: "前往儀表板 →",
    },
  },
};

for (const [lng, onboarding] of Object.entries(ONBOARDING)) {
  const file = path.join(LOCALES_DIR, lng, "common.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.onboarding = onboarding;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Updated ${lng}/common.json`);
}
