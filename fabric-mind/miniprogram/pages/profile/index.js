const { request } = require("../../utils/api");
const app = getApp();

const POINTS_KEY = "fabricMindPoints";
const CHECKIN_KEY = "fabricMindLastCheckInDate";

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

Page({
  data: {
    userInfo: null,
    avatarText: "微",
    points: 128,
    checkedIn: false,
    editingName: false,
    draftNickName: "",
    nicknameFocus: false,
    nicknameEditTitle: "修改昵称",
    nicknameEditTip: "可以选择微信昵称，也可以自己输入。",
    nicknamePlaceholder: "请输入昵称",
    totalTasks: 24,
    successTasks: 21
  },
  onLoad() {
    this.restoreProfile();
  },
  onShow() {
    this.restoreProfile();
    if (wx.getStorageSync("userInfo")) this.syncProfileFromServer();
  },
  restoreProfile() {
    const userInfo = wx.getStorageSync("userInfo");
    const points = Number(wx.getStorageSync(POINTS_KEY) || 128);
    const checkedIn = wx.getStorageSync(CHECKIN_KEY) === todayKey();
    this.setData({
      userInfo: userInfo || null,
      points,
      checkedIn,
      avatarText: userInfo?.nickName ? userInfo.nickName.slice(0, 1) : "微"
    });
  },
  async syncProfileFromServer() {
    try {
      const resp = await request("/api/me/profile");
      if (!resp.user) return;
      const userInfo = {
        nickName: resp.user.name || resp.user.nickName || "微信用户",
        avatarUrl: resp.user.fullAvatarUrl || resp.user.avatarUrl || ""
      };
      wx.setStorageSync("userInfo", userInfo);
      if (Number.isFinite(Number(resp.user.points))) wx.setStorageSync(POINTS_KEY, Number(resp.user.points));
      this.setData({
        userInfo,
        points: Number(resp.user.points || this.data.points),
        avatarText: userInfo.nickName ? userInfo.nickName.slice(0, 1) : "微"
      });
    } catch (error) {
      console.warn("profile sync failed", error);
    }
  },
  login() {
    const fallback = () => this.saveUser({ nickName: "微信用户", avatarUrl: "" });
    if (!wx.getUserProfile) {
      fallback();
      return;
    }
    wx.getUserProfile({
      desc: "用于展示微信昵称和头像",
      success: (res) => {
        this.saveUser({
          nickName: res.userInfo.nickName || "微信用户",
          avatarUrl: res.userInfo.avatarUrl || ""
        });
      },
      fail: fallback
    });
  },
  async saveUser(userInfo) {
    wx.setStorageSync("userInfo", userInfo);
    this.setData({
      userInfo,
      editingName: false,
      draftNickName: "",
      nicknameFocus: false,
      avatarText: userInfo.nickName ? userInfo.nickName.slice(0, 1) : "微"
    });
    try {
      const resp = await request("/api/me/profile", "POST", {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        points: this.data.points,
        lastCheckInDate: wx.getStorageSync(CHECKIN_KEY) || ""
      });
      if (resp.user) {
        const remoteUser = {
          nickName: resp.user.name || resp.user.nickName || userInfo.nickName,
          avatarUrl: resp.user.fullAvatarUrl || resp.user.avatarUrl || userInfo.avatarUrl
        };
        wx.setStorageSync("userInfo", remoteUser);
        this.setData({ userInfo: remoteUser });
      }
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: "本地已保存，云端同步失败", icon: "none" });
    }
  },
  editName() {
    wx.showActionSheet({
      itemList: ["使用微信昵称", "自定义昵称"],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.openNicknameEditor({
            title: "使用微信昵称",
            tip: "点输入框后，微信会在键盘上方给出你的微信昵称，选择后保存即可。",
            placeholder: "点击选择微信昵称",
            initialValue: ""
          });
        } else {
          this.openNicknameEditor({
            title: "自定义昵称",
            tip: "输入你想在小程序和管理端展示的昵称。",
            placeholder: "请输入自定义昵称",
            initialValue: this.data.userInfo?.nickName || ""
          });
        }
      }
    });
  },
  openNicknameEditor({ title, tip, placeholder, initialValue }) {
    this.setData({
      editingName: true,
      draftNickName: initialValue || "",
      nicknameFocus: true,
      nicknameEditTitle: title,
      nicknameEditTip: tip,
      nicknamePlaceholder: placeholder
    });
  },
  onNicknameInput(event) {
    this.setData({ draftNickName: event.detail.value });
  },
  cancelNickname() {
    this.setData({ editingName: false, draftNickName: "", nicknameFocus: false });
  },
  saveNickname() {
    const nickName = (this.data.draftNickName || "").trim();
    if (!nickName) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }
    this.saveUser({
      ...(this.data.userInfo || {}),
      nickName,
      avatarUrl: this.data.userInfo?.avatarUrl || ""
    });
  },
  chooseAvatar(event) {
    const avatarUrl = event.detail?.avatarUrl;
    if (!avatarUrl) return;
    this.setData({
      userInfo: {
        ...(this.data.userInfo || { nickName: "微信用户" }),
        avatarUrl
      }
    });
    this.uploadAvatar(avatarUrl);
  },
  uploadAvatar(filePath) {
    wx.showLoading({ title: "上传头像" });
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: "base64",
      success: (fileRes) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/uploads`,
          method: "POST",
          header: { "content-type": "application/json" },
          data: {
            kind: "avatar",
            filename: "avatar.jpg",
            contentType: "image/jpeg",
            base64: fileRes.data
          },
          success: (res) => {
            if (res.statusCode >= 400 || !res.data?.url) {
              wx.showToast({ title: res.data?.message || "头像上传失败", icon: "none" });
              return;
            }
            this.saveUser({
              nickName: this.data.userInfo?.nickName || "微信用户",
              avatarUrl: res.data.ossUrl || res.data.url
            });
          },
          fail: () => wx.showToast({ title: "头像上传失败", icon: "none" }),
          complete: () => wx.hideLoading()
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "头像读取失败", icon: "none" });
      }
    });
  },
  async checkIn() {
    if (this.data.checkedIn) {
      wx.showToast({ title: "今日已签到", icon: "none" });
      return;
    }
    const next = this.data.points + 5;
    wx.setStorageSync(POINTS_KEY, next);
    wx.setStorageSync(CHECKIN_KEY, todayKey());
    this.setData({ points: next, checkedIn: true });
    await this.saveUser({
      ...(this.data.userInfo || { nickName: "微信用户", avatarUrl: "" })
    });
    wx.showToast({ title: "签到 +5", icon: "success" });
  },
  logout() {
    wx.showModal({
      title: "提示",
      content: "确定要退出登录吗？",
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync("userInfo");
          this.setData({ userInfo: null, avatarText: "微", editingName: false });
          wx.showToast({ title: "已退出", icon: "none" });
        }
      }
    });
  },
  extractQrToken(raw = "") {
    const text = String(raw || "").trim();
    if (!text) return "";
    const matched = text.match(/qr-[0-9a-fA-F-]{20,}/);
    if (matched) return matched[0];
    try {
      const parsed = new URL(text);
      return parsed.searchParams.get("qrToken") || parsed.searchParams.get("token") || "";
    } catch (e) {
      return text.startsWith("qr-") ? text : "";
    }
  },
  scanQrLogin() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ["qrCode"],
      success: (res) => {
        const qrToken = this.extractQrToken(res.result);
        if (!qrToken) {
          wx.showToast({ title: "未识别到登录二维码", icon: "none" });
          return;
        }
        wx.navigateTo({ url: `/pages/auth/qr-login/index?qrToken=${encodeURIComponent(qrToken)}` });
      },
      fail: () => {
        wx.showToast({ title: "扫码已取消", icon: "none" });
      }
    });
  },
  goQrLogin() {
    wx.showActionSheet({
      itemList: ["扫一扫网页二维码", "手动输入登录码"],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.scanQrLogin();
        } else {
          wx.navigateTo({ url: "/pages/auth/qr-login/index" });
        }
      },
      fail: () => {}
    });
  }
});
