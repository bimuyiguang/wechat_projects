"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

export type Language = "zh" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  isRTL: boolean
}

const translations = {
  zh: {
    // 导航与全局
    "nav.home": "数字定制试衣间",
    "nav.reviews": "定制评价反馈",
    "nav.brand": "织彩 TexColor",
    
    // 核心试衣间
    "hero.title": "织彩服装柔性定制中心",
    "hero.subtitle": "服装款式与面料数字化 2D 试衣系统",
    "hero.description":
      "本系统完美串联面料色彩数据库与成衣柔性制造。您可以自由选择不同的经典服装样板款式，并随意替换 17 种高精度数字化扫描面料，实时预览成衣效果，选择专属尺码直接下单定制。",
    "hero.buyNow": "立即下单定制",
    "hero.oldPrice": "¥499",
    "hero.newPrice": "¥399",

    // 服装定制相关
    "custom.title": "成衣定制控制台",
    "custom.style.select": "第一步：选择服装款式样板",
    "custom.fabric.select": "第二步：选择高保真数字化面料",
    "custom.size.select": "第三步：选择通用定制尺码",
    "custom.size.guide": "尺码建议指南",
    "custom.size.xs": "XS (建议 155-160cm / 40-50kg)",
    "custom.size.s": "S (建议 160-165cm / 50-60kg)",
    "custom.size.m": "M (建议 165-170cm / 60-70kg)",
    "custom.size.l": "L (建议 170-175cm / 70-80kg)",
    "custom.size.xl": "XL (建议 175-180cm / 80-90kg)",
    "custom.size.xxl": "XXL (建议身高 180-185厘米 / 体重 90-95公斤)",
    "custom.size.3xl": "3XL (建议身高 185-188厘米 / 体重 95-100公斤)",
    "custom.size.4xl": "4XL (建议身高 188-192厘米 / 体重 100-105公斤)",
    "custom.size.5xl": "5XL (建议身高 192-195厘米 / 体重 105-115公斤)",
    "custom.specs.title": "当前成衣及面料Spec参数",

    // 款式定义
    "style.tx.name": "极简百搭圆领T恤",
    "style.dk.name": "都市休闲轻便短裤",
    "style.dx.name": "英伦时尚风衣大衣",
    "style.cx.name": "都市雅痞休闲长袖衬衫",

    // 17种面料定义
    "fabric.fabric1.name": "01号 烈焰红高悬垂真丝",
    "fabric.fabric2.name": "02号 经典蓝高密精梳棉",
    "fabric.fabric3.name": "03号 燕麦黄生态粗织亚麻",
    "fabric.fabric4.name": "04号 烟雨灰复古纤维呢料",
    "fabric.fabric5.name": "05号 橄榄绿防泼水风衣料",
    "fabric.fabric6.name": "06号 珊瑚粉亲肤弹力针织",
    "fabric.fabric7.name": "07号 芥末黄微弹斜纹水洗",
    "fabric.fabric8.name": "08号 罗兰紫高贵天鹅绒面",
    "fabric.fabric9.name": "09号 象牙白抗皱丝光泡泡纱",
    "fabric.fabric10.name": "10号 摩卡棕重磅华达呢",
    "fabric.fabric11.name": "11号 薄荷绿冰丝爽滑透气",
    "fabric.fabric12.name": "12号 极光银科技防风拒水",
    "fabric.fabric13.name": "13号 雾霾蓝吸湿排汗速干",
    "fabric.fabric14.name": "14号 泥炭灰粗纺颗粒呢绒",
    "fabric.fabric15.name": "15号 柠檬黄高弹莫代尔针织",
    "fabric.fabric16.name": "16号 松石绿竹纤维有机织物",
    "fabric.fabric17.name": "17号 焦糖红高级针织精纺毛",

    // 面料通用属性
    "fabrics.composition": "面料材质成分",
    "fabrics.weight": "面料物理克重",
    "fabrics.width": "数字化幅宽",
    "fabrics.pantone": "PANTONE 色号",
    "fabrics.hex": "HEX 色值代码",
    "fabrics.rgb": "RGB 颜色分量",
    "fabrics.meters": "件",

    // 评价模块
    "reviews.title": "定制评价与试衣效果反馈",
    "reviews.average": "综合评分",
    "reviews.writeReview": "发表定制评语",
    "reviews.yourName": "您的姓名",
    "reviews.rating": "定制评分",
    "reviews.yourReview": "定制感受评语",
    "reviews.placeholder": "请分享您对服装版型上身效果、面料质感、色差精准度、尺码合适度等方面的感受...",
    "reviews.submit": "提交评语",
    "reviews.submitting": "正在提交...",
    "reviews.verifiedOnly": "仅限已下单定制的真实买家可发表评语",

    // CTA
    "cta.title": "探索柔性智能制造的无限可能",
    "cta.description": "织彩数字定制中心支持面料与版型的无缝组合，小单快反极速响应，从屏幕预览到工厂裁剪最快仅需 48 小时。",
    "cta.button": "索取定制版型册与布样",

    // 页脚
    "footer.copyright": "© 2026 织彩 TexColor 服装数字定制中心. 保留所有权利。",

    // 结算页面
    "checkout.title": "定制成衣结算中心",
    "checkout.orderSummary": "定制方案摘要",
    "checkout.fullName": "收货人姓名",
    "checkout.email": "电子邮箱",
    "checkout.phone": "联系电话",
    "checkout.address": "送货地址",
    "checkout.quantity": "定制数量 (件)",
    "checkout.paymentMethod": "支付及结算方式",
    "checkout.creditCard": "在线快捷支付 (微信支付 / 支付宝)",
    "checkout.paypal": "企业对公转账",
    "checkout.cashOnDelivery": "顺丰代收货款 (货到付款)",
    "checkout.subtotal": "定制小计",
    "checkout.discount": "特惠减免",
    "checkout.total": "应付总额",
    "checkout.placeOrder": "确认信息并提交订单",
    "checkout.processing": "正在提交定制订单...",
  },
  en: {
    // Navigation
    "nav.home": "Digital Fitting Room",
    "nav.reviews": "Customization Reviews",
    "nav.brand": "TexColor",

    // Hero Section
    "hero.title": "TexColor Apparel Customization",
    "hero.subtitle": "Digital 2D Style & Fabric Fitting System",
    "hero.description":
      "Perfectly connecting fabric database with garment flexible manufacturing. Choose from classic clothing templates, swap 17 high-precision digital scanned fabrics, preview high-fidelity on-model effects, select your size, and order instantly.",
    "hero.buyNow": "Order Custom Garment",
    "hero.oldPrice": "$99",
    "hero.newPrice": "$79",

    // Custom Panel
    "custom.title": "Customization Panel",
    "custom.style.select": "Step 1: Select Garment Template",
    "custom.fabric.select": "Step 2: Select Digital Scanned Fabric",
    "custom.size.select": "Step 3: Select Custom Size",
    "custom.size.guide": "Size Recommendation Guide",
    "custom.size.xs": "XS (Suggested 155-160cm / 40-50kg)",
    "custom.size.s": "S (Suggested 160-165cm / 50-60kg)",
    "custom.size.m": "M (Suggested 165-170cm / 60-70kg)",
    "custom.size.l": "L (Suggested 170-175cm / 70-80kg)",
    "custom.size.xl": "XL (Suggested 175-180cm / 80-90kg)",
    "custom.size.xxl": "XXL (Suggested 180-185cm / 90-100kg)",
    "custom.specs.title": "Current Spec Specs",

    // Style Names
    "style.tx.name": "Essential Round-Neck Tee",
    "style.dk.name": "Urban Casual Shorts",
    "style.dx.name": "Classic Trench Coat",
    "style.cx.name": "Smart Casual Shirt",

    // Fabric Names
    "fabric.fabric1.name": "01 Flame Red Fluid Silk",
    "fabric.fabric2.name": "02 Classic Blue Combed Cotton",
    "fabric.fabric3.name": "03 Almond Beige Woven Linen",
    "fabric.fabric4.name": "04 Wind Chime Retro Wool",
    "fabric.fabric5.name": "05 Olive Green Trench Cotton",
    "fabric.fabric6.name": "06 Coral Pink Stretch Knit",
    "fabric.fabric7.name": "07 Mustard Yellow Twill Canvas",
    "fabric.fabric8.name": "08 Royal Purple Velvet",
    "fabric.fabric9.name": "09 Ivory White Seersucker",
    "fabric.fabric10.name": "10 Mocha Brown Heavy Gabardine",
    "fabric.fabric11.name": "11 Mint Green Smooth Ice-Silk",
    "fabric.fabric12.name": "12 Aurora Silver Tech Windbreaker",
    "fabric.fabric13.name": "13 Mist Blue Dry-Fit Athletic",
    "fabric.fabric14.name": "14 Charcoal Grey Mélange Tweed",
    "fabric.fabric15.name": "15 Lemon Yellow Stretch Modal",
    "fabric.fabric16.name": "16 Turquoise Organic Bamboo",
    "fabric.fabric17.name": "17 Caramel Red Worsted Wool",

    // Fabric Specs
    "fabrics.composition": "Fabric Composition",
    "fabrics.weight": "Fabric Weight",
    "fabrics.width": "Digital Width",
    "fabrics.pantone": "PANTONE Color",
    "fabrics.hex": "HEX Code",
    "fabrics.rgb": "RGB Color Value",
    "fabrics.meters": "pcs",

    // Reviews
    "reviews.title": "Custom Garment Reviews & Fit Feedback",
    "reviews.average": "Average Rating",
    "reviews.writeReview": "Write a Review",
    "reviews.yourName": "Your Name",
    "reviews.rating": "Garment Rating",
    "reviews.yourReview": "Review Comment",
    "reviews.placeholder": "Share your thoughts on the drape, color accuracy, size fit, and overall custom quality...",
    "reviews.submit": "Submit Review",
    "reviews.submitting": "Submitting...",
    "reviews.verifiedOnly": "Only verified buyers can leave custom reviews",

    // CTA
    "cta.title": "Explore Infinite Options of Smart Manufacturing",
    "cta.description": "TexColor connects digital libraries with modular tailoring, delivering bespoke clothing from digital rendering to precision cutting in 48 hours.",
    "cta.button": "Request Sample Book & Swatches",

    // Footer
    "footer.copyright": "© 2026 TexColor Apparel Customization Center. All rights reserved.",

    // Checkout
    "checkout.title": "Custom Checkout Center",
    "checkout.orderSummary": "Customization Summary",
    "checkout.fullName": "Full Name",
    "checkout.email": "Email Address",
    "checkout.phone": "Phone Number",
    "checkout.address": "Shipping Address",
    "checkout.quantity": "Quantity (pcs)",
    "checkout.paymentMethod": "Payment Method",
    "checkout.creditCard": "Online Payment (WeChat / Alipay)",
    "checkout.paypal": "Corporate Wire Transfer",
    "checkout.cashOnDelivery": "Cash on Delivery",
    "checkout.subtotal": "Subtotal",
    "checkout.discount": "Discount",
    "checkout.total": "Total Amount",
    "checkout.placeOrder": "Confirm Custom Details & Order",
    "checkout.processing": "Submitting custom order...",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("zh")

  useEffect(() => {
    // Force language to be zh to satisfy pure Chinese requirement
    if (typeof window !== "undefined") {
      localStorage.setItem("language", "zh")
      setLanguage("zh")
      document.documentElement.lang = "zh"
      document.documentElement.dir = "ltr"
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("language", "zh")
      document.documentElement.lang = "zh"
      document.documentElement.dir = "ltr"
    }
  }, [language])

  const t = (key: string): string => {
    // Double insurance: always return Chinese translation
    return translations["zh"][key as keyof (typeof translations)["zh"]] || key
  }

  const isRTL = false

  return <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
