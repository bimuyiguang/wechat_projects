"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Star, CheckCircle2, Sliders, Palette, Ruler, X, MessageSquareWarning, QrCode, Loader2, ShieldCheck } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { fetchFromApi } from "@/lib/api"
import QRCode from "qrcode"

interface GarmentStyle {
  id: string
  nameKey: string
  image: string // Icon image path or OSS URL
  basePrice: number // Base price for this style
  previewUrls?: Record<string, string>
}

interface FabricSpec {
  id: string // e.g. fabric1
  nameKey: string
  composition: string
  weight: string
  width: string
  pantone: string
  hex: string
  rgb: string
  priceMarkup: number // Price increment markup for premium fabrics
  image?: string
  previewUrls?: Record<string, string>
}

const ossBase = "https://sky-takeout-wet.oss-cn-beijing.aliyuncs.com/fabricmind/public/shop"
const styleImage = (styleId: string) => `${ossBase}/styles/style/${styleId}/image-${styleId}.jpg`
const fabricImage = (fabricId: string) => `${ossBase}/fabrics/fabric/${fabricId}/image-${fabricId}.jpg`
const previewImage = (fabricId: string, styleId: string) =>
  `${ossBase}/previews/preview/${fabricId}_${styleId}/image_url-${fabricId}_${styleId}.png`
const previewUrlsFor = (fabricId: string) => ({
  tx: previewImage(fabricId, "tx"),
  dx: previewImage(fabricId, "dx"),
  dk: previewImage(fabricId, "dk"),
  cx: previewImage(fabricId, "cx"),
})
const normalizeStyles = (items: GarmentStyle[]) =>
  items.map((style) => ({ ...style, image: style.image?.startsWith("http") ? style.image : styleImage(style.id) }))
const normalizeFabrics = (items: FabricSpec[]) =>
  items.map((fabric) => ({
    ...fabric,
    image: fabric.image?.startsWith("http") ? fabric.image : fabricImage(fabric.id),
    previewUrls: { ...previewUrlsFor(fabric.id), ...(fabric.previewUrls || {}) },
  }))

const stylesList: GarmentStyle[] = [
  { id: "tx", nameKey: "style.tx.name", image: styleImage("tx"), basePrice: 199 },
  { id: "dk", nameKey: "style.dk.name", image: styleImage("dk"), basePrice: 179 },
  { id: "dx", nameKey: "style.dx.name", image: styleImage("dx"), basePrice: 499 },
  { id: "cx", nameKey: "style.cx.name", image: styleImage("cx"), basePrice: 299 },
]

