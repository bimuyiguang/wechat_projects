const { request } = require("../../../utils/api");
const app = getApp();

Page({
  data: {
    qrToken: "",
    status: "idle",      // idle | loading | success | error
    message: "",
    userInfo: null,
    manualToken: "",
    showManual: false
  },

  onLoad(options) {
    // 从扫码 scene 参数获取 qrToken
    // 小程序码 scene 值会被 URL encode，格式: qrToken=xxx
    let qrToken = "";
    if (options.scene) {
      try {
        const decoded = decodeURIComponent(options.scene);
        const params = Object.fromEntries(decoded.split("&").map(p => p.split("=")));
        qrToken = params.qrToken || params.token || "";
      } catch (e) {
        qrToken = options.scene || "";
      }
    }
    if (options.qrToken) qrToken = options.qrToken;
    if (options.token) qrToken = options.token;

    if (qrToken) {
      this.setData({ qrToken });
      this.confirmLogin(qrToken);
    } else {
      this.setData({ showManual: true });
    }
  },

  onManualInput(e) {
    this.setData({ manualToken: e.detail.value });
  },

  onManualConfirm() {
    const token = (this.data.manualToken || "").trim();
    if (!token) {
      wx.showToast({ title: "请输入登录码", icon: "none" });
      return;
    }
    this.setData({ qrToken: token, showManual: false });
    this.confirmLogin(token);
  },

  async confirmLogin(qrToken) {
    this.setData({ status: "loading", message: "正在登录...", userInfo: null });

    try {
      // 获取用户昵称和头像（可选）
      const userInfo = wx.getStorageSync("userInfo") || {};
      const nickName = userInfo.nickName || "微信用户";
      const avatarUrl = userInfo.avatarUrl || "";

      const payload = { qrToken, nickName, avatarUrl };

      // 优先使用已有 Bearer token（后端通过 Authorization header 识别当前用户）
      // 只有在没有 token 时才调 wx.login 获取新 code
      if (!app.globalData.token) {
        try {
          const loginResult = await new Promise((resolve, reject) => {
            wx.login({ success: resolve, fail: reject });
          });
          payload.code = loginResult.code;
        } catch (e) {
          console.warn("wx.login failed, proceeding without code", e);
        }
      }

      // 调用确认 API（request 会自动带上 Authorization header）
      const result = await request("/api/auth/qr/confirm", "POST", payload);

      if (result.success) {
        // 同步保存小程序端登录态
        if (result.user) {
          const newUserInfo = {
            nickName: result.user.name || result.user.nickName || nickName,
            avatarUrl: result.user.fullAvatarUrl || result.user.avatarUrl || avatarUrl
          };
          wx.setStorageSync("userInfo", newUserInfo);
        }

        this.setData({
          status: "success",
          message: "登录成功！网页端将自动刷新。",
          userInfo: result.user || null
        });

        // 3 秒后返回
        setTimeout(() => {
          this.goBack();
        }, 2500);
      } else {
        this.setData({
          status: "error",
          message: result.message || "确认失败，请重试"
        });
      }
    } catch (err) {
      console.error("QR confirm error:", err);
      this.setData({
        status: "error",
        message: err?.message || "网络错误，请重试"
      });
    }
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: "/pages/generate/index" });
    }
  },

  retry() {
    const qrToken = this.data.qrToken;
    if (qrToken) {
      this.confirmLogin(qrToken);
    } else {
      this.setData({ showManual: true, status: "idle", message: "" });
    }
  }
});
