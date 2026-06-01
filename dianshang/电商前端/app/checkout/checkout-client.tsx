"use client"

import type React from "react"
import { useState, useEffect, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Minus, Plus, CheckCircle, Palette, QrCode, CreditCard, ShieldCheck, ShoppingBag, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { API_BASE, fetchFromApi } from "@/lib/api"
import QRCode from "qrcode"

interface GarmentStyle {
  id: string
  nameKey: string
  image: string
  basePrice: number
  previewUrls?: Record<string, string>
}

interface FabricSpec {
  id: string
  nameKey: string
  composition: string
  weight: string
  width: string
  pantone: string
  hex: string
  rgb: string
  priceMarkup: number
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
  { id: "fabric1", nameKey: "fabric.fabric1.name", composition: "100% 桑蚕丝", weight: "19姆米", width: "140厘米", pantone: "18-1662 TCX", hex: "#D62229", rgb: "214, 34, 41", priceMarkup: 150 },
  { id: "fabric2", nameKey: "fabric.fabric2.name", composition: "100% 精梳埃及长绒棉", weight: "220克/平方米", width: "150厘米", pantone: "19-4052 TCX", hex: "#0F4C81", rgb: "15, 76, 129", priceMarkup: 0 },
  { id: "fabric3", nameKey: "fabric.fabric3.name", composition: "100% 生态经纬交织雨露亚麻", weight: "180克/平方米", width: "145厘米", pantone: "14-1116 TCX", hex: "#D2C29D", rgb: "210, 194, 157", priceMarkup: 50 },
  { id: "fabric4", nameKey: "fabric.fabric4.name", composition: "75% 羊毛, 25% 天丝", weight: "380克/平方米", width: "148厘米", pantone: "17-1501 TCX", hex: "#A2A2A0", rgb: "162, 162, 160", priceMarkup: 100 },
  { id: "fabric5", nameKey: "fabric.fabric5.name", composition: "80% 精梳棉, 20% 高弹天丝", weight: "200克/平方米", width: "150厘米", pantone: "19-0303 TCX", hex: "#4B5320", rgb: "75, 83, 32", priceMarkup: 20 },
  { id: "fabric6", nameKey: "fabric.fabric6.name", composition: "92% 莫代尔, 8% 氨纶", weight: "180克/平方米", width: "152厘米", pantone: "16-1546 TCX", hex: "#F88379", rgb: "248, 131, 121", priceMarkup: 15 },
  { id: "fabric7", nameKey: "fabric.fabric7.name", composition: "100% 强捻水洗斜纹帆布", weight: "300克/平方米", width: "145厘米", pantone: "14-1050 TCX", hex: "#E1AD01", rgb: "225, 173, 1", priceMarkup: 30 },
  { id: "fabric8", nameKey: "fabric.fabric8.name", composition: "95% 真丝天鹅绒, 5% 氨纶", weight: "240克/平方米", width: "140厘米", pantone: "19-3520 TCX", hex: "#4F2F4F", rgb: "79, 47, 79", priceMarkup: 120 },
  { id: "fabric9", nameKey: "fabric.fabric9.name", composition: "100% 双烧丝光防皱泡泡纱", weight: "130克/平方米", width: "148厘米", pantone: "11-0103 TCX", hex: "#FDFBF7", rgb: "253, 251, 247", priceMarkup: 40 },
  { id: "fabric10", nameKey: "fabric.fabric10.name", composition: "65% 纯羊毛, 35% 聚酯纤维", weight: "320克/平方米", width: "150厘米", pantone: "19-0915 TCX", hex: "#4A3B32", rgb: "74, 59, 50", priceMarkup: 80 },
  { id: "fabric11", nameKey: "fabric.fabric11.name", composition: "88% 冰丝锦纶, 12% 弹力氨纶", weight: "160克/平方米", width: "150厘米", pantone: "13-5412 TCX", hex: "#98FF98", rgb: "152, 255, 152", priceMarkup: 25 },
  { id: "fabric12", nameKey: "fabric.fabric12.name", composition: "100% 科技复合纳米防泼水聚酯", weight: "140克/平方米", width: "145厘米", pantone: "14-4102 TCX", hex: "#C0C0C0", rgb: "192, 192, 192", priceMarkup: 60 },
  { id: "fabric13", nameKey: "fabric.fabric13.name", composition: "90% 吸湿速干超细纤维, 10% 氨纶", weight: "150克/平方米", width: "150厘米", pantone: "15-4020 TCX", hex: "#73C2FB", rgb: "115, 194, 251", priceMarkup: 15 },
  { id: "fabric14", nameKey: "fabric.fabric14.name", composition: "85% 澳大利亚粗纺毛呢", weight: "420克/平方米", width: "148厘米", pantone: "19-3908 TCX", hex: "#4A4A4A", rgb: "74, 74, 74", priceMarkup: 110 },
  { id: "fabric15", nameKey: "fabric.fabric15.name", composition: "95% 天丝莫代尔, 5% 莱卡", weight: "190克/平方米", width: "152厘米", pantone: "13-0630 TCX", hex: "#FFF700", rgb: "255, 247, 0", priceMarkup: 20 },
  { id: "fabric16", nameKey: "fabric.fabric16.name", composition: "100% 竹纤维低碳环保丝", weight: "170克/平方米", width: "148厘米", pantone: "16-5127 TCX", hex: "#30D5C8", rgb: "48, 213, 200", priceMarkup: 30 },
  { id: "fabric17", nameKey: "fabric.fabric17.name", composition: "100% 澳大利亚美利奴精纺羊毛", weight: "280克/平方米", width: "148厘米", pantone: "18-1440 TCX", hex: "#C68E17", rgb: "198, 142, 23", priceMarkup: 140 },
].map((fabric) => ({
  ...fabric,
  image: fabric.image || fabricImage(fabric.id),
  previewUrls: fabric.previewUrls || previewUrlsFor(fabric.id),
}))

interface FormData {
  fullName: string
  email: string
  phone: string
  address: string
  quantity: number
  paymentMethod: string
}

interface FormErrors {
  fullName?: string
  email?: string
  phone?: string
  address?: string
  paymentMethod?: string
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  // WeChat auth states
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // QR scan login states
  const [qrToken, setQrToken] = useState<string>("")
  const [qrStatus, setQrStatus] = useState<"idle" | "pending" | "confirmed" | "expired">("idle")
  const [qrLoading, setQrLoading] = useState(false)
  const [loginNotice, setLoginNotice] = useState("")
  const [qrImageUrl, setQrImageUrl] = useState("")
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qrAutoStartedRef = useRef(false)

  // Dynamic data states loaded from API
  const [styles, setStyles] = useState<GarmentStyle[]>(stylesList)
  const [fabrics, setFabrics] = useState<FabricSpec[]>(fabricsList)
  const [currentOrderId, setCurrentOrderId] = useState<string>("")

  // Custom configuration states
  const [selectedStyle, setSelectedStyle] = useState<GarmentStyle>(stylesList[0])
  const [selectedFabric, setSelectedFabric] = useState<FabricSpec>(fabricsList[0])
  const [selectedSize, setSelectedSize] = useState("M")

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    quantity: 1, // Default 1 piece
    paymentMethod: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentSimulatingState, setPaymentSimulatingState] = useState<"pending" | "processing" | "success">("pending")
  const [orderComplete, setOrderComplete] = useState(false)

  // Load user session and shop configurations
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await fetchFromApi("/api/me");
        if (data && data.user) {
          setCurrentUser(data.user);
        }
      } catch (e) {
        if (searchParams.get("login") === "1") {
          setLoginNotice("请用小程序扫码确认登录，登录成功后继续下单。")
        }
        console.warn("User session checking failed", e);
      } finally {
        setAuthLoading(false);
      }
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
    }
    
    checkAuth();
    loadShopData();
  }, [searchParams])

  useEffect(() => {
    let cancelled = false;
    if (!qrToken) {
      setQrImageUrl("");
      return;
    }
    QRCode.toDataURL(qrToken, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrImageUrl(url);
    }).catch(() => {
      if (!cancelled) setQrImageUrl("");
    });
    return () => { cancelled = true; };
  }, [qrToken]);

  const handleWechatLogin = async () => {
    try {
      const currentRedirect = encodeURIComponent(window.location.pathname + window.location.search);
      const data = await fetchFromApi(`/api/auth/wechat/web-login-url?redirect=${currentRedirect}`);
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        alert("获取登录授权链接失败，请稍后重试");
      }
    } catch (err: any) {
      alert("微信登录初始化失败: " + err.message);
    }
  };

  const stopQrPolling = () => {
    if (qrPollingRef.current) {
      clearInterval(qrPollingRef.current);
      qrPollingRef.current = null;
    }
  };

  const startQrLogin = async () => {
    setQrLoading(true);
    stopQrPolling();
    try {
      const data = await fetchFromApi("/api/auth/qr/create", { method: "POST" });
      const token = data?.qrToken || "";
      if (!token) throw new Error("服务器未返回 qrToken");
      setQrToken(token);
      setQrImageUrl("");
      setQrStatus("pending");

      // 轮询状态（每 2.5 秒）
      qrPollingRef.current = setInterval(async () => {
        try {
          const statusData = await fetchFromApi(`/api/auth/qr/status?qrToken=${encodeURIComponent(token)}`);
          if (statusData.status === "confirmed") {
            stopQrPolling();
            setQrStatus("confirmed");
            setLoginNotice("");
            // 重新获取当前用户信息
            const meData = await fetchFromApi("/api/me");
            if (meData?.user) setCurrentUser(meData.user);
          } else if (statusData.status === "expired") {
            stopQrPolling();
            setQrStatus("expired");
          }
        } catch {
          // 网络错误，继续轮询
        }
      }, 2500);
    } catch (err: any) {
      alert("生成登录码失败: " + err.message);
      setQrStatus("idle");
    } finally {
      setQrLoading(false);
    }
  };

  // 离开页面时清理轮询
  useEffect(() => { return () => stopQrPolling(); }, []);

  useEffect(() => {
    if (!authLoading && !currentUser && !qrAutoStartedRef.current) {
      qrAutoStartedRef.current = true;
      startQrLogin();
    }
  }, [authLoading, currentUser]);

  const handleLogout = async () => {
    try {
      await fetchFromApi("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      alert("已安全退出登录");
    } catch (err: any) {
      console.error("Logout failed", err);
    }
  };

  useEffect(() => {
    const styleId = searchParams.get("style") || "tx"
    const fabricId = searchParams.get("fabric") || "fabric1"
    const size = searchParams.get("size") || "M"

    const style = styles.find((s) => s.id === styleId) || styles[0] || stylesList[0]
    const fabric = fabrics.find((f) => f.id === fabricId) || fabrics[0] || fabricsList[0]

    setSelectedStyle(style)
    setSelectedFabric(fabric)
    setSelectedSize(size)
  }, [searchParams, styles, fabrics])

  const singlePrice = selectedStyle.basePrice + selectedFabric.priceMarkup
  const subtotal = singlePrice * formData.quantity
  const discount = Math.round(singlePrice * 0.25) * formData.quantity
  const totalPrice = subtotal

  const renderingImagePath = selectedFabric.previewUrls?.[selectedStyle.id] || ""

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = "收货人姓名不能为空 / 收件人姓名必填"
    }

    if (!formData.email.trim()) {
      newErrors.email = "电子邮箱不能为空 / 邮箱必填"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "请输入有效的邮箱地址"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "联系电话不能为空 / 电话必填"
    } else if (!/^\+?[\d\s\-()]+$/.test(formData.phone)) {
      newErrors.phone = "请输入有效的电话号码"
    }

    if (!formData.address.trim()) {
      newErrors.address = "送货地址不能为空 / 地址必填"
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = "请选择支付方式"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      const data = await fetchFromApi("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: selectedStyle.id,
          fabricId: selectedFabric.id,
          size: selectedSize,
          quantity: formData.quantity,
          paymentMethod: formData.paymentMethod,
          receiver: {
            fullName: formData.fullName,
            phone: formData.phone,
            email: formData.email,
            address: formData.address
          }
        })
      });
      setCurrentOrderId(data.order.id)
      
      // Trigger Payment Modal
      setPaymentSimulatingState("pending")
      setShowPaymentModal(true)
    } catch (err: any) {
      const message = err?.message || "";
      if (message.includes("请先微信登录") || message.includes("401")) {
        setLoginNotice("当前网页还没有微信会话，请先用小程序确认登录后再提交订单。");
        setCurrentUser(null);
        qrAutoStartedRef.current = false;
        stopQrPolling();
        setQrStatus("idle");
        setQrToken("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        alert("创建订单失败: " + message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSimulatePaymentConfirm = async () => {
    setPaymentSimulatingState("processing")
    
    try {
      await fetchFromApi(`/api/shop/orders/${currentOrderId}/pay/mock`, {
        method: "POST"
      })
      
      setPaymentSimulatingState("success")
      
      // Hold success state momentarily for user feedback
      await new Promise((resolve) => setTimeout(resolve, 1000))
      
      if (typeof window !== "undefined") {
        localStorage.setItem("verifiedBuyer", "true")
      }
      
      setShowPaymentModal(false)
      setOrderComplete(true)
    } catch (err: any) {
      alert("支付确认失败: " + err.message)
      setPaymentSimulatingState("pending")
    }
  }

  const updateQuantity = (change: number) => {
    setFormData((prev) => ({
      ...prev,
      quantity: Math.max(1, prev.quantity + change),
    }))
  }

  const forceWechatRelogin = async () => {
    setLoginNotice("请用小程序确认登录，登录成功后会回到当前订单。");
    await fetchFromApi("/api/auth/logout", { method: "POST" }).catch(() => {});
    setCurrentUser(null);
    qrAutoStartedRef.current = false;
    stopQrPolling();
    setQrToken("");
    setQrStatus("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground font-semibold text-sm">正在验证微信安全会话...</p>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background py-16 flex items-center justify-center px-4 sm:px-6">
        <div className="max-w-md w-full space-y-6">
          <Card className="border border-border shadow-2xl relative overflow-hidden backdrop-blur-md bg-card/60">
            {/* Ambient background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />

            <CardHeader className="text-center pt-8">
              <div className="w-16 h-16 bg-[#07C160]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#07C160]/20 shadow-inner">
                <svg className="w-10 h-10 text-[#07C160]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.3 12.1c.4 0 .7-.3.7-.7s-.3-.7-.7-.7c-.4 0-.7.3-.7.7s.3.7.7.7zm2.9 0c.4 0 .7-.3.7-.7s-.3-.7-.7-.7c-.4 0-.7.3-.7.7s.3.7.7.7zm4.2-3c.4 0 .8-.4.8-.8s-.4-.8-.8-.8c-.4 0-.8.4-.8.8s.4.8.8.8zm2.6 0c.4 0 .8-.4.8-.8s-.4-.8-.8-.8c-.4 0-.8.4-.8.8s.4.8.8.8zM24 13.9c0-3.6-3.8-6.5-8.5-6.5-4.7 0-8.5 2.9-8.5 6.5 0 3.6 3.8 6.5 8.5 6.5 1 0 2-.1 3-.4l2.8 1.5-.7-2.6c2-1.3 3.9-3.2 3.9-5zm-14.8-4c0-4.6 4.8-8.3 10.7-8.3 1.3 0 2.5.2 3.7.6C21.7.9 19.3 0 16.7 0 10.2 0 5 4.3 5 9.6c0 2.9 1.5 5.5 3.9 7.2l-.7 2.6 3-1.6c.9.2 1.8.3 2.7.3.3 0 .7 0 1-.1-2.9-1.2-5.1-3.4-5.1-4.1z"/>
                </svg>
              </div>
              <CardTitle className="text-2xl font-extrabold tracking-tight text-foreground">
                微信登录
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-2">
                需微信身份确认才能提交数字化定制订单
              </p>
              {loginNotice && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {loginNotice}
                </p>
              )}
            </CardHeader>

            <CardContent className="px-6 pb-8 space-y-5">
              {/* 方式一：小程序扫码登录 */}
              <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>📱</span> 方式一：小程序扫码登录（推荐）
                </p>

                {qrStatus === "idle" && (
                  <Button
                    onClick={startQrLogin}
                    disabled={qrLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-sm py-5 rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    {qrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    {qrLoading ? "生成登录码中..." : "生成小程序登录码"}
                  </Button>
                )}

                {qrStatus === "pending" && qrToken && (
                  <div className="space-y-3">
                    <div className="bg-white border border-border rounded-xl p-4 flex flex-col items-center gap-3">
                      {qrImageUrl && (
                        <img
                          src={qrImageUrl}
                          alt="微信扫码登录二维码"
                          className="h-44 w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm"
                        />
                      )}
                      <p className="text-[11px] text-muted-foreground text-center">
                        打开 FabricMind 小程序「我的」里的网页扫码登录，扫一扫上方二维码即可确认。
                      </p>
                      <p className="text-[11px] text-muted-foreground text-center">在 FabricMind 小程序 → 「我的」→ 右上角「扫码登录」中输入以下 token：</p>
                      <div className="font-mono text-xs font-bold bg-muted px-3 py-2 rounded-lg break-all text-center select-all border border-dashed border-primary/40 text-primary">
                        {qrToken}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        等待小程序端确认...
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={startQrLogin}
                      className="w-full text-xs text-muted-foreground"
                    >
                      刷新登录码
                    </Button>
                  </div>
                )}

                {qrStatus === "expired" && (
                  <div className="text-center space-y-2">
                    <p className="text-xs text-destructive font-medium">登录码已过期</p>
                    <Button onClick={startQrLogin} size="sm" className="text-xs">
                      重新生成
                    </Button>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">或</span></div>
              </div>

              {/* 方式二：原有微信授权（需 web appid，个人号无此能力） */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>💻</span> 方式二：微信网页授权登录
                </p>
                <Button
                  onClick={handleWechatLogin}
                  className="w-full bg-[#07C160] hover:bg-[#06ad56] text-white font-bold text-sm py-5 rounded-xl shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M8.3 12.1c.4 0 .7-.3.7-.7s-.3-.7-.7-.7c-.4 0-.7.3-.7.7s.3.7.7.7zm2.9 0c.4 0 .7-.3.7-.7s-.3-.7-.7-.7c-.4 0-.7.3-.7.7s.3.7.7.7zm4.2-3c.4 0 .8-.4.8-.8s-.4-.8-.8-.8c-.4 0-.8.4-.8.8s.4.8.8.8zm2.6 0c.4 0 .8-.4.8-.8s-.4-.8-.8-.8c-.4 0-.8.4-.8.8s.4.8.8.8zM24 13.9c0-3.6-3.8-6.5-8.5-6.5-4.7 0-8.5 2.9-8.5 6.5 0 3.6 3.8 6.5 8.5 6.5 1 0 2-.1 3-.4l2.8 1.5-.7-2.6c2-1.3 3.9-3.2 3.9-5zm-14.8-4c0-4.6 4.8-8.3 10.7-8.3 1.3 0 2.5.2 3.7.6C21.7.9 19.3 0 16.7 0 10.2 0 5 4.3 5 9.6c0 2.9 1.5 5.5 3.9 7.2l-.7 2.6 3-1.6c.9.2 1.8.3 2.7.3.3 0 .7 0 1-.1-2.9-1.2-5.1-3.4-5.1-4.1z"/>
                  </svg>
                  微信网页授权登录
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => router.push("/")}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                返回试衣间首页
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="text-center border border-border shadow-xl">
            <CardContent className="p-8">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-3xl font-extrabold text-foreground mb-4">定制订单提交成功！</h1>
              <p className="text-md text-muted-foreground mb-6 leading-relaxed">
                感谢您的定制！我们已成功收到您的专属成衣定制方案。我们的智能柔性车间已完成数字化排产，将于 48 小时内为您完成精细裁剪与打样缝制，并通过顺丰特快寄送。
              </p>

              <div className="bg-muted/50 border border-border p-5 rounded-xl mb-6 text-left space-y-3">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-1">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  您的定制方案及明细
                </h3>
                <div className="flex gap-4 items-center">
                  <div className="w-16 h-20 bg-muted border border-border rounded-lg overflow-hidden shrink-0">
                    {renderingImagePath ? (
                      <img src={renderingImagePath} alt="定制成衣" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-[10px] font-semibold text-muted-foreground">缺少 OSS 预览图</div>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-sm text-foreground font-bold">{t(selectedStyle.nameKey)}</p>
                    <p className="text-muted-foreground">定制尺码: <span className="font-bold text-foreground">{selectedSize} 码</span></p>
                    <p className="text-muted-foreground">数字化面料: <span className="text-foreground">{t(selectedFabric.nameKey)}</span></p>
                    <p className="text-muted-foreground">面料主要成分: <span className="text-foreground">{selectedFabric.composition}</span></p>
                  </div>
                </div>
                <div className="border-t border-border/80 my-2 pt-2 flex justify-between text-sm font-semibold">
                  <span>订购数量: {formData.quantity} 件</span>
                  <span className="text-primary">实付总额: ¥{totalPrice}</span>
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/30 p-4 rounded-lg mb-6">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  🎉 恭喜！您现在已解锁“已购定制成衣真实买家”身份。您可以回到试衣间首页发表您的穿着感受、尺码推荐及面料质感评语！
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/#reviews")}
                  className="w-full font-bold shadow-lg"
                >
                  去发表定制评语
                </Button>
                <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                  回到定制试衣间首页
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("checkout.title")}</h1>
              <p className="text-muted-foreground mt-2">请填写您的成衣收货信息与量体支付明细，确认您的智能定制订单</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Shipping and Delivery Form */}
          <div className="lg:col-span-8">
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-lg font-bold">量体定制收货人信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3 shadow-sm">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border border-emerald-500/30 shrink-0">
                    {currentUser.avatarUrl || currentUser.avatar ? (
                      <img
                        src={currentUser.avatarUrl || currentUser.avatar}
                        alt={currentUser.nickName || "微信用户"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-[9px] text-muted-foreground">缺图</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                      已微信关联：{currentUser.nickName || currentUser.name || "微信用户"}
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5 font-bold">
                        WeChat OK
                      </Badge>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      登录状态已保存，订单会自动归档到当前微信用户。
                    </p>
                  </div>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-6">
                  
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold">{t("checkout.fullName")} *</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                      className={errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}
                      placeholder="请填写定制成衣收件人姓名"
                    />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold">{t("checkout.email")} *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                        placeholder="请输入电子邮箱"
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-semibold">{t("checkout.phone")} *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                        className={errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
                        placeholder="联系电话或手机号码"
                      />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-xs font-semibold">{t("checkout.address")} *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      className={errors.address ? "border-destructive focus-visible:ring-destructive" : ""}
                      placeholder="请填写详细的定制成衣送货地址 (我们将使用顺丰特快发出)"
                      rows={3}
                    />
                    {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{t("checkout.quantity")} (起订1件) *</Label>
                      <div className="flex items-center space-x-3 mt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(-1)}
                          disabled={formData.quantity <= 1}
                          className="h-9 w-9"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-lg font-bold w-10 text-center font-mono">{formData.quantity}</span>
                        <Button type="button" variant="outline" size="icon" onClick={() => updateQuantity(1)} className="h-9 w-9">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Display size selected */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">定制版型及尺码确认</Label>
                      <div className="text-sm font-bold text-foreground bg-muted p-2 rounded-lg mt-1 inline-block">
                        {t(selectedStyle.nameKey)} ——— <Badge className="text-xs font-bold ml-1">{selectedSize} 码</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentMethod" className="text-xs font-semibold">{t("checkout.paymentMethod")} *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value }))}
                    >
                      <SelectTrigger className={errors.paymentMethod ? "border-destructive focus:ring-destructive" : ""}>
                        <SelectValue placeholder="选择您的定制支付方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wechat-alipay">{t("checkout.creditCard")}</SelectItem>
                        <SelectItem value="wire-transfer">{t("checkout.paypal")}</SelectItem>
                        <SelectItem value="cash-on-delivery">{t("checkout.cashOnDelivery")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.paymentMethod && <p className="text-xs text-destructive">{errors.paymentMethod}</p>}
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-6 text-md font-bold shadow-lg"
                  >
                    {t("checkout.placeOrder")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Custom Order Summary Receiver */}
          <div className="lg:col-span-4">
            <Card className="sticky top-8 border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">{t("checkout.orderSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Visual item configuration overlay */}
                <div className="flex gap-4 items-center pb-4 border-b border-border">
                  <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                    {renderingImagePath ? (
                      <img
                        src={renderingImagePath}
                        alt={t(selectedStyle.nameKey)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-[10px] font-semibold text-muted-foreground">缺图</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate">
                      {t(selectedStyle.nameKey)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      面料: {t(selectedFabric.nameKey)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 font-bold">
                        尺码: {selectedSize}
                      </Badge>
                      <Badge className="text-[9px] font-mono" style={{ backgroundColor: selectedFabric.hex }}>
                        <span className="text-white drop-shadow-sm font-bold">{selectedFabric.hex}</span>
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("checkout.subtotal")}:</span>
                    <span className="font-semibold font-mono">¥{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>{t("checkout.discount")}:</span>
                    <span className="font-mono">-¥{discount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">订购数量:</span>
                    <span className="font-semibold font-mono">{formData.quantity} 件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">顺丰特快空运:</span>
                    <span className="text-emerald-600 font-bold">免邮费 (包邮)</span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between font-extrabold text-lg">
                      <span>{t("checkout.total")}:</span>
                      <span className="text-primary font-mono">¥{totalPrice}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1.5 pt-2 border-t border-border leading-relaxed">
                  <p>• 智能工厂 48 小时极速打样裁剪与车缝</p>
                  <p>• 顺丰特快全国空运免邮发货</p>
                  <p>• 柔性量体定制除质量缺陷外不支持无理由退换</p>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Interactive Mock Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md border border-border shadow-2xl bg-card">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-extrabold text-foreground flex items-center justify-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              织彩数字云收银台
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              请选择或扫码以下模拟支付通道，完成定制方案结算
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-muted/30 rounded-xl border border-border/80">
            {paymentSimulatingState === "pending" && (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="bg-white p-3 rounded-xl shadow-md border border-border shrink-0 flex items-center justify-center">
                  <QrCode className="w-40 h-40 text-zinc-900" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-foreground">微信 / 支付宝 扫码快捷支付</p>
                  <p className="text-lg font-black text-primary font-mono mt-1">¥{totalPrice}</p>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  已通过 256 位安全加密沙箱保护
                </div>
              </div>
            )}

            {paymentSimulatingState === "processing" && (
              <div className="flex flex-col items-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-foreground">{t("checkout.processing")}</p>
                  <p className="text-xs text-muted-foreground">正在同步发卡行与数字化工厂数据库...</p>
                </div>
              </div>
            )}

            {paymentSimulatingState === "success" && (
              <div className="flex flex-col items-center py-8 space-y-3">
                <CheckCircle className="w-16 h-16 text-emerald-500 animate-bounce" />
                <div className="text-center space-y-1">
                  <p className="text-md font-bold text-foreground">模拟支付成功！</p>
                  <p className="text-xs text-muted-foreground">正在为您跳转订单确认收据...</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between gap-2 flex-row justify-between w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPaymentModal(false)}
              disabled={paymentSimulatingState === "processing"}
              className="text-xs"
            >
              取消定制
            </Button>
            {paymentSimulatingState === "pending" && (
              <Button
                type="button"
                onClick={handleSimulatePaymentConfirm}
                className="font-bold shadow-md text-xs px-6"
              >
                确认模拟完成支付
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-semibold">正在载入量体结算中心 / Loading...</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