const fabricsList: FabricSpec[] = [
  { id: "fabric1", nameKey: "fabric.fabric1.name", composition: "100% 桑蚕丝", weight: "19姆米 (约 82克/平方米)", width: "140厘米", pantone: "18-1662 TCX (烈焰红)", hex: "#D62229", rgb: "214, 34, 41", priceMarkup: 150 },
  { id: "fabric2", nameKey: "fabric.fabric2.name", composition: "100% 精梳埃及长绒棉", weight: "220克/平方米", width: "150厘米", pantone: "19-4052 TCX (经典蓝)", hex: "#0F4C81", rgb: "15, 76, 129", priceMarkup: 0 },
  { id: "fabric3", nameKey: "fabric.fabric3.name", composition: "100% 生态经纬交织雨露亚麻", weight: "180克/平方米", width: "145厘米", pantone: "14-1116 TCX (杏仁黄)", hex: "#D2C29D", rgb: "210, 194, 157", priceMarkup: 50 },
  { id: "fabric4", nameKey: "fabric.fabric4.name", composition: "75% 羊毛, 25% 天丝", weight: "380克/平方米", width: "148厘米", pantone: "17-1501 TCX (烟雨灰)", hex: "#A2A2A0", rgb: "162, 162, 160", priceMarkup: 100 },
  { id: "fabric5", nameKey: "fabric.fabric5.name", composition: "80% 精梳棉, 20% 高弹天丝", weight: "200克/平方米", width: "150厘米", pantone: "19-0303 TCX (橄榄绿)", hex: "#4B5320", rgb: "75, 83, 32", priceMarkup: 20 },
  { id: "fabric6", nameKey: "fabric.fabric6.name", composition: "92% 莫代尔, 8% 氨纶", weight: "180克/平方米", width: "152厘米", pantone: "16-1546 TCX (珊瑚粉)", hex: "#F88379", rgb: "248, 131, 121", priceMarkup: 15 },
  { id: "fabric7", nameKey: "fabric.fabric7.name", composition: "100% 强捻水洗斜纹帆布", weight: "300克/平方米", width: "145厘米", pantone: "14-1050 TCX (芥末黄)", hex: "#E1AD01", rgb: "225, 173, 1", priceMarkup: 30 },
  { id: "fabric8", nameKey: "fabric.fabric8.name", composition: "95% 优质真丝天鹅绒, 5% 氨纶", weight: "240克/平方米", width: "140厘米", pantone: "19-3520 TCX (罗兰紫)", hex: "#4F2F4F", rgb: "79, 47, 79", priceMarkup: 120 },
  { id: "fabric9", nameKey: "fabric.fabric9.name", composition: "100% 双烧丝光防皱泡泡纱", weight: "130克/平方米", width: "148厘米", pantone: "11-0103 TCX (象牙白)", hex: "#FDFBF7", rgb: "253, 251, 247", priceMarkup: 40 },
  { id: "fabric10", nameKey: "fabric.fabric10.name", composition: "65% 纯羊毛, 35% 聚酯纤维", weight: "320克/平方米", width: "150厘米", pantone: "19-0915 TCX (摩卡棕)", hex: "#4A3B32", rgb: "74, 59, 50", priceMarkup: 80 },
  { id: "fabric11", nameKey: "fabric.fabric11.name", composition: "88% 冰丝锦纶, 12% 弹力氨纶", weight: "160克/平方米", width: "150厘米", pantone: "13-5412 TCX (薄荷绿)", hex: "#98FF98", rgb: "152, 255, 152", priceMarkup: 25 },
  { id: "fabric12", nameKey: "fabric.fabric12.name", composition: "100% 科技复合纳米防泼水聚酯", weight: "140克/平方米", width: "145厘米", pantone: "14-4102 TCX (极光银)", hex: "#C0C0C0", rgb: "192, 192, 192", priceMarkup: 60 },
  { id: "fabric13", nameKey: "fabric.fabric13.name", composition: "90% 吸湿速干超细纤维, 10% 氨纶", weight: "150克/平方米", width: "150厘米", pantone: "15-4020 TCX (雾霾蓝)", hex: "#73C2FB", rgb: "115, 194, 251", priceMarkup: 15 },
  { id: "fabric14", nameKey: "fabric.fabric14.name", composition: "85% 澳大利亚粗纺毛呢, 15% 粘胶", weight: "420克/平方米", width: "148厘米", pantone: "19-3908 TCX (泥炭灰)", hex: "#4A4A4A", rgb: "74, 74, 74", priceMarkup: 110 },
  { id: "fabric15", nameKey: "fabric.fabric15.name", composition: "95% 高弹天丝莫代尔, 5% 莱卡", weight: "190克/平方米", width: "152厘米", pantone: "13-0630 TCX (柠檬黄)", hex: "#FFF700", rgb: "255, 247, 0", priceMarkup: 20 },
  { id: "fabric16", nameKey: "fabric.fabric16.name", composition: "100% 天然竹纤维低碳环保丝", weight: "170克/平方米", width: "148厘米", pantone: "16-5127 TCX (松石绿)", hex: "#30D5C8", rgb: "48, 213, 200", priceMarkup: 30 },
  { id: "fabric17", nameKey: "fabric.fabric17.name", composition: "100% 澳大利亚美利奴超细精纺羊毛", weight: "280克/平方米", width: "148厘米", pantone: "18-1440 TCX (焦糖红)", hex: "#C68E17", rgb: "198, 142, 23", priceMarkup: 140 },
].map((fabric) => ({
  ...fabric,
  image: fabric.image || fabricImage(fabric.id),
  previewUrls: fabric.previewUrls || previewUrlsFor(fabric.id),
}))

const sizesList = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"]
const missingPreviewImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23f4f4f5'/%3E%3Ctext x='300' y='290' text-anchor='middle' font-size='28' font-family='Arial' fill='%2371717a'%3EMissing OSS image%3C/text%3E%3Ctext x='300' y='330' text-anchor='middle' font-size='18' font-family='Arial' fill='%23a1a1aa'%3EPlease update database preview URL%3C/text%3E%3C/svg%3E"

// Detailed Mapped Size Measurement Specs (for XS - 5XL)
const sizesSpecification = [
  { size: "XS", height: "155", weight: "45", shoulder: "50", bust: "102" },
  { size: "S", height: "160", weight: "50", shoulder: "52", bust: "106" },
  { size: "M", height: "165", weight: "60", shoulder: "54", bust: "110" },
  { size: "L", height: "170", weight: "70", shoulder: "56", bust: "114" },
  { size: "XL", height: "175", weight: "80", shoulder: "58", bust: "118" },
  { size: "XXL", height: "180", weight: "90", shoulder: "60", bust: "122" },
  { size: "3XL", height: "185", weight: "95", shoulder: "61", bust: "126" },
  { size: "4XL", height: "188", weight: "100", shoulder: "62", bust: "132" },
  { size: "5XL", height: "192", weight: "110", shoulder: "63", bust: "138" },
]

interface Review {
  id: number
  name: string
  role: string
  rating: number
  comment: string
  date: string
  verified: boolean
}

const initialReviews: Review[] = [
  {
    id: 1,
    name: "李薇",
    role: "新锐独立服装设计师 / 时装买手",
    rating: 5,
    comment:
      "数字试衣间的替换渲染图清晰度极高，面料的悬垂感和大衣挺括版型的融合非常直观！实物大货寄到后色缸差几乎肉眼不可见，尺码XS非常合身，给柔性供应链点赞！",
    date: "2026-05-24",
    verified: true,
  },
  {
    id: 2,
    name: "Marcus G.",
    role: "男装工作室主理人",
    rating: 5,
    comment:
      "面料切换的渲染图效果非常精致。经典款长袖衬衫版型搭配经典蓝棉面料，细节感十分丰富。下单流程顺畅且极速，体验很好。",
    date: "2026-05-20",
    verified: true,
  },
  {
    id: 3,
    name: "赵华",
    role: "高级私人定制店联合创始人",
    rating: 4,
    comment:
      "T恤板型通用性很强。亚麻面料的粗犷感在大图里能看得很细腻。定制了M码衬衫和短裤，尺码极其规整，推荐给需要高频打样的服装工作室！",
    date: "2026-05-18",
    verified: true,
  },
]

export default function HomePage() {
  const { t } = useLanguage()
  const router = useRouter()
  
  // Dynamic data states loaded from API
  const [styles, setStyles] = useState<GarmentStyle[]>(stylesList)
  const [fabrics, setFabrics] = useState<FabricSpec[]>(fabricsList)

  // Selection states
  const [selectedStyleId, setSelectedStyleId] = useState("tx") // Default T-shirt
  const [selectedFabricId, setSelectedFabricId] = useState("fabric1") // Default Fabric 1 (Red Silk)
  const [selectedSize, setSelectedSize] = useState("M") // Default Size M
  
  // Size Chart Popup Modal States
  const [showSizeChart, setShowSizeChart] = useState(false)
  const [fitType, setFitType] = useState("宽松") // Default "宽松" to match screenshots

  const getBustModifier = (fit: string) => {
    switch (fit) {
      case "超紧":
        return -6
      case "紧身":
        return -3
      case "修身":
        return 0
      case "宽松":
        return 4
      case "超宽":
        return 8
      default:
        return 0
    }
  }

  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [newReview, setNewReview] = useState({
    name: "",
    role: "",
    rating: 0,
    comment: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifiedBuyer, setIsVerifiedBuyer] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [checkingCheckout, setCheckingCheckout] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState("")
  const [qrToken, setQrToken] = useState("")
  const [qrStatus, setQrStatus] = useState<"idle" | "pending" | "confirmed" | "expired">("idle")
  const [qrLoading, setQrLoading] = useState(false)
  const [qrImageUrl, setQrImageUrl] = useState("")
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Find selected objects using dynamic state
  const selectedStyle = styles.find((s) => s.id === selectedStyleId) || styles[0] || stylesList[0]
  const selectedFabric = fabrics.find((f) => f.id === selectedFabricId) || fabrics[0] || fabricsList[0]

  // Calculated Dynamic Price
  const finalPrice = selectedStyle.basePrice + selectedFabric.priceMarkup
  const oldPrice = Math.round(finalPrice * 1.25)

  const renderingImagePath = selectedFabric.previewUrls?.[selectedStyle.id] || ""
  const showcaseImage = (fabricId: string, styleId: string) =>
    fabrics.find((fabric) => fabric.id === fabricId)?.previewUrls?.[styleId] || missingPreviewImage
  const checkoutUrl = `/checkout?style=${selectedStyle.id}&fabric=${selectedFabric.id}&size=${selectedSize}`

  const stopQrPolling = () => {
    if (qrPollingRef.current) {
      clearInterval(qrPollingRef.current)
      qrPollingRef.current = null
    }
  }

  const startQrLogin = async (targetUrl = checkoutUrl) => {
    setQrLoading(true)
    stopQrPolling()
    try {
      const data = await fetchFromApi("/api/auth/qr/create", { method: "POST" })
      const token = data?.qrToken || ""
      if (!token) throw new Error("服务器未返回登录码")
      setQrToken(token)
      setQrImageUrl("")
      setQrStatus("pending")

      qrPollingRef.current = setInterval(async () => {
        try {
          const statusData = await fetchFromApi(`/api/auth/qr/status?qrToken=${encodeURIComponent(token)}`)
          if (statusData.status === "confirmed") {
            stopQrPolling()
            setQrStatus("confirmed")
            const me = await fetchFromApi("/api/me")
            if (me?.user) setCurrentUser(me.user)
            setTimeout(() => {
              setLoginDialogOpen(false)
              router.push(targetUrl)
            }, 500)
          } else if (statusData.status === "expired") {
            stopQrPolling()
            setQrStatus("expired")
          }
        } catch {
          // Keep polling; a short network shake should not interrupt login.
        }
      }, 2500)
    } catch (err: any) {
      setQrStatus("idle")
      alert("生成小程序登录码失败: " + (err?.message || "请稍后重试"))
    } finally {
      setQrLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!qrToken) {
      setQrImageUrl("")
      return
    }
    QRCode.toDataURL(qrToken, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrImageUrl(url)
    }).catch(() => {
      if (!cancelled) setQrImageUrl("")
    })
    return () => { cancelled = true }
  }, [qrToken])

  useEffect(() => {
    fetchFromApi("/api/me")
      .then((data) => setCurrentUser(data?.user || null))
      .catch(() => setCurrentUser(null))
  }, [])

  const handleBuyNow = async () => {
    const targetUrl = checkoutUrl
    setPendingCheckoutUrl(targetUrl)
    setCheckingCheckout(true)
    try {
      const me = await fetchFromApi("/api/me")
      if (me?.user) setCurrentUser(me.user)
      router.push(targetUrl)
    } catch {
      setLoginDialogOpen(true)
      await startQrLogin(targetUrl)
    } finally {
      setCheckingCheckout(false)
    }
  }

  const handleLoginDialogChange = (open: boolean) => {
    setLoginDialogOpen(open)
    if (!open) {
      stopQrPolling()
      setQrToken("")
      setQrStatus("idle")
      setQrLoading(false)
    }
  }

  const handleHomeLogout = async () => {
    await fetchFromApi("/api/auth/logout", { method: "POST" }).catch(() => {})
    setCurrentUser(null)
  }

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400 transition-colors" : ""}`}
            onClick={interactive && onRatingChange ? () => onRatingChange(star) : undefined}
          />
        ))}
      </div>
    )
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isVerifiedBuyer) {
      alert(t("reviews.verifiedOnly"))
      return
    }

    if (!newReview.name.trim() || !newReview.comment.trim() || newReview.rating === 0) {
      alert("请填写所有必要字段并选择评分。")
      return
    }

    setIsSubmitting(true)

    try {
      const data = await fetchFromApi("/api/shop/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newReview.name,
          role: newReview.role.trim() || "定制服装主理人",
          rating: newReview.rating,
          comment: newReview.comment
        })
      });
      setReviews((prev) => [data.review, ...prev])
      setNewReview({ name: "", role: "", rating: 0, comment: "" })
      alert("感谢您的专业定制评价！")
    } catch (err: any) {
      alert("评价提交失败: " + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 5

  useEffect(() => {
    if (typeof window !== "undefined") {
      const verified = localStorage.getItem("verifiedBuyer") === "true"
      setIsVerifiedBuyer(verified)
    }

    async function loadShopData() {
      try {
        const stylesData = await fetchFromApi("/api/shop/styles");
        setStyles(normalizeStyles(stylesData));
      } catch (e) {
        console.warn("无法从后端加载款式，使用内置数据", e);
      }
      try {
        const fabricsData = await fetchFromApi("/api/shop/fabrics");
        setFabrics(normalizeFabrics(fabricsData));
      } catch (e) {
        console.warn("无法从后端加载面料，使用内置数据", e);
      }
      try {
        const reviewsData = await fetchFromApi("/api/shop/reviews");
        setReviews(reviewsData);
      } catch (e) {
        console.warn("无法从后端加载评价，使用内置数据", e);
      }
    }
    loadShopData();
  }, [])

  useEffect(() => {
    return () => stopQrPolling()
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero / Studio Fitting Section */}
      <section className="relative py-16 lg:py-24 bg-gradient-to-b from-muted/50 to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {currentUser && (
            <div className="mb-6 flex justify-end">
              <div className="inline-flex max-w-full items-center gap-3 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="truncate">已微信登录：{currentUser.nickName || currentUser.name || "微信用户"}</span>
                <button type="button" onClick={handleHomeLogout} className="text-zinc-500 hover:text-zinc-900">
                  退出
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left: HD Fitting Preview Engine */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="relative group w-full max-w-md bg-card rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 hover:shadow-primary/10 border border-border">
                {/* 3D Rendered Combined Image */}
                <div className="relative w-full aspect-[4/5] bg-muted overflow-hidden">
                  {renderingImagePath ? (
                    <img
                      src={renderingImagePath}
                      alt={`${t(selectedStyle.nameKey)} - ${t(selectedFabric.nameKey)}`}
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-102"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
                      缺少 OSS 预览图
                    </div>
                  )}
                  <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground backdrop-blur-md border border-white/10 text-xs px-3 py-1 font-sans uppercase tracking-widest shadow-md">
                    成衣试衣效果 / 数字化效果呈现
                  </Badge>
                  
                  {/* Style Preview Icon (Floating Overlay) */}
                  <div className="absolute bottom-4 right-4 w-16 h-16 rounded-xl overflow-hidden border border-white/20 shadow-lg bg-black/40 backdrop-blur-md flex items-center justify-center p-0.5">
                    {selectedStyle.image ? (
                      <img src={selectedStyle.image} alt="版型" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-[10px] text-white/80">缺图</span>
                    )}
                  </div>
                </div>

                {/* Professional Custom Info Bar */}
                <div className="p-5 bg-white dark:bg-zinc-950 flex gap-4 items-center border-t border-border">
                  {/* Fabric Swatch circular preview */}
                  <div
                    className="w-14 h-14 rounded-full shadow-inner border border-black/10 shrink-0 transition-all duration-500 ring-4 ring-muted"
                    style={{ backgroundColor: selectedFabric.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono font-bold">
                      数字化定制参数
                    </p>
                    <h3 className="text-md font-bold text-zinc-900 dark:text-zinc-50 truncate tracking-tight mt-0.5">
                      {t(selectedStyle.nameKey)}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                      {t(selectedFabric.nameKey)} • {selectedFabric.pantone.split(" ")[0]}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-xs font-mono px-2 py-0.5 bg-muted">
                      定制尺码 {selectedSize}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Customization Interactive Console */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="inline-flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold gap-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  <Palette className="w-3.5 h-3.5" />
                  织彩柔性智能快反定制
                </Badge>
                <Badge variant="outline" className="px-3 py-1 text-xs font-mono">
                  {selectedFabric.id.toUpperCase()}_{selectedStyle.id.toUpperCase()}
                </Badge>
              </div>

              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">
                {t("hero.title")}
              </h1>
              <p className="text-md text-muted-foreground mb-6 leading-relaxed">
                {t("hero.description")}
              </p>

              {/* Dynamic Prices */}
              <div className="mb-6 flex items-baseline gap-4">
                <span className="text-xl text-muted-foreground line-through font-mono">
                  ¥{oldPrice}
                </span>
                <span className="text-4xl font-black text-primary font-mono">
                  ¥{finalPrice} <span className="text-sm font-normal text-muted-foreground">/ 件 (包工包料全包价)</span>
                </span>
              </div>

              <div className="space-y-6 border-t border-border pt-6">
                
                {/* Step 1: Style Selection */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">1</span>
                    {t("custom.style.select")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {styles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyleId(style.id)}
                        className={`relative p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all duration-300 ${
                          selectedStyleId === style.id
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5 scale-102"
                            : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border">
                          {style.image ? (
                            <img src={style.image} alt={t(style.nameKey)} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted text-[10px] text-muted-foreground">缺图</div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-center tracking-tight text-foreground truncate max-w-full">
                          {t(style.nameKey).replace("极简", "").replace("都市", "")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Fabric Grid Selection (17 Fabrics!) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">2</span>
                    {t("custom.fabric.select")}
                  </h3>
                  <div className="grid grid-cols-5 sm:grid-cols-9 gap-2 max-h-48 overflow-y-auto p-1.5 border border-border rounded-xl bg-muted/20">
                    {fabrics.map((fabric) => (
                      <button
                        key={fabric.id}
                        onClick={() => setSelectedFabricId(fabric.id)}
                        className={`relative w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                          selectedFabricId === fabric.id
                            ? "border-primary scale-110 shadow-lg ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground"
                        }`}
                        style={{ backgroundColor: fabric.hex }}
                        title={t(fabric.nameKey)}
                      >
                        {selectedFabricId === fabric.id && (
                          <div className="absolute inset-0 rounded-full border-2 border-white" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 pl-1.5">
                    <span className="w-3.5 h-3.5 rounded-sm border border-black/10 inline-block shrink-0" style={{ backgroundColor: selectedFabric.hex }} />
                    已选面料: <span className="text-foreground">{t(selectedFabric.nameKey)}</span>
                  </p>
                </div>

                {/* Step 3: Custom Size Selection with Interactive Size Chart link */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">3</span>
                      {t("custom.size.select")}
                    </h3>
                    
                    {/* View Size Chart Trigger Button */}
                    <button
                      onClick={() => setShowSizeChart(true)}
                      className="text-xs text-primary hover:text-primary/95 font-extrabold flex items-center gap-1 hover:underline transition-colors focus:outline-none"
                    >
                      <Ruler className="w-3.5 h-3.5" />
                      查看尺码表 📏
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {sizesList.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2.5 rounded-lg border-2 text-xs font-extrabold tracking-wider transition-all ${
                          selectedSize === size
                            ? "border-primary bg-primary text-primary-foreground shadow-md"
                            : "border-border hover:border-muted-foreground/50 hover:bg-muted"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  
                  {/* Size recommendation notice card */}
                  <div className="bg-card border border-border p-3 rounded-lg flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                    <Ruler className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-foreground">{t("custom.size.guide")}：</span>
                      <span>{t(`custom.size.${selectedSize.toLowerCase()}`)}</span>
                    </div>
                  </div>
                </div>

                {/* Current Custom Specs Specs Panel */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    当前成衣及面料规格详情
                  </h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs leading-relaxed">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[10px]">{t("fabrics.composition")}</span>
                      <p className="font-semibold text-foreground truncate">{selectedFabric.composition}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[10px]">{t("fabrics.pantone")}</span>
                      <p className="font-mono font-bold text-foreground">{selectedFabric.pantone.split(" ")[0]}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[10px]">{t("fabrics.weight")}</span>
                      <p className="font-semibold text-foreground">{selectedFabric.weight}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[10px]">{t("fabrics.hex")}</span>
                      <p className="font-mono font-semibold text-foreground flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm border border-black/10 inline-block shrink-0" style={{ backgroundColor: selectedFabric.hex }} />
                        {selectedFabric.hex}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[10px]">成衣基础定制费</span>
                      <p className="font-semibold text-foreground font-mono">¥{selectedStyle.basePrice}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-[10px]">高端面料溢价</span>
                      <p className="font-semibold text-foreground font-mono">¥{selectedFabric.priceMarkup}</p>
                    </div>
                  </div>
                </div>

                {/* Place Order CTA Buttons */}
                <div className="flex flex-wrap gap-4 items-center pt-2">
                  <Button
                    size="lg"
                    onClick={handleBuyNow}
                    disabled={checkingCheckout}
                    className="flex-1 min-w-[200px] py-6 text-md font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all duration-300"
                  >
                    {checkingCheckout ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在检查登录
                      </>
                    ) : (
                      t("hero.buyNow")
                    )}
                  </Button>
                  <Button size="lg" variant="outline" className="px-8 py-6 text-md font-semibold" onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}>
                    定制评价 ({reviews.length})
                  </Button>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Description Info Section */}
      <section className="py-16 lg:py-24 bg-muted/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
                织彩数字化服装柔性快反链
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                织彩 (TexColor) 柔性定制系统深度整合前端 2D 试衣看板与后端智能制造工序。所有款式样板均完成 3D 拟真动作标定，面料库收录超高清纤维扫描图。您在屏幕前的每一次点击组合，都将同步翻译为织物裁剪工序的机器数字化坐标，保证“所见即所得”，极速打样与交付。
              </p>

              {/* Unique selling points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-sm font-semibold">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>一件起订，单品柔性定制</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>数字化缸差控制色缸差极小</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>顺丰特快寄送，48小时极速裁剪</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>尺码通用精细建模，极速响应</span>
                </div>
              </div>
            </div>

            {/* Showcase grid of core styles */}
            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="relative group rounded-xl overflow-hidden shadow-md aspect-square bg-card border border-border">
                <img
                  src={showcaseImage("fabric1", "tx")}
                  alt="极简百搭T恤"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <p className="text-white text-xs font-bold font-sans">款式: 极简百搭T恤</p>
                  <p className="text-white/70 text-[10px] mt-0.5">面料: 01号 烈焰红高悬垂真丝</p>
                </div>
              </div>
              <div className="relative group rounded-xl overflow-hidden shadow-md aspect-square bg-card border border-border">
                <img
                  src={showcaseImage("fabric2", "cx")}
                  alt="休闲长袖衬衫"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <p className="text-white text-xs font-bold font-sans">款式: 休闲长袖衬衫</p>
                  <p className="text-white/70 text-[10px] mt-0.5">面料: 02号 经典蓝高密精梳棉</p>
                </div>
              </div>
              <div className="relative group rounded-xl overflow-hidden shadow-md aspect-square bg-card border border-border">
                <img
                  src={showcaseImage("fabric3", "dk")}
                  alt="休闲轻便短裤"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <p className="text-white text-xs font-bold font-sans">款式: 休闲轻便短裤</p>
                  <p className="text-white/70 text-[10px] mt-0.5">面料: 03号 燕麦黄生态粗织亚麻</p>
                </div>
              </div>
              <div className="relative group rounded-xl overflow-hidden shadow-md aspect-square bg-card border border-border">
                <img
                  src={showcaseImage("fabric4", "dx")}
                  alt="时尚风衣大衣"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <p className="text-white text-xs font-bold font-sans">款式: 时尚风衣大衣</p>
                  <p className="text-white/70 text-[10px] mt-0.5">面料: 04号 烟雨灰复古纤维呢料</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-16 lg:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
              {t("reviews.title")}
            </h2>
            <div className="flex items-center justify-center space-x-3">
              <div className="flex items-center space-x-2">
                {renderStars(Math.round(averageRating))}
                <span className="text-lg font-bold ml-1">{averageRating.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">({reviews.length} 条定制客户真实反馈)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Reviews List */}
            <div className="lg:col-span-2 space-y-6">
              {reviews.map((review) => (
                <Card key={review.id} className="hover:shadow-lg transition-all duration-300 border border-border bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-foreground text-md">{review.name}</h3>
                          {review.verified && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 font-medium border border-emerald-200/30">
                              已购定制成衣
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{review.role} • {new Date(review.date).toLocaleDateString()}</p>
                      </div>
                      {renderStars(review.rating)}
                    </div>
                    <p className="text-foreground text-sm leading-relaxed text-pretty">{review.comment}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add Review Form */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8 border border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">{t("reviews.writeReview")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!isVerifiedBuyer ? (
                    <div className="text-center p-6 bg-muted/30 rounded-lg border border-dashed border-border">
                      <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                        {t("reviews.verifiedOnly")}
                      </p>
                      <Button className="w-full font-bold" onClick={handleBuyNow} disabled={checkingCheckout}>
                        {t("hero.buyNow")}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-4">
                      <div>
                        <Label htmlFor="reviewName" className="text-xs font-semibold">{t("reviews.yourName")}</Label>
                        <Input
                          id="reviewName"
                          type="text"
                          value={newReview.name}
                          onChange={(e) => setNewReview((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder={t("reviews.yourName")}
                          required
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="reviewRole" className="text-xs font-semibold">您的职位/角色</Label>
                        <Input
                          id="reviewRole"
                          type="text"
                          value={newReview.role}
                          onChange={(e) => setNewReview((prev) => ({ ...prev, role: e.target.value }))}
                          placeholder="例如：高级时装主理人 / 采购采购"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold">{t("reviews.rating")}</Label>
                        <div className="mt-1.5">
                          {renderStars(newReview.rating, true, (rating) =>
                            setNewReview((prev) => ({ ...prev, rating })),
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="reviewComment" className="text-xs font-semibold">{t("reviews.yourReview")}</Label>
                        <Textarea
                          id="reviewComment"
                          value={newReview.comment}
                          onChange={(e) => setNewReview((prev) => ({ ...prev, comment: e.target.value }))}
                          placeholder={t("reviews.placeholder")}
                          rows={4}
                          required
                          className="mt-1"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full font-bold"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? t("reviews.submitting") : t("reviews.submit")}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </section>

      {/* Footer Call to Action */}
      <section className="py-16 bg-muted/40 border-t border-border text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight mb-4">
            {t("cta.title")}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t("cta.description")}
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="px-8 py-6 text-md font-bold" onClick={() => alert("定制版型册与17种数字化面料样卡包裹已收到！我们将在24小时内顺丰发出。")}>
              {t("cta.button")}
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={loginDialogOpen} onOpenChange={handleLoginDialogChange}>
        <DialogContent className="sm:max-w-md border border-border bg-card p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-border bg-muted/20">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                购买前请先登录
              </DialogTitle>
              <DialogDescription className="leading-6">
                定制订单会关联您的小程序用户 ID，登录后可在小程序和管理后台同步查看。
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">请到 FabricMind 小程序确认登录</p>
              <p className="text-xs leading-5 text-muted-foreground">
                打开小程序的“我的”页面，点击“网页扫码登录”，输入下方登录码完成绑定。
              </p>
              {qrStatus === "pending" && qrToken && (
                <>
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt="微信扫码登录二维码"
                      className="mx-auto h-44 w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm"
                    />
                  )}
                  <p className="text-center text-xs leading-5 text-muted-foreground">
                    打开 FabricMind 小程序「我的」里的网页扫码登录，扫一扫二维码即可确认。
                  </p>
                  <div className="rounded-md bg-muted px-3 py-3 text-center font-mono text-xs font-semibold text-foreground break-all select-all">
                    {qrToken}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    等待小程序确认
                  </div>
                </>
              )}
              {qrStatus === "confirmed" && (
                <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  登录成功，正在进入结算页
                </div>
              )}
              {qrStatus === "expired" && (
                <p className="text-center text-xs text-destructive">登录码已过期，请重新生成。</p>
              )}
              {(qrStatus === "idle" || qrStatus === "expired") && (
                <Button
                  onClick={() => startQrLogin(pendingCheckoutUrl || checkoutUrl)}
                  disabled={qrLoading}
                  className="w-full"
                >
                  {qrLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  {qrLoading ? "生成中" : "生成小程序登录码"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              登录完成后将保留当前选择，并继续提交您的定制订单。
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 100% High-Fidelity Size Chart Dialog Modal (Based on User's Screenshot) */}
      <Dialog open={showSizeChart} onOpenChange={setShowSizeChart}>
        <DialogContent className="sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-border shadow-2xl bg-card p-6 rounded-2xl scrollbar-thin">
          <DialogHeader className="relative pb-4 border-b border-border flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Ruler className="w-5 h-5 text-primary" />
              尺码信息
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4 text-sm">
            {/* Fit type selector (版型滑块 UI) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-muted-foreground font-bold">
                <span>版型</span>
              </div>
              <div className="relative flex items-center justify-between py-2 px-1 bg-muted/40 rounded-xl border border-border">
                {/* Horizontal slider line behind items */}
                <div className="absolute left-[10%] right-[10%] h-[2px] bg-border z-0" />
                
                {["超紧", "紧身", "修身", "宽松", "超宽"].map((type) => {
                  const isSelected = fitType === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFitType(type)}
                      className={`relative z-10 px-3 py-1 rounded-md text-xs font-bold transition-all duration-300 focus:outline-none ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm scale-105"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 横向并排 Grid 排版 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 左侧：身高体重对照表 (lg:col-span-7) */}
              <div className="lg:col-span-7 space-y-2.5">
                <h3 className="font-black text-foreground flex items-center gap-1.5">
                  身高体重对照表
                  <span className="text-[10px] font-normal text-muted-foreground">厘米/公斤</span>
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                        <th className="p-2.5 font-bold">身高\体重</th>
                        <th className="p-2.5 font-bold">&lt; 50公斤</th>
                        <th className="p-2.5 font-bold">50-60公斤</th>
                        <th className="p-2.5 font-bold">60-70公斤</th>
                        <th className="p-2.5 font-bold">70-80公斤</th>
                        <th className="p-2.5 font-bold">80-90公斤</th>
                        <th className="p-2.5 font-bold">90-100公斤</th>
                        <th className="p-2.5 font-bold">100-110公斤</th>
                        <th className="p-2.5 font-bold">110-120公斤</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-medium">
                      <tr className="hover:bg-muted/20">
                        <td className="p-2.5 bg-muted/20 font-bold text-foreground">155-160厘米</td>
                        <td className="p-2.5 font-bold text-primary">XS</td>
                        <td className="p-2.5">S</td>
                        <td className="p-2.5">M</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                      </tr>
                      <tr className="hover:bg-muted/20">
                        <td className="p-2.5 bg-muted/20 font-bold text-foreground">160-170厘米</td>
                        <td className="p-2.5">S</td>
                        <td className="p-2.5 font-bold text-primary">M</td>
                        <td className="p-2.5 font-bold text-primary">L</td>
                        <td className="p-2.5">XL</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                      </tr>
                      <tr className="hover:bg-muted/20">
                        <td className="p-2.5 bg-muted/20 font-bold text-foreground">170-180厘米</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5">M</td>
                        <td className="p-2.5 font-bold text-primary">L</td>
                        <td className="p-2.5 font-bold text-primary">XL</td>
                        <td className="p-2.5 font-bold text-primary">XXL</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                      </tr>
                      <tr className="hover:bg-muted/20">
                        <td className="p-2.5 bg-muted/20 font-bold text-foreground">180-185厘米</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5">L</td>
                        <td className="p-2.5 font-bold text-primary">XL</td>
                        <td className="p-2.5 font-bold text-primary">XXL</td>
                        <td className="p-2.5 text-primary">3XL</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                      </tr>
                      <tr className="hover:bg-muted/20">
                        <td className="p-2.5 bg-muted/20 font-bold text-foreground">185-190厘米</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">XXL</td>
                        <td className="p-2.5 font-bold text-primary">3XL</td>
                        <td className="p-2.5 font-bold text-primary">4XL</td>
                        <td className="p-2.5">5XL</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                      </tr>
                      <tr className="hover:bg-muted/20">
                        <td className="p-2.5 bg-muted/20 font-bold text-foreground">190-195厘米</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5 text-muted-foreground">-</td>
                        <td className="p-2.5">3XL</td>
                        <td className="p-2.5 font-bold text-primary">4XL</td>
                        <td className="p-2.5 font-bold text-primary">5XL</td>
                        <td className="p-2.5">5XL</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold pl-1">
                  * 针对选中的 “{fitType}” 版型，建议优先参考高亮加粗推荐尺码。
                </p>
              </div>

              {/* 右侧：成衣尺寸表 (lg:col-span-5) */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 mb-1">
                  <h3 className="font-black text-foreground flex items-center gap-1.5">
                    成衣尺寸表
                    <span className="text-[10px] font-normal text-muted-foreground">厘米/公斤</span>
                  </h3>
                  <span className="text-[11px] text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 transition-all duration-300">
                    当前已选【{fitType}】版型，胸围松量自动微调：
                    <span className="font-mono text-xs ml-1 font-black">
                      {getBustModifier(fitType) >= 0 ? "+" : ""}{getBustModifier(fitType)}cm
                    </span>
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                        <th className="p-2.5 font-bold">尺码</th>
                        <th className="p-2.5 font-bold">建议身高</th>
                        <th className="p-2.5 font-bold">建议体重</th>
                        <th className="p-2.5 font-bold">肩宽</th>
                        <th className="p-2.5 font-bold">胸围</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-semibold font-mono">
                      {sizesSpecification.map((row) => {
                        const isUserSelected = selectedSize === row.size
                        const baseBust = parseInt(row.bust)
                        const modifier = getBustModifier(fitType)
                        const finalBust = baseBust + modifier
                        return (
                          <tr
                            key={row.size}
                            className={`hover:bg-muted/20 transition-colors ${
                              isUserSelected ? "bg-primary/5 text-primary font-bold" : "text-foreground"
                            }`}
                          >
                            <td className="p-2.5 font-sans font-bold">{row.size}</td>
                            <td className="p-2.5">{row.height}厘米</td>
                            <td className="p-2.5">{row.weight}公斤</td>
                            <td className="p-2.5">{row.shoulder}厘米</td>
                            <td className="p-2.5">
                              <span className="font-extrabold text-foreground dark:text-zinc-50">{finalBust}厘米</span>
                              {modifier !== 0 && (
                                <span className={`text-[10px] ml-1.5 font-bold ${modifier > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                  ({modifier > 0 ? `+${modifier}` : modifier}cm)
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 买家尺码及身型参考反馈 */}
            <div className="space-y-2 pt-4 border-t border-border/60">
              <h3 className="font-black text-foreground">买家尺码及身型参考反馈</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/20 border border-border p-3.5 rounded-xl text-xs leading-relaxed text-muted-foreground">
                  <p>• <strong>张设计师 (165cm/58kg)</strong>: 选择 M 码，试穿效果“宽松舒适”，面料悬垂感完美落地。</p>
                </div>
                <div className="bg-muted/20 border border-border p-3.5 rounded-xl text-xs leading-relaxed text-muted-foreground">
                  <p>• <strong>Marcus (178cm/82kg)</strong>: 定制 XL 码，肩宽非常饱满合适，胸部有适度活动空间。</p>
                </div>
                <div className="bg-muted/20 border border-border p-3.5 rounded-xl text-xs leading-relaxed text-muted-foreground">
                  <p>• <strong>小薇 (156cm/44kg)</strong>: 定制 XS 码，成衣非常贴合精致，极力推荐给骨架偏小的女生。</p>
                </div>
              </div>
            </div>

            {/* Bottom error disclaimer notice */}
            <div className="border-t border-border pt-4 flex gap-2 items-start text-[10px] text-muted-foreground leading-relaxed font-semibold">
              <MessageSquareWarning className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                说明：由于不同面料（真丝、呢绒、弹性莫代尔）的物理缩水率和车缝测量方式不同，可能允许存在 2-4 厘米的合理误差。以上表格及买家参考反馈仅供量体参考，请根据您偏好的穿着版型（当前已选：{fitType}）结合个人身型喜好进行最终选择。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
